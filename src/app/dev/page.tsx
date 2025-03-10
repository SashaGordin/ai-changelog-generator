"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

export default function DevPage() {
  const [repoPath, setRepoPath] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [changelog, setChangelog] = useState("");
  const [editableChangelog, setEditableChangelog] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(true);

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
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
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
        body: JSON.stringify({ commits, repoPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      const content = data.changelog.content;
      setChangelog(content);
      setEditableChangelog(content);
      toast.success("Changelog generated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const submitChangelog = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/submit-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editableChangelog,
          commits,
          repoPath,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit changelog");

      setCommits([]);
      setChangelog("");
      setEditableChangelog("");
      toast.success("Changelog submitted successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
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
          {loading ? "Fetching..." : "Fetch New Commits"}
        </button>
      </div>

      {commits.length > 0 && (
        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium text-gray-700">
            New Commits to Process
          </label>
          <div className="border rounded-md shadow-sm bg-gray-50 p-4 max-h-60 overflow-y-auto">
            {commits.map((commit) => (
              <div key={commit.hash} className="mb-3 last:mb-0">
                <div className="text-sm text-gray-600">{new Date(commit.date).toLocaleString()}</div>
                <div className="text-gray-800">{commit.message}</div>
              </div>
            ))}
          </div>
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
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-xl font-semibold text-gray-800">Changelog Preview</h2>
            <div className="space-x-2">
              <button
                onClick={() => setIsPreview(!isPreview)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                {isPreview ? "Edit" : "Preview"}
              </button>
              <button
                onClick={submitChangelog}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                disabled={loading}
              >
                {loading ? "Submitting..." : "Submit Changelog"}
              </button>
            </div>
          </div>

          {isPreview ? (
            <div className="p-4 bg-gray-50 border rounded-md shadow-sm">
              <ReactMarkdown>{editableChangelog}</ReactMarkdown>
            </div>
          ) : (
            <textarea
              value={editableChangelog}
              onChange={(e) => setEditableChangelog(e.target.value)}
              className="w-full h-64 p-4 border rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
          )}
        </div>
      )}
    </div>
  );
}