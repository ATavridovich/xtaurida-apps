/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface EditTemplateViewProps {
	content: string;
	onChange: (content: string) => void;
}

export function EditTemplateView({ content, onChange }: EditTemplateViewProps) {
	return (
		<div className="edit-template-view">
			<p>Monaco editor will be integrated in Phase 5</p>
			<textarea
				className="template-editor"
				value={content}
				onChange={(e) => onChange(e.target.value)}
				placeholder="Edit .xtform content here..."
			/>
		</div>
	);
}
