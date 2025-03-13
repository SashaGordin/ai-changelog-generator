# AI Changelog Generator

An intelligent changelog generator that uses GitHub's API and OpenAI's GPT-4 to automatically create meaningful, user-focused changelog entries from your code changes.

## Features

- 🤖 AI-powered changelog generation using GPT-4
- 🔄 Direct GitHub repository integration
- 🎯 Smart commit deduplication to prevent duplicate entries
- 📝 Editable changelog entries before submission
- 🏷️ Feature badges for better categorization
- 🎨 Clean, modern UI with improved formatting
- 📊 Organized changelog view by month and year
- 💡 Focus on actual code changes rather than just commit messages
- 🎯 Accurate change detection based on code diffs

## Technical Decisions

### Architecture
- **Next.js 14**: Chosen for its App Router, server components, and API routes
- **PostgreSQL + Drizzle ORM**: Type-safe database operations with minimal boilerplate
- **TypeScript**: For enhanced type safety and better developer experience
- **Tailwind CSS**: For rapid UI development and consistent styling

### Design Decisions
- **Two-View System**: Separated developer tools from the public changelog view
- **Simple Navigation**: Toggle button between views instead of a nav bar for minimal UI
- **GitHub Integration**: Moved from local git to GitHub API for better accessibility
- **Transaction-based Saves**: Ensures data consistency between changelogs and commits
- **Optimistic UI**: Loading states and toast notifications for better UX
- **Code-Centric Analysis**: Enhanced prompt system that analyzes actual code diffs for accurate change detection
- **Feature Badges**: Replaced component detection with user-selected feature badges for better categorization
- **Simplified Data Model**: Streamlined database schema by removing unused fields and focusing on essential data

### AI-Powered Development
- **Cursor AI**: Used as the primary IDE with AI pair programming capabilities, significantly speeding up development and helping with code generation, debugging, and refactoring
- **Grok**: Used for high-level ideation and architectural planning, helping to conceptualize the app's structure and core features before implementation
- **GPT-4**: Powers the changelog generation, transforming technical code changes into user-friendly changelog entries

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ai-changelog-generator.git
cd ai-changelog-generator
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up your environment variables in `.env`:
```env
DATABASE_URL=your_postgres_database_url
OPENAI_API_KEY=your_openai_api_key
GITHUB_TOKEN=your_github_personal_access_token
```

4. Run database migrations:
```bash
pnpm drizzle-kit push:pg
```

5. Start the development server:
```bash
pnpm dev
```

## Usage

1. Navigate to the developer view by clicking "Switch to Dev"
2. Enter a GitHub repository URL
3. Click "Fetch New Commits" to get recent commits
4. Select the change type (Feature, Update, etc.)
5. Add relevant feature badges to categorize the changes
6. Click "Generate Changelog" to create an AI-generated entry
7. Edit the entry if needed
8. Click "Submit" to save the changelog
9. View the formatted changelog in the public view

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for GPT-4 access
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo access

## Recent Updates

- 🎯 Improved accuracy of changelog entries by enhancing the AI prompt to focus on actual code changes
- 🏷️ Replaced automatic component detection with user-selected feature badges for better categorization
- 🎨 Enhanced bullet point formatting for better readability
- 📝 Simplified data model by removing unused fields (component, scope, impact)
- 🔄 Fixed hydration issues with consistent date formatting
- ⚡️ Optimized code by removing unused functions and streamlining the codebase

## Demo

[Click here to see the demo!](https://www.loom.com/share/c9a4cd220184434384765702516db177?sid=0c7bf722-990d-490a-9271-20f4e17b47e3)

