"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChangeType } from "@/app/api/generate-changelog/route";

interface Commit {
  message: string;
  hash: string;
  date: string;
}

interface ChangelogDraft {
  title: string;
  content: string;
  date: string;
  type: ChangeType;
}

const changeTypes: ChangeType[] = ["Feature", "Update", "Fix", "Breaking", "Security"];

export default function DevPage() {
  const [repoPath, setRepoPath] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [changelogDraft, setChangelogDraft] = useState<ChangelogDraft | null>(null);
  const [editableChangelog, setEditableChangelog] = useState("");
  const [selectedType, setSelectedType] = useState<ChangeType>("Feature");
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(true);

  // Separate loading states
  const [isFetchingCommits, setIsFetchingCommits] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCommits = async () => {
    setIsFetchingCommits(true);
    setError(null);
    try {
      const res = await fetch("/api/commits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoPath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch commits");

      if (data.commits.length === 0) {
        toast.info("No new commits found to process", {
          description: "All commits have already been included in the changelog."
        });
      } else {
        toast.success(`Found ${data.commits.length} new commits to process`);
      }

      setCommits(data.commits);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsFetchingCommits(false);
    }
  };

  const generateChangelog = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commits, type: selectedType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate changelog");
      setChangelogDraft(data.changelog);
      setEditableChangelog(data.changelog.content);
      toast.success("Changelog generated successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const submitChangelog = async () => {
    if (!changelogDraft) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: editableChangelog,
          commits,
          repoPath,
          type: selectedType,
          date: changelogDraft.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit changelog");

      setCommits([]);
      setChangelogDraft(null);
      setEditableChangelog("");
      toast.success("Changelog submitted successfully!");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Changelog Generator</h1>

      <div className="mb-6">
        <label className="block mb-2 text-sm font-medium">
          Local Repository Path
        </label>
        <input
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          className="w-full p-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="/Users/Sasha/Dev/my-repo"
          disabled={isFetchingCommits}
        />
        <button
          onClick={fetchCommits}
          className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 relative"
          disabled={isFetchingCommits || !repoPath.trim()}
        >
          {isFetchingCommits ? (
            <>
              <span className="opacity-0">Fetch New Commits</span>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
              </div>
            </>
          ) : (
            "Fetch New Commits"
          )}
        </button>
      </div>

      {commits.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium">
              New Commits to Process
            </label>
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium">Type:</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as ChangeType)}
                className="p-2 border rounded-md shadow-sm text-sm"
                disabled={isGenerating}
              >
                {changeTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
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
            className="mt-3 w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 relative"
            disabled={isGenerating || commits.length === 0}
          >
            {isGenerating ? (
              <>
                <span className="opacity-0">Generate Changelog</span>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                </div>
              </>
            ) : (
              "Generate Changelog"
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {changelogDraft && (
        <div className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h2 className="text-xl font-semibold">{changelogDraft.title}</h2>
              <div className="flex items-center mt-2 space-x-2">
                <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 font-medium">
                  {selectedType}
                </span>
                {changelogDraft.date && (
                  <span className="text-sm text-gray-500">
                    {new Date(changelogDraft.date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => setIsPreview(!isPreview)}
                className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                disabled={isSubmitting}
              >
                {isPreview ? "Edit" : "Preview"}
              </button>
              <button
                onClick={submitChangelog}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-400 min-w-[100px] relative"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="opacity-0">Submit</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    </div>
                  </>
                ) : (
                  "Submit"
                )}
              </button>
            </div>
          </div>

          {isPreview ? (
            <div className="p-4 bg-gray-50 border rounded-md shadow-sm prose prose-sm max-w-none">
              {editableChangelog}
            </div>
          ) : (
            <textarea
              value={editableChangelog}
              onChange={(e) => setEditableChangelog(e.target.value)}
              className="w-full h-32 p-4 border rounded-md shadow-sm font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSubmitting}
            />
          )}
        </div>
      )}
    </div>
  );
}