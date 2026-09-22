// Webview script for XTForm editor - NEW YAML HIERARCHY FORMAT
// This script runs in the webview context and communicates with the extension

import * as YAML from 'yaml';
import { unflattenNode } from '../src/parsers/yamlParser';

// Type definitions matching backend

// Presence of `changes.kind` on the root document signals a pending draft —
// see spec/xtdraft-format.md ("Detection"). The value itself is meaningful
// to whichever Agent proposed the changes, not to the Viewer.
interface XtformRootChanges {
  kind: string;
}

// Snapshot of a node's previous field values, carried on `changes.prev` for
// a `modified` item — see spec/xtdraft-format.md ("Modified fields"). Only
// fields that actually changed are present.
interface XtformItemChangesPrev {
  label?: string;
  description?: string;
  value?: any;
  options?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  instructions?: Record<string, string>;
}

// Marks an individual item as part of a pending draft proposal — see
// spec/xtdraft-format.md ("Rendering", "Field buttons").
interface XtformItemChanges {
  status: 'added' | 'removed' | 'modified';
  prev?: XtformItemChangesPrev;
}

interface XtformNode {
  type: string;
  uuid: string;
  label?: string;
  description?: string;
  instructions?: Record<string, string>;
  width?: string;
  align?: 'left' | 'center' | 'right';
  value?: any;
  options?: string;
  items?: XtformNode[];
  data?: any;
  changes?: XtformItemChanges;
}

interface XtformDocument {
  type: 'Form';
  uuid: string;
  title?: string;
  description?: string;
  prompt?: string;
  elaborate_options?: string[];
  instructions?: Record<string, string>;
  items?: XtformNode[];
  disable_quick_actions?: boolean;
  show_apply_action?: boolean;
  revision?: number;
  applied_revision?: number | null;
  changes?: XtformRootChanges;
}

// A single record in a Table component's `data` array. Field values are
// keyed by the uuid of the column definition (a node in the Table's
// `items`) they belong to.
interface XtformTableRow {
  uuid: string;
  props?: Record<string, any>;
  data?: Record<string, any>;
}

// Component Registry for Designer Palette
interface ComponentRegistryEntry {
  type: string;
  category: 'inputs' | 'layout' | 'advanced';
  label: string;
  icon: string;
  description: string;
  createNode: (uuid: string) => XtformNode;
}

const COMPONENT_REGISTRY: ComponentRegistryEntry[] = [
  // Input Components
  {
    type: 'TextInput',
    category: 'inputs',
    label: 'Text Input',
    icon: '📝',
    description: 'Single-line text field',
    createNode: (uuid: string): XtformNode => ({
      type: 'TextInput',
      uuid,
      label: 'New Text Input',
      value: ''
    })
  },
  {
    type: 'TextArea',
    category: 'inputs',
    label: 'Text Area',
    icon: '📄',
    description: 'Multi-line text input',
    createNode: (uuid: string): XtformNode => ({
      type: 'TextArea',
      uuid,
      label: 'New Text Area',
      value: ''
    })
  },
  {
    type: 'IntegerInput',
    category: 'inputs',
    label: 'Integer',
    icon: '🔢',
    description: 'Whole number input',
    createNode: (uuid: string): XtformNode => ({
      type: 'IntegerInput',
      uuid,
      label: 'New Integer',
      value: 0
    })
  },
  {
    type: 'DecimalInput',
    category: 'inputs',
    label: 'Decimal',
    icon: '💰',
    description: 'Decimal number input',
    createNode: (uuid: string): XtformNode => ({
      type: 'DecimalInput',
      uuid,
      label: 'New Decimal',
      value: 0.0
    })
  },
  {
    type: 'Checkbox',
    category: 'inputs',
    label: 'Checkbox',
    icon: '☑',
    description: 'Boolean yes/no field',
    createNode: (uuid: string): XtformNode => ({
      type: 'Checkbox',
      uuid,
      label: 'New Checkbox',
      value: false
    })
  },
  {
    type: 'DatePicker',
    category: 'inputs',
    label: 'Date Picker',
    icon: '📅',
    description: 'Date selection',
    createNode: (uuid: string): XtformNode => ({
      type: 'DatePicker',
      uuid,
      label: 'Select Date',
      value: new Date().toISOString().split('T')[0]
    })
  },
  {
    type: 'TimePicker',
    category: 'inputs',
    label: 'Time Picker',
    icon: '🕐',
    description: 'Time selection',
    createNode: (uuid: string): XtformNode => ({
      type: 'TimePicker',
      uuid,
      label: 'Select Time',
      value: '12:00'
    })
  },
  {
    type: 'Select',
    category: 'inputs',
    label: 'Select',
    icon: '▼',
    description: 'Dropdown selection',
    createNode: (uuid: string): XtformNode => ({
      type: 'Select',
      uuid,
      label: 'New Select',
      options: 'Option 1,Option 2,Option 3',
      value: 'Option 1'
    })
  },
  {
    type: 'RadioGroup',
    category: 'inputs',
    label: 'Radio Group',
    icon: '◉',
    description: 'Single choice from options',
    createNode: (uuid: string): XtformNode => ({
      type: 'RadioGroup',
      uuid,
      label: 'Choose One',
      options: 'Option 1,Option 2,Option 3',
      value: 'Option 1'
    })
  },
  // Layout Components
  {
    type: 'Section',
    category: 'layout',
    label: 'Section',
    icon: '📦',
    description: 'Visual grouping container',
    createNode: (uuid: string): XtformNode => ({
      type: 'Section',
      uuid,
      label: 'New Section',
      items: []
    })
  },
  {
    type: 'CollapsibleSection',
    category: 'layout',
    label: 'Collapsible',
    icon: '📁',
    description: 'Expandable/collapsible section',
    createNode: (uuid: string): XtformNode => ({
      type: 'CollapsibleSection',
      uuid,
      label: 'New Collapsible Section',
      items: []
    })
  },
  {
    type: 'Tab',
    category: 'layout',
    label: 'Tab',
    icon: '📑',
    description: 'Tab panel (auto-groups)',
    createNode: (uuid: string): XtformNode => ({
      type: 'Tab',
      uuid,
      label: 'New Tab',
      items: []
    })
  },
  // Advanced Components
  {
    type: 'Table',
    category: 'advanced',
    label: 'Table',
    icon: '▦',
    description: 'Flat list of records — select the table, then click any Input to add it as a column',
    createNode: (uuid: string): XtformNode => ({
      type: 'Table',
      uuid,
      label: 'New Table',
      items: [
        {
          type: 'TextInput',
          uuid: generateUuid(),
          label: 'Column 1'
        }
      ],
      data: []
    })
  }
];

