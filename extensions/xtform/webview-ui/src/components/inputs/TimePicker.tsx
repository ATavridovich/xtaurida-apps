/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface TimePickerProps {
	name: string;
	label?: string;
	value?: string;
	onChange?: (value: string) => void;
}

export const TimePicker: React.FC<TimePickerProps> = ({ name, label, value, onChange }) => {
	return (
		<div className="form-field">
			{label && <label htmlFor={name}>{label}</label>}
			<input
				type="time"
				id={name}
				name={name}
				value={value || ''}
				onChange={(e) => onChange?.(e.target.value)}
			/>
		</div>
	);
};
