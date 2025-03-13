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

    // Log important data for debugging
    console.log("Generate Changelog - Request received");
    console.log(`Commits count: ${commits.length}`);
    console.log(`Change type: ${type}`);

    try {
      // Combine all file changes for a holistic view
      const allFiles = commits.flatMap(commit => commit.files || []);
      console.log(`Total files to analyze: ${allFiles.length}`);

      // Extract commit messages for better context
      const commitMessages = commits.map(commit => commit.message).filter(Boolean);
      console.log(`Extracted ${commitMessages.length} commit messages`);

      const fileDetails = allFiles.map(file => ({
        path: file.path,
        changes: `${file.additions} additions, ${file.deletions} deletions`,
        patch: file.patch ? (file.patch.length > 500 ? file.patch.substring(0, 500) + '...' : file.patch) : ''
      }));

      // Analyze components from file paths
      const components = new Set<string>();
      for (const file of allFiles) {
        if (!file.path) continue;
        if (file.path.includes('/components/')) components.add('UI');
        else if (file.path.includes('/api/')) components.add('API');
        else if (file.path.includes('/db/')) components.add('Database');
        else if (file.path.includes('/auth/')) components.add('Security');
      }

      console.log("Preparing OpenAI prompt");
      const prompt = `
        I need you to create a concise, user-friendly changelog entry based on these code changes.

        CONTEXT (Technical details for reference only - DO NOT mention these in the output):
        COMMIT MESSAGES:
        ${commitMessages.map((msg, i) => `${i+1}. ${msg}`).join('\n')}

        MODIFIED FILES:
        ${fileDetails.map(f => `File: ${f.path} (${f.changes})`).join('\n')}

        CODE PATCHES (samples):
        ${fileDetails.filter(f => f.patch).slice(0, 5).map(f => `--- ${f.path} ---\n${f.patch}`).join('\n\n')}

        YOUR TASK:
        Create a simple changelog entry that accurately describes ONLY the changes that were actually made in the commits above.
        ACCURACY is more important than quantity - do NOT add features or changes that aren't specifically indicated in the commit data.
        Focus ONLY on changes that impact how users interact with the application.

        CRITICAL INSTRUCTIONS:
        - It's better to mention fewer changes than to make up changes that weren't made
        - DO NOT invent features like "improved search" unless the commits clearly show search improvements
        - If the commits only show UI adjustments, then only mention UI adjustments
        - If there are fewer than 3 meaningful changes, that's fine - quality over quantity

        REQUIRED FORMAT:
        1. **Bold Title**: A 3-5 word title that captures the essence of the change

        2. One SHORT paragraph (2-3 sentences maximum) explaining what changed in simple,
           non-technical language. Focus on what users can now do or how their experience improved.

        3. "What's the Impact?" section with 1-3 bullet points highlighting the specific benefits to users.
           Each bullet should be a single sentence, focused on outcomes, not implementation.
           ONLY include benefits that directly relate to changes in the commits.

        IMPORTANT GUIDELINES:
        - Use everyday language anyone can understand
        - Focus 100% on user benefits and experience changes
        - NEVER mention technical implementation details (code, libraries, etc.)
        - Be extremely concise - most users only scan changelogs
        - Only describe changes that are actually present in the commit data

        GOOD EXAMPLE:
        **Faster Search Results**

        We've improved how search works across the platform. Results now appear more quickly and are more relevant to what you're looking for.

        What's the Impact?
        Search results appear as you type, saving you time
        More accurate matches put what you need at the top of the list
        Historical content is now included in search results

        BAD EXAMPLE (INACCURATE):
        **Complete UI Overhaul**

        We've redesigned the entire interface with a fresh look and feel. The application now includes dark mode, improved search, and a new dashboard.

        What's the Impact?
        The new interface is more modern and professional looking
        Dark mode reduces eye strain when working at night
        New dashboard gives you quick access to all features in one place

        (This would be BAD if the commits only showed minor UI tweaks to one component)
        `;

      console.log("Calling OpenAI API");
      let entries: ChangelogEntry[] = [];
      let changes: string[] = [];

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000, // Increased token limit for more detailed response
          temperature: 0.7,
        });
        console.log("OpenAI API response received");

        // The content will be a formatted changelog entry
        const generatedContent = completion.choices[0]?.message.content?.trim() || "";
        console.log("Generated changelog content");

        // Create a single entry with the complete content
        entries = [{
          content: generatedContent,
          order: 0,
          component: detectComponent(generatedContent),
          scope: detectScope(generatedContent),
          impact: detectImpact(generatedContent),
          isTechnical: false,
          isUserFacing: true
        }];

        changes = [generatedContent];
      } catch (openaiError) {
        console.error("Error with OpenAI API:", openaiError);

        // Fallback for testing: generate mock entries without calling OpenAI
        console.log("Using fallback mock generation for testing");

        // Create a more simplified mock entry for testing
        const mockEntry = `**UI Layout Improvements**

We've adjusted the layout of several UI elements to create a more logical flow. The repositioning of elements makes the application more intuitive to navigate.

**What's the Impact?**
Related UI elements are now grouped together for easier access
The most important controls are more prominently displayed`;

        entries = [{
          content: mockEntry,
          order: 0,
          component: "User Experience",
          scope: "Frontend",
          impact: "minor",
          isTechnical: false,
          isUserFacing: true
        }];

        changes = [mockEntry];
      }

      const date = new Date();
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();

      console.log("Sending response with", entries.length, "entries");
      return NextResponse.json({
        changelog: {
          title: `${month}, ${year}`,
          date: date.toISOString(),
          type: type || "Feature",
          changes,
          entries
        }
      });
    } catch (innerError) {
      console.error("Inner error in generate-changelog:", innerError);
      if (innerError instanceof Error) {
        console.error("Stack trace:", innerError.stack);
      }
      throw innerError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error("Error generating changelog:", error);
    if (error instanceof Error) {
      console.error("Stack trace:", error.stack);
      return NextResponse.json(
        { error: `Failed to generate changelog: ${error.message}` },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate changelog" },
      { status: 500 }
    );
  }
}

