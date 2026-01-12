import dts from "rollup-plugin-dts";
import esbuild, { minify } from "rollup-plugin-esbuild";
import alias from "@rollup/plugin-alias";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pkg = require("./package.json");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dependencyNames = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

/**
 * Externalize:
 * - all deps/peerDeps
 * - node: builtins
 * Keep relative/absolute internal.
 */
const isExternal = (id) => {
  if (id.startsWith("\0")) return false;

  // keep local
  if (id.startsWith(".") || path.isAbsolute(id)) return false;

  // keep src alias (resolved to absolute, but still just in case)
  if (id === "src" || id.startsWith("src/")) return false;

  // node builtins
  if (id.startsWith("node:")) return true;

  // deps/peerDeps
  return dependencyNames.some((dep) => id === dep || id.startsWith(`${dep}/`));
};

const aliasPlugin = alias({
  entries: [{ find: "src", replacement: path.resolve(__dirname, "src") }],
});

const resolvePlugin = nodeResolve({
  extensions: [".ts", ".js"],
});

const commonjsPlugin = commonjs();

/**
 * 1) ESM build (non-minified) for node + browser
 */
const buildEsm = {
  input: {
    node: "src/node.ts",
    browser: "src/browser.ts",
  },
  external: isExternal,
  plugins: [
    esbuild({ target: "es2019" }),
    aliasPlugin,
    resolvePlugin,
    commonjsPlugin,
  ],
  output: [
    {
      dir: "dist",
      format: "es",
      exports: "named",
      entryFileNames: "[name].js", // => dist/node.js, dist/browser.js
      sourcemap: true,
    },
  ],
};

/**
 * 2) ESM build (minified) - optional.
 * Если тебе не нужны *.min.js, можно удалить этот конфиг.
 */
const buildEsmMin = {
  input: {
    node: "src/node.ts",
    browser: "src/browser.ts",
  },
  external: isExternal,
  plugins: [
    esbuild({ target: "es2019" }),
    aliasPlugin,
    resolvePlugin,
    commonjsPlugin,
    minify(),
  ],
  output: [
    {
      dir: "dist",
      format: "es",
      exports: "named",
      entryFileNames: "[name].min.js",
      sourcemap: true,
    },
  ],
};

/**
 * 3) DTS for both entrypoints
 * rollup-plugin-dts понимает объект input.
 * На выходе получишь dist/node.d.ts и dist/browser.d.ts.
 */
const buildDts = {
  input: {
    node: "src/node.ts",
    browser: "src/browser.ts",
  },
  external: isExternal,
  plugins: [dts({ tsconfig: "./tsconfig.json" })],
  output: [
    {
      dir: "dist",
      format: "es",
      entryFileNames: "[name].d.ts",
    },
  ],
};

export default [buildEsm, buildEsmMin, buildDts];
