// @ts-check
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  platform: 'node',
  format: 'esm',
  target: 'esnext',
  skipNodeModulesBundle: true,
  clean: true,
  shims: false,
  minify: false,
  splitting: false,
  keepNames: true,
  dts: false,
  sourcemap: true,
  // noExternal: [/.*/],
  treeshake: 'smallest',
  define: { __rootname: JSON.stringify(__dirname), },
})