/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { XtformWebviewManager } from './webview/xtformWebviewManager';

/**
 * Provider for .xtform custom text editor
 */
export class XtformEditorProvider implements vscode.CustomTextEditorProvider {
	public static readonly viewType = 'xtform.editor';

	constructor(private readonly context: vscode.ExtensionContext) { }

	/**
	 * Called when a custom editor is opened
	 */
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		token: vscode.CancellationToken
	): Promise<void> {
		// Create webview manager
		const webviewManager = new XtformWebviewManager(
			this.context.extensionUri,
			document,
			webviewPanel,
			(message) => this.handleWebviewMessage(document, webviewManager, message)
		);

		// Listen for document changes
		const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
			if (e.document.uri.toString() === document.uri.toString()) {
				this.updateWebview(document, webviewManager, true);
			}
		});

		// Clean up when webview is disposed
		webviewPanel.onDidDispose(() => {
			changeDocumentSubscription.dispose();
			webviewManager.dispose();
		});

		// Send initial data to webview
		await this.updateWebview(document, webviewManager, true);
	}

	/**
	 * Handle messages from webview
	 */
	private async handleWebviewMessage(
		document: vscode.TextDocument,
		webviewManager: XtformWebviewManager,
		message: any
	): Promise<void> {
		switch (message.type) {
			case 'ready':
				// Webview is ready, send initial data
				await this.updateWebview(document, webviewManager, true);
				break;

			case 'switchTab':
				// User switched tabs - parse immediately if switching to Form View
				if (message.tab === 'form') {
					await this.updateWebview(document, webviewManager, true);
				}
				break;

			case 'updateText':
				// User edited text in Edit Template View
				// For now, we'll apply changes immediately
				// TODO: Implement debouncing in Phase 2
				await this.updateDocument(document, message.content);
				break;

			case 'updateData':
				// User changed a form field value
				// TODO: Implement in Phase 4
				console.log('Update data:', message.name, message.value);
				break;

			case 'insertComponent':
				// User dragged component from palette
				// TODO: Implement in Phase 3
				console.log('Insert component:', message.template);
				break;
		}
	}

	/**
	 * Update webview with parsed document data
	 */
	private async updateWebview(
		document: vscode.TextDocument,
		webviewManager: XtformWebviewManager,
		force: boolean
	): Promise<void> {
		try {
			const content = document.getText();

			// TODO: Implement actual parsing in Phase 2
			// For now, send dummy data
			const dummyAST = {
				uuid: 'test-uuid',
				title: 'Test Form',
				version: 1,
				body: content,
				data: {},
				format: '1.2'
			};

			const dummyRegistry = {
				tabs: [{
					name: 'Basic Inputs',
					description: 'Standard form input components',
					components: [
						{
							id: 'text-input',
							label: 'Text Input',
							// allow-any-unicode-next-line
							icon: '📝',
							description: 'Single-line text field',
							template: '[% TextInput name="field" label="Label" /%]'
						}
					]
				}]
			};

			webviewManager.postMessage({
				type: 'init',
				registry: dummyRegistry,
				ast: dummyAST,
				data: {}
			});

		} catch (error) {
			webviewManager.postMessage({
				type: 'error',
				message: error instanceof Error ? error.message : 'Unknown error',
				errors: []
			});
		}
	}

	/**
	 * Update the text document
	 */
	private async updateDocument(
		document: vscode.TextDocument,
		content: string
	): Promise<void> {
		const edit = new vscode.WorkspaceEdit();
		edit.replace(
			document.uri,
			new vscode.Range(0, 0, document.lineCount, 0),
			content
		);
		await vscode.workspace.applyEdit(edit);
	}
}
