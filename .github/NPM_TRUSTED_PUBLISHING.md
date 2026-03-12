# NPM Trusted Publishing Setup

This repository uses **NPM Trusted Publishing** (Provenance) for secure, automated package publishing without managing tokens.

## What is Trusted Publishing?

Trusted Publishing uses OpenID Connect (OIDC) to establish trust between GitHub Actions and npm. This means:

- ✅ No need to create or rotate NPM tokens
- ✅ No secrets to manage in GitHub
- ✅ Automatic provenance attestation for supply chain security
- ✅ Verifiable build artifacts

## Setup Instructions

### 1. Configure npm Package

On npm.com, configure trusted publishing for `@effect-x/ultimate-search`:

1. Go to https://www.npmjs.com/package/@effect-x/ultimate-search/access
2. Click "Publishing Access" → "Trusted Publishers"
3. Click "Add Trusted Publisher"
4. Fill in the form:
   - **Provider:** GitHub Actions
   - **Repository owner:** `xesrevinu`
   - **Repository name:** `ultimate-search`
   - **Workflow name:** `release.yml`
   - **Environment name:** (leave empty)

### 2. Verify Configuration

The repository is already configured correctly:

**package.json:**
```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

**release.yml:**
```yaml
permissions:
  id-token: write # Required for OIDC authentication
  contents: write
  pull-requests: write

env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  NPM_CONFIG_PROVENANCE: true
  # No NPM_TOKEN needed!
```

### 3. First-Time Publishing

For the **first publish** of a new package:

1. Manually publish version 0.1.0 with a token:
   ```bash
   npm login
   npm publish --access public --provenance
   ```

2. Then configure trusted publishing on npm.com

3. All subsequent releases will use trusted publishing automatically

## Benefits

### Supply Chain Security

Every package published includes:
- **Provenance attestation**: Cryptographic proof of where and how the package was built
- **Build transparency**: Links to the exact commit, workflow, and build logs
- **Verification**: Users can verify packages with `npm audit signatures`

### Simplified Workflow

```bash
# Create a changeset
bun run changeset

# Commit and push
git add .
git commit -m "feat: new feature"
git push

# GitHub Actions automatically:
# 1. Creates "Release packages" PR
# 2. When merged, publishes to npm with provenance
# 3. Creates GitHub release
```

## Verification

After publishing, users can verify the package:

```bash
npm install @effect-x/ultimate-search
npm audit signatures
```

This will show:
- ✅ Package has valid provenance
- ✅ Built by GitHub Actions
- ✅ From repository xesrevinu/ultimate-search

## Troubleshooting

### "Provenance generation failed"

Ensure:
- `id-token: write` permission is set
- Using npm 9.5.0 or later (Node.js 18+)
- `NPM_CONFIG_PROVENANCE: true` is set
- Package name matches npm configuration

### "Unauthorized"

For first-time publishing:
- Package must exist on npm first
- Trusted publisher must be configured on npm.com
- Repository and workflow names must match exactly

## References

- [npm Trusted Publishing Documentation](https://docs.npmjs.com/generating-provenance-statements)
- [GitHub OIDC Documentation](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
- [npm Provenance Blog Post](https://github.blog/2023-04-19-introducing-npm-package-provenance/)
