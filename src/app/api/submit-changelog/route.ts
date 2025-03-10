import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { changelogs, processedCommits } from "@/app/db/schema";
import { inArray } from "drizzle-orm";
import type { ChangeType } from "../generate-changelog/route";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

const validChangeTypes = ["Feature", "Update", "Fix", "Breaking", "Security"] as const;

export async function POST(request: Request) {
  try {
    const { content, commits, repoUrl, type, date } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Valid content is required" },
        { status: 400 }
      );
    }
    if (!Array.isArray(commits)) {
      return NextResponse.json(
        { error: "Commits must be an array" },
        { status: 400 }
      );
    }
    if (!repoUrl || typeof repoUrl !== "string") {
      return NextResponse.json(
        { error: "Valid GitHub repository URL is required" },
        { status: 400 }
      );
    }
    if (!type || !validChangeTypes.includes(type as ChangeType)) {
      return NextResponse.json(
        { error: "Valid change type is required" },
        { status: 400 }
      );
    }

    const title = new Date(date).toLocaleString('default', { month: 'long' }) + ", " + new Date(date).getFullYear();

    try {
      // Save changelog and processed commits in a transaction
      const [newChangelog] = await db.transaction(async (tx) => {
        // First, check which commits are already processed
        const commitHashes = commits.map(c => c.hash);
        const existingCommits = await tx
          .select({ hash: processedCommits.hash })
          .from(processedCommits)
          .where(inArray(processedCommits.hash, commitHashes));

        const existingHashes = new Set(existingCommits.map(c => c.hash));
        const newCommits = commits.filter(commit => !existingHashes.has(commit.hash));

        // If all commits are already processed, return an error
        if (newCommits.length === 0) {
          console.log("All commits have already been processed");
          throw new Error("All commits have already been processed");
        }

        const [changelog] = await tx
          .insert(changelogs)
          .values({ title, content, type })
          .returning();

        // Store only new commits
        await tx.insert(processedCommits).values(
          newCommits.map((commit: Commit) => ({
            hash: commit.hash,
            message: commit.message,
            date: new Date(commit.date),
            repoUrl: repoUrl,
            changelogId: changelog.id,
          }))
        );

        return [changelog];
      });

      return NextResponse.json({ changelog: newChangelog });
    } catch (dbError) {
      console.error("Database error:", dbError);
      throw new Error(`Database operation failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Error submitting changelog:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}