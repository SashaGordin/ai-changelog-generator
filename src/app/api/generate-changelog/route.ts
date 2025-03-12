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
        Generate 1-3 concise changelog entries for changes in the ${component} component.
        Focus on the actual code changes, considering:
        - Files modified: ${files.map(f => f.path).join(', ')}
        - Total changes: ${totalStats.additions} additions, ${totalStats.deletions} deletions

        For context, here are some of the changes:
        ${fileDetails.map(f => `${f.path}: ${f.changes}\nPatch preview: ${f.patch.slice(0, 200)}...`).join('\n\n')}

        Guidelines:
        - Each entry should be a single, impactful sentence
        - Start with an action verb (Added, Updated, Fixed, etc.)
        - Focus on user-facing changes and technical improvements
        - Be specific about what was changed
        - Don't use quotes in the response
        - Separate entries with newlines

        Example outputs:
        Added form validation to improve user input handling
        Updated API response caching for better performance
        Refactored database queries to reduce load times
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