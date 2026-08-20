/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../base/common/buffer.js';
import { basename, dirname, joinPath } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { localize, localize2 } from '../../../../nls.js';
import { ILocalizedString } from '../../../../platform/action/common/action.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { FileFilter, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService, IQuickPickItem } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';

const category: ILocalizedString = localize2('Create', 'Create');

const XTFORM_VIEW_TYPE = 'xtform.editor';
const XTFORM_FILE_FILTER: FileFilter[] = [{ name: localize('xtformFile', "XTForm"), extensions: ['xtform'] }];
const defaultFormTitle = localize('newForm.defaultTitle', "New Form");

const NewFormMenu = new MenuId('NewForm');

// File > New Form submenu — kept at the top of the File > New section
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	title: localize('miNewForm', "New Form"),
	submenu: NewFormMenu,
	group: '1_new',
	order: 0
});

function yamlString(value: string): string {
	return JSON.stringify(value);
}

function newUuid(): string {
	return yamlString(generateUuid());
}

function createBlankFormYaml(title: string): string {
	return `type: Form
uuid: ${newUuid()}
title: ${yamlString(title)}
items: []
`;
}

interface FormTemplate {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	content(title: string): string;
}

const formTemplates: FormTemplate[] = [
	{
		id: 'section',
		label: localize('template.section', "Basic Form"),
		description: localize('template.section.description', "A section with a couple of fields"),
		content: title => `type: Form
uuid: ${newUuid()}
title: ${yamlString(title)}
items:
  - type: Section
    uuid: ${newUuid()}
    label: "Details"
    items:
      - type: TextInput
        uuid: ${newUuid()}
        label: "Name"
      - type: TextArea
        uuid: ${newUuid()}
        label: "Description"
`
	},
	{
		id: 'tabs',
		label: localize('template.tabs', "Tabbed Form"),
		description: localize('template.tabs.description', "Two tabs, ready for more fields"),
		content: title => `type: Form
uuid: ${newUuid()}
title: ${yamlString(title)}
items:
  - type: Tab
    uuid: ${newUuid()}
    label: "General"
    items:
      - type: TextInput
        uuid: ${newUuid()}
        label: "Name"
  - type: Tab
    uuid: ${newUuid()}
    label: "Advanced"
    items: []
`
	},
	{
		id: 'table',
		label: localize('template.table', "Table Form"),
		description: localize('template.table.description', "A single editable table"),
		content: title => `type: Form
uuid: ${newUuid()}
title: ${yamlString(title)}
items:
  - type: Table
    uuid: ${newUuid()}
    label: "Items"
    items:
      - type: TextInput
        uuid: ${newUuid()}
        label: "Name"
      - type: TextInput
        uuid: ${newUuid()}
        label: "Value"
    data: []
`
	}
];

interface MarkdownSection {
	label: string;
	body: string;
}

function parseMarkdown(markdown: string): { title: string; sections: MarkdownSection[] } {
	const lines = markdown.split(/\r?\n/);
	let title: string | undefined;
	const sections: MarkdownSection[] = [];
	let current: MarkdownSection | undefined;
	let bodyLines: string[] = [];

	const flushCurrentSection = () => {
		if (current) {
			current.body = bodyLines.join('\n').trim();
		}
		bodyLines = [];
	};

	for (const line of lines) {
		const h1Match = /^#\s+(.+)$/.exec(line);
		const h2Match = /^##\s+(.+)$/.exec(line);
		if (h1Match && title === undefined) {
			title = h1Match[1].trim();
			continue;
		}
		if (h2Match) {
			flushCurrentSection();
			current = { label: h2Match[1].trim(), body: '' };
			sections.push(current);
			continue;
		}
		bodyLines.push(line);
	}
	flushCurrentSection();

	if (sections.length === 0) {
		const body = markdown.trim();
		if (body.length > 0) {
			sections.push({ label: localize('markdownForm.content', "Content"), body });
		}
	}

	return { title: title ?? '', sections };
}

function createFormFromMarkdown(markdown: string, fallbackTitle: string): string {
	const { title, sections } = parseMarkdown(markdown);
	const lines: string[] = [
		'type: Form',
		`uuid: ${newUuid()}`,
		`title: ${yamlString(title || fallbackTitle)}`
	];

	if (sections.length === 0) {
		lines.push('items: []');
		return `${lines.join('\n')}\n`;
	}

	lines.push('items:');
	for (const section of sections) {
		lines.push('  - type: Section');
		lines.push(`    uuid: ${newUuid()}`);
		lines.push(`    label: ${yamlString(section.label)}`);
		lines.push('    items:');
		lines.push('      - type: TextArea');
		lines.push(`        uuid: ${newUuid()}`);
		lines.push(`        label: ${yamlString(section.label)}`);
		lines.push(`        value: ${yamlString(section.body)}`);
	}

	return `${lines.join('\n')}\n`;
}

