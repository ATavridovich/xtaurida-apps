// Webview script for XTForm editor
// This script runs in the webview context and communicates with the extension

// Inline minimal YAML parser (for webview bundle)
const parseYAML = (content: string): any => {
  const parts = content.split(/^---\s*$/m);
  if (parts.length < 3) {
    throw new Error('Invalid .xtform format');
  }

  const yamlStr = parts[1].trim();
  const template = parts.slice(2).join('---').trim();

  // Basic YAML parsing - extract uuid and data
  const lines = yamlStr.split('\n');
  let uuid = '';
  const data: Record<string, any> = {};
  let inData = false;
  let currentKey = '';

  for (const line of lines) {
    if (line.match(/^uuid:\s*(.+)$/)) {
      uuid = RegExp.$1.trim();
    } else if (line.match(/^data:\s*$/)) {
      inData = true;
    } else if (inData && line.match(/^\s{2}([a-zA-Z0-9-]+):\s*(.+)$/)) {
      currentKey = RegExp.$1;
      const value = RegExp.$2.trim();
      // Remove quotes if present
      data[currentKey] = value.replace(/^["']|["']$/g, '');
    }
  }

  return { uuid, data, template };
};

// Parse component tags from template
const parseComponentTags = (template: string): any[] => {
  const components: any[] = [];
  const tagPattern = /\[%\s*(\/?)(\w+)(.*?)\s*(\/)?\s*%\]/gs;

  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(template)) !== null) {
    const [, closingSlash, componentType, attributesStr, selfClosingSlash] = match;

    if (!closingSlash && selfClosingSlash) {
      // Self-closing tag
      const attributes = parseAttributes(attributesStr.trim());
      components.push({
        type: componentType,
        uuid: attributes.uuid || '',
        label: attributes.label,
        attributes,
        selfClosing: true
      });
    }
  }

  return components;
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
  const html = components.map(c => renderComponent(c, data)).join('\n');
  return `<div class="xtform-root">\n${html}\n</div>`;
};

// Render single component
const renderComponent = (component: any, data: Record<string, any>): string => {
  const value = data[component.uuid] || '';
  const label = component.label || component.attributes.label || '';

  switch (component.type) {
    case 'TextInput':
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
        <input
          type="text"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
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
      </div>`;

    case 'Select':
      const optionsStr = component.attributes.options || '';
      const options = optionsStr.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt);
      return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ''}
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
  console.log('[XTForm Webview] updateForm called, content:', content?.substring(0, 100));

  try {
    const doc = parseYAML(content);
    console.log('[XTForm Webview] Parsed doc:', { uuid: doc.uuid, dataKeys: Object.keys(doc.data), templateLength: doc.template?.length });
    const components = parseComponentTags(doc.template);
    console.log('[XTForm Webview] Found components:', components.length, components);
    const formHtml = renderForm(components, doc.data);
    console.log('[XTForm Webview] Generated HTML length:', formHtml.length);

    const root = document.getElementById('root');
    if (root) {
      console.log('[XTForm Webview] Setting innerHTML to root');
      root.innerHTML = formHtml;
      attachEventListeners();
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
  // Text inputs
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
};

// Send ready message when webview loads
console.log('[XTForm Webview] Sending ready message');
vscode.postMessage({ type: 'ready' });
