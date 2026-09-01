import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored MediaPipe WASM runtime (public/mediapipe/wasm/*.js) -- a
    // third-party build artifact copied verbatim from node_modules, not
    // code this project owns or should lint.
    "public/mediapipe/**",
  ]),
]);

export default eslintConfig;