// Global state
let currentDoc: XtformDocument | null = null;
let selectedUuid: string | null = null;
const vscode = acquireVsCodeApi();

// === QUICK ACTIONS MENU ===
// Populated from the extension host (see the 'update' message handler),
// which reads it from whichever extension(s) declare form quick-actions in
// their own manifest. No command list is hardcoded here — if nothing is
// declared (e.g. xTaurida Agent isn't installed), the menu button doesn't
// render at all.

interface QuickAction {
  command: string;
  title: string;
}

let quickActions: QuickAction[] = [];
let openQuickMenu: HTMLElement | null = null;

// === APPLY ACTION ===
// Universal — same command/title for every form type. Declared once by
// whichever extension owns it (see 'update' message handler); whether a
// given form actually shows the button is decided purely from the
// document's own `show_apply_action` flag in renderForm(), not here.

let applyAction: QuickAction | null = null;

// === DRAFT ACTIONS ===
// Draft toolbar (Apply all / Cancel) and per-field (✓ / ✗) commands — see
// spec/xtdraft-format.md. Declared once by whichever extension owns them
// (see 'update' message handler); "Both buttons are Agent commands — viewer
// just renders them", so these are plain command ids with fixed labels,
// dispatched the same way as `runCommand` above. Whether the draft toolbar
// or a given field's buttons actually render is decided purely from the
// document's own `changes` fields in renderForm()/renderNode(), not here.
//
// The modified-field metadata popup's own Apply/Cancel (spec/xtdraft-
// format.md, "Modified fields") are NOT Agent commands — see
// `sendApplyModifiedField`/`sendCancelModifiedField`.

interface DraftActions {
  applyAll?: string;
  cancel?: string;
  fieldAccept?: string;
  fieldReject?: string;
}

let draftActions: DraftActions = {};

function closeQuickMenu(): void {
  if (openQuickMenu) {
    openQuickMenu.remove();
    openQuickMenu = null;
  }
}

function toggleQuickMenu(anchor: HTMLElement): void {
  if (openQuickMenu) {
    closeQuickMenu();
    return;
  }

  const menu = document.createElement('div');
  menu.className = 'xtform-quick-menu';
  menu.innerHTML = quickActions.map(action =>
    `<button class="xtform-quick-menu-item" data-command="${escapeHtml(action.command)}">${escapeHtml(action.title)}</button>`
  ).join('');

  menu.querySelectorAll('.xtform-quick-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const command = (item as HTMLElement).getAttribute('data-command');
      if (command) {
        sendRunCommand(command);
      }
      closeQuickMenu();
    });
  });

  anchor.appendChild(menu);
  openQuickMenu = menu;
}

function sendRunCommand(command: string, args?: unknown[]): void {
  vscode.postMessage({ type: 'runCommand', command, args });
}

// === RENDERING FUNCTIONS ===

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === DRAFT RENDERING (spec/xtdraft-format.md) ===
// Applied by every render*() function below to whichever node it renders:
// a color class on the item's outer wrapper based on `changes.status`, plus
// the inline Accept (✓) / Reject (✗) buttons shown on hover. Both buttons
// are Agent commands — the Viewer just renders and dispatches them.

function draftStatusClass(node: XtformNode): string {
  switch (node.changes?.status) {
    case 'added': return ' xtform-draft-added';
    case 'removed': return ' xtform-draft-removed';
    case 'modified': return ' xtform-draft-modified';
    default: return '';
  }
}

function draftButtonsHtml(node: XtformNode): string {
  // `modified` items get their own Apply/Cancel inside the metadata popup
  // (`openMetadataPopup`) instead — see spec/xtdraft-format.md ("Modified
  // fields").
  if (!node.changes?.status || node.changes.status === 'modified') {
    return '';
  }

  const acceptBtn = draftActions.fieldAccept
    ? `<button class="xtform-draft-accept" data-uuid="${node.uuid}" title="Accept">✓</button>`
    : '';
  const rejectBtn = draftActions.fieldReject
    ? `<button class="xtform-draft-reject" data-uuid="${node.uuid}" title="Reject">✗</button>`
    : '';

  if (!acceptBtn && !rejectBtn) {
    return '';
  }

  return `
    <div class="xtform-draft-buttons">
      ${acceptBtn}
      ${rejectBtn}
    </div>
  `;
}

// A `modified` item is highlighted yellow (`draftStatusClass`) and carries
// a small "M" badge right after its title (`draftModifiedBadgeHtml`, wired
// into each render*() function's label markup). Clicking it opens the
// metadata popup (`openMetadataPopup`) — see spec/xtdraft-format.md
// ("Modified fields"): a small dialog, built fresh each time and appended
// to `document.body` (not pre-rendered as part of the form, since its
// per-field selection state is local and resets every time it's opened),
// listing every field `changes.prev` carries a previous value for as a
// clickable prev/current toggle (default: current/proposed). Unlike the
// form-level "Apply all"/"Cancel" toolbar (an Agent command), this Apply/
// Cancel is a mechanical write/revert this extension performs itself — see
// `sendApplyModifiedField`/`sendCancelModifiedField`.

const MODIFIED_DIFF_FIELD_ORDER = ['label', 'description', 'options', 'width', 'align'] as const;

