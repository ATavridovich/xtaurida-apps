/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as esbuild from 'esbuild';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const watch = process.argv.includes('--watch');

/**
 * Build configuration for webview UI (React)
 */
const webviewConfig = {
	entryPoints: [join(__dirname, 'webview-ui', 'src', 'index.tsx')],
	outfile: join(__dirname, 'dist', 'webview.js'),
	bundle: true,
	minify: !watch,
	sourcemap: watch ? 'inline' : false,
	format: 'iife',
	platform: 'browser',
	target: ['es2020'],
	loader: {
		'.tsx': 'tsx',
		'.ts': 'ts'
	},
	define: {
		'process.env.NODE_ENV': watch ? '"development"' : '"production"'
	}
};

/**
 * Build configuration for extension (Node.js)
 */
const extensionConfig = {
	entryPoints: [join(__dirname, 'src', 'extension.ts')],
	outfile: join(__dirname, 'dist', 'extension.js'),
	bundle: true,
	minify: !watch,
	sourcemap: watch ? 'inline' : false,
	format: 'cjs',
	platform: 'node',
	target: ['node16'],
	external: ['vscode'],
	loader: {
		'.ts': 'ts'
	}
};

async function build() {
	try {
		if (watch) {
			console.log('Building in watch mode...');
			const webviewContext = await esbuild.context(webviewConfig);
			const extensionContext = await esbuild.context(extensionConfig);

			await Promise.all([
				webviewContext.watch(),
				extensionContext.watch()
			]);

			console.log('Watching for changes...');
		} else {
			console.log('Building...');
			await Promise.all([
				esbuild.build(webviewConfig),
				esbuild.build(extensionConfig)
			]);
			console.log('Build complete!');
		}
	} catch (error) {
		console.error('Build failed:', error);
		process.exit(1);
	}
}

build();
