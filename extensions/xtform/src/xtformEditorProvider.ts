/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { XtformWebviewManager } from './webview/xtformWebviewManager';
import { XtformParser } from './parser';
import { RegistryLoader, ComponentRegistry } from './registry';

/**
 * Provider for .xtform custom text editor
 */
export class XtformEditorProvider implements vscode.CustomTextEditorProvider {
	public static readonly viewType = 'xtform.editor';
	private registry: ComponentRegistry | null = null;
	private registryLoadPromise: Promise<void> | null = null;

	constructor(private readonly context: vscode.ExtensionContext) {
		// Start loading registry asynchronously
		this.registryLoadPromise = this.loadRegistry();
	}

	/**
	 * Load component registry
	 */
	private async loadRegistry(): Promise<void> {
		try {
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (!workspaceFolder) {
				console.warn('No workspace folder found, component registry not loaded');
				return;
			}

			console.log('Loading registry from workspace:', workspaceFolder.uri.fsPath);
			const loader = new RegistryLoader(workspaceFolder.uri.fsPath);
			const { registry, errors } = await loader.load();

			if (errors.length > 0) {
				console.warn('Registry loading errors:', errors);
				errors.forEach(err => console.warn(`  - ${err.file}: ${err.message}`));
			}

			if (registry) {
				this.registry = registry;
				console.log('Component registry loaded successfully:');
				console.log(`  - ${registry.tabs.length} tabs`);
				registry.tabs.forEach(tab => {
					console.log(`  - Tab "${tab.name}": ${tab.components.length} components`);
				});
			} else {
				console.error('Registry is null after loading');
			}
		} catch (error) {
			console.error('Failed to load component registry:', error);
		}
	}

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
			// Ensure registry is loaded
			if (this.registryLoadPromise) {
				await this.registryLoadPromise;
				this.registryLoadPromise = null;
			}

			// Parse document content
			const content = document.getText();
			const parseResult = XtformParser.parse(content);

			// Send parsed data to webview
			webviewManager.postMessage({
				type: 'update',
				registry: this.registry,
				ast: parseResult.ast,
				errors: parseResult.errors
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
