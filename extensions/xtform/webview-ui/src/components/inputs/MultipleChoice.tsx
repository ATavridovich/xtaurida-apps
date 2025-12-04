/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface MultipleChoiceProps {
	name: string;
	label?: string;
	options: string | string[];
	value?: string[];
	onChange?: (value: string[]) => void;
}

export const MultipleChoice: React.FC<MultipleChoiceProps> = ({ name, label, options, value = [], onChange }) => {
	const optionArray = typeof options === 'string' ? options.split(',').map(o => o.trim()) : options;

	const handleChange = (option: string, checked: boolean) => {
		if (checked) {
			onChange?.([...value, option]);
		} else {
			onChange?.(value.filter(v => v !== option));
		}
	};

	return (
		<div className="form-field">
			{label && <label>{label}</label>}
			<div className="checkbox-group">
				{optionArray.map((option, index) => (
					<div key={index} className="checkbox-item">
						<input
							type="checkbox"
							id={`${name}-${index}`}
							name={`${name}[]`}
							value={option}
							checked={value.includes(option)}
							onChange={(e) => handleChange(option, e.target.checked)}
						/>
						<label htmlFor={`${name}-${index}`}>{option}</label>
					</div>
				))}
			</div>
		</div>
	);
};
