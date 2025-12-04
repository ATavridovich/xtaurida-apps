/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { XtformEditorProvider } from './xtformEditorProvider';

/**
 * Extension activation
 */
export function activate(context: vscode.ExtensionContext) {
	console.log('XForm extension activated');

	// Register custom text editor provider
	const provider = new XtformEditorProvider(context);
	const registration = vscode.window.registerCustomEditorProvider(
		XtformEditorProvider.viewType,
		provider,
		{
			webviewOptions: {
				retainContextWhenHidden: true
			},
			supportsMultipleEditorsPerDocument: false
		}
	);

	context.subscriptions.push(registration);
}

/**
 * Extension deactivation
 */
export function deactivate() {
	console.log('XForm extension deactivated');
}
