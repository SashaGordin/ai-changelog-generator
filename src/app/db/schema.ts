import { pgTable, serial, text, timestamp, integer, jsonb, boolean } from "drizzle-orm/pg-core";

export const changelogs = pgTable("changelogs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("Feature"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table for granular changelog entries
export const changelogEntries = pgTable("changelog_entries", {
  id: serial("id").primaryKey(),
  changelogId: serial("changelog_id").references(() => changelogs.id).notNull(),
  content: text("content").notNull(),
  component: text("component"), // UI, API, Database, etc.
  scope: text("scope"), // Frontend, Backend, Infrastructure, etc.
  impact: text("impact").default("minor"), // major, minor, patch
  isTechnical: boolean("is_technical").default(false),
  isUserFacing: boolean("is_user_facing").default(true),
  order: integer("order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const processedCommits = pgTable("processed_commits", {
  id: serial("id").primaryKey(),
  hash: text("hash").notNull().unique(),
  message: text("message").notNull(),
  date: timestamp("date").notNull(),
  repoUrl: text("repo_url").notNull(),
  changelogId: serial("changelog_id").references(() => changelogs.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  // New fields for enhanced commit data
  stats: jsonb("stats").$type<{
    totalAdditions: number;
    totalDeletions: number;
    filesChanged: number;
  }>(),
});

export const fileChanges = pgTable("file_changes", {
  id: serial("id").primaryKey(),
  commitId: serial("commit_id").references(() => processedCommits.id),
  path: text("file_path").notNull(),
  additions: integer("additions").notNull(),
  deletions: integer("deletions").notNull(),
  patch: text("patch").notNull(),
  component: text("component").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// New table to associate commits with specific changelog entries
export const entryCommitMap = pgTable("entry_commit_map", {
  id: serial("id").primaryKey(),
  entryId: serial("entry_id").references(() => changelogEntries.id).notNull(),
  commitId: serial("commit_id").references(() => processedCommits.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});