// Webview script for XTForm editor
// This script runs in the webview context and communicates with the extension

import * as YAML from 'yaml';

// Parse .xtform file content
const parseYAML = (content: string): any => {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    throw new Error('Invalid .xtform format');
  }

  const yamlStr = parts[1].trim();
  const template = parts.slice(2).join('---').trim();

  console.log('[XTForm Webview] Parsing YAML frontmatter...');

  // Use proper YAML parser
  const parsed = YAML.parse(yamlStr);

  console.log('[XTForm Webview] Parsed metadata:', parsed);
  console.log('[XTForm Webview] UUID:', parsed.uuid);
  console.log('[XTForm Webview] Data:', parsed.data);
  console.log('[XTForm Webview] Data keys count:', Object.keys(parsed.data || {}).length);

  return {
    uuid: parsed.uuid || '',
    data: parsed.data || {},
    template
  };
};

// Parse component tags from template
const parseComponentTags = (template: string): any[] => {
  const tokens = tokenizeTemplate(template);
  const { components } = buildComponentTree(tokens, 0);
  return components;
};

// Tokenize template into tags
const tokenizeTemplate = (template: string): any[] => {
  const tokens: any[] = [];
  const tagPattern = /\[%\s*(\/?)(\w+)(.*?)\s*(\/)?\s*%\]/gs;

  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(template)) !== null) {
    const [fullMatch, closingSlash, componentType, attributesStr, selfClosingSlash] = match;
    const position = match.index;

    if (closingSlash) {
      // Closing tag
      tokens.push({
        type: 'CLOSE_TAG',
        componentType,
        position
      });
    } else if (selfClosingSlash) {
      // Self-closing tag
      const attributes = parseAttributes(attributesStr.trim());
      tokens.push({
        type: 'SELF_CLOSING',
        componentType,
        attributes,
        position
      });
    } else {
      // Opening tag
      const attributes = parseAttributes(attributesStr.trim());
      tokens.push({
        type: 'OPEN_TAG',
        componentType,
        attributes,
        position
      });
    }
  }

  return tokens;
};

// Build component tree from tokens
const buildComponentTree = (tokens: any[], startIndex: number): { components: any[]; nextIndex: number } => {
  const components: any[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === 'CLOSE_TAG') {
      // End of current container
      return { components, nextIndex: i + 1 };
    }

    if (token.type === 'SELF_CLOSING') {
      // Self-closing tag - no children
      components.push({
        type: token.componentType,
        uuid: token.attributes?.uuid || '',
        label: token.attributes?.label,
        attributes: token.attributes || {},
        children: [],
        selfClosing: true
      });
      i++;
    } else if (token.type === 'OPEN_TAG') {
      // Opening tag - parse children
      const { components: children, nextIndex } = buildComponentTree(tokens, i + 1);

      components.push({
        type: token.componentType,
        uuid: token.attributes?.uuid || '',
        label: token.attributes?.label,
        attributes: token.attributes || {},
        children,
        selfClosing: false
      });
      i = nextIndex;
    } else {
      i++;
    }
  }

  return { components, nextIndex: i };
};

