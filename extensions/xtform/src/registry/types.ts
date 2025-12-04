/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Component manifest (.xtcomp file)
 */
export interface ComponentManifest {
	id: string;
	label: string;
	icon?: string;
	template: string;
	description?: string;
	props?: ComponentProp[];
}

/**
 * Component property definition
 */
export interface ComponentProp {
	name: string;
	type: 'string' | 'number' | 'boolean' | 'object' | 'array';
	required?: boolean;
	default?: any;
	description?: string;
}

/**
 * Palette tab in registry
 */
export interface PaletteTab {
	tab: string;
	description?: string;
	components: string[];
}

/**
 * Component registry structure
 */
export interface RegistryConfig {
	palette: PaletteTab[];
}

/**
 * Component registry (loaded and validated)
 */
export interface ComponentRegistry {
	tabs: {
		name: string;
		description?: string;
		components: ComponentManifest[];
	}[];
	componentsByName: Map<string, ComponentManifest>;
}

/**
 * Registry validation error
 */
export interface RegistryError {
	message: string;
	file?: string;
	severity: 'error' | 'warning';
}
