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
      Create a concise, impactful changelog entry from these commits.
      The entry should be a single, cohesive summary of the overall changes, not a list of individual commits.
      Focus on the user impact and value delivered.

      Format the response as a single paragraph without bullet points.
      Start with an action verb like "Added", "Updated", "Released", "Launched", etc.
      Keep technical details minimal unless they're important for users.
      Make it easy for non-technical users to understand.

      Example format:
      "Released a research preview of GPT-4.5—our largest and most capable chat model yet. GPT-4.5's high "EQ" and understanding of user intent make it better at creative tasks and agentic planning."

      Commits to summarize:
      ${commitMessages}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
    });

    const content = completion.choices[0]?.message.content || "";
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