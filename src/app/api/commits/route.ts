import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { processedCommits } from "@/app/db/schema";
import { eq } from "drizzle-orm";
import { parseGitHubUrl } from "@/app/utils/github";
import { env } from "@/env";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

// Helper function to determine component from file path
function determineComponent(filePath: string): string {
  if (filePath.startsWith('src/app/api/')) return 'api';
  if (filePath.startsWith('src/app/components/')) return 'ui';
  if (filePath.startsWith('src/app/db/')) return 'database';
  if (filePath.includes('test') || filePath.includes('spec')) return 'tests';
  if (filePath.endsWith('.css') || filePath.endsWith('.scss')) return 'styles';
  if (filePath.includes('types') || filePath.endsWith('.d.ts')) return 'types';
  if (filePath.startsWith('docs/')) return 'documentation';
  return 'other';
}

export async function POST(request: Request) {
  try {
    const { repoUrl } = await request.json();
    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Valid GitHub repository URL is required" },
        { status: 400 }
      );
    }

    const { owner, repo } = parseGitHubUrl(repoUrl);

    // Get basic commit list
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      per_page: 50,
    });

    // Get processed commit hashes for this repo
    const processed = await db
      .select({ hash: processedCommits.hash })
      .from(processedCommits)
      .where(eq(processedCommits.repoUrl, repoUrl));

    const processedHashes = new Set(processed.map(p => p.hash));

    // Filter out processed commits
    const newCommits = commits.filter(commit => !processedHashes.has(commit.sha));

    // Fetch detailed information for each new commit
    const enhancedCommits = await Promise.all(
      newCommits.map(async (commit) => {
        // Get detailed commit data including diff
        const { data: detail } = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: commit.sha,
        });

        // Process file changes
        const files = detail.files?.map(file => ({
          path: file.filename,
          additions: file.additions,
          deletions: file.deletions,
          patch: file.patch || '',
          component: determineComponent(file.filename),
        })) || [];

        // Calculate stats
        const stats = {
          totalAdditions: files.reduce((sum, file) => sum + file.additions, 0),
          totalDeletions: files.reduce((sum, file) => sum + file.deletions, 0),
          filesChanged: files.length,
        };

        return {
          hash: commit.sha,
          message: commit.commit.message,
          date: commit.commit.author?.date || new Date().toISOString(),
          files,
          stats,
        };
      })
    );

    return NextResponse.json({
      commits: enhancedCommits,
      totalCommits: enhancedCommits.length,
    });
  } catch (error) {
    console.error("Error fetching commits:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch commits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}