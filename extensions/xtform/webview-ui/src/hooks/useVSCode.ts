/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { useEffect, useCallback } from 'react';
import type { WebviewMessage, ExtensionMessage } from '../types/messages';

// VS Code API type
interface VSCodeAPI {
	postMessage(message: WebviewMessage): void;
	getState(): any;
	setState(state: any): void;
}

declare global {
	interface Window {
		acquireVsCodeApi(): VSCodeAPI;
	}
}

let vscodeApi: VSCodeAPI | undefined;

/**
 * Get VS Code API (singleton)
 */
export function getVSCodeAPI(): VSCodeAPI {
	if (!vscodeApi) {
		vscodeApi = window.acquireVsCodeApi();
	}
	return vscodeApi;
}

/**
 * Hook for VS Code API communication
 */
export function useVSCode() {
	const vscode = getVSCodeAPI();

	const postMessage = useCallback((message: WebviewMessage) => {
		vscode.postMessage(message);
	}, [vscode]);

	const onMessage = useCallback((handler: (message: ExtensionMessage) => void) => {
		const listener = (event: MessageEvent<ExtensionMessage>) => {
			handler(event.data);
		};
		window.addEventListener('message', listener);
		return () => window.removeEventListener('message', listener);
	}, []);

	// Send ready message on mount
	useEffect(() => {
		postMessage({ type: 'ready' });
	}, [postMessage]);

	return { postMessage, onMessage, vscode };
}
