/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Token, TokenType } from './types';

/**
 * Tokenizer for .xtform files
 * Recognizes component syntax: [% ComponentName /%]
 */
export class Tokenizer {
	private input: string;
	private pos: number = 0;
	private line: number = 1;
	private column: number = 1;

	constructor(input: string) {
		this.input = input;
	}

	/**
	 * Get all tokens from the input
	 */
	public tokenize(): Token[] {
		const tokens: Token[] = [];
		let token: Token;

		while ((token = this.nextToken()).type !== TokenType.EOF) {
			tokens.push(token);
		}

		return tokens;
	}

	/**
	 * Get the next token
	 */
	private nextToken(): Token {
		if (this.pos >= this.input.length) {
			return this.createToken(TokenType.EOF, '');
		}

		// Check for component start: [%
		if (this.peek(2) === '[%') {
			return this.readComponent();
		}

		// Otherwise, read text until we hit a component or EOF
		return this.readText();
	}

	/**
	 * Read a component token
	 * Matches: [% ComponentName /%] or [% ComponentName prop="value" /%]
	 */
	private readComponent(): Token {
		const startLine = this.line;
		const startColumn = this.column;

		// Consume [%
		this.advance(2);
		this.skipWhitespace();

		// Read component name
		let componentContent = '';
		while (this.pos < this.input.length && this.peek(2) !== '/%') {
			componentContent += this.current();
			this.advance();
		}

		// Consume /%]
		if (this.peek(2) === '/%') {
			this.advance(2);
			if (this.current() === ']') {
				this.advance();
			}
		}

		return {
			type: TokenType.ComponentSelfClosing,
			value: componentContent.trim(),
			line: startLine,
			column: startColumn
		};
	}

	/**
	 * Read text until we hit a component or EOF
	 */
	private readText(): Token {
		const startLine = this.line;
		const startColumn = this.column;
		let text = '';

		while (this.pos < this.input.length && this.peek(2) !== '[%') {
			text += this.current();
			this.advance();
		}

		return {
			type: TokenType.Text,
			value: text,
			line: startLine,
			column: startColumn
		};
	}

	/**
	 * Get current character
	 */
	private current(): string {
		return this.input[this.pos];
	}

	/**
	 * Peek ahead n characters
	 */
	private peek(n: number): string {
		return this.input.substring(this.pos, this.pos + n);
	}

	/**
	 * Advance position by n characters
	 */
	private advance(n: number = 1): void {
		for (let i = 0; i < n; i++) {
			if (this.pos < this.input.length) {
				if (this.input[this.pos] === '\n') {
					this.line++;
					this.column = 1;
				} else {
					this.column++;
				}
				this.pos++;
			}
		}
	}

	/**
	 * Skip whitespace
	 */
	private skipWhitespace(): void {
		while (this.pos < this.input.length && /\s/.test(this.current())) {
			this.advance();
		}
	}

	/**
	 * Create a token
	 */
	private createToken(type: TokenType, value: string): Token {
		return {
			type,
			value,
			line: this.line,
			column: this.column
		};
	}
}
