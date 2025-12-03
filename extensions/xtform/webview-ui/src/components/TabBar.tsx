/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';

interface TabBarProps {
	activeTab: 'form' | 'edit';
	onTabChange: (tab: 'form' | 'edit') => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
	return (
		<div className="tab-bar">
			<button
				className={`tab ${activeTab === 'form' ? 'active' : ''}`}
				onClick={() => onTabChange('form')}
			>
				Form View
			</button>
			<button
				className={`tab ${activeTab === 'edit' ? 'active' : ''}`}
				onClick={() => onTabChange('edit')}
			>
				Edit Template
			</button>
		</div>
	);
}
