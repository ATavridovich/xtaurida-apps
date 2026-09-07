/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';

/**
 * Top level "AppTwin" menu bar entry, plus its command placements. Kept as
 * a standalone, self-contained registration (rather than editing
 * `menubar.contribution.ts`) so that rebasing this fork onto a newer
 * upstream VS Code stays a pure file-add with no merge conflicts,
 * following the same pattern as the "Run" menu (see
 * `debug.contribution.ts`) and the "New Form" submenu (see
 * `contrib/xtform/browser/xtform.contribution.ts`).
 *
 * Core only declares the menu's presence, position, and which command ids
 * sit in which slot — it registers no command handlers. The AppTwin
 * extension ("Agent") registers the actual handlers against these same
 * ids (`appTwin.assist`, `appTwin.clarify`, ...) via
 * `vscode.commands.registerCommand`; it does not need to (and should not)
 * declare `contributes.menus` itself, since the placement already lives
 * here.
 */
MenuRegistry.appendMenuItem(MenuId.MenubarMainMenu, {
	submenu: MenuId.MenubarAppTwinMenu,
	title: {
		value: 'AppTwin',
		original: 'AppTwin',
		mnemonicTitle: localize({ key: 'mAppTwin', comment: ['&& denotes a mnemonic'] }, "&&AppTwin"),
	},
	// Between "Go" (5) and "Run" (6); a fractional order avoids renumbering
	// the other top level menus registered elsewhere in the codebase.
	order: 5.5
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.assist', title: localize('appTwin.assist', "Assist") },
	group: '1_assist',
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.clarify', title: localize('appTwin.clarify', "Clarify") },
	group: '2_actions',
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.elaborate', title: localize('appTwin.elaborate', "Elaborate") },
	group: '2_actions',
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.summarize', title: localize('appTwin.summarize', "Summarize") },
	group: '2_actions',
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.reflect', title: localize('appTwin.reflect', "Reflect") },
	group: '2_actions',
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.build', title: localize('appTwin.build', "Build") },
	group: '3_build',
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.buildAll', title: localize('appTwin.buildAll', "Build All") },
	group: '3_build',
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.previewBuild', title: localize('appTwin.previewBuild', "Preview Build") },
	group: '3_build',
	order: 3
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.previewBuildAll', title: localize('appTwin.previewBuildAll', "Preview Build All") },
	group: '3_build',
	order: 4
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.addFileToAsm', title: localize('appTwin.addFileToAsm', "Add File to ASM") },
	group: '4_asm',
	order: 1
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.addFolderToAsm', title: localize('appTwin.addFolderToAsm', "Add Folder to ASM") },
	group: '4_asm',
	order: 2
});

MenuRegistry.appendMenuItem(MenuId.MenubarAppTwinMenu, {
	command: { id: 'appTwin.settings', title: localize('appTwin.settings', "Settings...") },
	group: 'z_commands',
	order: 1
});
