# Contributing

Thanks for contributing to `@effect-x/ultimate-search`.

## Local Setup

```bash
bun install
cp .env.example .env
```

Repository development uses Bun for dependency management and task running. Published artifacts are built for Node.js 20+.

## Development Commands

```bash
bun run check
bun run build
bun run pack:check
```

What these commands do:

- `bun run check` runs linting, type checking, tests, circular dependency checks, and Effect diagnostics
- `bun run build` produces the distributable Node CLI at `dist/cli.js`
- `bun run pack:check` verifies the final npm tarball contents

## Change Process

1. Follow the existing command surface and local patterns in `src/`.
2. Add or update tests for user-visible behavior.
3. Run the relevant quality checks locally.
4. Update public docs when changing CLI behavior, MCP tools, output shape, configuration, or release flow.
5. Add a changeset for user-visible changes.

## Release Commands

```bash
bunx changeset
bun run release:version
bun run release:publish
```

In normal maintenance, publishing should happen through GitHub Actions rather than manual local publishing.

## Documentation That Must Stay In Sync

Update these files whenever the public surface changes:

- `README.md`
- `SKILL.md`
- `docs/publishing.md`
- `.specs/ultimate-search-effect-cli.md`
