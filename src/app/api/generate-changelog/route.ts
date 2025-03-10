import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/app/db";
import { changelogs, processedCommits } from "@/app/db/schema";
import { env } from "@/env";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { commits, repoPath } = await request.json();
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

    const commitMessages = commits.map((c: Commit) => c.message).join("\n");

    const prompt = `
      Summarize these git commits into a concise changelog for end-users.
      Focus on user-facing changes, ignore internal refactors unless impactful.
      Format as markdown bullet points.
      Commits:
      ${commitMessages}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4", // Fixed the model name
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const changelogContent = completion.choices[0]?.message.content || "";
    const title = `Changelog ${new Date().toISOString().split("T")[0]}`;

    // Save changelog and processed commits in a transaction
    const [newChangelog] = await db.transaction(async (tx) => {
      const [changelog] = await tx
        .insert(changelogs)
        .values({ title, content: changelogContent })
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
    console.error("Error generating changelog:", error);
    return NextResponse.json(
      { error: "Failed to generate changelog" },
      { status: 500 }
    );
  }
}