interface ModifiedEntry {
  key: string;
  prevValue: unknown;
  currValue: unknown;
}

function formatDiffValue(value: unknown): string {
  if (value === undefined || value === null || value === '') {
    return '""';
  }
  return typeof value === 'string' ? `"${value}"` : String(value);
}

// Every field with a previous value in `changes.prev` — the set the
// metadata popup shows, one toggle row each.
function getModifiedEntries(node: XtformNode): ModifiedEntry[] {
  const prev = node.changes?.prev;
  if (!prev) {
    return [];
  }

  const entries: ModifiedEntry[] = [];

  if ('value' in prev) {
    entries.push({ key: 'value', prevValue: prev.value, currValue: node.value });
  }

  for (const key of MODIFIED_DIFF_FIELD_ORDER) {
    if (key in prev) {
      entries.push({ key, prevValue: prev[key], currValue: (node as Record<string, unknown>)[key] });
    }
  }

  if (prev.instructions) {
    for (const [key, prevValue] of Object.entries(prev.instructions)) {
      entries.push({ key: `instructions.${key}`, prevValue, currValue: node.instructions?.[key] });
    }
  }

  return entries;
}

// Inline "M" badge — see `openMetadataPopup` for what clicking it does.
function draftModifiedBadgeHtml(node: XtformNode): string {
  return node.changes?.status === 'modified'
    ? ` <button type="button" class="xtform-modified-badge" data-uuid="${node.uuid}" title="Show changes">M</button>`
    : '';
}

let openMetadataPopupEl: HTMLElement | null = null;

function closeMetadataPopup(): void {
  if (openMetadataPopupEl) {
    openMetadataPopupEl.remove();
    openMetadataPopupEl = null;
  }
}

// Positions a popup just under its anchor, nudged back onto screen if it
// would otherwise overflow the viewport. `popup` must already be in the DOM
// when called, so its size can be measured.
function positionPopupNearAnchor(popup: HTMLElement, anchor: HTMLElement): void {
  const offset = 4;
  const anchorRect = anchor.getBoundingClientRect();
  const rect = popup.getBoundingClientRect();

  let left = anchorRect.left;
  let top = anchorRect.bottom + offset;

  if (left + rect.width > window.innerWidth) {
    left = Math.max(0, window.innerWidth - rect.width - offset);
  }
  if (top + rect.height > window.innerHeight) {
    top = anchorRect.top - rect.height - offset;
  }

  popup.style.left = `${Math.max(0, left)}px`;
  popup.style.top = `${Math.max(0, top)}px`;
}

function metadataRowContentHtml(entry: ModifiedEntry, selected: 'prev' | 'curr'): string {
  const prevClass = selected === 'prev' ? 'xtform-diff-selected' : 'xtform-diff-struck';
  const currClass = selected === 'curr' ? 'xtform-diff-selected' : 'xtform-diff-struck';
  return `
    <div class="xtform-metadata-key">${escapeHtml(entry.key)}</div>
    <div class="xtform-metadata-values">
      <span class="${prevClass}">${escapeHtml(formatDiffValue(entry.prevValue))}</span>
      <span class="xtform-diff-arrow">→</span>
      <span class="${currClass}">${escapeHtml(formatDiffValue(entry.currValue))}</span>
    </div>
  `;
}

// Builds and opens the metadata popup for a modified node, anchored to the
// badge that triggered it. Selection state (which value — prev or current —
// each field is currently toggled to) lives only in this closure and is
// discarded when the popup closes, per spec/xtdraft-format.md ("Modified
// fields": "Click selections reset on next open").
function openMetadataPopup(node: XtformNode, anchor: HTMLElement): void {
  closeMetadataPopup();

  const entries = getModifiedEntries(node);
  if (!entries.length) {
    return;
  }

  const selections: Record<string, 'prev' | 'curr'> = {};
  for (const entry of entries) {
    selections[entry.key] = 'curr';
  }

  const popup = document.createElement('div');
  popup.className = 'xtform-metadata-popup';
  popup.addEventListener('click', (e) => e.stopPropagation());

  const title = node.label || node.type;
  popup.innerHTML = `
    <div class="xtform-metadata-header">
      <span class="xtform-metadata-title">Changes — "${escapeHtml(title)}"</span>
      <button type="button" class="xtform-metadata-close" title="Close">×</button>
    </div>
    <div class="xtform-metadata-body">
      ${entries.map(() => '<div class="xtform-metadata-row"></div>').join('')}
    </div>
    <div class="xtform-metadata-footer">
      <button type="button" class="xtform-metadata-apply">Apply</button>
      <button type="button" class="xtform-metadata-cancel">Cancel</button>
    </div>
  `;

  const rowEls = Array.from(popup.querySelectorAll<HTMLElement>('.xtform-metadata-row'));
  entries.forEach((entry, i) => {
    const rowEl = rowEls[i];
    rowEl.innerHTML = metadataRowContentHtml(entry, selections[entry.key]);
    rowEl.addEventListener('click', () => {
      selections[entry.key] = selections[entry.key] === 'curr' ? 'prev' : 'curr';
      rowEl.innerHTML = metadataRowContentHtml(entry, selections[entry.key]);
    });
  });

  popup.querySelector('.xtform-metadata-close')?.addEventListener('click', () => closeMetadataPopup());

  popup.querySelector('.xtform-metadata-apply')?.addEventListener('click', () => {
    const values: Record<string, unknown> = {};
    for (const entry of entries) {
      values[entry.key] = selections[entry.key] === 'prev' ? entry.prevValue : entry.currValue;
    }
    sendApplyModifiedField(node.uuid, values);
    closeMetadataPopup();
  });

  popup.querySelector('.xtform-metadata-cancel')?.addEventListener('click', () => {
    sendCancelModifiedField(node.uuid);
    closeMetadataPopup();
  });

  document.body.appendChild(popup);
  positionPopupNearAnchor(popup, anchor);
  openMetadataPopupEl = popup;
}

