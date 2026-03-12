# Publishing

## Overview

This repository publishes the package as `@effect-x/ultimate-search` on npm while keeping `ultimate-search` as the installed executable name.

## Package Conventions

- package name: `@effect-x/ultimate-search`
- binary name: `ultimate-search`
- runtime target: Node.js 20+
- repository package manager: Bun
- versioning and release automation: Changesets + GitHub Actions

## First Publish Checklist

Before the first release, make sure you have:

- npm publish access for the `@effect-x` scope
- an `NPM_TOKEN` secret configured in the GitHub repository
- `main` configured as the default branch
- trusted publishing / provenance configured if you want npm provenance enabled
- final repository metadata ready for `repository`, `homepage`, and `bugs` in `package.json`

## Pre-Release Checklist

Run the full release gate locally:

```bash
bun install
bun run release:check
```

This should confirm that:

- `bun run check` passes
- `bun run build` emits `dist/cli.js`
- `npm pack --dry-run` only includes approved package files
- the README, skill file, and spec still match the shipped command surface

## Changesets Workflow

### Create a changeset

```bash
bunx changeset
```

Use a changeset for any user-visible change, including:

- new or changed CLI flags
- MCP tool surface changes
- output schema changes
- provider behavior changes
- release process or documentation changes that affect users or maintainers

### Apply version updates

```bash
bun run release:version
```

### Publish manually

```bash
bun run release:publish
```

Prefer the GitHub Actions release workflow over manual local publishing.

## GitHub Workflows

### CI

Defined in `.github/workflows/ci.yml`.

It is responsible for:

- installing Node.js and Bun
- running `bun install --frozen-lockfile`
- running `bun run check`
- running `bun run build`
- running `bun run pack:check`

### Release

Defined in `.github/workflows/release.yml`.

It is responsible for:

- reading pending changesets
- opening a release PR when versions need to be updated
- publishing to npm when versioned packages are ready and credentials are available

## Published Files

The npm package boundary is defined by `package.json.files` and currently includes only:

- `dist/`
- `README.md`
- `LICENSE`
- `SKILL.md`

This keeps specs, tests, local scripts, and maintenance-only files out of the npm tarball.
