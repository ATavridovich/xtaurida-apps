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
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';

export const category: ILocalizedString = localize2('Create', 'Create');

const XTFORM_VIEW_TYPE = 'xtform.editor';
export const XTFORM_FILE_FILTER: FileFilter[] = [{ name: localize('xtformFile', "XTForm"), extensions: ['xtform'] }];
const defaultFormTitle = localize('newForm.defaultTitle', "New Form");

// "From Template" (electron-browser/xtformTemplates.contribution.ts) needs
// the app's install root to find the bundled templates folder, which isn't
// available in the web/common environment service — so it lives in a
// separate, desktop-only contribution and reuses the pieces exported here.
export const NewFormMenu = new MenuId('NewForm');

// File > New Form submenu — kept at the top of the File > New section
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
	title: localize('miNewForm', "New Form"),
	submenu: NewFormMenu,
	group: '1_new',
	order: 0
});

export function yamlString(value: string): string {
	return JSON.stringify(value);
}

export function newUuid(): string {
	return yamlString(generateUuid());
}

function createBlankFormYaml(title: string): string {
	return `type: Form
uuid: ${newUuid()}
title: ${yamlString(title)}
items: []
`;
}

/**
 * A node in the tree built from a Markdown document by
 * {@link buildMarkdownFormTree}. Mirrors the subset of `.xtform` node shapes
 * `createFormFromMarkdown` can produce. Deliberately distinct from the
 * extension's `XtformNode` type (defined in the separate `extensions/xtform`
 * npm package), which core workbench code cannot import. `uuid` fields here
 * are always the raw, unquoted uuid — quoting happens at serialization time
 * via `yamlString`, since a `Table` column's uuid also doubles as a bare
 * YAML map key in every row's `data`.
 */
type MarkdownFormNode =
	| { type: 'Section'; uuid: string; label: string; items: MarkdownFormNode[] }
	| { type: 'TextArea'; uuid: string; value: string }
	| { type: 'CodeBlock'; uuid: string; value: string }
	| { type: 'Table'; uuid: string; columns: MarkdownTableColumn[]; rows: MarkdownTableRow[] };

interface MarkdownTableColumn {
	uuid: string;
	label: string;
}

interface MarkdownTableRow {
	uuid: string;
	cells: string[];
}

/**
 * One block of a Markdown document as produced by {@link tokenizeMarkdown}:
 * a heading of any level, a single line of prose/list text, a GFM pipe
 * table (already split into header cells and data rows), or a fenced code
 * block (body lines, blank lines preserved verbatim).
 */
type MarkdownBlock =
	| { kind: 'heading'; level: number; text: string }
	| { kind: 'text'; line: string }
	| { kind: 'table'; headerCells: string[]; rows: string[][] }
	| { kind: 'code'; lines: string[] };

/**
 * Splits a Markdown document into an ordered, flat sequence of blocks.
 * Blank/whitespace-only lines are dropped as separators, except inside a
 * fenced code block where they are semantically meaningful and kept
 * verbatim. Lists get no special handling — list items are ordinary text
 * lines, grouped with surrounding prose by {@link buildMarkdownFormTree}.
 */
function tokenizeMarkdown(markdown: string): MarkdownBlock[] {
	const lines = markdown.split(/\r?\n/);
	const blocks: MarkdownBlock[] = [];
	let i = 0;

	while (i < lines.length) {
		const line = lines[i];

		if (line.trim().length === 0) {
			i++;
			continue;
		}

		const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
		if (headingMatch) {
			blocks.push({ kind: 'heading', level: headingMatch[1].length, text: headingMatch[2] });
			i++;
			continue;
		}

		const fenceMatch = /^(`{3,}|~{3,})(.*)$/.exec(line);
		if (fenceMatch) {
			const fenceChar = fenceMatch[1][0];
			const fenceLength = fenceMatch[1].length;
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !isClosingCodeFence(lines[i], fenceChar, fenceLength)) {
				codeLines.push(lines[i]);
				i++;
			}
			if (i < lines.length) {
				i++; // consume the closing fence line
			}
			blocks.push({ kind: 'code', lines: codeLines });
			continue;
		}

		if (line.includes('|') && i + 1 < lines.length && isTableDelimiterRow(lines[i + 1])) {
			const headerCells = splitTableRow(line);
			i += 2; // consume header row + delimiter row
			const rows: string[][] = [];
			while (i < lines.length && lines[i].trim().length > 0 && lines[i].includes('|')
				&& !/^#{1,6}\s+/.test(lines[i]) && !/^(`{3,}|~{3,})/.test(lines[i])) {
				rows.push(splitTableRow(lines[i]));
				i++;
			}
			blocks.push({ kind: 'table', headerCells, rows });
			continue;
		}

		blocks.push({ kind: 'text', line });
		i++;
	}

	return blocks;
}