function setupModifiedBadges(): void {
  document.querySelectorAll<HTMLButtonElement>('.xtform-modified-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const uuid = badge.getAttribute('data-uuid');
      const node = uuid && currentDoc ? findNode(currentDoc, uuid) : null;
      if (node && node.type !== 'Form') {
        openMetadataPopup(node as XtformNode, badge);
      }
    });
  });
}

function renderNode(node: XtformNode): string {
  const handlers: Record<string, (node: XtformNode) => string> = {
    'TextInput': renderTextInput,
    'TextArea': renderTextArea,
    'IntegerInput': renderIntegerInput,
    'DecimalInput': renderDecimalInput,
    'Checkbox': renderCheckbox,
    'DatePicker': renderDatePicker,
    'TimePicker': renderTimePicker,
    'Select': renderSelect,
    'RadioGroup': renderRadioGroup,
    'Section': renderSection,
    'CollapsibleSection': renderCollapsibleSection,
    'Tab': renderTab,
    'Table': renderTable,
  };

  const handler = handlers[node.type];
  if (!handler) {
    return renderUnknown(node);
  }

  return handler(node);
}

function renderTextInput(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <input
        type="text"
        class="xtform-input"
        data-uuid="${node.uuid}"
        value="${escapeHtml(String(node.value || ''))}"
      />
    </div>
  `;
}

function renderTextArea(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <textarea
        class="xtform-textarea"
        data-uuid="${node.uuid}"
      >${escapeHtml(String(node.value || ''))}</textarea>
    </div>
  `;
}

function renderIntegerInput(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <input
        type="number"
        step="1"
        class="xtform-input"
        data-uuid="${node.uuid}"
        value="${node.value || 0}"
      />
    </div>
  `;
}

function renderDecimalInput(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <input
        type="number"
        step="0.01"
        class="xtform-input"
        data-uuid="${node.uuid}"
        value="${node.value || 0.0}"
      />
    </div>
  `;
}

function renderCheckbox(node: XtformNode): string {
  const checked = node.value === true ? 'checked' : '';
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <label class="xtform-checkbox-label">
        <input
          type="checkbox"
          class="xtform-checkbox"
          data-uuid="${node.uuid}"
          ${checked}
        />
        ${node.label ? escapeHtml(node.label) : 'Checkbox'}${draftModifiedBadgeHtml(node)}
      </label>
    </div>
  `;
}

function renderDatePicker(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <input
        type="date"
        class="xtform-input"
        data-uuid="${node.uuid}"
        value="${node.value || ''}"
      />
    </div>
  `;
}

function renderTimePicker(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <input
        type="time"
        class="xtform-input"
        data-uuid="${node.uuid}"
        value="${node.value || '12:00'}"
      />
    </div>
  `;
}

function renderSelect(node: XtformNode): string {
  const options = (node.options || '').split(',').map(opt => opt.trim());
  const optionsHtml = options.map(opt =>
    `<option value="${escapeHtml(opt)}" ${node.value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
  ).join('');

  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <select class="xtform-select" data-uuid="${node.uuid}">
        ${optionsHtml}
      </select>
    </div>
  `;
}

function renderRadioGroup(node: XtformNode): string {
  const options = (node.options || '').split(',').map(opt => opt.trim());
  const optionsHtml = options.map((opt, idx) => {
    const radioId = `${node.uuid}-${idx}`;
    return `
      <label class="xtform-radio-label">
        <input
          type="radio"
          class="xtform-radio"
          name="${node.uuid}"
          data-uuid="${node.uuid}"
          value="${escapeHtml(opt)}"
          ${node.value === opt ? 'checked' : ''}
        />
        ${escapeHtml(opt)}
      </label>
    `;
  }).join('');

  return `
    <div class="xtform-field xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <div class="xtform-radio-group">
        ${optionsHtml}
      </div>
    </div>
  `;
}

function renderSection(node: XtformNode): string {
  const childrenHtml = node.items
    ? node.items.map(child => renderNode(child)).join('\n')
    : '';

  return `
    <div class="xtform-section xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<h2 class="xtform-section-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</h2>` : ''}
      <div class="xtform-section-content">
        ${childrenHtml}
      </div>
    </div>
  `;
}

function renderCollapsibleSection(node: XtformNode): string {
  const childrenHtml = node.items
    ? node.items.map(child => renderNode(child)).join('\n')
    : '';

  return `
    <details class="xtform-collapsible-section xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}" open>
      <summary>${node.label ? escapeHtml(node.label) : 'Collapsible Section'}${draftModifiedBadgeHtml(node)}</summary>
      ${draftButtonsHtml(node)}
      <div class="xtform-section-content">
        ${childrenHtml}
      </div>
    </details>
  `;
}

function renderTab(node: XtformNode): string {
  const childrenHtml = node.items
    ? node.items.map(child => renderNode(child)).join('\n')
    : '';

  return `
    <div class="xtform-tab xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      <div class="xtform-tab-label">${node.label ? escapeHtml(node.label) : 'Tab'}${draftModifiedBadgeHtml(node)}</div>
      <div class="xtform-tab-content">
        ${childrenHtml}
      </div>
    </div>
  `;
}

