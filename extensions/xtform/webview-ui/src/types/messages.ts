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
	icon: string;
	description: string;
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

export interface XtformAST {
	uuid: string;
	title: string;
	version: number;
	body: string;
	data: Record<string, any>;
	format: string;
	description?: string;
	extends?: boolean | string;
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
	| { type: 'init'; registry: ComponentRegistry; ast: XtformAST; data: Record<string, any> }
	| { type: 'update'; ast: XtformAST; data: Record<string, any> }
	| { type: 'error'; message: string; errors: ValidationError[] };
