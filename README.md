# @effect-x/ultimate-search

Node-first web search CLI and read-only MCP server for agents and automation.

## Highlights

- exposes `search`, `fetch`, and `map` commands for common agent research workflows
- supports Grok, Tavily, and Firecrawl-backed retrieval flows behind one CLI surface
- runs as a read-only MCP stdio server for tool-aware agent environments
- bundles the CLI with `tsdown` while keeping Bun for dependency management and local development
- publishes through a single-package Changesets workflow with npm provenance enabled

## Install

Run it without installing:

```bash
npx @effect-x/ultimate-search --help
```

Or install it globally:

```bash
npm install --global @effect-x/ultimate-search
ultimate-search --help
```

## Usage

Set the provider credentials you need in your shell or `.env` file:

- `GROK_API_URL`
- `GROK_API_KEY`
- `TAVILY_API_URL`
- `TAVILY_API_KEY`
- `FIRECRAWL_API_KEY` for the `fetch` fallback path

Run a few common commands:

```bash
ultimate-search search grok --query "latest bun release"
ultimate-search search tavily --query "effect cli docs" --depth advanced --max-results 5
ultimate-search search dual --query "FastAPI latest release" --include-answer --output llm
ultimate-search fetch --url "https://effect.website" --output llm
ultimate-search map --url "https://docs.tavily.com" --depth 2 --limit 100 --output llm
ultimate-search mcp stdio
```

## Development

The repository uses Bun for dependency management and local commands. The published CLI targets Node.js 24+.

```bash
bun install
bun run check
node ./dist/cli.js --help
```

## Release

This package uses Changesets plus the shared GitHub Actions release workflow.

```bash
bun run changeset
bun run version-packages
bun run release
```

## License

MIT