function createFormFromPrompt(prompt: string): string {
	const trimmed = prompt.trim();
	const title = trimmed.length > 60 ? `${trimmed.slice(0, 57).trimEnd()}…` : trimmed;
	return `type: Form
uuid: ${newUuid()}
title: ${yamlString(title || defaultFormTitle)}
prompt: ${yamlString(trimmed)}
items: []
`;
}

async function defaultFormUri(dialogService: IFileDialogService, fileName: string): Promise<URI> {
	return joinPath(await dialogService.defaultFilePath(), fileName);
}

/**
 * Prompts for a destination, writes the given `.xtform` content to it and
 * opens it in the XTForm editor. Mirrors the save-dialog-then-create flow
 * used by the plain "New File..." command, since forms are always saved to
 * disk immediately — the XTForm custom editor provider has no untitled/
 * in-memory document support.
 */
async function saveAndOpenForm(dialogService: IFileDialogService, fileService: IFileService, editorService: IEditorService, content: string, defaultUri: URI): Promise<boolean> {
	const createFormLabel = localize('newForm.saveLabel', "Create Form");
	const saveUri = await dialogService.showSaveDialog({
		title: createFormLabel,
		saveLabel: createFormLabel,
		defaultUri,
		filters: XTFORM_FILE_FILTER
	});

	if (!saveUri) {
		return false;
	}

	await fileService.createFile(saveUri, VSBuffer.fromString(content), { overwrite: true });

	await editorService.openEditor({
		resource: saveUri,
		options: {
			override: XTFORM_VIEW_TYPE,
			pinned: true
		}
	});

	return true;
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.files.newForm.blank',
			title: localize2('newForm.blank', "Blank Form"),
			category,
			f1: true,
			menu: {
				id: NewFormMenu,
				group: '1_form',
				order: 1
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const dialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);

		const defaultUri = await defaultFormUri(dialogService, 'NewForm.xtform');
		await saveAndOpenForm(dialogService, fileService, editorService, createBlankFormYaml(defaultFormTitle), defaultUri);
	}
});

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
		const quickInputService = accessor.get(IQuickInputService);
		const dialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);

		const picks: (IQuickPickItem & { template: FormTemplate })[] = formTemplates.map(template => ({
			id: template.id,
			label: template.label,
			description: template.description,
			template
		}));

		const pick = await quickInputService.pick(picks, {
			title: localize('newForm.fromTemplate.title', "New Form from Template"),
			placeHolder: localize('newForm.fromTemplate.placeholder', "Select a form template")
		});

		if (!pick) {
			return;
		}

		const defaultUri = await defaultFormUri(dialogService, 'NewForm.xtform');
		await saveAndOpenForm(dialogService, fileService, editorService, pick.template.content(defaultFormTitle), defaultUri);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.files.newForm.fromMarkdown',
			title: localize2('newForm.fromMarkdown', "From Markdown"),
			category,
			f1: true,
			menu: {
				id: NewFormMenu,
				group: '1_form',
				order: 3
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const dialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);
		const notificationService = accessor.get(INotificationService);

		const markdownUris = await dialogService.showOpenDialog({
			title: localize('newForm.fromMarkdown.openTitle', "Select Markdown File"),
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: [{ name: localize('markdownFile', "Markdown"), extensions: ['md', 'markdown'] }]
		});

		const markdownUri = markdownUris?.[0];
		if (!markdownUri) {
			return;
		}

		let markdown: string;
		try {
			const fileContent = await fileService.readFile(markdownUri);
			markdown = fileContent.value.toString();
		} catch (error) {
			notificationService.error(localize('newForm.fromMarkdown.readError', "Failed to read '{0}': {1}", basename(markdownUri), error instanceof Error ? error.message : String(error)));
			return;
		}

		const fileName = basename(markdownUri).replace(/\.[^./]+$/, '');
		const defaultUri = joinPath(dirname(markdownUri), `${fileName}.xtform`);

		await saveAndOpenForm(dialogService, fileService, editorService, createFormFromMarkdown(markdown, fileName), defaultUri);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.files.newForm.createWithAI',
			title: localize2('newForm.createWithAI', "Create with AI"),
			category,
			f1: true,
			menu: {
				id: NewFormMenu,
				group: '1_form',
				order: 4
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const dialogService = accessor.get(IFileDialogService);
		const fileService = accessor.get(IFileService);
		const editorService = accessor.get(IEditorService);

		const prompt = await quickInputService.input({
			title: localize('newForm.createWithAI.title', "Create Form with AI"),
			placeHolder: localize('newForm.createWithAI.placeholder', "Describe the form you want to create"),
			prompt: localize('newForm.createWithAI.prompt', "The xTaurida AI agent will use this description to build the form")
		});

		if (!prompt) {
			return;
		}

		const defaultUri = await defaultFormUri(dialogService, 'NewForm.xtform');
		const created = await saveAndOpenForm(dialogService, fileService, editorService, createFormFromPrompt(prompt), defaultUri);

		if (created) {
			notificationService.info(localize('newForm.createWithAI.notice', "Form created from your prompt. Install the xTaurida Agent extension to generate its contents automatically."));
		}
	}
});
