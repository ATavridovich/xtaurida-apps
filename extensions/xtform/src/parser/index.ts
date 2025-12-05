/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Tokenizer } from './tokenizer';
import { YamlParser } from './yamlParser';
import { ASTBuilder } from './astBuilder';
import { XtformAST, ParseResult } from './types';

/**
 * Main parser for .xtform files
 */
export class XtformParser {
	/**
	 * Parse .xtform file content
	 */
	public static parse(content: string): ParseResult {
		// Step 1: Extract YAML frontmatter and data section
		const { metadata, body, data, errors: yamlErrors } = YamlParser.parse(content);

		// Step 2: Tokenize the body
		const tokenizer = new Tokenizer(body);
		const tokens = tokenizer.tokenize();

		// Step 3: Build AST
		const astBuilder = new ASTBuilder(tokens);
		const { ast: bodyAST, errors: astErrors } = astBuilder.build();

		// Combine results
		const ast: XtformAST = {
			metadata,
			body: bodyAST,
			data
		};

		const errors = [...yamlErrors, ...astErrors];

		return { ast, errors };
	}

	/**
	 * Serialize AST back to .xtform file content
	 */
	public static serialize(ast: XtformAST): string {
		let content = '';

		// Serialize metadata
		content += YamlParser.serializeMetadata(ast.metadata);
		content += '\n';

		// Serialize body (currently simplified - just convert AST to string)
		// TODO: Implement proper AST-to-markdown serialization
		content += this.serializeBody(ast.body);
		content += '\n\n';

		// Serialize data section
		if (ast.data && Object.keys(ast.data).length > 0) {
			content += YamlParser.serializeData(ast.data);
		}

		return content;
	}

	/**
	 * Serialize body AST to markdown/text
	 * Simplified version - preserves structure but not perfect formatting
	 */
	public static serializeBody(node: any): string {
		if (!node) {
			return '';
		}

		switch (node.type) {
			case 'Document':
				return node.children?.map((child: any) => this.serializeBody(child)).join('\n\n') || '';

			case 'Heading':
				const headingPrefix = '#'.repeat(node.level);
				const headingText = node.children?.map((child: any) => this.serializeBody(child)).join('') || '';
				return `${headingPrefix} ${headingText}`;

			case 'Paragraph':
				return node.children?.map((child: any) => this.serializeBody(child)).join('') || '';

			case 'Text':
				return node.value || '';

			case 'Component':
				const props = node.props || {};
				const propsStr = Object.entries(props)
					.map(([key, value]) => {
						if (typeof value === 'string') {
							// Quote strings (values are already unescaped from parser)
							return `${key}="${value}"`;
						} else if (typeof value === 'number') {
							return `${key}={${value}}`;
						} else if (typeof value === 'boolean') {
							return value ? key : '';
						}
						return `${key}={${JSON.stringify(value)}}`;
					})
					.filter(p => p)
					.join(' ');

				return propsStr ? `[% ${node.name} ${propsStr} /%]` : `[% ${node.name} /%]`;

			default:
				return '';
		}
	}
}

// Re-export types
export * from './types';
