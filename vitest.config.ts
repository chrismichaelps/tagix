import { defineConfig } from "vitest/config";
import { ADAPTERS, adapterTestExcludeGlobs } from "./adapters.config";

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: adapterTestExcludeGlobs,
        },
      },
      ...ADAPTERS.map((adapter) => ({
        test: {
          name: adapter.name,
          environment: adapter.environment,
          include: [`src/${adapter.name}/**/*.test.ts`],
        },
      })),
    ],
  },
});
