import { NextResponse } from "next/server";
import OpenAI from "openai";
import { env } from "@/env";

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

    // Combine all file changes for a holistic view
    const allFiles = commits.flatMap(commit => commit.files);
    const fileDetails = allFiles.map(file => ({
      path: file.path,
      changes: `${file.additions} additions, ${file.deletions} deletions`,
      patch: file.patch
    }));

    const prompt = `
      Technical changes to analyze:
      ${fileDetails.map(f => `
      Changes: ${f.changes}
      Diff preview:
      ${f.patch}`).join('\n\n')}

      Guidelines:
      - Write natural, concise descriptions of user-facing improvements
      - Focus on what the change means for users, not how it was implemented
      - Keep entries brief - one simple sentence per improvement is ideal
      - Avoid technical terms, code references, and implementation details
      - Never use "first," "second," or numbered points
      - Write in a consistent tense (preferably present)
      - Each entry should stand alone and make sense by itself
      - Start each entry with "- "

      Example outputs:
      - Added real-time preview for a better editing experience
      - Improved organization of changes by component
      - Fixed loading issues for faster performance
      - Simplified the changelog submission process
      - Added visual indicators for file changes

      Bad examples (avoid):
      - Fixed bug in the FileChange interface implementation
      - First, we improved error handling in the API
      - Modified the database schema to support new features
      - Enhanced the UI by refactoring the React components
      `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
    });

    const changes = completion.choices[0]?.message.content
      ?.split('\n')
      .filter(line => line.trim())
      .map(line => line.replace(/['"]/g, '')) || [];

    const date = new Date();
    const month = date.toLocaleString('default', { month: 'long' });
    const year = date.getFullYear();

    return NextResponse.json({
      changelog: {
        title: `${month}, ${year}`,
        date: date.toISOString(),
        type: type || "Feature",
        changes: changes.map(change =>
          change.startsWith('- ') ? change : `- ${change}`
        )
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