// Renders the editable control for one Table cell, matching the column's
// component type. Falls back to a plain text input for any unrecognized
// (or default TextInput) column type.
function renderCellInput(column: XtformNode, row: XtformTableRow): string {
  const value = row.data ? row.data[column.uuid] : undefined;
  const commonAttrs = `class="xtform-cell-input" data-row-uuid="${row.uuid}" data-col-uuid="${column.uuid}"`;

  switch (column.type) {
    case 'IntegerInput':
      return `<input type="number" step="1" ${commonAttrs} value="${value ?? 0}" />`;
    case 'DecimalInput':
      return `<input type="number" step="0.01" ${commonAttrs} value="${value ?? 0}" />`;
    case 'Checkbox':
      return `<input type="checkbox" class="xtform-cell-checkbox" data-row-uuid="${row.uuid}" data-col-uuid="${column.uuid}" ${value === true ? 'checked' : ''} />`;
    case 'DatePicker':
      return `<input type="date" ${commonAttrs} value="${escapeHtml(String(value ?? ''))}" />`;
    case 'TimePicker':
      return `<input type="time" ${commonAttrs} value="${escapeHtml(String(value ?? ''))}" />`;
    case 'Select':
    case 'RadioGroup': {
      const options = (column.options || '').split(',').map(opt => opt.trim()).filter(opt => opt);
      const optionsHtml = options.map(opt =>
        `<option value="${escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
      ).join('');
      return `<select ${commonAttrs}>${optionsHtml}</select>`;
    }
    case 'TextArea':
      return `<textarea class="xtform-cell-input xtform-cell-textarea" data-row-uuid="${row.uuid}" data-col-uuid="${column.uuid}">${escapeHtml(String(value ?? ''))}</textarea>`;
    case 'TextInput':
    default:
      return `<input type="text" ${commonAttrs} value="${escapeHtml(String(value ?? ''))}" />`;
  }
}

function renderTable(node: XtformNode): string {
  const columns = node.items || [];
  const rows: XtformTableRow[] = Array.isArray(node.data) ? node.data : [];

  const headerHtml = columns.map(col => `
    <th class="xtform-table-col-header xtform-component" data-uuid="${col.uuid}">${escapeHtml(col.label || col.type)}</th>
  `).join('');

  const rowsHtml = rows.map(row => `
    <tr data-row-uuid="${row.uuid}">
      ${columns.map(col => `<td>${renderCellInput(col, row)}</td>`).join('')}
      <td class="xtform-table-row-actions">
        <button class="xtform-table-row-delete" data-row-uuid="${row.uuid}" title="Delete row">✕</button>
      </td>
    </tr>
  `).join('');

  const emptyRowHtml = `<tr class="xtform-table-empty-row"><td colspan="${columns.length + 1}">No rows yet</td></tr>`;

  return `
    <div class="xtform-field xtform-table xtform-component${draftStatusClass(node)}" data-uuid="${node.uuid}">
      ${draftButtonsHtml(node)}
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}${draftModifiedBadgeHtml(node)}</label>` : ''}
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <table class="xtform-table-grid" data-table-uuid="${node.uuid}">
        <thead>
          <tr>
            ${headerHtml}
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || emptyRowHtml}
        </tbody>
      </table>
      <button class="xtform-table-add-row" data-table-uuid="${node.uuid}">+ Add Row</button>
    </div>
  `;
}

function renderUnknown(node: XtformNode): string {
  return `
    <div class="xtform-component-unknown xtform-component" data-uuid="${node.uuid}">
      Unknown component type: ${escapeHtml(node.type)}
    </div>
  `;
}

// Group consecutive Tab elements into TabbedSection
function groupTabs(html: string): string {
  // Simple implementation - can be enhanced later
  return html;
}

function renderForm(doc: XtformDocument): void {
  const formPreview = document.getElementById('form-preview');
  if (!formPreview) return;

  try {
    // Render form header (clickable to edit form properties)
    const quickMenuButton = (quickActions.length > 0 && !doc.disable_quick_actions)
      ? `<button class="xtform-quick-menu-btn" title="Quick actions" aria-label="Quick actions">⋮</button>`
      : '';

    const applyEligible = applyAction !== null && doc.show_apply_action === true;
    const applyEnabled = applyEligible &&
      (doc.applied_revision == null || doc.applied_revision !== doc.revision);
    const applyButton = applyEligible
      ? `<button class="xtform-apply-btn" data-command="${escapeHtml(applyAction!.command)}"${applyEnabled ? '' : ' disabled'}>${escapeHtml(applyAction!.title)}</button>`
      : '';

    // Draft toolbar: "{title} (pending changes)" + Apply all / Cancel
    // (spec/xtdraft-format.md). Shown only when `changes.kind` is present
    // in root fields; each button only if its command is declared.
    const hasPendingChanges = !!doc.changes?.kind;
    const draftBadge = hasPendingChanges ? '<span class="xtform-draft-badge">(pending changes)</span>' : '';
    const applyAllBtn = hasPendingChanges && draftActions.applyAll
      ? `<button class="xtform-draft-apply-all">Apply all</button>`
      : '';
    const cancelBtn = hasPendingChanges && draftActions.cancel
      ? `<button class="xtform-draft-cancel">Cancel</button>`
      : '';
    const draftToolbarHtml = (applyAllBtn || cancelBtn)
      ? `<div class="xtform-draft-actions">${applyAllBtn}${cancelBtn}</div>`
      : '';

    const formHeader = `
      <div class="xtform-form-header xtform-component" data-uuid="${doc.uuid}">
        <div class="xtform-form-header-row">
          <h2 class="xtform-form-title">${escapeHtml(doc.title || 'Untitled Form')} ${draftBadge}</h2>
          ${draftToolbarHtml}
          ${applyButton}
          ${quickMenuButton}
        </div>
        ${doc.description ? `<p class="xtform-form-description">${escapeHtml(doc.description)}</p>` : ''}
      </div>
    `;

    const itemsHtml = doc.items
      ? doc.items.map(node => renderNode(node)).join('\n')
      : '<p class="no-selection">No components in form</p>';

    formPreview.innerHTML = formHeader + groupTabs(itemsHtml);
    setupEventListeners();
  } catch (error) {
    formPreview.innerHTML = `
      <div class="xtform-error">
        <h3>Render Error</h3>
        <p>${escapeHtml(String(error))}</p>
      </div>
    `;
  }
}

// === EVENT LISTENERS ===

function setupEventListeners(): void {
  // Quick actions menu (Clarify | Elaborate | Summarize) on the form header
  document.querySelectorAll('.xtform-quick-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleQuickMenu(btn as HTMLElement);
    });
  });

  // Universal Apply button on the form header
  document.querySelectorAll('.xtform-apply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const command = (btn as HTMLElement).getAttribute('data-command');
      if (command) {
        sendRunCommand(command);
      }
    });
  });

  // Component selection
  document.querySelectorAll('.xtform-component').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const uuid = (el as HTMLElement).getAttribute('data-uuid');
      if (uuid) {
        selectComponent(uuid);
      }
    });
  });

  // Value change listeners - only attach to actual input/textarea/select elements
  document.querySelectorAll('input[data-uuid], textarea[data-uuid], select[data-uuid]').forEach(el => {
    const element = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const uuid = element.getAttribute('data-uuid');
    if (!uuid) return;

    if (element.type === 'checkbox') {
      element.addEventListener('change', () => {
        sendUpdateValue(uuid, (element as HTMLInputElement).checked);
      });
    } else if (element.type === 'radio') {
      element.addEventListener('change', () => {
        if ((element as HTMLInputElement).checked) {
          sendUpdateValue(uuid, element.value);
        }
      });
    } else if (element.type === 'number') {
      element.addEventListener('input', () => {
        // For number inputs, only send valid numbers
        // This allows users to type intermediate values like "-" or "3." without resetting
        const value = element.valueAsNumber;
        if (!isNaN(value)) {
          sendUpdateValue(uuid, value);
        }
        // If NaN (empty or invalid), don't send update - keep previous value
      });
    } else {
      element.addEventListener('input', () => {
        sendUpdateValue(uuid, element.value);
      });
    }
  });

  // Table "+ Add Row" buttons
  document.querySelectorAll('.xtform-table-add-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const tableUuid = (btn as HTMLElement).getAttribute('data-table-uuid');
      if (tableUuid) {
        sendAddTableRow(tableUuid);
      }
    });
  });

  // Table row delete buttons
  document.querySelectorAll('.xtform-table-row-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rowUuid = (btn as HTMLElement).getAttribute('data-row-uuid');
      const table = (btn as HTMLElement).closest('table[data-table-uuid]');
      const tableUuid = table?.getAttribute('data-table-uuid');
      if (tableUuid && rowUuid) {
        sendDeleteTableRow(tableUuid, rowUuid);
      }
    });
  });

  // Draft field buttons: Accept (✓) / Reject (✗) — Agent commands, the
  // Viewer just dispatches them with the item's uuid (spec/xtdraft-format.md)
  document.querySelectorAll('.xtform-draft-accept').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uuid = (btn as HTMLElement).getAttribute('data-uuid');
      if (uuid && draftActions.fieldAccept) {
        sendRunCommand(draftActions.fieldAccept, [uuid]);
      }
    });
  });

  document.querySelectorAll('.xtform-draft-reject').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uuid = (btn as HTMLElement).getAttribute('data-uuid');
      if (uuid && draftActions.fieldReject) {
        sendRunCommand(draftActions.fieldReject, [uuid]);
      }
    });
  });

  // Modified-field "M" badge — opens the metadata popup (Apply/Cancel
  // inside it are wired at creation time in `openMetadataPopup`, not here)
  setupModifiedBadges();

  // Draft toolbar: Apply all / Cancel — Agent commands (spec/xtdraft-format.md)
  document.querySelectorAll('.xtform-draft-apply-all').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (draftActions.applyAll) {
        sendRunCommand(draftActions.applyAll);
      }
    });
  });

  document.querySelectorAll('.xtform-draft-cancel').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (draftActions.cancel) {
        sendRunCommand(draftActions.cancel);
      }
    });
  });

  // Table cell value change listeners
  document.querySelectorAll('.xtform-cell-input, .xtform-cell-checkbox').forEach(el => {
    const element = el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const rowUuid = element.getAttribute('data-row-uuid');
    const colUuid = element.getAttribute('data-col-uuid');
    const table = element.closest('table[data-table-uuid]');
    const tableUuid = table?.getAttribute('data-table-uuid');
    if (!rowUuid || !colUuid || !tableUuid) return;

    if (element instanceof HTMLInputElement && element.type === 'checkbox') {
      element.addEventListener('change', () => {
        sendUpdateTableCell(tableUuid, rowUuid, colUuid, element.checked);
      });
    } else if (element instanceof HTMLInputElement && element.type === 'number') {
      element.addEventListener('input', () => {
        const value = element.valueAsNumber;
        if (!isNaN(value)) {
          sendUpdateTableCell(tableUuid, rowUuid, colUuid, value);
        }
      });
    } else {
      element.addEventListener('input', () => {
        sendUpdateTableCell(tableUuid, rowUuid, colUuid, element.value);
      });
    }
  });
}

