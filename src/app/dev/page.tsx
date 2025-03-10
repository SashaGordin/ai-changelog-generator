"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function DevPage() {
  const [repoPath, setRepoPath] = useState("");
  const [commits, setCommits] = useState<any[]>([]);
  const [changelog, setChangelog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCommits = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch commits");
      setCommits(data.commits);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const generateChangelog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      setChangelog(data.changelog.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Changelog Generator</h1>

      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium text-gray-700">
          Local Repository Path
        </label>
        <input
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          className="w-full p-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="/Users/Sasha/Dev/my-repo"
          disabled={loading}
        />
        <button
          onClick={fetchCommits}
          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400"
          disabled={loading}
        >
          {loading ? "Fetching..." : "Fetch Commits"}
        </button>
      </div>

      {commits.length > 0 && (
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Commits (Edit as Needed)
          </label>
          <textarea
            value={commits.map((c) => c.message).join("\n")}
            onChange={(e) =>
              setCommits(e.target.value.split("\n").map((msg) => ({ message: msg })))
            }
            className="w-full p-3 border rounded-md shadow-sm h-40 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            onClick={generateChangelog}
            className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400"
            disabled={loading || commits.length === 0}
          >
            {loading ? "Generating..." : "Generate Changelog"}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {changelog && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-3 text-gray-800">Changelog Preview</h2>
          <div className="p-4 bg-gray-50 border rounded-md shadow-sm">
            <ReactMarkdown>{changelog}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}