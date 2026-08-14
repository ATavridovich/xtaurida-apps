import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: [resolve(__dirname, 'src/extension.ts')],
  bundle: true,
  outfile: resolve(__dirname, 'out/extension.js'),
  external: ['vscode'],
  format: 'cjs',
  platform: 'node',
  sourcemap: true,
  minify: false,
  target: 'ES2022',
  logLevel: 'info',
});

if (isWatch) {
  await ctx.watch();
  console.log('Watching extension...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Extension build complete');
}
