import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADAPTERS, entryPoints } from "../../../adapters.config";

const pkgPath = resolve(__dirname, "../../../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
  exports: Record<string, unknown>;
  peerDependenciesMeta: Record<string, { optional?: boolean }>;
};

describe("adapters.config ↔ package.json sync", () => {
  it("every adapter has a matching export in package.json", () => {
    for (const adapter of ADAPTERS) {
      expect(pkg.exports, `package.json must export ${adapter.subpath}`).toHaveProperty(
        adapter.subpath
      );
    }
  });

  it("no phantom exports exist that the manifest does not declare", () => {
    const declared = new Set([".", ...ADAPTERS.map((a) => a.subpath)]);
    const exported = Object.keys(pkg.exports);
    for (const sub of exported) {
      expect(declared, `package.json export ${sub} has no matching adapter`).toContain(sub);
    }
  });

  it("every adapter is marked as an optional peer dependency", () => {
    for (const adapter of ADAPTERS) {
      expect(
        pkg.peerDependenciesMeta,
        `${adapter.name} must be an optional peer dependency`
      ).toHaveProperty(adapter.name);
      expect(pkg.peerDependenciesMeta[adapter.name]?.optional).toBe(true);
    }
  });

  it("every adapter has a tsup entry point", () => {
    for (const adapter of ADAPTERS) {
      expect(
        entryPoints,
        `entryPoints must include src/${adapter.name}/index.ts`
      ).toContain(`src/${adapter.name}/index.ts`);
    }
  });

  it("adding an adapter to the manifest without updating package.json fails this test", () => {
    // Structural invariant: the counts must match. If someone adds an adapter to
    // adapters.config.ts but forgets package.json exports, this count diverges.
    const adapterExportCount = Object.keys(pkg.exports).filter((k) => k !== ".").length;
    expect(adapterExportCount).toBe(ADAPTERS.length);
  });
});
