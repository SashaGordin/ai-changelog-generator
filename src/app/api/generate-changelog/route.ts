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
      - Format introduction as regular text without bullet point
      - Each bullet point should describe one complete improvement
      - Format as "Area: specific improvement details"
      - Focus on concrete user benefits and improvements
      - Keep descriptions clear and user-focused
      - Include specific details about what was improved
      - Never use numbers or ordering
      - Start improvements with "- "

      Example outputs:
      Here is the breakdown of the technical changes made:

      - Commit detail enhancement: Added detailed tracking of file changes, additions, and deletions for better change visibility
      - Component organization: Improved grouping and categorization of changes by application area
      - Database improvements: Enhanced storage capabilities for detailed commit and file change information
      - Interface updates: Reorganized commit details display with component-based grouping and clear statistics

      Bad examples (avoid):
      - Starting bullet points with introductory text
      - Using numbers or sequential language
      - Adding concluding statements
      - Using technical implementation details
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