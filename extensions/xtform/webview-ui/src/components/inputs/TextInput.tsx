/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface TextInputProps {
	name: string;
	label?: string;
	placeholder?: string;
	value?: string;
	onChange?: (value: string) => void;
}

export const TextInput: React.FC<TextInputProps> = ({ name, label, placeholder, value, onChange }) => {
	return (
		<div className="form-field">
			{label && <label htmlFor={name}>{label}</label>}
			<input
				type="text"
				id={name}
				name={name}
				placeholder={placeholder}
				value={value || ''}
				onChange={(e) => onChange?.(e.target.value)}
			/>
		</div>
	);
};
