import { ComponentTag } from '../parsers/componentTagParser';

/**
 * Renders component tags as HTML form
 */
export function renderForm(
  components: ComponentTag[],
  data: Record<string, any>
): string {
  const html = components.map(component => renderComponent(component, data)).join('\n');
  return `<div class="xtform-root">\n${html}\n</div>`;
}

/**
 * Renders a single component
 */
function renderComponent(component: ComponentTag, data: Record<string, any>): string {
  switch (component.type) {
    case 'Section':
      return renderSection(component, data);
    case 'CollapsibleSection':
      return renderCollapsibleSection(component, data);
    case 'Tab':
      return renderTab(component, data);
    case 'TextInput':
      return renderTextInput(component, data);
    case 'TextArea':
      return renderTextArea(component, data);
    case 'IntegerInput':
      return renderIntegerInput(component, data);
    case 'DecimalInput':
      return renderDecimalInput(component, data);
    case 'Checkbox':
      return renderCheckbox(component, data);
    case 'Select':
      return renderSelect(component, data);
    case 'RadioGroup':
      return renderRadioGroup(component, data);
    case 'Table':
      return renderTable(component, data);
    default:
      return `<div class="xtform-component-unknown" data-uuid="${escapeHtml(component.uuid)}">
        <p>Unknown component type: ${escapeHtml(component.type)}</p>
      </div>`;
  }
}

/**
 * Renders a Section component
 */
function renderSection(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const children = component.children
    ? component.children.map(child => renderComponent(child, data)).join('\n')
    : '';

  return `<div class="xtform-section" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<h3 class="xtform-section-label">${escapeHtml(label)}</h3>` : ''}
  <div class="xtform-section-content">
    ${children}
  </div>
</div>`;
}

/**
 * Renders a CollapsibleSection component
 */
function renderCollapsibleSection(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const children = component.children
    ? component.children.map(child => renderComponent(child, data)).join('\n')
    : '';

  return `<details class="xtform-collapsible-section" data-uuid="${escapeHtml(component.uuid)}" open>
  <summary class="xtform-section-label">${escapeHtml(label)}</summary>
  <div class="xtform-section-content">
    ${children}
  </div>
</details>`;
}

/**
 * Renders a Tab component (simplified for Phase 1)
 */
function renderTab(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const children = component.children
    ? component.children.map(child => renderComponent(child, data)).join('\n')
    : '';

  return `<div class="xtform-tab" data-uuid="${escapeHtml(component.uuid)}">
  <div class="xtform-tab-label">${escapeHtml(label)}</div>
  <div class="xtform-tab-content">
    ${children}
  </div>
</div>`;
}

/**
 * Renders a TextInput component
 */
function renderTextInput(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const placeholder = component.attributes.placeholder || '';
  const value = data[component.uuid] || '';

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <input
    type="text"
    class="xtform-input"
    data-uuid="${escapeHtml(component.uuid)}"
    value="${escapeHtml(String(value))}"
    placeholder="${escapeHtml(placeholder)}"
  />
</div>`;
}

/**
 * Renders a TextArea component
 */
function renderTextArea(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const placeholder = component.attributes.placeholder || '';
  const value = data[component.uuid] || '';

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <textarea
    class="xtform-textarea"
    data-uuid="${escapeHtml(component.uuid)}"
    placeholder="${escapeHtml(placeholder)}"
  >${escapeHtml(String(value))}</textarea>
</div>`;
}

/**
 * Renders an IntegerInput component
 */
function renderIntegerInput(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const value = data[component.uuid] || '';
  const min = component.attributes.min_value || '';
  const max = component.attributes.max_value || '';

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <input
    type="number"
    class="xtform-input"
    data-uuid="${escapeHtml(component.uuid)}"
    value="${escapeHtml(String(value))}"
    ${min ? `min="${escapeHtml(min)}"` : ''}
    ${max ? `max="${escapeHtml(max)}"` : ''}
    step="1"
  />
</div>`;
}

/**
 * Renders a DecimalInput component
 */
function renderDecimalInput(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const value = data[component.uuid] || '';
  const min = component.attributes.min_value || '';
  const max = component.attributes.max_value || '';

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <input
    type="number"
    class="xtform-input"
    data-uuid="${escapeHtml(component.uuid)}"
    value="${escapeHtml(String(value))}"
    ${min ? `min="${escapeHtml(min)}"` : ''}
    ${max ? `max="${escapeHtml(max)}"` : ''}
    step="0.01"
  />
</div>`;
}

/**
 * Renders a Checkbox component
 */
function renderCheckbox(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const value = data[component.uuid] || false;
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
}

/**
 * Renders a Select component
 */
function renderSelect(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const value = data[component.uuid] || '';
  const optionsStr = component.attributes.options || '';
  const options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt);

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <select class="xtform-select" data-uuid="${escapeHtml(component.uuid)}">
    <option value="">-- Select --</option>
    ${options.map(opt => `<option value="${escapeHtml(opt)}" ${value === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('\n    ')}
  </select>
</div>`;
}

/**
 * Renders a RadioGroup component
 */
function renderRadioGroup(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const description = component.attributes.description || '';
  const value = data[component.uuid] || '';
  const optionsStr = component.attributes.options || '';
  const options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt);

  return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  ${description ? `<div class="xtform-description">${escapeHtml(description)}</div>` : ''}
  <div class="xtform-radio-group">
    ${options.map(opt => `
    <label class="xtform-radio-label">
      <input
        type="radio"
        class="xtform-radio"
        name="${escapeHtml(component.uuid)}"
        data-uuid="${escapeHtml(component.uuid)}"
        value="${escapeHtml(opt)}"
        ${value === opt ? 'checked' : ''}
      />
      ${escapeHtml(opt)}
    </label>`).join('\n    ')}
  </div>
</div>`;
}

/**
 * Renders a Table component (basic read-only for Phase 1)
 */
function renderTable(component: ComponentTag, data: Record<string, any>): string {
  const label = component.label || component.attributes.label || '';
  const tableData = data[component.uuid] || [];
  const columns = component.children || [];

  if (!Array.isArray(tableData)) {
    return `<div class="xtform-table" data-uuid="${escapeHtml(component.uuid)}">
      <p class="xtform-error">Table data must be an array</p>
    </div>`;
  }

  return `<div class="xtform-table" data-uuid="${escapeHtml(component.uuid)}">
  ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
  <div class="xtform-table-note">Full table editing will be available in Phase 2</div>
  <table class="xtform-table-grid">
    <thead>
      <tr>
        ${columns.map(col => `<th>${escapeHtml(col.label || col.attributes.label || col.uuid)}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableData.map((row: any) => `
      <tr data-row-uuid="${escapeHtml(row.uuid || '')}">
        ${columns.map(col => {
          const cellValue = row.data ? row.data[col.uuid] : '';
          return `<td>${escapeHtml(String(cellValue || ''))}</td>`;
        }).join('')}
      </tr>`).join('')}
    </tbody>
  </table>
</div>`;
}

/**
 * Escapes HTML to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => map[char]);
}
