import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { processedCommits } from "@/app/db/schema";
import { eq } from "drizzle-orm";
import { parseGitHubUrl } from "@/app/utils/github";
import { env } from "@/env";
import { Octokit } from "@octokit/rest";

const octokit = new Octokit({ auth: env.GITHUB_TOKEN });

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

    // Get commits from GitHub
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

    // Filter out already processed commits and format the response
    const newCommits = commits
      .filter(commit => !processedHashes.has(commit.sha))
      .map(commit => ({
        message: commit.commit.message,
        date: commit.commit.author?.date || new Date().toISOString(),
        hash: commit.sha,
      }));

    return NextResponse.json({ commits: newCommits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch commits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}