/**
 * Single source of truth for framework adapters.
 *
 * `tsup.config.ts` derives its entry points from this manifest, and
 * `vitest.config.ts` derives its per-adapter test projects (plus the node
 * project's exclude list) from it. `package.json` is static JSON and can't
 * import this module — a guard test (`src/config/test/adapters-sync.test.ts`)
 * asserts the two stay in sync, so adding/removing an adapter means editing
 * exactly two files (this one + `package.json`) instead of four.
 */
export interface AdapterConfig {
  /** Directory name under `src/` — e.g. `react`, `vue`. */
  readonly name: string;
  /** Subpath exposed by the package — `tagix/react`, `tagix/vue`. */
  readonly subpath: string;
  /** Vitest environment for this adapter's tests. */
  readonly environment: "jsdom" | "happy-dom";
}

export const ADAPTERS: readonly AdapterConfig[] = [
  { name: "react", subpath: "./react", environment: "jsdom" },
  { name: "vue", subpath: "./vue", environment: "happy-dom" },
] as const;

/** Glob patterns for every adapter's source directory. */
export const adapterTestGlobs = ADAPTERS.map((a) => `src/${a.name}/**/*.test.ts`);

/** Glob patterns for every adapter's test directory, for the node project's exclude list. */
export const adapterTestExcludeGlobs = ADAPTERS.map((a) => `src/${a.name}/**/*.test.ts`);

/** tsup entry points: the core entry plus one per adapter. */
export const entryPoints = ["src/index.ts", ...ADAPTERS.map((a) => `src/${a.name}/index.ts`)];

/** Package names that adapters depend on — kept external so tsup never bundles them. */
export const adapterExternals = [...ADAPTERS.map((a) => a.name)];