// Helper functions to detect metadata from entry content
function detectComponent(content: string): string | undefined {
  const lowerContent = content.toLowerCase();

  // Product features
  if (lowerContent.includes('analytics') || lowerContent.includes('stats') || lowerContent.includes('metrics'))
    return 'Analytics';
  if (lowerContent.includes('auth') || lowerContent.includes('login') || lowerContent.includes('sign in'))
    return 'Authentication';
  if (lowerContent.includes('api') || lowerContent.includes('integration') || lowerContent.includes('connect'))
    return 'API Integration';
  if (lowerContent.includes('content') || lowerContent.includes('editor') || lowerContent.includes('cms'))
    return 'Content Management';
  if (lowerContent.includes('dashboard'))
    return 'Dashboards';
  if (lowerContent.includes('visualiz') || lowerContent.includes('chart') || lowerContent.includes('graph'))
    return 'Data Visualization';
  if (lowerContent.includes('email') || lowerContent.includes('notification') || lowerContent.includes('alert'))
    return 'Email Notifications';
  if (lowerContent.includes('filter') || lowerContent.includes('sort') || lowerContent.includes('search'))
    return 'Filtering';
  if (lowerContent.includes('performance') || lowerContent.includes('speed') || lowerContent.includes('optimize'))
    return 'Performance Optimization';
  if (lowerContent.includes('report') || lowerContent.includes('export'))
    return 'Reporting';
  if (lowerContent.includes('search'))
    return 'Search';
  if (lowerContent.includes('security') || lowerContent.includes('protect') || lowerContent.includes('privacy'))
    return 'Security Features';
  if (lowerContent.includes('user experience') || lowerContent.includes('ux') || lowerContent.includes('workflow'))
    return 'User Experience';
  if (lowerContent.includes('ui') || lowerContent.includes('interface') || lowerContent.includes('display'))
    return 'User Interface';

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