/** Whether `line` is a GFM table delimiter row, e.g. `| --- | :-: | ---: |`. */
function isTableDelimiterRow(line: string): boolean {
	const trimmed = line.trim();
	if (trimmed.length === 0 || !trimmed.includes('-')) {
		return false;
	}
	const cells = splitTableRow(trimmed);
	return cells.length > 0 && cells.every(cell => /^:?-+:?$/.test(cell));
}

/** Splits a pipe-delimited table row into trimmed cell strings. */
function splitTableRow(line: string): string[] {
	let trimmed = line.trim();
	if (trimmed.startsWith('|')) {
		trimmed = trimmed.slice(1);
	}
	if (trimmed.endsWith('|')) {
		trimmed = trimmed.slice(0, -1);
	}
	return trimmed.split('|').map(cell => cell.trim());
}

/** Whether `line` closes a fence opened with `fenceChar` repeated `minLength` times or more. */
function isClosingCodeFence(line: string, fenceChar: string, minLength: number): boolean {
	return new RegExp(`^${fenceChar}{${minLength},}[ \\t]*$`).test(line);
}

/**
 * Groups a flat block sequence into a Form title plus a tree of nodes.
 * Headings nest by level: a heading at level `L` closes any currently open
 * section at level >= `L` before opening its own; a heading with no open
 * shallower section becomes a top-level child of the Form root. If the
 * document has exactly one level-1 heading, it is consumed as the Form
 * `title` and produces no `Section` — and, since it never touches the
 * nesting stack, any heading that would otherwise have nested under it
 * instead lands at whatever level the stack already points to. Consecutive
 * text/list lines merge into a single `TextArea`, only breaking on a table,
 * code block, or heading.
 */
function buildMarkdownFormTree(blocks: readonly MarkdownBlock[]): { title: string | undefined; items: MarkdownFormNode[] } {
	const titleHeadingCount = blocks.filter(block => block.kind === 'heading' && block.level === 1).length;
	const consumeH1AsTitle = titleHeadingCount === 1;

	const rootItems: MarkdownFormNode[] = [];
	const stack: { level: number; items: MarkdownFormNode[] }[] = [{ level: 0, items: rootItems }];
	let title: string | undefined;
	let textRun: string[] = [];

	const flushTextRun = () => {
		if (textRun.length > 0) {
			stack[stack.length - 1].items.push({
				type: 'TextArea',
				uuid: generateUuid(),
				value: textRun.join('\n')
			});
			textRun = [];
		}
	};

	for (const block of blocks) {
		switch (block.kind) {
			case 'text':
				textRun.push(block.line);
				break;

			case 'table': {
				flushTextRun();
				const columns: MarkdownTableColumn[] = block.headerCells.map(label => ({ uuid: generateUuid(), label }));
				const rows: MarkdownTableRow[] = block.rows.map(cells => ({
					uuid: generateUuid(),
					cells: columns.map((_column, index) => cells[index] ?? '')
				}));
				stack[stack.length - 1].items.push({
					type: 'Table',
					uuid: generateUuid(),
					columns,
					rows
				});
				break;
			}

			case 'code':
				flushTextRun();
				stack[stack.length - 1].items.push({
					type: 'CodeBlock',
					uuid: generateUuid(),
					value: block.lines.join('\n')
				});
				break;

			case 'heading': {
				flushTextRun();
				if (consumeH1AsTitle && block.level === 1) {
					title = block.text;
					break;
				}
				while (stack.length > 1 && stack[stack.length - 1].level >= block.level) {
					stack.pop();
				}
				const section: MarkdownFormNode = { type: 'Section', uuid: generateUuid(), label: block.text, items: [] };
				stack[stack.length - 1].items.push(section);
				stack.push({ level: block.level, items: section.items });
				break;
			}
		}
	}
	flushTextRun();

	return { title, items: rootItems };
}

const YAML_INDENT_UNIT = '  ';

