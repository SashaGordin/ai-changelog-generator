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
    impact?: string;
    order?: number;
    labels?: string;
  }[];
}

const changeTypes: ChangeType[] = ["Feature", "Update", "Fix", "Breaking", "Security"];

// Define available feature badges for the platform
const availableFeatureBadges = [
  "Analytics",
  "Authentication",
  "API Integration",
  "Content Management",
  "Dashboards",
  "Data Visualization",
  "Email Notifications",
  "Filtering",
  "Performance Optimization",
  "Reporting",
  "Search",
  "Security Features",
  "User Experience",
  "User Interface"
];

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
  const [selectedBadges, setSelectedBadges] = useState<string[]>([]);

  // Helper functions to extract parts from the markdown format
  const extractTitle = (content: string): string | null => {
    const match = content.match(/^\*\*([^*]+)\*\*/);
    return match ? match[1] : null;
  };

  const extractSummary = (content: string): string | null => {
    // Get text between the title and "What's the Impact?" section
    const titleMatch = content.match(/^\*\*([^*]+)\*\*\n\n/);
    const impactIndex = content.indexOf("What's the Impact?");

    if (titleMatch && impactIndex > -1) {
      const startIndex = titleMatch[0].length;
      // Return the trimmed substring
      return content.substring(startIndex, impactIndex).trim();
    } else if (titleMatch) {
      // If there's no impact section
      return content.substring(titleMatch[0].length).trim();
    }

    return null;
  };

  const extractImpactPoints = (content: string): string[] | null => {
    const impactIndex = content.indexOf("What's the Impact?");
    if (impactIndex === -1) return null;

    // Get the text after "What's the Impact?"
    const impactSection = content.substring(impactIndex + "What's the Impact?".length).trim();

    // Extract bullet points - handle both lines with and without dashes
    return impactSection.split('\n')
      .filter(line => line.trim() !== '') // Keep any non-empty lines
      .map(line => {
        // Remove dash if present
        return line.trim().startsWith('-') ? line.trim().substring(1).trim() : line.trim();
      });
  };

  // Helper functions to update parts of the changelog
  const updateChangelogPart = (changeIndex: number, part: 'title' | 'summary', value: string) => {
    if (!changelogDraft) return;

    const originalChange = changelogDraft.changes[changeIndex];
    let title = extractTitle(originalChange) || '';
    let summary = extractSummary(originalChange) || '';
    const impactPoints = extractImpactPoints(originalChange) || [];

    if (part === 'title') title = value;
    if (part === 'summary') summary = value;

    // Rebuild the change text
    let newChange = `**${title}**\n\n${summary}`;

    if (impactPoints.length > 0) {
      newChange += `\n\nWhat's the Impact?\n${impactPoints.map(point => `${point}`).join('\n')}`;
    }

    const newChanges = [...changelogDraft.changes];
    newChanges[changeIndex] = newChange;
    setChangelogDraft({
      ...changelogDraft,
      changes: newChanges
    });
  };

  const updateImpactPoint = (changeIndex: number, pointIndex: number, value: string) => {
    if (!changelogDraft) return;

    const originalChange = changelogDraft.changes[changeIndex];
    const title = extractTitle(originalChange) || '';
    const summary = extractSummary(originalChange) || '';
    const impactPoints = extractImpactPoints(originalChange) || [];

    // Update the specific impact point
    if (pointIndex >= impactPoints.length) {
      impactPoints.push(value);
    } else {
      impactPoints[pointIndex] = value;
    }

    // Rebuild the change text
    let newChange = `**${title}**\n\n${summary}`;

    if (impactPoints.length > 0) {
      newChange += `\n\nWhat's the Impact?\n${impactPoints.join('\n')}`;
    }

    const newChanges = [...changelogDraft.changes];
    newChanges[changeIndex] = newChange;
    setChangelogDraft({
      ...changelogDraft,
      changes: newChanges
    });
  };

  const addImpactPoint = (changeIndex: number) => {
    if (!changelogDraft) return;

    const originalChange = changelogDraft.changes[changeIndex];
    const impactPoints = extractImpactPoints(originalChange) || [];
    impactPoints.push('');

    updateImpactPoint(changeIndex, impactPoints.length - 1, '');
  };

  const removeImpactPoint = (changeIndex: number, pointIndex: number) => {
    if (!changelogDraft) return;

    const originalChange = changelogDraft.changes[changeIndex];
    const title = extractTitle(originalChange) || '';
    const summary = extractSummary(originalChange) || '';
    let impactPoints = extractImpactPoints(originalChange) || [];

    // Remove the specific impact point
    impactPoints = impactPoints.filter((_, i) => i !== pointIndex);

    // Rebuild the change text
    let newChange = `**${title}**\n\n${summary}`;

    if (impactPoints.length > 0) {
      newChange += `\n\nWhat's the Impact?\n${impactPoints.map(point => `${point}`).join('\n')}`;
    }

    const newChanges = [...changelogDraft.changes];
    newChanges[changeIndex] = newChange;
    setChangelogDraft({
      ...changelogDraft,
      changes: newChanges
    });
  };

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

  const toggleBadge = (badge: string) => {
    setSelectedBadges(prev =>
      prev.includes(badge)
        ? prev.filter(b => b !== badge)
        : [...prev, badge]
    );
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

      // Update entries to share the same selected badges across all entries
      const entries = validChanges.map((change, index) => {
        return {
          content: change,
          order: index,
          labels: selectedBadges.length > 0 ? JSON.stringify(selectedBadges) : null,
          component: selectedBadges.length > 0 ? selectedBadges[0] : detectComponent(change),
          impact: detectImpact(change)
        };
      });

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

        <div className="space-y-6">
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
              <div className="flex flex-col mb-3">
                <div className="flex justify-between items-center mt-3">
                  <div className="flex-1">
                    <div className="mt-4 mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <div className="text-sm font-medium text-gray-700">Categorize your changes:</div>
                        <div className="flex items-center space-x-2">
                          <label className="text-sm font-medium">Type:</label>
                          <select
                            value={selectedType}
                            onChange={(e) => setSelectedType(e.target.value as ChangeType)}
                            className="p-2 border rounded-md shadow-sm text-sm"
                          >
                            {changeTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {availableFeatureBadges.map(badge => (
                          <button
                            key={badge}
                            onClick={() => toggleBadge(badge)}
                            className={`text-xs px-2 py-1 rounded-full ${
                              selectedBadges.includes(badge)
                                ? 'bg-gray-200 text-gray-800 ring-2 ring-gray-400'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {badge}
                          </button>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500">
                        Selected badges will appear in the public changelog
                      </div>

                      <div className="pt-6 pb-2">
                        <h2 className="text-xl font-semibold">{changelogDraft.title}</h2>
                      </div>

                      <div className="flex items-center mt-4 mb-2 space-x-2">
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800 font-medium">
                          {selectedType}
                        </span>
                        {selectedBadges.map(badge => (
                          <span key={badge} className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700">
                            {badge}
                          </span>
                        ))}
                        {changelogDraft.date && (
                          <span className="text-sm text-gray-500">
                            {new Date(changelogDraft.date).toLocaleDateString('en-US', {
                              timeZone: 'UTC',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <SwitchViewButton />
                </div>
              </div>

              <div className="prose max-w-none">
                {changelogDraft.changes.map((change, index) => {
                  return (
                    <div key={index} className="p-3 border rounded-md mb-4 bg-gray-50 group">
                      {isEditing ? (
                        <div className="bg-white border rounded-md p-4 space-y-4">
                          <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Title</h3>
                            <input
                              type="text"
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="Enter a bold title (3-5 words)"
                              value={extractTitle(change) || ""}
                              onChange={(e) => {
                                updateChangelogPart(index, 'title', e.target.value);
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">Will appear as: <strong>{extractTitle(change) || "Title"}</strong></p>
                          </div>

                          <div className="mb-4">
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Summary</h3>
                            <textarea
                              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                              placeholder="Briefly explain the change in 2-3 sentences"
                              rows={3}
                              value={extractSummary(change) || ""}
                              onChange={(e) => {
                                updateChangelogPart(index, 'summary', e.target.value);
                              }}
                            />
                            <p className="text-xs text-gray-500 mt-1">Keep it simple and user-focused</p>
                          </div>

                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">Impact (bullet points)</h3>
                            {(extractImpactPoints(change) || ['', '']).map((point, pointIndex) => (
                              <div key={pointIndex} className="flex items-center mb-2">
                                <span className="mr-2 text-blue-500">•</span>
                                <input
                                  type="text"
                                  className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                  placeholder={`User benefit ${pointIndex + 1}`}
                                  value={point}
                                  onChange={(e) => {
                                    updateImpactPoint(index, pointIndex, e.target.value);
                                  }}
                                />
                                {pointIndex > 1 && (
                                  <button
                                    onClick={() => removeImpactPoint(index, pointIndex)}
                                    className="ml-2 text-red-500 hover:text-red-700"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ))}
                            {(extractImpactPoints(change) || []).length < 4 && (
                              <button
                                onClick={() => addImpactPoint(index)}
                                className="text-sm text-blue-600 hover:text-blue-800 flex items-center"
                              >
                                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                                </svg>
                                Add another impact point
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          {formatContent(change)}
                        </div>
                      )}
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
      </div>
    </>
  );
}

// Helper function to guess component
function detectComponent(content: string): string | undefined {
  const lowerContent = content.toLowerCase();

  // Product features - match the same logic as in the API
  if (lowerContent.includes('analytics') || lowerContent.includes('stats') || lowerContent.includes('metrics'))
    return 'Analytics';
  if (lowerContent.includes('auth') || lowerContent.includes('login') || lowerContent.includes('sign in'))
    return 'Authentication';
  if (lowerContent.includes('api') || lowerContent.includes('integration') || lowerContent.includes('connect'))
    return 'API Integration';
  if (lowerContent.includes('content') || lowerContent.includes('editor') || lowerContent.includes('cms'))
    return 'Content Management';
  if (lowerContent.includes('dashboard'))
    return 'Dashboards';
  if (lowerContent.includes('visualiz') || lowerContent.includes('chart') || lowerContent.includes('graph'))
    return 'Data Visualization';
  if (lowerContent.includes('email') || lowerContent.includes('notification') || lowerContent.includes('alert'))
    return 'Email Notifications';
  if (lowerContent.includes('filter') || lowerContent.includes('sort') || lowerContent.includes('search'))
    return 'Filtering';
  if (lowerContent.includes('performance') || lowerContent.includes('speed') || lowerContent.includes('optimize'))
    return 'Performance Optimization';
  if (lowerContent.includes('report') || lowerContent.includes('export'))
    return 'Reporting';
  if (lowerContent.includes('search'))
    return 'Search';
  if (lowerContent.includes('security') || lowerContent.includes('protect') || lowerContent.includes('privacy'))
    return 'Security Features';
  if (lowerContent.includes('user experience') || lowerContent.includes('ux') || lowerContent.includes('workflow'))
    return 'User Experience';
  if (lowerContent.includes('ui') || lowerContent.includes('interface') || lowerContent.includes('display'))
    return 'User Interface';

  return undefined;
}

// Helper function to guess impact level
function detectImpact(content: string): string {
  const lowerContent = content.toLowerCase();

  if (lowerContent.includes('major') || lowerContent.includes('significant') ||
      lowerContent.includes('redesign') || lowerContent.includes('overhaul'))
    return 'major';
  if (lowerContent.includes('bugfix') || lowerContent.includes('typo') ||
      lowerContent.includes('minor fix') || lowerContent.includes('small'))
    return 'patch';

  return 'minor'; // Default
}

// Helper to convert simple markdown-style formatting to HTML
function formatContent(content: string): React.ReactNode {
  if (!content) return null;

  // Split content by line breaks
  const lines = content.split('\n');

  // Track whether we're in the impact section
  let inImpactSection = false;

  return lines.map((line, index) => {
    // Handle any bold text, though we're using less of it in the new format
    const boldPattern = /\*\*(.+?)\*\*/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = boldPattern.exec(line)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(line.substring(lastIndex, match.index));
      }

      // Add the bold text - add special styling for the title (first bold text)
      if (index === 0) {
        parts.push(<span key={`bold-${index}-${match.index}`} className="text-lg font-bold text-gray-900">{match[1]}</span>);
      } else {
        parts.push(<strong key={`bold-${index}-${match.index}`}>{match[1]}</strong>);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < line.length) {
      parts.push(line.substring(lastIndex));
    }

    // If line is empty, add a spacer
    if (line.trim() === '') {
      return <div key={`line-${index}`} className="h-4"></div>;
    }

    // Check if this is the "What's the Impact?" header
    if (line.includes("What's the Impact?")) {
      inImpactSection = true;
      return (
        <div key={`line-${index}`} className="mt-3 mb-2 font-semibold text-gray-800">
          {parts.length > 0 ? parts : line}
        </div>
      );
    }

    // Handle bullet points - both explicit ones starting with dash and all lines in impact section
    if (line.trim().startsWith('-') || (inImpactSection && line.trim() !== '')) {
      // For existing bullet points, remove the dash
      const lineContent = line.trim().startsWith('-') ? line.substring(2).trim() : line.trim();

      return (
        <div key={`line-${index}`} className="flex items-start mb-3 pl-1">
          <span className="mr-2 text-blue-500 flex-shrink-0">•</span>
          <div className="text-gray-700">
            {parts.length > 0 ? parts : lineContent}
          </div>
        </div>
      );
    }

    // For regular paragraph text, add more spacing for readability
    return (
      <div key={`line-${index}`} className={`mb-4 text-gray-800 leading-relaxed ${index === 0 ? 'mt-2' : ''}`}>
        {parts.length > 0 ? parts : line}
      </div>
    );
  });
}