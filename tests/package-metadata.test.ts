import { describe, expect, it } from "vitest";
import PackageJson from "../package.json" with { type: "json" };

describe("package metadata", () => {
  it("publishes under the @effect-x scope with an explicit tarball boundary", () => {
    expect(PackageJson.name).toBe("@effect-x/ultimate-search");
    expect(PackageJson.bin).toEqual({
      "ultimate-search": "./dist/cli.js",
    });
    expect(PackageJson.files).toEqual(["dist", "src", "README.md", "LICENSE", "SKILL.md"]);
    expect(PackageJson.publishConfig).toEqual({
      access: "public",
      provenance: true,
    });
  });

  it("keeps release safety scripts in place", () => {
    expect(PackageJson.scripts.prepack).toBe("bun run build");
    expect(PackageJson.scripts["pack:check"]).toBe("npm pack --dry-run");
    expect(PackageJson.scripts["release:check"]).toBe("bun run check && bun run pack:check");
  });
});
