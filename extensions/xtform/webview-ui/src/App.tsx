/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useState, useEffect } from 'react';
import { useVSCode } from './hooks/useVSCode';
import { ComponentPalette } from './components/ComponentPalette';
import { TabBar } from './components/TabBar';
import { FormView } from './components/FormView';
import { EditTemplateView } from './components/EditTemplateView';
import type { ComponentRegistry, XtformAST, ExtensionMessage } from './types/messages';

export function App() {
	const { postMessage, onMessage } = useVSCode();
	const [activeTab, setActiveTab] = useState<'form' | 'edit'>('form');
	const [registry, setRegistry] = useState<ComponentRegistry | null>(null);
	const [ast, setAST] = useState<XtformAST | null>(null);
	const [data, setData] = useState<Record<string, any>>({});
	const [content, setContent] = useState<string>('');
	const [error, setError] = useState<string | null>(null);

	// Listen for messages from extension
	useEffect(() => {
		return onMessage((message: ExtensionMessage) => {
			switch (message.type) {
				case 'init':
					setRegistry(message.registry);
					setAST(message.ast);
					setData(message.data);
					setContent(JSON.stringify(message.ast, null, 2)); // Temporary
					setError(null);
					break;

				case 'update':
					setAST(message.ast);
					setData(message.data);
					setError(null);
					break;

				case 'error':
					setError(message.message);
					break;
			}
		});
	}, [onMessage]);

	// Handle tab switch
	const handleTabSwitch = (newTab: 'form' | 'edit') => {
		setActiveTab(newTab);

		// Request fresh parse when switching to Form View
		if (newTab === 'form') {
			postMessage({ type: 'switchTab', tab: 'form' });
		}
	};

	// Handle content changes in Edit Template View
	const handleContentChange = (newContent: string) => {
		setContent(newContent);
		// Debounced update will be implemented later
		postMessage({ type: 'updateText', content: newContent });
	};

	return (
		<div className="xtform-editor">
			<ComponentPalette registry={registry} />
			<div className="editor-main">
				<TabBar activeTab={activeTab} onTabChange={handleTabSwitch} />
				{error && <div className="error-banner">{error}</div>}
				<div className="editor-content">
					{activeTab === 'form' ? (
						<FormView ast={ast} data={data} />
					) : (
						<EditTemplateView content={content} onChange={handleContentChange} />
					)}
				</div>
			</div>
		</div>
	);
}
