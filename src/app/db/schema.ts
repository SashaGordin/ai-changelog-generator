import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const changelogs = pgTable("changelogs", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});