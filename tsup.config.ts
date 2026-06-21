import { defineConfig } from "tsup";
import { entryPoints, adapterExternals } from "./adapters.config";

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
  // Adapter frameworks (react, vue) are optional peer dependencies —
  // never bundle them; consumers provide their own copy.
  external: [...adapterExternals],
});