// Parse attributes from tag
const parseAttributes = (attributeStr: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const attrPattern = /(\w+(?:\.\w+)*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;

  let match: RegExpExecArray | null;
  while ((match = attrPattern.exec(attributeStr)) !== null) {
    const [, key, doubleQuoted, singleQuoted, braced] = match;
    const value = doubleQuoted ?? singleQuoted ?? braced ?? '';
    attributes[key] = value;
  }

  return attributes;
};

// Render form HTML
const renderForm = (components: any[], data: Record<string, any>): string => {
  // Group consecutive Tab components into TabbedSections
  const grouped = groupTabs(components);
  const html = grouped.map(c => renderComponent(c, data)).join('\n');
  return `<div class="xtform-root">\n${html}\n</div>`;
};

// Group consecutive Tab components
const groupTabs = (components: any[]): any[] => {
  const result: any[] = [];
  let i = 0;

  while (i < components.length) {
    const component = components[i];

    if (component.type === 'Tab') {
      // Collect all consecutive Tabs
      const tabs: any[] = [component];
      i++;

      while (i < components.length && components[i].type === 'Tab') {
        tabs.push(components[i]);
        i++;
      }

      // Create a TabbedSection
      result.push({
        type: 'TabbedSection',
        uuid: `tabbed-${tabs[0].uuid}`,
        label: '',
        attributes: {},
        children: tabs,
        selfClosing: false
      });
    } else {
      result.push(component);
      i++;
    }
  }

  return result;
};

// Render single component
const renderComponent = (component: any, data: Record<string, any>): string => {
  const value = data[component.uuid] || '';
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const placeholder = component.attributes.placeholder || '';

  switch (component.type) {
    case 'Section':
      const sectionChildren = (component.children || []).map((c: any) => renderComponent(c, data)).join('\n');
      return `<div class="xtform-section">
        ${label ? `<h3 class="xtform-section-label">${escapeHtml(label)}</h3>` : ''}
        <div class="xtform-section-content">
          ${sectionChildren}
        </div>
      </div>`;

    case 'CollapsibleSection':
      const collapsibleChildren = (component.children || []).map((c: any) => renderComponent(c, data)).join('\n');
      const sectionId = `section-${escapeHtml(component.uuid)}`;
      return `<details class="xtform-collapsible-section" open>
        <summary>${escapeHtml(label)}</summary>
        <div class="xtform-section-content">
          ${collapsibleChildren}
        </div>
      </details>`;

    case 'TabbedSection':
      // Render tabs with tab navigation
      const tabs = component.children || [];
      const tabHeaders = tabs.map((tab: any, index: number) => {
        const tabLabel = tab.label || tab.attributes.label || `Tab ${index + 1}`;
        return `<button class="xtform-tab-button ${index === 0 ? 'active' : ''}" data-tab-index="${index}">${escapeHtml(tabLabel)}</button>`;
      }).join('');

      const tabPanels = tabs.map((tab: any, index: number) => {
        const tabChildren = (tab.children || []).map((c: any) => renderComponent(c, data)).join('\n');
        return `<div class="xtform-tab-panel ${index === 0 ? 'active' : ''}" data-tab-index="${index}">
          ${tabChildren}
        </div>`;
      }).join('');

      return `<div class="xtform-tabbed-section">
        <div class="xtform-tab-buttons">
          ${tabHeaders}
        </div>
        <div class="xtform-tab-panels">
          ${tabPanels}
        </div>
      </div>`;

    case 'TextInput':
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <input
          type="text"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
          ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
        />
      </div>`;

    case 'TextArea':
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <textarea
          class="xtform-textarea"
          data-uuid="${escapeHtml(component.uuid)}"
          ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
        >${escapeHtml(String(value))}</textarea>
      </div>`;

    case 'IntegerInput':
      const minInt = component.attributes.min_value || '';
      const maxInt = component.attributes.max_value || '';
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <input
          type="number"
          step="1"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
          ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
          ${minInt ? `min="${escapeHtml(minInt)}"` : ''}
          ${maxInt ? `max="${escapeHtml(maxInt)}"` : ''}
        />
      </div>`;

    case 'DecimalInput':
      const minDec = component.attributes.min_value || '';
      const maxDec = component.attributes.max_value || '';
      const step = component.attributes.step || '0.01';
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <input
          type="number"
          step="${escapeHtml(step)}"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
          ${placeholder ? `placeholder="${escapeHtml(placeholder)}"` : ''}
          ${minDec ? `min="${escapeHtml(minDec)}"` : ''}
          ${maxDec ? `max="${escapeHtml(maxDec)}"` : ''}
        />
      </div>`;

    case 'Checkbox':
      const checked = value === true || value === 'true';
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        <label class="xtform-checkbox-label">
          <input
            type="checkbox"
            class="xtform-checkbox"
            data-uuid="${escapeHtml(component.uuid)}"
            ${checked ? 'checked' : ''}
          />
          ${escapeHtml(label)}
        </label>
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
      </div>`;

    case 'RadioGroup':
      const radioOptions = (component.attributes.options || '').split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <div class="xtform-radio-group">
          ${radioOptions.map((opt: string) => `
            <label class="xtform-radio-label">
              <input
                type="radio"
                class="xtform-radio"
                name="radio-${escapeHtml(component.uuid)}"
                data-uuid="${escapeHtml(component.uuid)}"
                value="${escapeHtml(opt)}"
                ${value === opt ? 'checked' : ''}
              />
              ${escapeHtml(opt)}
            </label>
          `).join('\n')}
        </div>
      </div>`;

    case 'MultipleChoice':
      const multiOptions = (component.attributes.options || '').split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      const selectedValues = Array.isArray(value) ? value : (value ? String(value).split(',') : []);
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <div class="xtform-multiple-choice">
          ${multiOptions.map((opt: string) => `
            <label class="xtform-checkbox-label">
              <input
                type="checkbox"
                class="xtform-multiple-choice-option"
                data-uuid="${escapeHtml(component.uuid)}"
                value="${escapeHtml(opt)}"
                ${selectedValues.includes(opt) ? 'checked' : ''}
              />
              ${escapeHtml(opt)}
            </label>
          `).join('\n')}
        </div>
      </div>`;

    case 'DatePicker':
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <input
          type="date"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
        />
      </div>`;

    case 'TimePicker':
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <input
          type="time"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
        />
      </div>`;

    case 'Select':
      const optionsStr = component.attributes.options || '';
      const options = optionsStr.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
        <select class="xtform-select" data-uuid="${escapeHtml(component.uuid)}">
          <option value="">-- Select --</option>
          ${options.map((opt: string) =>
            `<option value="${escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`
          ).join('\n')}
        </select>
      </div>`;

    default:
      return `<div class="xtform-component-unknown">Unknown component: ${escapeHtml(component.type)}</div>`;
  }
};

// Escape HTML
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
};

// VS Code API
declare function acquireVsCodeApi(): any;
const vscode = acquireVsCodeApi();

// Main webview logic
let currentContent = '';

// Handle messages from extension
window.addEventListener('message', (event) => {
  const message = event.data;
  console.log('[XTForm Webview] Received message:', message.type);

  switch (message.type) {
    case 'update':
      console.log('[XTForm Webview] Content length:', message.content?.length);
      updateForm(message.content);
      break;
  }
});

// Update form with new content
const updateForm = (content: string): void => {
  currentContent = content;
  console.log('[XTForm Webview] updateForm called, content length:', content?.length);
  console.log('[XTForm Webview] Content preview:', content?.substring(0, 200));

  try {
    const doc = parseYAML(content);
    console.log('[XTForm Webview] Parsed YAML data:', JSON.stringify(doc.data, null, 2));
    console.log('[XTForm Webview] Data keys:', Object.keys(doc.data));
    console.log('[XTForm Webview] Template length:', doc.template?.length);

    const components = parseComponentTags(doc.template);
    console.log('[XTForm Webview] Found components:', components.length);
    console.log('[XTForm Webview] Components:', components);

    const formHtml = renderForm(components, doc.data);
    console.log('[XTForm Webview] Generated HTML length:', formHtml.length);

    const root = document.getElementById('root');
    if (root) {
      console.log('[XTForm Webview] Setting innerHTML to root');
      root.innerHTML = formHtml;
      attachEventListeners();
      console.log('[XTForm Webview] Form updated successfully');
    } else {
      console.error('[XTForm Webview] Root element not found!');
    }
  } catch (error) {
    console.error('[XTForm Webview] Error in updateForm:', error);
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div class="xtform-error">
          <h3>Error parsing document</h3>
          <p>${escapeHtml(String(error))}</p>
        </div>
      `;
    }
    vscode.postMessage({
      type: 'error',
      message: String(error)
    });
  }
};

