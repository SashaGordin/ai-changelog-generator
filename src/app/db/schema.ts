import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const changelogs = pgTable("changelogs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("Feature"),
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
});