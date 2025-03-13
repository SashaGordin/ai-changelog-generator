import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/env";

export type ChangeType = "Feature" | "Update" | "Fix" | "Breaking" | "Security";

// Define interfaces for enhanced entries
export interface ChangelogEntry {
  content: string;
  component?: string;
  scope?: string;
  impact?: string;
  isTechnical?: boolean;
  isUserFacing?: boolean;
  order?: number;
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { commits, type } = await request.json();
    if (!Array.isArray(commits)) {
      return NextResponse.json(
        { error: "Commits must be an array" },
        { status: 400 }
      );
    }

    // Combine all file changes for a holistic view
    const allFiles = commits.flatMap(commit => commit.files);
    const fileDetails = allFiles.map(file => ({
      path: file.path,
      changes: `${file.additions} additions, ${file.deletions} deletions`,
      patch: file.patch
    }));

    // Analyze components from file paths
    const components = new Set<string>();
    for (const file of allFiles) {
      if (file.path.includes('/components/')) components.add('UI');
      else if (file.path.includes('/api/')) components.add('API');
      else if (file.path.includes('/db/')) components.add('Database');
      else if (file.path.includes('/auth/')) components.add('Security');
    }

    const prompt = `
      Technical changes to analyze:
      ${fileDetails.map(f => `
      Changes: ${f.changes}
      Diff preview:
      ${f.patch}`).join('\n\n')}

      Guidelines:
      - Write natural, concise descriptions of user-facing improvements
      - Focus on what the change means for users, not how it was implemented
      - Keep entries brief - one simple sentence per improvement is ideal
      - Avoid technical terms, code references, and implementation details
      - Never use "first," "second," or numbered points
      - Write in a consistent tense (preferably present)
      - Each entry should stand alone and make sense by itself
      - Start each entry with "- "

      Example outputs:
      - Added real-time preview for a better editing experience
      - Improved organization of changes by component
      - Fixed loading issues for faster performance
      - Simplified the changelog submission process
      - Added visual indicators for file changes

      Bad examples (avoid):
      - Fixed bug in the FileChange interface implementation
      - First, we improved error handling in the API
      - Modified the database schema to support new features
      - Enhanced the UI by refactoring the React components
      `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const rawChanges = completion.choices[0]?.message.content
      ?.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/['"]/g, '')) || [];

    // Process changes into enhanced entries with metadata
    const entries: ChangelogEntry[] = rawChanges.map((change, index) => {
      const content = change.startsWith('- ') ? change : `- ${change}`;

      // Attempt to infer metadata from content
      return {
        content,
        order: index,
        component: detectComponent(content),
        scope: detectScope(content),
        impact: detectImpact(content),
        isTechnical: content.toLowerCase().includes('technical') ||
                     content.toLowerCase().includes('performance'),
        isUserFacing: !content.toLowerCase().includes('internal') &&
                     !content.toLowerCase().includes('refactor')
      };
    });

    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    return NextResponse.json({
      changelog: {
        title: `${month}, ${year}`,
        date: date.toISOString(),
        type: type || "Feature",
        changes: rawChanges.map(change =>
          change.startsWith('- ') ? change : `- ${change}`
        ),
        // New field containing enhanced entries
        entries
      }
    });
  } catch (error) {
    console.error("Error generating changelog:", error);
    return NextResponse.json(
      { error: "Failed to generate changelog" },
      { status: 500 }
    );
  }
}

// Helper functions to detect metadata from entry content
function detectComponent(content: string): string | undefined {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('ui') || lowerContent.includes('interface') || lowerContent.includes('display'))
    return 'UI';
  if (lowerContent.includes('api') || lowerContent.includes('endpoint'))
    return 'API';
  if (lowerContent.includes('database') || lowerContent.includes('schema') || lowerContent.includes('storage'))
    return 'Database';
  if (lowerContent.includes('security') || lowerContent.includes('auth'))
    return 'Security';
  if (lowerContent.includes('performance') || lowerContent.includes('speed') || lowerContent.includes('optimize'))
    return 'Performance';

  return undefined;
}

function detectScope(content: string): string | undefined {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('frontend') || lowerContent.includes('ui') || lowerContent.includes('interface'))
    return 'Frontend';
  if (lowerContent.includes('backend') || lowerContent.includes('api') || lowerContent.includes('server'))
    return 'Backend';
  if (lowerContent.includes('database') || lowerContent.includes('schema'))
    return 'Database';
  if (lowerContent.includes('infra') || lowerContent.includes('deployment'))
    return 'Infrastructure';

  return undefined;
}

function detectImpact(content: string): string {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('major') || lowerContent.includes('significant') ||
      lowerContent.includes('redesign') || lowerContent.includes('overhaul'))
    return 'major';
  if (lowerContent.includes('bugfix') || lowerContent.includes('typo') ||
      lowerContent.includes('minor fix') || lowerContent.includes('small'))
    return 'patch';

  return 'minor'; // Default
}