# NPM Trusted Publishing Setup

This repository uses npm trusted publishing with provenance enabled.

Before the first release:

1. Create the package on npm or publish the first version manually.
2. Configure this GitHub repository as a trusted publisher on npm.
3. Keep `publishConfig.provenance` enabled in `package.json`.

The bundled `release.yml` workflow already includes `id-token: write` and publishes with provenance enabled.
