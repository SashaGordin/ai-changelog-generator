import { db } from "@/app/db";
import { changelogs, changelogEntries } from "@/app/db/schema";
import { desc, eq } from "drizzle-orm";
import type { ChangeType } from "../api/generate-changelog/route";
import SwitchViewButton from "@/app/components/SwitchViewButton";

// Define an interface for changelog entries including the labels field
interface ChangelogEntry {
  id: number;
  changelogId: number;
  content: string;
  component: string | null;
  scope: string | null;
  impact: string | null;
  isTechnical: boolean | null;
  isUserFacing: boolean | null;
  order: number | null;
  labels: string | null;
  createdAt: Date;
}

const typeColors: Record<ChangeType, { bg: string; text: string }> = {
  Feature: { bg: "bg-green-100", text: "text-green-800" },
  Update: { bg: "bg-blue-100", text: "text-blue-800" },
  Fix: { bg: "bg-yellow-100", text: "text-yellow-800" },
  Breaking: { bg: "bg-red-100", text: "text-red-800" },
  Security: { bg: "bg-purple-100", text: "text-purple-800" },
};

// Helper to convert simple markdown-style formatting to HTML
function formatContent(content: string): React.ReactNode {
  if (!content) return null;

  // Split content by line breaks
  const lines = content.split('\n');

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

    // Special handling for What's the Impact? section
    if (line.includes("What's the Impact?")) {
      return (
        <div key={`line-${index}`} className="mt-3 mb-2 font-semibold text-gray-800">
          {parts.length > 0 ? parts : line}
        </div>
      );
    }

    // If line starts with a dash, make it a bullet point
    if (line.trim().startsWith('-')) {
      return (
        <div key={`line-${index}`} className="flex items-start mb-3 pl-1">
          <span className="mr-2 text-blue-500 flex-shrink-0">•</span>
          <div className="text-gray-700">{parts.length > 0 ? parts : line.substring(1).trim()}</div>
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

export default async function ChangelogPage() {
  // Get all changelogs
  const logs = await db.select().from(changelogs).orderBy(desc(changelogs.createdAt));

  // Fetch entries for each changelog
  const logsWithEntries = await Promise.all(
    logs.map(async (log) => {
      // Get all entries for this changelog
      const entries = await db
        .select()
        .from(changelogEntries)
        .where(eq(changelogEntries.changelogId, log.id))
        .orderBy(changelogEntries.order);

      return {
        ...log,
        entries: entries.length > 0 ? entries : null
      };
    })
  );

  // Keep all changelogs
  const filteredLogs = logsWithEntries;

  // Group logs by month and year
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.createdAt);
    const key = `${date.toLocaleString('default', { month: 'long' })}, ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof filteredLogs>);

  // Helper to extract all badges from entries
  function getBadgesFromEntries(entries: ChangelogEntry[] | null): string[] {
    if (!entries || entries.length === 0) return [];

    const allBadges = new Set<string>();

    entries.forEach(entry => {
      // Try to get badges from labels field first
      if (entry.labels) {
        try {
          const parsedLabels = JSON.parse(entry.labels as string) as string[];
          parsedLabels.forEach(label => allBadges.add(label));
        } catch {
          // If parsing fails, fall back to component
          if (entry.component) allBadges.add(entry.component);
        }
      }
      // Fall back to component field for older entries
      else if (entry.component) {
        allBadges.add(entry.component);
      }
    });

    return Array.from(allBadges);
  }

  return (
    <>
      <SwitchViewButton />
      <div className="max-w-4xl mx-auto px-6 pt-24">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">Changelog</h1>
        </div>

        {Object.entries(groupedLogs).map(([title, monthLogs]) => (
          <section key={title} className="mb-16">
            <h2 className="text-2xl font-semibold mb-8">{title}</h2>

            <div className="space-y-12">
              {monthLogs.map((log) => {
                const date = new Date(log.createdAt);
                const colors = typeColors[log.type as ChangeType] || typeColors.Feature;

                // Get unique badges using our helper function
                const changelogBadges = getBadgesFromEntries(log.entries as ChangelogEntry[] | null);

                return (
                  <div key={log.id} className="flex gap-6">
                    <div className="flex-none w-20 text-sm text-gray-500">
                      {date.toLocaleDateString('default', { day: '2-digit' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-4 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                          {log.type}
                        </span>

                        {/* Display all badges with gray background */}
                        {changelogBadges.map(badge => (
                          badge && (
                            <span key={badge} className="px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                              {badge}
                            </span>
                          )
                        ))}

                        {log.title !== title && (
                          <span className="text-sm text-gray-500">
                            {log.title}
                          </span>
                        )}
                      </div>

                      {/* Display entries if available, otherwise fall back to content */}
                      {log.entries ? (
                        <div className="space-y-2">
                          {log.entries.map((entry) => (
                            <div key={entry.id} className="text-gray-800 prose prose-sm max-w-none">
                              {formatContent(entry.content)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-gray-800">
                          {log.content.split('\n').map((line, i) => (
                            <div key={i} className="mb-2">
                              {line}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {Object.keys(groupedLogs).length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No changelogs found that match the current filters.
          </div>
        )}
      </div>
    </>
  );
}