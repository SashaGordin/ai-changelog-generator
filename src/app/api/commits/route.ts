import { NextResponse } from "next/server";
import simpleGit from "simple-git";

export async function POST(request: Request) {
  try {
    const { repoPath } = await request.json();
    if (!repoPath || typeof repoPath !== "string") {
      return NextResponse.json(
        { error: "Valid repoPath is required" },
        { status: 400 }
      );
    }

    const git = simpleGit(repoPath);
    const log = await git.log({ maxCount: 50 }); // Last 50 commits
    const commits = log.all.map((commit) => ({
      message: commit.message,
      date: commit.date,
      hash: commit.hash,
    }));

    return NextResponse.json({ commits });
  } catch (error) {
    console.error("Error fetching commits:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}