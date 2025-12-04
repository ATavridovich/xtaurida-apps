/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface CheckboxProps {
	name: string;
	label?: string;
	checked?: boolean;
	onChange?: (checked: boolean) => void;
}

export const Checkbox: React.FC<CheckboxProps> = ({ name, label, checked, onChange }) => {
	return (
		<div className="form-field form-field-checkbox">
			<input
				type="checkbox"
				id={name}
				name={name}
				checked={checked || false}
				onChange={(e) => onChange?.(e.target.checked)}
			/>
			{label && <label htmlFor={name}>{label}</label>}
		</div>
	);
};
