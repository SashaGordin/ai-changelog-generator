CREATE TABLE "processed_commits" (
	"id" serial PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"message" text NOT NULL,
	"date" timestamp NOT NULL,
	"repo_path" text NOT NULL,
	"changelog_id" serial NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_commits_hash_unique" UNIQUE("hash")
);
--> statement-breakpoint
ALTER TABLE "processed_commits" ADD CONSTRAINT "processed_commits_changelog_id_changelogs_id_fk" FOREIGN KEY ("changelog_id") REFERENCES "public"."changelogs"("id") ON DELETE no action ON UPDATE no action;