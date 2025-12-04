/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface IntegerInputProps {
	name: string;
	label?: string;
	min?: number;
	max?: number;
	step?: number;
	value?: number;
	onChange?: (value: number) => void;
}

export const IntegerInput: React.FC<IntegerInputProps> = ({ name, label, min, max, step = 1, value, onChange }) => {
	return (
		<div className="form-field">
			{label && <label htmlFor={name}>{label}</label>}
			<input
				type="number"
				id={name}
				name={name}
				min={min}
				max={max}
				step={step}
				value={value || 0}
				onChange={(e) => onChange?.(parseInt(e.target.value, 10))}
			/>
		</div>
	);
};
