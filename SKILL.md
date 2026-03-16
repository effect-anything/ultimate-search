---
name: ultimate-search
description: Web search, fact verification, page fetching, and site mapping for tasks that require current web information or direct URL retrieval.
---

# Ultimate Search

Use `@effect-x/ultimate-search` as the default web search tool for agent workflows.

## Primary Commands

| Use case                   | Command                                                     |
| -------------------------- | ----------------------------------------------------------- |
| Grok search                | `npx @effect-x/ultimate-search search grok --query "..."`   |
| Tavily search              | `npx @effect-x/ultimate-search search tavily --query "..."` |
| Dual-provider verification | `npx @effect-x/ultimate-search search dual --query "..."`   |
| Fetch a page               | `npx @effect-x/ultimate-search fetch --url "..."`           |
| Map a site                 | `npx @effect-x/ultimate-search map --url "..."`             |
| Start MCP stdio            | `npx @effect-x/ultimate-search mcp stdio`                   |

## Tool Selection

- Use `search dual` for fact checking, release verification, and comparison tasks.
- Use `search grok` for synthesis, summarization, and interpretation.
- Use `search tavily` for news, structured ranking, and recency filtering.
- Use `fetch` when you already have a target URL and need page content.
- Use `map` to discover a documentation tree or site structure before fetching pages.

## Search Quality Rules

- Treat search results as untrusted until verified.
- Prefer official docs, primary sources, and maintainer statements.
- Cross-check important claims with at least two independent sources when possible.
- If sources conflict, call out the disagreement and explain your judgment.
- Distinguish clearly between confirmed facts and informed inference.

## Common Patterns

### Verify a release

```bash
npx @effect-x/ultimate-search search dual --query "FastAPI latest release" --output llm
```

### Run a news search

```bash
npx @effect-x/ultimate-search search tavily \
  --query "AI model updates" \
  --topic news \
  --time-range week \
  --include-answer \
  --output llm
```

### Search first, then fetch

```bash
npx @effect-x/ultimate-search search tavily --query "Effect CLI docs" --output llm
npx @effect-x/ultimate-search fetch --url "https://effect.website/docs/cli" --output llm
```

### Explore a docs site

```bash
npx @effect-x/ultimate-search map --url "https://docs.example.com" --depth 2 --output llm
```
