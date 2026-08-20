/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { INativeWorkbenchEnvironmentService } from '../../../services/environment/electron-browser/environmentService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { category, defaultFormUri, newUuid, NewFormMenu, saveAndOpenForm, XTFORM_FILE_FILTER } from '../browser/xtform.contribution.js';

/**
 * Form templates live on disk under `resources/xtform-templates/`, browsed
 * with a standard file-open dialog rooted at that folder rather than a
 * curated quick pick, so any `.xtform` file dropped anywhere under it —
 * including in nested subfolders — is immediately pickable.
 * `INativeWorkbenchEnvironmentService.appRoot` resolves to the repo root
 * when running from source and to the installed app's resource root in a
 * packaged build, so this works in both — but it is only available in the
 * native/desktop environment service, which is why this action lives in its
 * own electron-browser-only contribution rather than alongside the rest of
 * the New Form actions.
 */
const TEMPLATES_FOLDER = 'xtform-templates';

/**
 * Replaces every `uuid: "..."` scalar in the template's raw YAML text with a
 * freshly generated one, so a form copied from a template never shares uuids
 * with the template file itself or with any other form copied from it.
 * Works line-by-line on the raw text rather than through a YAML parser,
 * since the value is always a flat scalar at any indentation level (root
 * `uuid`, node `uuid`, and table/tree record `uuid` alike).
 */
function regenerateFormUuids(content: string): string {
	return content.replace(/^([ \t]*uuid:[ \t]*)(?:"[^"]*"|'[^']*'|\S+)[ \t]*$/gm, (_match, prefix: string) => `${prefix}${newUuid()}`);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.files.newForm.fromTemplate',
			title: localize2('newForm.fromTemplate', "From Template"),
			category,
			f1: true,
			menu: {
				id: NewFormMenu,
				group: '1_form',
				order: 2
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const dialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const environmentService = accessor.get(INativeWorkbenchEnvironmentService);
		const notificationService = accessor.get(INotificationService);

		const templatesRoot = joinPath(URI.file(environmentService.appRoot), 'resources', TEMPLATES_FOLDER);

		const templateUris = await dialogService.showOpenDialog({
			title: localize('newForm.fromTemplate.openTitle', "Select Form Template"),
			defaultUri: templatesRoot,
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: XTFORM_FILE_FILTER
		});

		const templateUri = templateUris?.[0];
		if (!templateUri) {
			return;
		}

		let templateContent: string;
		try {
			const fileContent = await fileService.readFile(templateUri);
			templateContent = fileContent.value.toString();
		} catch (error) {
			notificationService.error(localize('newForm.fromTemplate.readError', "Failed to read template '{0}': {1}", basename(templateUri), error instanceof Error ? error.message : String(error)));
			return;
		}

		const templateName = basename(templateUri).replace(/\.[^./]+$/, '');
		const defaultUri = await defaultFormUri(dialogService, `${templateName}.xtform`);
		await saveAndOpenForm(dialogService, fileService, editorService, regenerateFormUuids(templateContent), defaultUri);
	}
});
