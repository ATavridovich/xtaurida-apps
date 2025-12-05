/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Token types for the .xtform tokenizer
 */
export enum TokenType {
	Text = 'Text',
	ComponentStart = 'ComponentStart',
	ComponentEnd = 'ComponentEnd',
	ComponentSelfClosing = 'ComponentSelfClosing',
	EOF = 'EOF'
}

/**
 * Token structure
 */
export interface Token {
	type: TokenType;
	value: string;
	line: number;
	column: number;
}

/**
 * Component reference in the document
 */
export interface ComponentRef {
	name: string;
	props?: Record<string, any>;
	line: number;
	column: number;
}

/**
 * AST Node types
 */
export enum ASTNodeType {
	Document = 'Document',
	Text = 'Text',
	Component = 'Component',
	Paragraph = 'Paragraph',
	Heading = 'Heading'
}

/**
 * Base AST Node
 */
export interface ASTNode {
	type: ASTNodeType;
	line?: number;
	column?: number;
}

/**
 * Text node
 */
export interface TextNode extends ASTNode {
	type: ASTNodeType.Text;
	value: string;
}

/**
 * Component node
 */
export interface ComponentNode extends ASTNode {
	type: ASTNodeType.Component;
	name: string;
	props?: Record<string, any>;
}

/**
 * Paragraph node
 */
export interface ParagraphNode extends ASTNode {
	type: ASTNodeType.Paragraph;
	children: (TextNode | ComponentNode)[];
}

/**
 * Heading node
 */
export interface HeadingNode extends ASTNode {
	type: ASTNodeType.Heading;
	level: number;
	children: (TextNode | ComponentNode)[];
}

/**
 * Document root node
 */
export interface DocumentNode extends ASTNode {
	type: ASTNodeType.Document;
	children: (ParagraphNode | HeadingNode | ComponentNode)[];
}

/**
 * XForm AST structure
 */
export interface XtformAST {
	metadata: XtformMetadata;
	body: DocumentNode;
	data: Record<string, any>;
}

/**
 * XForm metadata (from YAML frontmatter)
 */
export interface XtformMetadata {
	title?: string;
	description?: string;
	version?: string;
	[key: string]: any;
}

/**
 * Validation error
 */
export interface ValidationError {
	message: string;
	line?: number;
	column?: number;
	severity: 'error' | 'warning';
}

/**
 * Parse result
 */
export interface ParseResult {
	ast: XtformAST;
	errors: ValidationError[];
}
