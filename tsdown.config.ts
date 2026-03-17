import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
  },
  outDir: "dist",
  platform: "node",
  format: "esm",
  sourcemap: true,
  clean: true,
  fixedExtension: false,
});
