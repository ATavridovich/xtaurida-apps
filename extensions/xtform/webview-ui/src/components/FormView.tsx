/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { XtformAST } from '../types/messages';

interface FormViewProps {
	ast: XtformAST | null;
	data: Record<string, any>;
}

export function FormView({ ast, data }: FormViewProps) {
	if (!ast) {
		return <div className="form-view">Loading form...</div>;
	}

	return (
		<div className="form-view">
			<h2>{ast.title}</h2>
			<div className="form-content">
				<p>Form rendering will be implemented in Phase 4</p>
				<pre>{JSON.stringify(ast, null, 2)}</pre>
			</div>
		</div>
	);
}
