import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ADAPTERS, entryPoints, adapterExternals } from "../../../adapters.config";

const pkgPath = resolve(__dirname, "../../../package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as {
  exports: Record<string, unknown>;
  peerDependencies: Record<string, string>;
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

  it("every adapter is declared as a peer dependency", () => {
    // peerDependenciesMeta alone is meaningless without peerDependencies.
    // Without this block, tsup has no signal to keep the framework external,
    // and the entire framework gets bundled into the adapter chunk.
    for (const adapter of ADAPTERS) {
      expect(
        pkg.peerDependencies,
        `${adapter.name} must be listed in peerDependencies`
      ).toHaveProperty(adapter.name);
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

  it("every adapter framework is marked external for tsup", () => {
    // If a framework is missing from adapterExternals, tsup bundles it into
    // the adapter chunk — vue ballooned to 2 MB before this guard existed.
    for (const adapter of ADAPTERS) {
      expect(
        adapterExternals,
        `${adapter.name} must be in adapterExternals so tsup keeps it external`
      ).toContain(adapter.name);
    }
  });

  it("adding an adapter to the manifest without updating package.json fails this test", () => {
    // Structural invariant: the counts must match. If someone adds an adapter to
    // adapters.config.ts but forgets package.json exports, this count diverges.
    const adapterExportCount = Object.keys(pkg.exports).filter((k) => k !== ".").length;
    expect(adapterExportCount).toBe(ADAPTERS.length);
  });
});
