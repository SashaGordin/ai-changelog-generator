import { db } from "@/app/db";
import { changelogs } from "@/app/db/schema";
import { desc } from "drizzle-orm";
import type { ChangeType } from "../api/generate-changelog/route";
import SwitchViewButton from "@/app/components/SwitchViewButton";

const typeColors: Record<ChangeType, { bg: string; text: string }> = {
  Feature: { bg: "bg-green-100", text: "text-green-800" },
  Update: { bg: "bg-blue-100", text: "text-blue-800" },
  Fix: { bg: "bg-yellow-100", text: "text-yellow-800" },
  Breaking: { bg: "bg-red-100", text: "text-red-800" },
  Security: { bg: "bg-purple-100", text: "text-purple-800" },
};

export default async function ChangelogPage() {
  const logs = await db.select().from(changelogs).orderBy(desc(changelogs.createdAt));

  // Group logs by month and year
  const groupedLogs = logs.reduce((acc, log) => {
    const date = new Date(log.createdAt);
    const key = `${date.toLocaleString('default', { month: 'long' })}, ${date.getFullYear()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {} as Record<string, typeof logs>);

  return (
    <>
      <SwitchViewButton />
      <div className="max-w-3xl mx-auto px-6 pt-24">
        <h1 className="text-4xl font-bold mb-12">Changelog</h1>

        {Object.entries(groupedLogs).map(([title, monthLogs]) => (
          <section key={title} className="mb-16">
            <h2 className="text-2xl font-semibold mb-8">{title}</h2>

            <div className="space-y-8">
              {monthLogs.map((log) => {
                const date = new Date(log.createdAt);
                const colors = typeColors[log.type as ChangeType] || typeColors.Feature;

                return (
                  <div key={log.id} className="flex gap-6">
                    <div className="flex-none w-20 text-sm text-gray-500">
                      {date.toLocaleDateString('default', { day: '2-digit' })}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors.bg} ${colors.text}`}>
                          {log.type}
                        </span>
                        {log.title !== title && (
                          <span className="text-sm text-gray-500">
                            {log.title}
                          </span>
                        )}
                      </div>
                      <div className="text-gray-800">
                        {log.content.split('\n').map((line, i) => (
                          <div key={i} className="mb-2">
                            {line}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}