function selectComponent(uuid: string): void {
  // Remove previous selection
  document.querySelectorAll('.xtform-component.selected').forEach(el => {
    el.classList.remove('selected');
  });

  // Add new selection
  const element = document.querySelector(`.xtform-component[data-uuid="${uuid}"]`);
  if (element) {
    element.classList.add('selected');
    selectedUuid = uuid;
    renderPropertyEditor(uuid);
  }
}

// === PROPERTY EDITOR ===

function renderPropertyEditor(uuid: string): void {
  const propertyContent = document.getElementById('property-content');
  if (!propertyContent || !currentDoc) return;

  const node = findNode(currentDoc, uuid);
  if (!node) {
    propertyContent.innerHTML = '<p class="no-selection">Component not found</p>';
    return;
  }

  const html = `
    <div class="property-form">
      <div class="property-section">
        <label class="property-label">Type</label>
        <span class="type-badge">${node.type}</span>
      </div>

      <div class="property-section">
        <label class="property-label">UUID</label>
        <input type="text" class="property-input" value="${node.uuid}" readonly />
      </div>

      ${node.type === 'Form' ? `
      <div class="property-section">
        <label class="property-label">Title</label>
        <input
          type="text"
          class="property-input"
          id="prop-title"
          value="${escapeHtml(node.title || '')}"
        />
      </div>
      ` : node.type !== 'Form' ? `
      <div class="property-section">
        <label class="property-label">Label</label>
        <input
          type="text"
          class="property-input"
          id="prop-label"
          value="${escapeHtml(node.label || '')}"
        />
      </div>
      ` : ''}

      <div class="property-section">
        <label class="property-label">Description</label>
        <textarea
          class="property-textarea"
          id="prop-description"
        >${escapeHtml(node.description || '')}</textarea>
      </div>

      ${node.type === 'Select' || node.type === 'RadioGroup' ? `
      <div class="property-section">
        <label class="property-label">Options (comma-separated)</label>
        <input
          type="text"
          class="property-input"
          id="prop-options"
          value="${escapeHtml(node.options || '')}"
        />
      </div>
      ` : ''}

      ${node.type !== 'Form' ? `
      <div class="property-actions">
        <button class="btn-danger" id="btn-delete">Delete Component</button>
        <button class="btn-secondary" id="btn-duplicate">Duplicate</button>
      </div>
      ` : ''}
    </div>
  `;

  propertyContent.innerHTML = html;
  setupPropertyEditorListeners(uuid);
}

