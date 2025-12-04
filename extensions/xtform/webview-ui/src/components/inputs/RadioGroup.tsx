/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface RadioGroupProps {
	name: string;
	label?: string;
	options: string | string[];
	value?: string;
	onChange?: (value: string) => void;
}

export const RadioGroup: React.FC<RadioGroupProps> = ({ name, label, options, value, onChange }) => {
	const optionArray = typeof options === 'string' ? options.split(',').map(o => o.trim()) : options;

	return (
		<div className="form-field">
			{label && <label>{label}</label>}
			<div className="radio-group">
				{optionArray.map((option, index) => (
					<div key={index} className="radio-item">
						<input
							type="radio"
							id={`${name}-${index}`}
							name={name}
							value={option}
							checked={value === option}
							onChange={(e) => onChange?.(e.target.value)}
						/>
						<label htmlFor={`${name}-${index}`}>{option}</label>
					</div>
				))}
			</div>
		</div>
	);
};
