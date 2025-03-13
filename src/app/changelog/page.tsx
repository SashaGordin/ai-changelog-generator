import { db } from "@/app/db";
import { changelogs, changelogEntries } from "@/app/db/schema";
import { desc, eq, and } from "drizzle-orm";
import type { ChangeType } from "../api/generate-changelog/route";
import SwitchViewButton from "@/app/components/SwitchViewButton";
import Link from "next/link";

const typeColors: Record<ChangeType, { bg: string; text: string }> = {
  Feature: { bg: "bg-green-100", text: "text-green-800" },
  Update: { bg: "bg-blue-100", text: "text-blue-800" },
  Fix: { bg: "bg-yellow-100", text: "text-yellow-800" },
  Breaking: { bg: "bg-red-100", text: "text-red-800" },
  Security: { bg: "bg-purple-100", text: "text-purple-800" },
};

// Impact level colors
const impactColors = {
  major: { bg: "bg-purple-100", text: "text-purple-800" },
  minor: { bg: "bg-blue-100", text: "text-blue-800" },
  patch: { bg: "bg-gray-100", text: "text-gray-800" },
};

// Component colors
const componentColors: Record<string, { bg: string; text: string }> = {
  UI: { bg: "bg-indigo-100", text: "text-indigo-800" },
  API: { bg: "bg-emerald-100", text: "text-emerald-800" },
  Database: { bg: "bg-amber-100", text: "text-amber-800" },
  Security: { bg: "bg-red-100", text: "text-red-800" },
  Performance: { bg: "bg-cyan-100", text: "text-cyan-800" },
};

export default async function ChangelogPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  // Get filter parameters
  const componentFilter = searchParams.component as string | undefined;
  const impactFilter = searchParams.impact as string | undefined;
  const scopeFilter = searchParams.scope as string | undefined;
  const userFacingOnly = searchParams.userFacing === 'true';

  // Get all changelogs
  const logs = await db.select().from(changelogs).orderBy(desc(changelogs.createdAt));

  // Fetch entries for each changelog
  const logsWithEntries = await Promise.all(
    logs.map(async (log) => {
      // Create an array of conditions
      const conditions = [eq(changelogEntries.changelogId, log.id)];

      // Add optional conditions
      if (componentFilter && componentFilter.length > 0) {
        conditions.push(eq(changelogEntries.component!, componentFilter));
      }

      if (impactFilter && impactFilter.length > 0) {
        conditions.push(eq(changelogEntries.impact!, impactFilter));
      }

      if (scopeFilter && scopeFilter.length > 0) {
        conditions.push(eq(changelogEntries.scope!, scopeFilter));
      }

      if (userFacingOnly) {
        conditions.push(eq(changelogEntries.isUserFacing, true));
      }

      // Execute query with all conditions
      const entries = await db
        .select()
        .from(changelogEntries)
        .where(and(...conditions))
        .orderBy(changelogEntries.order);

      return {
        ...log,
        entries: entries.length > 0 ? entries : null
      };
    })
  );

  // Remove changelogs that have no matching entries after filtering
  const filteredLogs = logsWithEntries.filter(log =>
    log.entries === null || log.entries.length > 0
  );

  // Group logs by month and year
  const groupedLogs = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.createdAt);
    const key = `${date.toLocaleString('default', { month: 'long' })}, ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof filteredLogs>);

  // Get unique components and scopes for filter options
  const allEntries = await db.select().from(changelogEntries);
  const components = [...new Set(allEntries.map(e => e.component).filter(Boolean))];
  const impacts = [...new Set(allEntries.map(e => e.impact).filter(Boolean))];

  return (
    <>
      <SwitchViewButton />
      <div className="max-w-4xl mx-auto px-6 pt-24">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold">Changelog</h1>

          <div className="flex gap-4">
            {/* Filter controls */}
            <div className="space-y-2">
              <div className="flex gap-2 justify-end">
                {components.map(component => (
                  component && (
                    <Link
                      key={component}
                      href={`/changelog?component=${component}`}
                      className={`text-xs px-2.5 py-1 rounded-full ${
                        componentFilter === component
                          ? `${componentColors[component as keyof typeof componentColors]?.bg || 'bg-gray-200'} ${componentColors[component as keyof typeof componentColors]?.text || 'text-gray-800'}`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {component}
                    </Link>
                  )
                ))}
                {componentFilter && (
                  <Link
                    href="/changelog"
                    className="text-xs px-2.5 py-1 rounded-full bg-red-100 text-red-700 hover:bg-red-200"
                  >
                    Clear
                  </Link>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                {impacts.map(impact => (
                  impact && (
                    <Link
                      key={impact}
                      href={`/changelog?impact=${impact}`}
                      className={`text-xs px-2.5 py-1 rounded-full ${
                        impactFilter === impact
                          ? `${impactColors[impact as keyof typeof impactColors]?.bg || 'bg-gray-200'} ${impactColors[impact as keyof typeof impactColors]?.text || 'text-gray-800'}`
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {impact}
                    </Link>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>

        {Object.entries(groupedLogs).map(([title, monthLogs]) => (
          <section key={title} className="mb-16">
            <h2 className="text-2xl font-semibold mb-8">{title}</h2>

            <div className="space-y-12">
              {monthLogs.map((log) => {
                const date = new Date(log.createdAt);
                const colors = typeColors[log.type as ChangeType] || typeColors.Feature;

                return (
                  <div key={log.id} className="flex gap-6">
                    <div className="flex-none w-20 text-sm text-gray-500">
                      {date.toLocaleDateString('default', { day: '2-digit' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                          {log.type}
                        </span>
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
                            <div key={entry.id} className="flex gap-2 items-start">
                              <div className="flex-1 text-gray-800">{entry.content}</div>

                              <div className="flex gap-1 flex-wrap">
                                {entry.component && (
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                                    componentColors[entry.component as keyof typeof componentColors]?.bg || 'bg-gray-100'
                                  } ${
                                    componentColors[entry.component as keyof typeof componentColors]?.text || 'text-gray-700'
                                  }`}>
                                    {entry.component}
                                  </span>
                                )}

                                {entry.impact && (
                                  <span className={`px-1.5 py-0.5 text-xs rounded ${
                                    impactColors[entry.impact as keyof typeof impactColors]?.bg || 'bg-gray-100'
                                  } ${
                                    impactColors[entry.impact as keyof typeof impactColors]?.text || 'text-gray-700'
                                  }`}>
                                    {entry.impact}
                                  </span>
                                )}
                              </div>
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