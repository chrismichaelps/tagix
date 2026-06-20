import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: ["src/react/**/*.test.ts", "src/vue/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "react",
          environment: "jsdom",
          include: ["src/react/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "vue",
          environment: "happy-dom",
          include: ["src/vue/**/*.test.ts"],
        },
      },
    ],
  },
});
