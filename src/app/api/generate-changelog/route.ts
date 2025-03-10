import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/app/db";
import { changelogs } from "@/app/db/schema";
import { env } from "@/env";

interface Commit {
  message: string;
  // Add other commit properties if needed
}

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { commits } = await request.json();
    if (!Array.isArray(commits)) {
      return NextResponse.json(
        { error: "Commits must be an array" },
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
      model: "gpt-4o-mini", // Or "gpt-3.5-turbo" if preferred
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const changelogContent = completion.choices[0]?.message.content || "";
    const title = `Changelog ${new Date().toISOString().split("T")[0]}`;

    // Save to Supabase
    const [newChangelog] = await db
      .insert(changelogs)
      .values({ title, content: changelogContent })
      .returning();

    return NextResponse.json({ changelog: newChangelog });
  } catch (error) {
    console.error("Error generating changelog:", error);
    return NextResponse.json(
      { error: "Failed to generate changelog" },
      { status: 500 }
    );
  }
}