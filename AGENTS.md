# Information

- Run commands from the monorepo root.
- The package manager used is `bun`.
- Avoid `index.ts` barrel files;

## Structure

- `.repo/`: reference repositories
- `src/`: main files
- `docs/`: project documentation

## Working Loop (for automation)

1. Identify the target app or package.
2. Follow local patterns in that directory.
3. Run focused checks/tests for the target.
4. Prefer `nx affected` for broad changes.

## Quick Commands

```bash
bun run check (typecheck, lint, formatter, test)
bun run build
```

# Specifications

To learn more about previous and current specifications for this project, see
the `.specs/README.md` file.

# Learning more about the "effect" & "@effect/\*" packages

`.repo/effect/README.md` is an authoritative source of information about the
"effect" and "@effect/\*" packages. Read this before looking elsewhere for
information about these packages. It contains the best practices for using
effect.

Use this for learning more about the library, rather than browsing the code in
`node_modules/`.