// Attach event listeners to form inputs
const attachEventListeners = (): void => {
  // Text inputs (TextInput, IntegerInput, DecimalInput, DatePicker, TimePicker)
  document.querySelectorAll('.xtform-input').forEach(input => {
    const element = input as HTMLInputElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      element.addEventListener('input', () => {
        vscode.postMessage({
          type: 'edit',
          uuid,
          value: element.value
        });
      });
    }
  });

  // Text areas
  document.querySelectorAll('.xtform-textarea').forEach(textarea => {
    const element = textarea as HTMLTextAreaElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      element.addEventListener('input', () => {
        vscode.postMessage({
          type: 'edit',
          uuid,
          value: element.value
        });
      });
    }
  });

  // Checkboxes
  document.querySelectorAll('.xtform-checkbox').forEach(checkbox => {
    const element = checkbox as HTMLInputElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      element.addEventListener('change', () => {
        vscode.postMessage({
          type: 'edit',
          uuid,
          value: element.checked
        });
      });
    }
  });

  // Radio buttons
  document.querySelectorAll('.xtform-radio').forEach(radio => {
    const element = radio as HTMLInputElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      element.addEventListener('change', () => {
        if (element.checked) {
          vscode.postMessage({
            type: 'edit',
            uuid,
            value: element.value
          });
        }
      });
    }
  });

  // Multiple choice (collect all checked values)
  const multipleChoiceFields = new Map<string, HTMLInputElement[]>();
  document.querySelectorAll('.xtform-multiple-choice-option').forEach(checkbox => {
    const element = checkbox as HTMLInputElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      if (!multipleChoiceFields.has(uuid)) {
        multipleChoiceFields.set(uuid, []);
      }
      multipleChoiceFields.get(uuid)!.push(element);

      element.addEventListener('change', () => {
        const checkboxes = multipleChoiceFields.get(uuid)!;
        const selectedValues = checkboxes
          .filter(cb => cb.checked)
          .map(cb => cb.value);

        vscode.postMessage({
          type: 'edit',
          uuid,
          value: selectedValues.join(',')
        });
      });
    }
  });

  // Select dropdowns
  document.querySelectorAll('.xtform-select').forEach(select => {
    const element = select as HTMLSelectElement;
    const uuid = element.getAttribute('data-uuid');

    if (uuid) {
      element.addEventListener('change', () => {
        vscode.postMessage({
          type: 'edit',
          uuid,
          value: element.value
        });
      });
    }
  });

  // Tab buttons
  document.querySelectorAll('.xtform-tab-button').forEach(button => {
    const element = button as HTMLButtonElement;
    element.addEventListener('click', () => {
      const tabIndex = element.getAttribute('data-tab-index');
      const tabbedSection = element.closest('.xtform-tabbed-section');

      if (tabbedSection && tabIndex !== null) {
        // Deactivate all tabs in this section
        tabbedSection.querySelectorAll('.xtform-tab-button').forEach(btn => btn.classList.remove('active'));
        tabbedSection.querySelectorAll('.xtform-tab-panel').forEach(panel => panel.classList.remove('active'));

        // Activate clicked tab
        element.classList.add('active');
        const panel = tabbedSection.querySelector(`.xtform-tab-panel[data-tab-index="${tabIndex}"]`);
        if (panel) {
          panel.classList.add('active');
        }
      }
    });
  });
};

// Send ready message when webview loads
console.log('[XTForm Webview] Sending ready message');
vscode.postMessage({ type: 'ready' });
