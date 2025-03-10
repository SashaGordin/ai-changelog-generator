import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { changelogs, processedCommits } from "@/app/db/schema";
import type { ChangeType } from "../generate-changelog/route";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

const validChangeTypes = ["Feature", "Update", "Fix", "Breaking", "Security"] as const;

export async function POST(request: Request) {
  try {
    const { content, commits, repoPath, type, date } = await request.json();

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
    if (!repoPath || typeof repoPath !== "string") {
      return NextResponse.json(
        { error: "Valid repoPath is required" },
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

    // Save changelog and processed commits in a transaction
    const [newChangelog] = await db.transaction(async (tx) => {
      const [changelog] = await tx
        .insert(changelogs)
        .values({ title, content, type })
        .returning();

      // Store all processed commits
      await tx.insert(processedCommits).values(
        commits.map((commit: Commit) => ({
          hash: commit.hash,
          message: commit.message,
          date: new Date(commit.date),
          repoPath,
          changelogId: changelog.id,
        }))
      );

      return [changelog];
    });

    return NextResponse.json({ changelog: newChangelog });
  } catch (error) {
    console.error("Error submitting changelog:", error);
    return NextResponse.json(
      { error: "Failed to submit changelog" },
      { status: 500 }
    );
  }
}