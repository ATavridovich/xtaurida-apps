/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Message types for communication between webview and extension
 */

export interface ComponentManifest {
	id: string;
	label: string;
	icon?: string;
	description?: string;
	template: string;
	requiresName?: boolean;
	isContainer?: boolean;
}

export interface ComponentRegistry {
	tabs: Array<{
		name: string;
		description: string;
		components: ComponentManifest[];
	}>;
}

export interface XtformMetadata {
	title?: string;
	description?: string;
	version?: string;
	[key: string]: any;
}

export interface ASTNode {
	type: string;
	line?: number;
	column?: number;
	[key: string]: any;
}

export interface XtformAST {
	metadata: XtformMetadata;
	body: ASTNode;
}

export interface ValidationError {
	line?: number;
	column?: number;
	message: string;
	severity: 'error' | 'warning';
}

// Webview → Extension messages
export type WebviewMessage =
	| { type: 'ready' }
	| { type: 'switchTab'; tab: 'form' | 'edit' }
	| { type: 'updateText'; content: string }
	| { type: 'updateData'; name: string; value: any }
	| { type: 'insertComponent'; template: string; position?: number };

// Extension → Webview messages
export type ExtensionMessage =
	| { type: 'update'; registry: ComponentRegistry | null; ast: XtformAST; errors: ValidationError[] }
	| { type: 'error'; message: string; errors: ValidationError[] };
