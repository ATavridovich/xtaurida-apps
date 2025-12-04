/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import React from 'react';
import type { ComponentRegistry } from '../types/messages';

interface ComponentPaletteProps {
	registry: ComponentRegistry | null;
}

export function ComponentPalette({ registry }: ComponentPaletteProps) {
	if (!registry) {
		return <div className="component-palette">Loading components...</div>;
	}

	return (
		<div className="component-palette">
			<h3>Components</h3>
			{registry.tabs.map(tab => (
				<div key={tab.name} className="palette-tab">
					<h4>{tab.name}</h4>
					<div className="component-grid">
						{tab.components.map(component => (
							<div
								key={component.id}
								className="component-item"
								draggable={true}
								title={component.description}
							>
								<div className="component-icon">{component.icon || '[?]'}</div>
								<div className="component-label">{component.label}</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
