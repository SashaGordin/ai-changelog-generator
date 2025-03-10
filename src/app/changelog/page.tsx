import { db } from "@/app/db";
import { changelogs } from "@/app/db/schema";
import ReactMarkdown from "react-markdown";
import { desc } from "drizzle-orm";

export default async function ChangelogPage() {
  const logs = await db.select().from(changelogs).orderBy(desc(changelogs.createdAt));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Public Changelog</h1>
      {logs.length === 0 ? (
        <p className="text-gray-600">No changelogs yet.</p>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800">{log.title}</h2>
            <p className="text-sm text-gray-500 mb-2">
              {new Date(log.createdAt).toLocaleDateString()}
            </p>
            <div className="p-4 bg-gray-50 border rounded-md shadow-sm">
              <ReactMarkdown>{log.content}</ReactMarkdown>
            </div>
          </div>
        ))
      )}
    </div>
  );
}