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

interface ChangelogDraft {
  title: string;
  date: string;
  type: ChangeType;
  changes: string[];
  entries?: {
    content: string;
    component?: string;
    scope?: string;
    impact?: string;
    isTechnical?: boolean;
    isUserFacing?: boolean;
    order?: number;
  }[];
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
  const [isEditing, setIsEditing] = useState(false);

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
    if (!changelogDraft || !changelogDraft.changes.length) {
      toast.error("Cannot submit empty changelog");
      return;
    }

    if (!commits || commits.length === 0) {
      toast.error("No commits available to submit");
      return;
    }

    if (!repoUrl) {
      toast.error("Repository URL is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Filter out any empty changes
      const validChanges = changelogDraft.changes.filter(change => change.trim() !== '');

      if (validChanges.length === 0) {
        toast.error("Changelog must contain at least one valid entry");
        setIsSubmitting(false);
        return;
      }

      // Use enhanced entries if available, otherwise generate simple entries from changes
      const entries = changelogDraft.entries || validChanges.map((change, index) => ({
        content: change,
        order: index
      }));

      // Keep content field for backward compatibility
      const content = validChanges.join('\n');

      // Ensure all commits have the required fields
      const validCommits = commits.map(commit => ({
        hash: commit.hash,
        message: commit.message || "No message provided",
        date: commit.date,
        files: Array.isArray(commit.files) ? commit.files : [],
        stats: commit.stats || { totalAdditions: 0, totalDeletions: 0, filesChanged: 0 }
      }));

      const res = await fetch("/api/submit-changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          entries,
          commits: validCommits,
          repoUrl,
          type: selectedType || "Feature",
          date: changelogDraft.date || new Date().toISOString(),
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
              {changelogDraft.changes.map((change, index) => {
                const isIntroLine = !change.startsWith('- ') &&
                  (change.includes('breakdown') || change.includes('following') || change.includes('changes made'));

                return (
                  <div key={index} className={`${isIntroLine ? 'mb-4' : 'ml-5 list-disc'} group`}>
                    <div
                      contentEditable={isEditing}
                      suppressContentEditableWarning
                      className={`text-gray-700 ${isEditing ? 'focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-1 -mx-1 border-dashed border border-transparent hover:border-gray-300' : ''}`}
                      onBlur={(e) => {
                        if (!isEditing) return;
                        const newChanges = [...changelogDraft.changes];
                        let newText = e.target.textContent || '';
                        if (!isIntroLine && !newText.startsWith('- ')) {
                          newText = `- ${newText}`;
                        }
                        newChanges[index] = newText;
                        setChangelogDraft({
                          ...changelogDraft,
                          changes: newChanges
                        });
                      }}
                    >
                      {isIntroLine ? change : (change.startsWith('- ') ? change : `- ${change}`)}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end space-x-3 pb-8">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`px-4 py-2 text-white rounded-md flex items-center gap-2 ${
                  isEditing
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-600 hover:bg-gray-700'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                {isEditing ? "Done Editing" : "Edit"}
              </button>
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