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
	private updateTimeouts: Map<string, NodeJS.Timeout> = new Map();
	private skipNextWebviewUpdate: Map<string, boolean> = new Map();

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
				const docUri = document.uri.toString();
				// Skip webview update if the change came from Edit Template View
				if (this.skipNextWebviewUpdate.get(docUri)) {
					this.skipNextWebviewUpdate.delete(docUri);
					return;
				}
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
				// Set flag to skip webview update after document change
				this.skipNextWebviewUpdate.set(document.uri.toString(), true);
				await this.updateDocument(document, message.content);
				break;

			case 'updateData':
				// User changed a form field value
				console.log('Update data:', message.name, message.value);
				await this.updateFieldData(document, webviewManager, message.name, message.value);
				break;

			case 'insertComponent':
				// User clicked component from palette
				console.log('Insert component:', message.template);
				await this.insertComponentTemplate(document, webviewManager, message.template);
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

			// Serialize body to markdown for Edit View
			const bodyText = XtformParser.serializeBody(parseResult.ast.body);

			// Send parsed data to webview
			webviewManager.postMessage({
				type: 'update',
				registry: this.registry,
				ast: parseResult.ast,
				bodyText: bodyText,
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
	 * Update a single field's data with debouncing
	 */
	private async updateFieldData(
		document: vscode.TextDocument,
		webviewManager: XtformWebviewManager,
		fieldName: string,
		value: any
	): Promise<void> {
		const docUri = document.uri.toString();

		// Clear existing timeout for this document
		const existingTimeout = this.updateTimeouts.get(docUri);
		if (existingTimeout) {
			clearTimeout(existingTimeout);
		}

		// Set new timeout for debounced update
		const timeout = setTimeout(async () => {
			try {
				// Parse current document
				const content = document.getText();
				const parseResult = XtformParser.parse(content);

				// Update data field
				parseResult.ast.data[fieldName] = value;

				// Serialize back to text
				const newContent = XtformParser.serialize(parseResult.ast);

				// Update document
				await this.updateDocument(document, newContent);

				// Remove timeout from map
				this.updateTimeouts.delete(docUri);
			} catch (error) {
				console.error('Failed to update field data:', error);
			}
		}, 500); // 500ms debounce

		this.updateTimeouts.set(docUri, timeout);
	}

	/**
	 * Insert a component template at the end of the document body
	 */
	private async insertComponentTemplate(
		document: vscode.TextDocument,
		webviewManager: XtformWebviewManager,
		template: string
	): Promise<void> {
		try {
			// Get current document content
			const content = document.getText();

			// Find the data section (if it exists)
			const dataMatch = content.match(/\n---\r?\ndata:/);

			let newContent: string;
			if (dataMatch && dataMatch.index !== undefined) {
				// Insert before data section
				const beforeData = content.substring(0, dataMatch.index);
				const dataSection = content.substring(dataMatch.index);
				newContent = beforeData + '\n\n' + template + '\n' + dataSection;
			} else {
				// No data section, append at end
				newContent = content.trimEnd() + '\n\n' + template + '\n';
			}

			// Update document
			await this.updateDocument(document, newContent);

			// Refresh webview
			await this.updateWebview(document, webviewManager, true);
		} catch (error) {
			console.error('Failed to insert component template:', error);
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
