# @effect-x/ultimate-search

A CLI-first web search toolkit for agents and automation.

It can be used in two ways:

- as an npm-executed CLI: `npx @effect-x/ultimate-search ...`
- as a read-only MCP server over stdio: `npx @effect-x/ultimate-search mcp stdio`

After installation, the executable name is `ultimate-search`.

## Features

- `search grok` for synthesis-oriented web search
- `search tavily` for structured search with ranking and recency controls
- `search dual` for cross-checking results across Grok and Tavily
- `fetch` for page retrieval with Tavily Extract first and FireCrawl fallback
- `map` for site URL discovery and documentation tree exploration
- `mcp stdio` for exposing the same read-only surface to MCP clients

## Installation

Run without installing:

```bash
npx @effect-x/ultimate-search --help
```

Or with other package managers:

```bash
pnpm dlx @effect-x/ultimate-search --help
bunx @effect-x/ultimate-search --help
```

Install globally:

```bash
npm install --global @effect-x/ultimate-search
ultimate-search --help
```

## Quick Start

### 1. Configure environment variables

Copy the example file:

```bash
cp .env.example .env
```

At minimum, configure:

- `GROK_API_URL`
- `GROK_API_KEY`
- `TAVILY_API_URL`
- `TAVILY_API_KEY`
- `FIRECRAWL_API_KEY` for the `fetch` fallback path

### 2. Run the CLI

```bash
npx @effect-x/ultimate-search search grok --query "latest bun release"
npx @effect-x/ultimate-search search tavily --query "effect cli docs" --depth advanced --max-results 5
npx @effect-x/ultimate-search search dual --query "FastAPI latest release" --include-answer --output llm
npx @effect-x/ultimate-search fetch --url "https://effect.website" --output llm
npx @effect-x/ultimate-search map --url "https://docs.tavily.com" --depth 2 --limit 100 --output llm
```

### 3. Start the MCP server

```bash
npx @effect-x/ultimate-search mcp stdio
```

Exposed read-only MCP tools:

- `search_grok`
- `search_tavily`
- `search_dual`
- `fetch`
- `map`

## Usage

### Output modes

- default output is human-readable text
- `--output llm` emits structured JSON for agents and automation
- if `AGENT=1` is set and `--output` is omitted, commands may default to `llm`

### Installed binary usage

```bash
ultimate-search --help
ultimate-search search dual --query "Node.js latest release" --output llm
ultimate-search mcp stdio
```

### Command overview

- `ultimate-search search grok --query "..."`
- `ultimate-search search tavily --query "..."`
- `ultimate-search search dual --query "..."`
- `ultimate-search fetch --url "..."`
- `ultimate-search map --url "..."`
- `ultimate-search mcp stdio`

## Configuration

### Required runtime variables

- `GROK_API_URL`
- `GROK_API_KEY`
- `TAVILY_API_URL`
- `TAVILY_API_KEY`

### Optional runtime variables

- `GROK_MODEL`
- `FIRECRAWL_API_URL`
- `FIRECRAWL_API_KEY`
- `AGENT`

## Local Development

Repository maintenance uses Bun. Published artifacts target Node.js 20+.

```bash
bun install
bun run build
node ./dist/cli.js --help
node ./dist/cli.js search grok --query "query"
node ./dist/cli.js mcp stdio
```

You can also run the source entry directly during development:

```bash
bun run ./src/cli.ts search grok --query "query"
bun run ./src/cli.ts mcp stdio
```

## Quality Checks

```bash
bun run check
bun run build
bun run pack:check
bun run release:check
```

## Release Workflow

This repository uses Changesets and GitHub Actions for versioning and publishing.

- release docs: `docs/publishing.md`
- contribution guide: `CONTRIBUTING.md`
- package skill instructions: `SKILL.md`

Before the first publish, make sure the target GitHub repository provides:

- an `NPM_TOKEN` secret
- npm publish access for the `@effect-x` scope
- trusted publishing / provenance setup if you want npm provenance enabled

## Skill Integration

The repository includes a root `SKILL.md` file for agent environments that support local skills:

```bash
mkdir -p ~/.openclaw/workspace/skills/ultimate-search
ln -sf "$(pwd)/SKILL.md" ~/.openclaw/workspace/skills/ultimate-search/SKILL.md
```

## License

MIT
