import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/env";

interface Commit {
  message: string;
  hash: string;
  date: string;
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
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message.content || "";

    return NextResponse.json({
      changelog: {
        content,
        title: `Changelog ${new Date().toISOString().split("T")[0]}`
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