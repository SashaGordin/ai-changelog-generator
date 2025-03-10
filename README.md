# AI Changelog Generator

An intelligent changelog generator that uses GitHub's API and OpenAI's GPT-4 to automatically create meaningful, user-focused changelog entries from your commits.

## Features

- 🤖 AI-powered changelog generation using GPT-4
- 🔄 Direct GitHub repository integration
- 🎯 Smart commit deduplication to prevent duplicate entries
- 📝 Editable changelog entries before submission
- 🏷️ Categorization of changes (Feature, Update, Fix, Breaking, Security)
- 📱 Responsive, modern UI with a clean design
- 📊 Organized changelog view by month and year

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
5. Click "Generate Changelog" to create an AI-generated entry
6. Edit the entry if needed
7. Click "Submit" to save the changelog
8. View the formatted changelog in the public view

## Environment Variables

- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API key for GPT-4 access
- `GITHUB_TOKEN`: GitHub Personal Access Token with repo access

## Demo

[[Link to your screen recording]](https://www.loom.com/share/334b3cfba83845baa9d772c2de72074a?sid=21dbba3d-f1ec-4a80-ab2e-f36e7c8d8ad9)

