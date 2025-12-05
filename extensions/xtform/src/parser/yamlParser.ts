/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { XtformMetadata, ValidationError } from './types';

/**
 * Parse YAML frontmatter and data section from .xtform file
 * Expected format:
 * ---
 * title: My Form
 * description: A sample form
 * version: 1.0.0
 * ---
 *
 * Body content here
 *
 * ---
 * data:
 *   fieldName: value
 * ---
 */
export class YamlParser {
	/**
	 * Extract and parse YAML frontmatter and data section
	 * Returns metadata, body content, and data
	 */
	public static parse(content: string): {
		metadata: XtformMetadata;
		body: string;
		data: Record<string, any>;
		errors: ValidationError[]
	} {
		const errors: ValidationError[] = [];
		let metadata: XtformMetadata = {};
		let body = content;
		let data: Record<string, any> = {};

		// Check for YAML frontmatter (handle both \n and \r\n line endings)
		const frontmatterMatch = content.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---\s*[\r\n]+([\s\S]*)$/);

		if (frontmatterMatch) {
			const yamlContent = frontmatterMatch[1];
			const restContent = frontmatterMatch[2];

			// Parse metadata
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

			// Check if there's a data section at the end
			const dataMatch = restContent.match(/^([\s\S]*?)[\r\n]+---[\r\n]+data:([\s\S]*?)(?:[\r\n]+---\s*)?$/);

			if (dataMatch) {
				body = dataMatch[1].trim();
				const dataContent = dataMatch[2];

				// Parse data section (simple key: value pairs with indentation)
				data = this.parseDataSection(dataContent, errors);
			} else {
				body = restContent.trim();
			}
		}

		return { metadata, body, data, errors };
	}

	/**
	 * Parse data section (indented key-value pairs)
	 */
	private static parseDataSection(content: string, errors: ValidationError[]): Record<string, any> {
		const data: Record<string, any> = {};
		const lines = content.split(/\r?\n/);

		for (const line of lines) {
			const trimmed = line.trim();

			// Skip empty lines and comments
			if (trimmed === '' || trimmed.startsWith('#')) {
				continue;
			}

			// Parse key: value (with 2-space indentation)
			const match = line.match(/^\s{2}(\w+):\s*(.*)$/);
			if (match) {
				const key = match[1];
				let value: any = match[2].trim();

				// Parse different value types
				if (value === '') {
					value = '';
				} else if (value === 'true') {
					value = true;
				} else if (value === 'false') {
					value = false;
				} else if (value === 'null') {
					value = null;
				} else if (/^\d+$/.test(value)) {
					value = parseInt(value, 10);
				} else if (/^\d+\.\d+$/.test(value)) {
					value = parseFloat(value);
				} else if ((value.startsWith('"') && value.endsWith('"')) ||
					(value.startsWith("'") && value.endsWith("'"))) {
					value = value.substring(1, value.length - 1);
				}

				data[key] = value;
			}
		}

		return data;
	}

	/**
	 * Serialize metadata to YAML frontmatter
	 */
	public static serializeMetadata(metadata: XtformMetadata): string {
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

	/**
	 * Serialize data section to YAML format
	 */
	public static serializeData(data: Record<string, any>): string {
		if (Object.keys(data).length === 0) {
			return '';
		}

		let yaml = '---\ndata:\n';
		for (const [key, value] of Object.entries(data)) {
			const serializedValue = this.serializeValue(value);
			yaml += `  ${key}: ${serializedValue}\n`;
		}
		yaml += '---\n';

		return yaml;
	}

	/**
	 * Serialize a single value
	 */
	private static serializeValue(value: any): string {
		if (value === null) {
			return 'null';
		} else if (value === true) {
			return 'true';
		} else if (value === false) {
			return 'false';
		} else if (typeof value === 'number') {
			return value.toString();
		} else if (typeof value === 'string') {
			// Quote strings that contain special characters
			if (value.includes(':') || value.includes('#') || value.includes('\n')) {
				return `"${value.replace(/"/g, '\\"')}"`;
			}
			return `"${value}"`;
		} else if (Array.isArray(value)) {
			return JSON.stringify(value);
		} else if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}
}
