// Webview script for XTForm editor - NEW YAML HIERARCHY FORMAT
// This script runs in the webview context and communicates with the extension

import * as YAML from 'yaml';

// Type definitions matching backend
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

function sendRunCommand(command: string): void {
  vscode.postMessage({ type: 'runCommand', command });
}

// === RENDERING FUNCTIONS ===

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
  };

  const handler = handlers[node.type];
  if (!handler) {
    return renderUnknown(node);
  }

  return handler(node);
}

function renderTextInput(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.description ? `<p class="xtform-description">${escapeHtml(node.description)}</p>` : ''}
      <label class="xtform-checkbox-label">
        <input
          type="checkbox"
          class="xtform-checkbox"
          data-uuid="${node.uuid}"
          ${checked}
        />
        ${node.label ? escapeHtml(node.label) : 'Checkbox'}
      </label>
    </div>
  `;
}

function renderDatePicker(node: XtformNode): string {
  return `
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-field xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<label class="xtform-label">${escapeHtml(node.label)}</label>` : ''}
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
    <div class="xtform-section xtform-component" data-uuid="${node.uuid}">
      ${node.label ? `<h2 class="xtform-section-label">${escapeHtml(node.label)}</h2>` : ''}
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
    <details class="xtform-collapsible-section xtform-component" data-uuid="${node.uuid}" open>
      <summary>${node.label ? escapeHtml(node.label) : 'Collapsible Section'}</summary>
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
    <div class="xtform-tab xtform-component" data-uuid="${node.uuid}">
      <div class="xtform-tab-label">${node.label ? escapeHtml(node.label) : 'Tab'}</div>
      <div class="xtform-tab-content">
        ${childrenHtml}
      </div>
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
    const formHeader = `
      <div class="xtform-form-header xtform-component" data-uuid="${doc.uuid}">
        <div class="xtform-form-header-row">
          <h2 class="xtform-form-title">${escapeHtml(doc.title || 'Untitled Form')}</h2>
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
  return ['Section', 'CollapsibleSection', 'Tab', 'Form'].includes(type);
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
        const elementId = hasFocus ? activeElement?.id : null;
        const radioValue = (hasFocus && activeElement instanceof HTMLInputElement && activeElement.type === 'radio') ? activeElement.value : null;
        const selectionStart = (hasFocus && 'selectionStart' in activeElement!) ? activeElement!.selectionStart : null;
        const selectionEnd = (hasFocus && 'selectionEnd' in activeElement!) ? activeElement!.selectionEnd : null;

        quickActions = Array.isArray(message.quickActions) ? message.quickActions : [];
        currentDoc = YAML.parse(message.content) as XtformDocument;
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

  // Close the quick actions menu when clicking anywhere outside it
  document.addEventListener('click', () => closeQuickMenu());

  // Signal ready to extension
  vscode.postMessage({ type: 'ready' });
});
