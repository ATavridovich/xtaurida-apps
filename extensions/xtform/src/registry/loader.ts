/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as path from 'path';
import { ComponentManifest, ComponentRegistry, RegistryConfig, RegistryError } from './types';

/**
 * Component Registry Loader
 * Loads registry.yml and all component manifests
 */
export class RegistryLoader {
	private workspaceRoot: string;
	private errors: RegistryError[] = [];

	constructor(workspaceRoot: string) {
		this.workspaceRoot = workspaceRoot;
	}

	/**
	 * Load component registry
	 */
	public async load(): Promise<{ registry: ComponentRegistry | null; errors: RegistryError[] }> {
		this.errors = [];

		try {
			// Load registry.yml
			const registryPath = path.join(this.workspaceRoot, 'components', 'registry.yml');
			console.log('Attempting to load registry from:', registryPath);
			const registryUri = vscode.Uri.file(registryPath);
			const registryContent = await this.readFile(registryUri);

			if (!registryContent) {
				console.error('Registry file not found:', registryPath);
				this.errors.push({
					message: 'Registry file not found: components/registry.yml',
					file: 'registry.yml',
					severity: 'error'
				});
				return { registry: null, errors: this.errors };
			}

			console.log('Registry file loaded, length:', registryContent.length);

			// Parse registry config
			const config = this.parseRegistry(registryContent);
			if (!config) {
				console.error('Failed to parse registry config');
				return { registry: null, errors: this.errors };
			}

			console.log('Registry parsed:', config.palette.length, 'palette tabs');

			// Load all component manifests
			const registry = await this.loadComponents(config);

			console.log('Components loaded:', registry.componentsByName.size, 'total components');

			return { registry, errors: this.errors };

		} catch (error) {
			console.error('Exception in registry loader:', error);
			this.errors.push({
				message: `Failed to load registry: ${error}`,
				severity: 'error'
			});
			return { registry: null, errors: this.errors };
		}
	}

	/**
	 * Parse registry.yml content
	 */
	private parseRegistry(content: string): RegistryConfig | null {
		try {
			// Handle both Unix (\n) and Windows (\r\n) line endings
			const lines = content.split(/\r?\n/);
			console.log('Parsing registry, total lines:', lines.length);
			const config: RegistryConfig = { palette: [] };
			let currentTab: any = null;

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i];
				const trimmed = line.trim();

				// Skip comments and empty lines
				if (trimmed.startsWith('#') || trimmed === '') {
					continue;
				}

				console.log(`Line ${i}: "${line}"`);

				// Parse tab
				if (line.match(/^  - tab:/)) {
					const tabMatch = line.match(/tab:\s*(.+)$/);
					if (tabMatch) {
						currentTab = {
							tab: tabMatch[1].trim(),
							components: []
						};
						config.palette.push(currentTab);
						console.log(`  -> Found tab: ${currentTab.tab}`);
					}
				}
				// Parse description
				else if (line.match(/^    description:/)) {
					const descMatch = line.match(/description:\s*(.+)$/);
					if (descMatch && currentTab) {
						currentTab.description = descMatch[1].trim();
						console.log(`  -> Found description: ${currentTab.description}`);
					}
				}
				// Parse component path
				else if (line.match(/^      - /)) {
					const compMatch = line.match(/- (.+)$/);
					if (compMatch && currentTab) {
						currentTab.components.push(compMatch[1].trim());
						console.log(`  -> Found component: ${compMatch[1].trim()}`);
					}
				}
			}

			console.log('Parsing complete, palette tabs:', config.palette.length);
			return config;

		} catch (error) {
			this.errors.push({
				message: `Failed to parse registry.yml: ${error}`,
				file: 'registry.yml',
				severity: 'error'
			});
			return null;
		}
	}

	/**
	 * Load all component manifests
	 */
	private async loadComponents(config: RegistryConfig): Promise<ComponentRegistry> {
		const registry: ComponentRegistry = {
			tabs: [],
			componentsByName: new Map()
		};

		for (const tabConfig of config.palette) {
			const tab = {
				name: tabConfig.tab,
				description: tabConfig.description,
				components: [] as ComponentManifest[]
			};

			for (const componentPath of tabConfig.components) {
				const manifest = await this.loadComponentManifest(componentPath);
				if (manifest) {
					tab.components.push(manifest);

					// Check for name conflicts
					if (registry.componentsByName.has(manifest.id)) {
						this.errors.push({
							message: `Duplicate component ID: ${manifest.id}`,
							file: componentPath,
							severity: 'error'
						});
					} else {
						registry.componentsByName.set(manifest.id, manifest);
					}
				}
			}

			registry.tabs.push(tab);
		}

		return registry;
	}

	/**
	 * Load a single component manifest
	 */
	private async loadComponentManifest(relativePath: string): Promise<ComponentManifest | null> {
		try {
			const manifestPath = path.join(this.workspaceRoot, 'components', relativePath);
			const manifestUri = vscode.Uri.file(manifestPath);
			const content = await this.readFile(manifestUri);

			if (!content) {
				this.errors.push({
					message: `Component manifest not found: ${relativePath}`,
					file: relativePath,
					severity: 'error'
				});
				return null;
			}

			return this.parseManifest(content, relativePath);

		} catch (error) {
			this.errors.push({
				message: `Failed to load component: ${relativePath} - ${error}`,
				file: relativePath,
				severity: 'error'
			});
			return null;
		}
	}

	/**
	 * Parse component manifest content
	 */
	private parseManifest(content: string, file: string): ComponentManifest | null {
		try {
			// Handle both Unix (\n) and Windows (\r\n) line endings
			const lines = content.split(/\r?\n/);
			const manifest: any = {};

			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed === '' || trimmed.startsWith('#')) {
					continue;
				}

				const match = line.match(/^(\w+):\s*(.+)$/);
				if (match) {
					const key = match[1];
					let value = match[2].trim();

					// Remove quotes
					if ((value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.substring(1, value.length - 1);
					}

					// Convert Unicode escape sequences to actual characters
					if (key === 'icon') {
						// Handle \U00000000 format (8 hex digits)
						value = value.replace(/\\U([0-9A-Fa-f]{8})/g, (match, hex) => {
							const codePoint = parseInt(hex, 16);
							return String.fromCodePoint(codePoint);
						});
						// Handle \u0000 format (4 hex digits)
						value = value.replace(/\\u([0-9A-Fa-f]{4})/g, (match, hex) => {
							const codePoint = parseInt(hex, 16);
							return String.fromCodePoint(codePoint);
						});
					}

					manifest[key] = value;
				}
			}

			// Validate required fields
			if (!manifest.id) {
				this.errors.push({
					message: 'Component manifest missing "id" field',
					file,
					severity: 'error'
				});
				return null;
			}

			if (!manifest.label) {
				this.errors.push({
					message: 'Component manifest missing "label" field',
					file,
					severity: 'error'
				});
				return null;
			}

			if (!manifest.template) {
				this.errors.push({
					message: 'Component manifest missing "template" field',
					file,
					severity: 'error'
				});
				return null;
			}

			return {
				id: manifest.id,
				label: manifest.label,
				icon: manifest.icon,
				template: manifest.template,
				description: manifest.description
			};

		} catch (error) {
			this.errors.push({
				message: `Failed to parse component manifest: ${file} - ${error}`,
				file,
				severity: 'error'
			});
			return null;
		}
	}

	/**
	 * Read file content
	 */
	private async readFile(uri: vscode.Uri): Promise<string | null> {
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			return Buffer.from(bytes).toString('utf8');
		} catch (error) {
			return null;
		}
	}
}
