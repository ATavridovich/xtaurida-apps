/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Disposable } from '../util/dispose';
import { getWebviewContent } from './htmlGenerator';

/**
 * Manages the webview panel lifecycle
 */
export class XtformWebviewManager extends Disposable {
	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly document: vscode.TextDocument,
		private readonly webviewPanel: vscode.WebviewPanel,
		private readonly onMessage: (message: any) => void
	) {
		super();

		// Set up webview content
		this.webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(extensionUri, 'dist'),
				vscode.Uri.joinPath(extensionUri, 'media')
			]
		};

		this.webviewPanel.webview.html = getWebviewContent(
			this.webviewPanel.webview,
			this.extensionUri
		);

		// Listen for messages from webview
		this._register(
			this.webviewPanel.webview.onDidReceiveMessage(message => {
				this.onMessage(message);
			})
		);

		// Clean up when webview is disposed
		this._register(
			this.webviewPanel.onDidDispose(() => {
				this.dispose();
			})
		);
	}

	/**
	 * Post message to webview
	 */
	public postMessage(message: any): void {
		this.webviewPanel.webview.postMessage(message);
	}

	/**
	 * Check if webview is still visible
	 */
	public get visible(): boolean {
		return this.webviewPanel.visible;
	}

	/**
	 * Check if webview is active
	 */
	public get active(): boolean {
		return this.webviewPanel.active;
	}
}