function setupPropertyEditorListeners(uuid: string): void {
  // Title (for Form)
  const titleInput = document.getElementById('prop-title') as HTMLInputElement;
  if (titleInput) {
    titleInput.addEventListener('input', () => {
      sendUpdateProperty(uuid, 'title', titleInput.value);
    });
  }

  // Label
  const labelInput = document.getElementById('prop-label') as HTMLInputElement;
  if (labelInput) {
    labelInput.addEventListener('input', () => {
      sendUpdateProperty(uuid, 'label', labelInput.value);
    });
  }

  // Description
  const descInput = document.getElementById('prop-description') as HTMLTextAreaElement;
  if (descInput) {
    descInput.addEventListener('input', () => {
      sendUpdateProperty(uuid, 'description', descInput.value);
    });
  }

  // Options
  const optionsInput = document.getElementById('prop-options') as HTMLInputElement;
  if (optionsInput) {
    optionsInput.addEventListener('input', () => {
      sendUpdateProperty(uuid, 'options', optionsInput.value);
    });
  }

  // Delete button
  const deleteBtn = document.getElementById('btn-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      if (confirm('Delete this component?')) {
        sendDeleteComponent(uuid);
      }
    });
  }

  // Duplicate button
  const duplicateBtn = document.getElementById('btn-duplicate');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => {
      sendDuplicateComponent(uuid);
    });
  }
}

// === COMPONENT PALETTE ===

function renderComponentPalette(category: string): void {
  const container = document.getElementById('palette-components');
  if (!container) return;

  const components = COMPONENT_REGISTRY.filter(c => c.category === category);

  container.innerHTML = components.map(comp => `
    <button class="palette-component"
            data-type="${comp.type}"
            title="${comp.description}">
      <span class="component-icon">${comp.icon}</span>
      <span class="component-label">${comp.label}</span>
    </button>
  `).join('');

  // Attach click handlers
  container.querySelectorAll('.palette-component').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.getAttribute('data-type');
      if (type) {
        handleAddComponent(type);
      }
    });
  });
}

function handleAddComponent(type: string): void {
  const definition = COMPONENT_REGISTRY.find(c => c.type === type);
  if (!definition) return;

  const uuid = generateUuid();
  const node = definition.createNode(uuid);

  // Determine parent: if component is selected and is a container, add as child
  // Otherwise add to root
  let parentUuid: string | null = null;
  if (selectedUuid && currentDoc) {
    const selectedNode = findNode(currentDoc, selectedUuid);
    if (selectedNode && isContainer(selectedNode.type)) {
      parentUuid = selectedUuid;
    }
  }

  sendAddComponent(parentUuid, node);
}

// === PROPERTY EDITOR COLLAPSE ===

function setupPropertyEditorCollapse(): void {
  const collapseBtn = document.getElementById('collapse-properties');
  const floatBtn = document.getElementById('property-toggle-float');
  const propertyEditor = document.getElementById('property-editor');

  if (!collapseBtn || !floatBtn || !propertyEditor) return;

  const toggleCollapse = () => {
    const isCollapsed = propertyEditor.classList.toggle('collapsed');

    // Toggle floating button visibility
    if (isCollapsed) {
      floatBtn.style.display = 'block';
    } else {
      floatBtn.style.display = 'none';
    }

    // Save state
    localStorage.setItem('xtform-property-editor-collapsed', String(isCollapsed));
  };

  // Attach to both buttons
  collapseBtn.addEventListener('click', toggleCollapse);
  floatBtn.addEventListener('click', toggleCollapse);

  // Restore collapse state on load
  const collapsed = localStorage.getItem('xtform-property-editor-collapsed');
  if (collapsed === 'true') {
    propertyEditor.classList.add('collapsed');
    floatBtn.style.display = 'block';
  }
}

// === HELPER FUNCTIONS ===

function generateUuid(): string {
  return 'f-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function isContainer(type: string): boolean {
  // 'Table' is included so that selecting a Table and clicking any Input
  // component in the palette adds it as a new column (see handleAddComponent).
  return ['Section', 'CollapsibleSection', 'Tab', 'Form', 'Table'].includes(type);
}

