import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/env';

// Global to maintain a single connection across app
let globalDb: ReturnType<typeof drizzle> | undefined = undefined;
let pgClient: ReturnType<typeof postgres> | undefined = undefined;

// Connection function with proper pooling to prevent "too many clients" error
function connectDb() {
  if (globalDb) return globalDb;

  const connectionString = env.DATABASE_URL;

  // Configure connection pool with more conservative limits
  pgClient = postgres(connectionString, {
    max: 3, // Reduce maximum connections to prevent overwhelming the db
    idle_timeout: 10, // Close idle connections faster
    connect_timeout: 5, // Shorter connection timeout
    max_lifetime: 60 * 10, // Connection max lifetime in seconds (10 minutes)
    ssl: process.env.NODE_ENV === 'production',
  });

  // Set up cleanup handler for graceful shutdown
  if (typeof process !== 'undefined') {
    process.on('beforeExit', () => {
      if (pgClient) {
        console.log('Closing database connections before exit');
        pgClient.end();
      }
    });
  }

  // Create and store the drizzle instance
  globalDb = drizzle(pgClient);
  return globalDb;
}

// Export a unified database interface
export const db = connectDb();