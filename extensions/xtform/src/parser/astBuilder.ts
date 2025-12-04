/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Token, TokenType, ASTNode, ASTNodeType, ComponentNode, TextNode, ParagraphNode, HeadingNode, DocumentNode, ValidationError } from './types';

/**
 * AST Builder
 * Converts tokens into an Abstract Syntax Tree
 */
export class ASTBuilder {
	private tokens: Token[];
	private pos: number = 0;
	private errors: ValidationError[] = [];

	constructor(tokens: Token[]) {
		this.tokens = tokens;
	}

	/**
	 * Build the AST
	 */
	public build(): { ast: DocumentNode; errors: ValidationError[] } {
		const children: (ParagraphNode | HeadingNode | ComponentNode)[] = [];

		while (this.pos < this.tokens.length) {
			const token = this.current();

			if (token.type === TokenType.Text) {
				// Parse markdown text (headings, paragraphs)
				const nodes = this.parseMarkdown(token);
				children.push(...nodes);
				this.advance();
			} else if (token.type === TokenType.ComponentSelfClosing) {
				// Parse component
				const component = this.parseComponent(token);
				if (component) {
					children.push(component);
				}
				this.advance();
			} else {
				this.advance();
			}
		}

		const ast: DocumentNode = {
			type: ASTNodeType.Document,
			children
		};

		return { ast, errors: this.errors };
	}

	/**
	 * Parse markdown text into paragraphs and headings
	 */
	private parseMarkdown(token: Token): (ParagraphNode | HeadingNode)[] {
		const nodes: (ParagraphNode | HeadingNode)[] = [];
		const lines = token.value.split('\n');

		let currentParagraph: (TextNode | ComponentNode)[] = [];
		let paragraphStart = token.line;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmed = line.trim();

			// Empty line ends current paragraph
			if (trimmed === '') {
				if (currentParagraph.length > 0) {
					nodes.push({
						type: ASTNodeType.Paragraph,
						line: paragraphStart,
						children: currentParagraph
					});
					currentParagraph = [];
				}
				continue;
			}

			// Check for heading
			const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
			if (headingMatch) {
				// End current paragraph if any
				if (currentParagraph.length > 0) {
					nodes.push({
						type: ASTNodeType.Paragraph,
						line: paragraphStart,
						children: currentParagraph
					});
					currentParagraph = [];
				}

				// Create heading node
				nodes.push({
					type: ASTNodeType.Heading,
					level: headingMatch[1].length,
					line: token.line + i,
					children: [{
						type: ASTNodeType.Text,
						value: headingMatch[2],
						line: token.line + i
					}]
				});

				paragraphStart = token.line + i + 1;
				continue;
			}

			// Regular text line
			if (currentParagraph.length === 0) {
				paragraphStart = token.line + i;
			}

			currentParagraph.push({
				type: ASTNodeType.Text,
				value: line + (i < lines.length - 1 ? '\n' : ''),
				line: token.line + i
			});
		}

		// Add remaining paragraph
		if (currentParagraph.length > 0) {
			nodes.push({
				type: ASTNodeType.Paragraph,
				line: paragraphStart,
				children: currentParagraph
			});
		}

		return nodes;
	}

	/**
	 * Parse component token
	 * Format: "ComponentName" or "ComponentName prop1='value1' prop2='value2'"
	 */
	private parseComponent(token: Token): ComponentNode | null {
		const content = token.value.trim();
		if (!content) {
			this.errors.push({
				message: 'Empty component reference',
				line: token.line,
				column: token.column,
				severity: 'error'
			});
			return null;
		}

		// Parse component name and props
		const parts = content.split(/\s+/);
		const name = parts[0];
		const props: Record<string, any> = {};

		// Parse props (simple key=value or key="value")
		for (let i = 1; i < parts.length; i++) {
			const propMatch = parts[i].match(/^(\w+)=(?:"([^"]*)"|'([^']*)'|(\S+))$/);
			if (propMatch) {
				const key = propMatch[1];
				const value = propMatch[2] || propMatch[3] || propMatch[4];
				props[key] = value;
			}
		}

		return {
			type: ASTNodeType.Component,
			name,
			props: Object.keys(props).length > 0 ? props : undefined,
			line: token.line,
			column: token.column
		};
	}

	/**
	 * Get current token
	 */
	private current(): Token {
		return this.tokens[this.pos];
	}

	/**
	 * Advance to next token
	 */
	private advance(): void {
		this.pos++;
	}
}
