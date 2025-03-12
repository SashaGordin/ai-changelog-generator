import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { changelogs, processedCommits, fileChanges } from "@/app/db/schema";
import type { ChangeType } from "../generate-changelog/route";

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

    // Save changelog and processed commits in a transaction
    const [newChangelog] = await db.transaction(async (tx) => {
      const [changelog] = await tx
        .insert(changelogs)
        .values({ title, content, type })
        .returning();

      // Store all processed commits with their stats
      await Promise.all(
        commits.map(async (commit: Commit) => {
          const [processedCommit] = await tx
            .insert(processedCommits)
            .values({
              hash: commit.hash,
              message: commit.message,
              date: new Date(commit.date),
              repoUrl: repoUrl,
              changelogId: changelog.id,
              stats: commit.stats,
            })
            .returning();

          // Store file changes for this commit
          await tx.insert(fileChanges).values(
            commit.files.map(file => ({
              commitId: processedCommit.id,
              path: file.path,
              additions: file.additions,
              deletions: file.deletions,
              patch: file.patch,
              component: file.component,
            }))
          );

          return processedCommit;
        })
      );

      return [changelog];
    });

    return NextResponse.json({ changelog: newChangelog });
  } catch (error) {
    console.error("Error submitting changelog:", error);
    const message = error instanceof Error ? error.message : "Failed to submit changelog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}