function findNode(doc: XtformDocument, uuid: string): XtformNode | XtformDocument | null {
  if (doc.uuid === uuid) {
    return doc;
  }

  function search(node: XtformNode): XtformNode | null {
    if (node.uuid === uuid) {
      return node;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        const result = search(child);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  if (doc.items) {
    for (const item of doc.items) {
      const result = search(item);
      if (result) {
        return result;
      }
    }
  }

  return null;
}

// === MESSAGE HANDLERS ===

function sendUpdateValue(uuid: string, value: any): void {
  vscode.postMessage({
    type: 'updateValue',
    uuid,
    value
  });
}

function sendUpdateProperty(uuid: string, property: string, value: any): void {
  vscode.postMessage({
    type: 'updateProperty',
    uuid,
    property,
    value
  });
}

// Metadata popup Apply/Cancel (spec/xtdraft-format.md, "Modified fields") —
// unlike `sendRunCommand`, these are handled directly by this extension
// (`xtformEditorProvider.ts`), not dispatched to an external Agent command.
function sendApplyModifiedField(uuid: string, values: Record<string, unknown>): void {
  vscode.postMessage({
    type: 'applyModifiedField',
    uuid,
    values
  });
}

function sendCancelModifiedField(uuid: string): void {
  vscode.postMessage({
    type: 'cancelModifiedField',
    uuid
  });
}

function sendAddComponent(parentUuid: string | null, node: XtformNode): void {
  vscode.postMessage({
    type: 'addComponent',
    parentUuid,
    node
  });
}

function sendDeleteComponent(uuid: string): void {
  vscode.postMessage({
    type: 'deleteComponent',
    uuid
  });
}

function sendDuplicateComponent(uuid: string): void {
  vscode.postMessage({
    type: 'duplicateComponent',
    uuid
  });
}

function sendAddTableRow(tableUuid: string): void {
  vscode.postMessage({
    type: 'addTableRow',
    tableUuid,
    row: { uuid: generateUuid(), props: {}, data: {} } as XtformTableRow
  });
}

function sendDeleteTableRow(tableUuid: string, rowUuid: string): void {
  vscode.postMessage({
    type: 'deleteTableRow',
    tableUuid,
    rowUuid
  });
}

function sendUpdateTableCell(tableUuid: string, rowUuid: string, columnUuid: string, value: any): void {
  vscode.postMessage({
    type: 'updateTableCell',
    tableUuid,
    rowUuid,
    columnUuid,
    value
  });
}

// === INITIALIZATION ===

window.addEventListener('message', event => {
  const message = event.data;

  switch (message.type) {
    case 'update':
      try {
        // Save focus state before re-rendering
        const activeElement = document.activeElement as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
        const hasFocus = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.tagName === 'SELECT'
        );
        const uuid = hasFocus ? activeElement?.getAttribute('data-uuid') : null;
        const rowUuid = hasFocus ? activeElement?.getAttribute('data-row-uuid') : null;
        const colUuid = hasFocus ? activeElement?.getAttribute('data-col-uuid') : null;
        const elementId = hasFocus ? activeElement?.id : null;
        const radioValue = (hasFocus && activeElement instanceof HTMLInputElement && activeElement.type === 'radio') ? activeElement.value : null;
        const selectionStart = (hasFocus && 'selectionStart' in activeElement!) ? activeElement!.selectionStart : null;
        const selectionEnd = (hasFocus && 'selectionEnd' in activeElement!) ? activeElement!.selectionEnd : null;

        quickActions = Array.isArray(message.quickActions) ? message.quickActions : [];
        applyAction = message.applyAction ?? null;
        draftActions = message.draftActions && typeof message.draftActions === 'object' ? message.draftActions : {};
        currentDoc = YAML.parse(message.content) as XtformDocument;
        unflattenNode(currentDoc);
        renderForm(currentDoc);

        // Restore focus and cursor position
        if (hasFocus) {
          let restoredElement: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null = null;

          // Try to restore Property Editor fields first (by ID)
          if (elementId && (elementId.startsWith('prop-') || elementId === 'prop-title' || elementId === 'prop-label' || elementId === 'prop-description' || elementId === 'prop-options')) {
            restoredElement = document.getElementById(elementId) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
          }
          // Otherwise restore form fields (by data-uuid)
          else if (uuid) {
            // For radio buttons, need to find the specific radio with both uuid and value
            if (radioValue !== null) {
              restoredElement = document.querySelector(
                `input[type="radio"][data-uuid="${uuid}"][value="${radioValue}"]`
              ) as HTMLInputElement | null;
            } else {
              // For other inputs, use uuid only
              restoredElement = document.querySelector(
                `input[data-uuid="${uuid}"], textarea[data-uuid="${uuid}"], select[data-uuid="${uuid}"]`
              ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
            }
          }
          // Otherwise restore a Table cell (identified by row + column uuid)
          else if (rowUuid && colUuid) {
            restoredElement = document.querySelector(
              `[data-row-uuid="${rowUuid}"][data-col-uuid="${colUuid}"]`
            ) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
          }

          if (restoredElement) {
            restoredElement.focus();
            const isNumberInput = restoredElement instanceof HTMLInputElement && restoredElement.type === 'number';

            if (isNumberInput) {
              // For number inputs, setSelectionRange doesn't work, so move cursor to end using a trick
              const val = restoredElement.value;
              restoredElement.value = '';
              restoredElement.value = val;
            } else if ('setSelectionRange' in restoredElement && selectionStart !== null && selectionEnd !== null) {
              restoredElement.setSelectionRange(selectionStart, selectionEnd);
            }
          }
        }
      } catch (error) {
        const formPreview = document.getElementById('form-preview');
        if (formPreview) {
          formPreview.innerHTML = `
            <div class="xtform-error">
              <h3>Parse Error</h3>
              <p>${escapeHtml(String(error))}</p>
            </div>
          `;
        }
      }
      break;
  }
});

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  // Setup palette tabs
  document.querySelectorAll('.palette-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active tab
      document.querySelectorAll('.palette-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Render components for selected category
      const category = tab.getAttribute('data-category');
      if (category) {
        renderComponentPalette(category as any);
      }
    });
  });

  // Render initial palette (inputs)
  renderComponentPalette('inputs');

  // Setup property editor collapse
  setupPropertyEditorCollapse();

  // Close the quick actions menu / an open metadata popup when clicking
  // anywhere outside it
  document.addEventListener('click', () => {
    closeQuickMenu();
    closeMetadataPopup();
  });

  // Signal ready to extension
  vscode.postMessage({ type: 'ready' });
});
