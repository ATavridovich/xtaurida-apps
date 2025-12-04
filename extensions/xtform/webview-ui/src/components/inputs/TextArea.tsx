/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface TextAreaProps {
	name: string;
	label?: string;
	placeholder?: string;
	rows?: number;
	value?: string;
	onChange?: (value: string) => void;
}

export const TextArea: React.FC<TextAreaProps> = ({ name, label, placeholder, rows = 4, value, onChange }) => {
	return (
		<div className="form-field">
			{label && <label htmlFor={name}>{label}</label>}
			<textarea
				id={name}
				name={name}
				placeholder={placeholder}
				rows={rows}
				value={value || ''}
				onChange={(e) => onChange?.(e.target.value)}
			/>
		</div>
	);
};
