import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { changelogs, processedCommits, fileChanges, changelogEntries, entryCommitMap } from "@/app/db/schema";
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

// New interface for changelog entries
interface ChangelogEntry {
  content: string;
  component?: string;
  scope?: string;
  impact?: string;
  isTechnical?: boolean;
  isUserFacing?: boolean;
  order?: number;
  labels?: string;
}

const validChangeTypes = ["Feature", "Update", "Fix", "Breaking", "Security"] as const;

export async function POST(request: Request) {
  try {
    const { entries, content, commits, repoUrl, type, date } = await request.json();

    // Check if we're receiving individual entries or legacy content
    const hasEntries = Array.isArray(entries) && entries.length > 0;

    if (!hasEntries && (!content || typeof content !== "string")) {
      return NextResponse.json(
        { error: "Either entries array or valid content is required" },
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

    // Process entries from either individual entries or split content
    const changelogEntriesToInsert: ChangelogEntry[] = hasEntries
      ? entries
      : content
          .split('\n')
          .filter((line: string) => line.trim())
          .map((line: string, index: number) => ({
            content: line,
            order: index,
            component: detectComponent(line),
            scope: detectScope(line),
            impact: detectImpact(line),
            isTechnical: false,
            isUserFacing: true
          }));

    // Save changelog, entries, and processed commits in a transaction
    const [newChangelog] = await db.transaction(async (tx) => {
      // Insert main changelog
      const [changelog] = await tx
        .insert(changelogs)
        .values({
          title,
          // Keep legacy content field for backward compatibility
          content: changelogEntriesToInsert.map(e => e.content).join('\n'),
          type
        })
        .returning();

      // Insert individual changelog entries
      const insertedEntries = await Promise.all(
        changelogEntriesToInsert.map(async (entry, index) => {
          const [insertedEntry] = await tx
            .insert(changelogEntries)
            .values({
              changelogId: changelog.id,
              content: entry.content,
              component: entry.component,
              scope: entry.scope,
              impact: entry.impact || "minor",
              isTechnical: entry.isTechnical || false,
              isUserFacing: entry.isUserFacing || true,
              order: entry.order || index,
              labels: entry.labels
            })
            .returning();
          return insertedEntry;
        })
      );

      // Store all processed commits with their stats
      const processedCommitsMap = new Map();

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

          processedCommitsMap.set(commit.hash, processedCommit);

          // Store file changes for this commit
          if (commit.files && commit.files.length > 0) {
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
          }

          return processedCommit;
        })
      );

      // Link entries to commits
      // For each entry, determine which commits are relevant
      // For now, we'll link all commits to all entries as a simple approach
      await Promise.all(
        insertedEntries.map(async entry => {
          await Promise.all(
            Array.from(processedCommitsMap.values()).map(async commit => {
              await tx.insert(entryCommitMap).values({
                entryId: entry.id,
                commitId: commit.id
              });
            })
          );
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