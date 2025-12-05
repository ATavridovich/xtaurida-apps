/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface CheckboxProps {
	name: string;
	label?: string;
	value?: boolean;
	checked?: boolean;
	onChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ name, label, value, checked, onChange }) => {
	// Support both 'value' and 'checked' props
	const isChecked = checked !== undefined ? checked : (value || false);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		console.log(`Checkbox ${name} changed:`, e.target.checked);
		onChange?.(e.target.checked);
	};

	console.log(`Checkbox ${name} rendered with value:`, isChecked);

	return (
		<div className="form-field form-field-checkbox">
			<input
				type="checkbox"
				id={name}
				name={name}
				checked={isChecked}
				onChange={handleChange}
			/>
			{label && <label htmlFor={name}>{label}</label>}
		</div>
	);
};
