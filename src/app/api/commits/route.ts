import { NextResponse } from "next/server";
import simpleGit from "simple-git";
import { db } from "@/app/db";
import { processedCommits } from "@/app/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const { repoPath } = await request.json();
    if (!repoPath || typeof repoPath !== "string") {
      return NextResponse.json(
        { error: "Valid repoPath is required" },
        { status: 400 }
      );
    }

    const git = simpleGit(repoPath);
    const log = await git.log({ maxCount: 50 }); // Last 50 commits

    // Get all processed commit hashes for this repo
    const processed = await db
      .select({ hash: processedCommits.hash })
      .from(processedCommits)
      .where(eq(processedCommits.repoPath, repoPath));

    const processedHashes = new Set(processed.map(p => p.hash));

    // Filter out already processed commits
    const commits = log.all
      .filter(commit => !processedHashes.has(commit.hash))
      .map((commit) => ({
        message: commit.message,
        date: commit.date,
        hash: commit.hash,
      }));

    return NextResponse.json({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}