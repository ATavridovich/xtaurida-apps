/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { XtformMetadata, ValidationError } from './types';

/**
 * Parse YAML frontmatter from .xtform file
 * Expected format:
 * ---
 * title: My Form
 * description: A sample form
 * version: 1.0.0
 * ---
 */
export class YamlParser {
	/**
	 * Extract and parse YAML frontmatter
	 * Returns metadata and the remaining body content
	 */
	public static parse(content: string): { metadata: XtformMetadata; body: string; errors: ValidationError[] } {
		const errors: ValidationError[] = [];
		let metadata: XtformMetadata = {};
		let body = content;

		// Check for YAML frontmatter (handle both \n and \r\n line endings)
		const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/);

		if (frontmatterMatch) {
			const yamlContent = frontmatterMatch[1];
			body = frontmatterMatch[2];

			// Parse YAML content (simple key: value pairs)
			const lines = yamlContent.split(/\r?\n/);
			let currentLine = 2; // Start at line 2 (after first ---)

			for (const line of lines) {
				currentLine++;

				// Skip empty lines and comments
				if (line.trim() === '' || line.trim().startsWith('#')) {
					continue;
				}

				// Parse key: value
				const match = line.match(/^(\w+):\s*(.+)$/);
				if (match) {
					const key = match[1];
					let value: any = match[2].trim();

					// Remove quotes if present
					if ((value.startsWith('"') && value.endsWith('"')) ||
						(value.startsWith("'") && value.endsWith("'"))) {
						value = value.substring(1, value.length - 1);
					}

					// Try to parse as number
					if (/^\d+$/.test(value)) {
						value = parseInt(value, 10);
					} else if (/^\d+\.\d+$/.test(value)) {
						value = parseFloat(value);
					}

					// Try to parse as boolean
					if (value === 'true') {
						value = true;
					} else if (value === 'false') {
						value = false;
					}

					metadata[key] = value;
				} else if (line.trim() !== '') {
					errors.push({
						message: `Invalid YAML syntax: ${line}`,
						line: currentLine,
						severity: 'warning'
					});
				}
			}
		}

		return { metadata, body, errors };
	}

	/**
	 * Serialize metadata to YAML frontmatter
	 */
	public static serialize(metadata: XtformMetadata): string {
		if (Object.keys(metadata).length === 0) {
			return '';
		}

		let yaml = '---\n';
		for (const [key, value] of Object.entries(metadata)) {
			if (typeof value === 'string' && (value.includes(':') || value.includes('#'))) {
				yaml += `${key}: "${value}"\n`;
			} else {
				yaml += `${key}: ${value}\n`;
			}
		}
		yaml += '---\n';

		return yaml;
	}
}
