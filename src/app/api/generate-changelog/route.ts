import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/env";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

export type ChangeType = "Feature" | "Update" | "Fix" | "Breaking" | "Security";

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export async function POST(request: Request) {
  try {
    const { commits, type } = await request.json();
    if (!Array.isArray(commits)) {
      return NextResponse.json(
        { error: "Commits must be an array" },
        { status: 400 }
      );
    }

    const commitMessages = commits.map((c: Commit) => c.message).join("\n");

    const prompt = `
      Create a concise changelog entry summarizing the code changes represented by these commits.
      Focus on the actual changes to the codebase (what was added, modified, or removed) rather than just the commit messages.
      Write a single, impactful sentence that captures the main user-facing changes.
      Start with an action verb (Added, Updated, Released, Launched, Fixed, etc.).
      Keep it brief and focused on user value.
      Do not use quotes in the response.

      Example outputs:
      Added metadata field support to the API with new validation rules.
      Updated user authentication flow with improved security measures.
      Fixed data synchronization issues between client and server.

      Commit messages (representing code changes):
      ${commitMessages}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message.content?.replace(/['"]/g, '') || "";
    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    return NextResponse.json({
      changelog: {
        content,
        title: `${month}, ${year}`,
        date: date.toISOString(),
        type: type || "Feature"
      }
    });
  } catch (error) {
    console.error("Error generating changelog:", error);
    return NextResponse.json(
      { error: "Failed to generate changelog" },
      { status: 500 }
    );
  }
}