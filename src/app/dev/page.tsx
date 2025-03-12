"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ChangeType } from "@/app/api/generate-changelog/route";
import SwitchViewButton from "@/app/components/SwitchViewButton";

interface FileChange {
  path: string;
  additions: number;
  deletions: number;
  patch: string;
  component: string;
}

interface CommitStats {
  totalAdditions: number;
  totalDeletions: number;
  filesChanged: number;
}

interface Commit {
  message: string;
  hash: string;
  date: string;
  files: FileChange[];
  stats: CommitStats;
}

interface ChangelogEntry {
  component: string;
  changes: string[];
}

interface ChangelogDraft {
  title: string;
  entries: ChangelogEntry[];
  date: string;
  type: ChangeType;
}

const changeTypes: ChangeType[] = ["Feature", "Update", "Fix", "Breaking", "Security"];

export default function DevPage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [changelogDraft, setChangelogDraft] = useState<ChangelogDraft | null>(null);
  const [selectedType, setSelectedType] = useState<ChangeType>("Feature");
  const [error, setError] = useState<string | null>(null);
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
        body: JSON.stringify({ repoUrl }),
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
      const content = changelogDraft.entries
        .map(entry => {
          return `## ${entry.component}\n${entry.changes.map(change => `- ${change}`).join('\n')}`;
        })
        .join('\n\n');

      const res = await fetch("/api/submit-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          commits,
          repoUrl,
          type: selectedType,
          date: changelogDraft.date,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit changelog");

      setCommits([]);
      setChangelogDraft(null);
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
    <>
      <SwitchViewButton />
      <div className="px-6 pt-24 max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Changelog Generator</h1>

        <div className="mb-6">
          <label className="block mb-2 text-sm font-medium">
            GitHub Repository URL
          </label>
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="w-full p-3 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://github.com/username/repository"
            disabled={isFetchingCommits}
          />
          <button
            onClick={fetchCommits}
            className="mt-3 w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-400 relative"
            disabled={isFetchingCommits || !repoUrl.trim()}
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
                <div key={commit.hash} className="mb-6 last:mb-0 border-b pb-4 last:border-b-0">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="text-sm text-gray-600">{new Date(commit.date).toLocaleString()}</div>
                      <div className="text-gray-800 font-medium">{commit.message}</div>
                    </div>
                    <div className="text-xs text-gray-500 space-y-1">
                      <div>Files Changed: {commit.stats.filesChanged}</div>
                      <div className="text-green-600">+{commit.stats.totalAdditions}</div>
                      <div className="text-red-600">-{commit.stats.totalDeletions}</div>
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {Object.entries(
                      commit.files.reduce((acc, file) => {
                        if (!acc[file.component]) acc[file.component] = [];
                        acc[file.component].push(file);
                        return acc;
                      }, {} as Record<string, FileChange[]>)
                    ).map(([component, files]) => (
                      <div key={component} className="text-sm">
                        <div className="font-medium text-gray-700 mb-1">
                          {component.charAt(0).toUpperCase() + component.slice(1)}
                        </div>
                        <div className="space-y-1 ml-4">
                          {files.map((file) => (
                            <div key={file.path} className="text-gray-600 flex items-center gap-2">
                              <span className="truncate flex-1">{file.path}</span>
                              <span className="text-xs whitespace-nowrap">
                                <span className="text-green-600">+{file.additions}</span>
                                {" / "}
                                <span className="text-red-600">-{file.deletions}</span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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
              <SwitchViewButton />
            </div>

            <div className="prose max-w-none">
              {changelogDraft.entries.map((entry, index) => (
                <div key={index} className="mb-6">
                  <h3 className="text-lg font-medium mb-2 text-gray-800">
                    {entry.component.charAt(0).toUpperCase() + entry.component.slice(1)}
                  </h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {entry.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="text-gray-700">
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={submitChangelog}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-400 relative"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="opacity-0">Submit Changelog</span>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    </div>
                  </>
                ) : (
                  "Submit Changelog"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}