import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: [resolve(__dirname, 'webview-src/index.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'media/index.js'),
  format: 'iife',
  platform: 'browser',
  sourcemap: true,
  minify: false,
  target: 'ES2022',
  logLevel: 'info',
});

if (isWatch) {
  await ctx.watch();
  console.log('Watching webview...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Webview build complete');
}
