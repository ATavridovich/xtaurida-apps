/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React, { useRef, useEffect, useCallback } from 'react';
import Editor from '@monaco-editor/react';

interface EditTemplateViewProps {
	content: string;
	onChange: (content: string) => void;
}

export function EditTemplateView({ content, onChange }: EditTemplateViewProps) {
	const editorRef = useRef<any>(null);
	const valueRef = useRef<string>(content);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const isExternalUpdateRef = useRef<boolean>(false);

	// Update editor value only when content changes from outside (not from user typing)
	useEffect(() => {
		if (editorRef.current && content !== valueRef.current) {
			isExternalUpdateRef.current = true;
			const editor = editorRef.current;
			const currentPosition = editor.getPosition();
			valueRef.current = content;
			editor.setValue(content);
			if (currentPosition) {
				editor.setPosition(currentPosition);
			}
			// Reset flag after a short delay
			setTimeout(() => {
				isExternalUpdateRef.current = false;
			}, 100);
		}
	}, [content]);

	const handleEditorChange = useCallback((value: string | undefined) => {
		if (value !== undefined && !isExternalUpdateRef.current) {
			valueRef.current = value;

			// Clear existing timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			// Debounce the onChange callback to extension
			timeoutRef.current = setTimeout(() => {
				onChange(value);
			}, 500); // 500ms debounce
		}
	}, [onChange]);

	const handleEditorDidMount = (editor: any, monaco: any) => {
		console.log('Monaco editor mounted successfully');
		editorRef.current = editor;
		valueRef.current = content;

		// Define VS Code theme colors
		monaco.editor.defineTheme('vscode-theme', {
			base: 'vs-dark',
			inherit: true,
			rules: [],
			colors: {
				'editor.background': '#1e1e1e',
				'editor.foreground': '#d4d4d4',
				'editorLineNumber.foreground': '#858585',
				'editorLineNumber.activeForeground': '#c6c6c6',
				'editor.selectionBackground': '#264f78',
				'editor.inactiveSelectionBackground': '#3a3d41',
				'editorCursor.foreground': '#aeafad',
			}
		});

		monaco.editor.setTheme('vscode-theme');
	};

	return (
		<div className="edit-template-view">
			<Editor
				height="100%"
				defaultLanguage="markdown"
				defaultValue={content}
				onChange={handleEditorChange}
				onMount={handleEditorDidMount}
				loading={<div style={{ padding: '20px', color: 'var(--vscode-foreground)' }}>Loading Monaco Editor...</div>}
				options={{
					minimap: { enabled: false },
					fontSize: 14,
					lineNumbers: 'on',
					wordWrap: 'on',
					automaticLayout: true,
					scrollBeyondLastLine: false,
					tabSize: 2,
				}}
			/>
		</div>
	);
}
