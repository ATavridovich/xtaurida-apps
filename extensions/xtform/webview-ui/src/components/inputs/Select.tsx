/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface SelectProps {
	name: string;
	label?: string;
	options: string | string[];
	value?: string;
	onChange?: (value: string) => void;
}

export const Select: React.FC<SelectProps> = ({ name, label, options, value, onChange }) => {
	const optionArray = typeof options === 'string' ? options.split(',').map(o => o.trim()) : options;

	return (
		<div className="form-field">
			{label && <label htmlFor={name}>{label}</label>}
			<select
				id={name}
				name={name}
				value={value || ''}
				onChange={(e) => onChange?.(e.target.value)}
			>
				<option value="">-- Select --</option>
				{optionArray.map((option, index) => (
					<option key={index} value={option}>
						{option}
					</option>
				))}
			</select>
		</div>
	);
};
