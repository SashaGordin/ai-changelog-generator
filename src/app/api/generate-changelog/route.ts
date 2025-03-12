import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/env";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
  component: string;
}

interface CommitStats {
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: number;
}

interface Commit {
  message: string;
  hash: string;
  date: string;
  files: FileChange[];
  stats: CommitStats;
}

export type ChangeType = "Feature" | "Update" | "Fix" | "Breaking" | "Security";

interface ChangelogEntry {
  component: string;
  changes: string[];
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Group files by component
function groupFilesByComponent(commits: Commit[]): Record<string, FileChange[]> {
  const componentGroups: Record<string, FileChange[]> = {};

  for (const commit of commits) {
    for (const file of commit.files) {
      if (!componentGroups[file.component]) {
        componentGroups[file.component] = [];
      }
      componentGroups[file.component].push(file);
    }
  }

  return componentGroups;
}

export async function POST(request: Request) {
  try {
    const { commits, type } = await request.json();
    if (!Array.isArray(commits)) {
      return NextResponse.json(
        { error: "Commits must be an array" },
        { status: 400 }
      );
    }

    const componentGroups = groupFilesByComponent(commits);
    const entries: ChangelogEntry[] = [];

    // Generate changelog entries for each component
    for (const [component, files] of Object.entries(componentGroups)) {
      const totalStats = files.reduce(
        (acc, file) => ({
          additions: acc.additions + file.additions,
          deletions: acc.deletions + file.deletions,
        }),
        { additions: 0, deletions: 0 }
      );

      const fileDetails = files.map(file => ({
        path: file.path,
        changes: `${file.additions} additions, ${file.deletions} deletions`,
        patch: file.patch
      }));

      const prompt = `
        Generate 1-2 high-level changelog entries for changes in the ${component} component.
        Instead of describing specific file changes, focus on the overall impact to the application and its users.
        Consider these technical changes:
        - Files modified: ${files.map(f => f.path).join(', ')}
        - Total changes: ${totalStats.additions} additions, ${totalStats.deletions} deletions

        Guidelines:
        - Focus on business value and user impact
        - Describe improvements to functionality, performance, or user experience
        - Use clear, non-technical language
        - Start with an action verb (Enhanced, Improved, Streamlined, etc.)
        - Combine related technical changes into single, meaningful updates
        - Don't mention specific files or technical implementations
        - Don't use quotes in the response
        - Separate entries with newlines

        Example outputs:
        Enhanced search performance with improved indexing and caching
        Streamlined user onboarding process with simplified form validation
        Improved dashboard loading speed and real-time updates

        Technical changes to summarize:
        ${fileDetails.map(f => `${f.path}: ${f.changes}`).join('\n')}
      `;

      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 500,
        temperature: 0.7,
      });

      const changes = completion.choices[0]?.message.content
        ?.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/['"]/g, '')) || [];

      if (changes.length > 0) {
        entries.push({
          component,
          changes
        });
      }
    }

    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    return NextResponse.json({
      changelog: {
        title: `${month}, ${year}`,
        date: date.toISOString(),
        type: type || "Feature",
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