/** Serializes sibling nodes as a YAML block sequence under an `items:` key at nesting `level`. */
function serializeMarkdownFormNodes(nodes: readonly MarkdownFormNode[], level: number): string[] {
	const lines: string[] = [];
	const markerIndent = YAML_INDENT_UNIT.repeat(level + 1);
	const fieldIndent = YAML_INDENT_UNIT.repeat(level + 2);

	for (const node of nodes) {
		lines.push(`${markerIndent}- type: ${node.type}`);
		lines.push(`${fieldIndent}uuid: ${yamlString(node.uuid)}`);

		switch (node.type) {
			case 'Section':
				lines.push(`${fieldIndent}label: ${yamlString(node.label)}`);
				if (node.items.length === 0) {
					lines.push(`${fieldIndent}items: []`);
				} else {
					lines.push(`${fieldIndent}items:`);
					lines.push(...serializeMarkdownFormNodes(node.items, level + 2));
				}
				break;

			case 'TextArea':
			case 'CodeBlock':
				lines.push(`${fieldIndent}value: ${yamlString(node.value)}`);
				break;

			case 'Table':
				if (node.columns.length === 0) {
					lines.push(`${fieldIndent}items: []`);
				} else {
					lines.push(`${fieldIndent}items:`);
					lines.push(...serializeTableColumns(node.columns, level + 2));
				}
				if (node.rows.length === 0) {
					lines.push(`${fieldIndent}data: []`);
				} else {
					lines.push(`${fieldIndent}data:`);
					lines.push(...serializeTableRows(node.rows, node.columns, level + 2));
				}
				break;
		}
	}

	return lines;
}

/** Serializes a Table's column definitions as `TextInput` nodes under its `items:` key. */
function serializeTableColumns(columns: readonly MarkdownTableColumn[], level: number): string[] {
	const lines: string[] = [];
	const markerIndent = YAML_INDENT_UNIT.repeat(level + 1);
	const fieldIndent = YAML_INDENT_UNIT.repeat(level + 2);

	for (const column of columns) {
		lines.push(`${markerIndent}- type: TextInput`);
		lines.push(`${fieldIndent}uuid: ${yamlString(column.uuid)}`);
		lines.push(`${fieldIndent}label: ${yamlString(column.label)}`);
	}

	return lines;
}

/** Serializes a Table's rows under its `data:` key, keyed per-cell by column uuid. */
function serializeTableRows(rows: readonly MarkdownTableRow[], columns: readonly MarkdownTableColumn[], level: number): string[] {
	const lines: string[] = [];
	const markerIndent = YAML_INDENT_UNIT.repeat(level + 1);
	const fieldIndent = YAML_INDENT_UNIT.repeat(level + 2);
	const dataFieldIndent = YAML_INDENT_UNIT.repeat(level + 3);

	for (const row of rows) {
		lines.push(`${markerIndent}- uuid: ${yamlString(row.uuid)}`);
		lines.push(`${fieldIndent}props: {}`);
		if (columns.length === 0) {
			lines.push(`${fieldIndent}data: {}`);
			continue;
		}
		lines.push(`${fieldIndent}data:`);
		columns.forEach((column, index) => {
			lines.push(`${dataFieldIndent}${column.uuid}: ${yamlString(row.cells[index] ?? '')}`);
		});
	}

	return lines;
}

function createFormFromMarkdown(markdown: string, fallbackTitle: string): string {
	const blocks = tokenizeMarkdown(markdown);
	const { title, items } = buildMarkdownFormTree(blocks);

	const lines: string[] = [
		'type: Form',
		`uuid: ${newUuid()}`,
		`title: ${yamlString(title || fallbackTitle)}`
	];

	if (items.length === 0) {
		lines.push('items: []');
		return `${lines.join('\n')}\n`;
	}

	lines.push('items:');
	lines.push(...serializeMarkdownFormNodes(items, 0));

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

export async function defaultFormUri(dialogService: IFileDialogService, fileName: string): Promise<URI> {
	return joinPath(await dialogService.defaultFilePath(), fileName);
}

/**
 * Prompts for a destination, writes the given `.xtform` content to it and
 * opens it in the XTForm editor. Mirrors the save-dialog-then-create flow
 * used by the plain "New File..." command, since forms are always saved to
 * disk immediately — the XTForm custom editor provider has no untitled/
 * in-memory document support.
 */
export async function saveAndOpenForm(dialogService: IFileDialogService, fileService: IFileService, editorService: IEditorService, content: string, defaultUri: URI): Promise<boolean> {
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
