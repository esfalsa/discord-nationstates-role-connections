import esbuild from "rollup-plugin-esbuild";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";

/** @type {import('rollup').RollupOptions} */
export default {
  input: "src/index.ts",
  output: {
    format: "esm",
    file: "dist/index.mjs",
  },
  plugins: [
    commonjs(),
    nodeResolve(),
    esbuild({
      target: "esnext",
      minify: true,
    }),
  ],
};
