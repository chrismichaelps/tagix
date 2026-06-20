import { defineConfig } from "tsup";
import { entryPoints } from "./adapters.config";

export default defineConfig({
  entry: entryPoints,
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  platform: "node",
});
