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
		// Step 1: Extract YAML frontmatter
		const { metadata, body, errors: yamlErrors } = YamlParser.parse(content);

		// Step 2: Tokenize the body
		const tokenizer = new Tokenizer(body);
		const tokens = tokenizer.tokenize();

		// Step 3: Build AST
		const astBuilder = new ASTBuilder(tokens);
		const { ast: bodyAST, errors: astErrors } = astBuilder.build();

		// Combine results
		const ast: XtformAST = {
			metadata,
			body: bodyAST
		};

		const errors = [...yamlErrors, ...astErrors];

		return { ast, errors };
	}
}

// Re-export types
export * from './types';
