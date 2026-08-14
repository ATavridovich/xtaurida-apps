"use strict";
(() => {
  // webview-src/index.ts
  var parseYAML = (content) => {
    const parts = content.split(/^---\s*$/m);
    if (parts.length < 3) {
      throw new Error("Invalid .xtform format");
    }
    const yamlStr = parts[1].trim();
    const template = parts.slice(2).join("---").trim();
    const lines = yamlStr.split("\n");
    let uuid = "";
    const data = {};
    let inData = false;
    let currentKey = "";
    for (const line of lines) {
      if (line.match(/^uuid:\s*(.+)$/)) {
        uuid = RegExp.$1.trim();
      } else if (line.match(/^data:\s*$/)) {
        inData = true;
      } else if (inData && line.match(/^\s{2}([a-zA-Z0-9-]+):\s*(.+)$/)) {
        currentKey = RegExp.$1;
        const value = RegExp.$2.trim();
        data[currentKey] = value.replace(/^["']|["']$/g, "");
      }
    }
    return { uuid, data, template };
  };
  var parseComponentTags = (template) => {
    const components = [];
    const tagPattern = /\[%\s*(\/?)(\w+)(.*?)\s*(\/)?\s*%\]/gs;
    let match;
    while ((match = tagPattern.exec(template)) !== null) {
      const [, closingSlash, componentType, attributesStr, selfClosingSlash] = match;
      if (!closingSlash && selfClosingSlash) {
        const attributes = parseAttributes(attributesStr.trim());
        components.push({
          type: componentType,
          uuid: attributes.uuid || "",
          label: attributes.label,
          attributes,
          selfClosing: true
        });
      }
    }
    return components;
  };
  var parseAttributes = (attributeStr) => {
    const attributes = {};
    const attrPattern = /(\w+(?:\.\w+)*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;
    let match;
    while ((match = attrPattern.exec(attributeStr)) !== null) {
      const [, key, doubleQuoted, singleQuoted, braced] = match;
      const value = doubleQuoted ?? singleQuoted ?? braced ?? "";
      attributes[key] = value;
    }
    return attributes;
  };
  var renderForm = (components, data) => {
    const html = components.map((c) => renderComponent(c, data)).join("\n");
    return `<div class="xtform-root">
${html}
</div>`;
  };
  var renderComponent = (component, data) => {
    const value = data[component.uuid] || "";
    const label = component.label || component.attributes.label || "";
    switch (component.type) {
      case "TextInput":
        return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ""}
        <input
          type="text"
          class="xtform-input"
          data-uuid="${escapeHtml(component.uuid)}"
          value="${escapeHtml(String(value))}"
        />
      </div>`;
      case "Checkbox":
        const checked = value === true || value === "true";
        return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        <label class="xtform-checkbox-label">
          <input
            type="checkbox"
            class="xtform-checkbox"
            data-uuid="${escapeHtml(component.uuid)}"
            ${checked ? "checked" : ""}
          />
          ${escapeHtml(label)}
        </label>
      </div>`;
      case "Select":
        const optionsStr = component.attributes.options || "";
        const options = optionsStr.split(",").map((opt) => opt.trim()).filter((opt) => opt);
        return `<div class="xtform-field" data-uuid="${escapeHtml(component.uuid)}">
        ${label ? `<label class="xtform-label">${escapeHtml(label)}</label>` : ""}
        <select class="xtform-select" data-uuid="${escapeHtml(component.uuid)}">
          <option value="">-- Select --</option>
          ${options.map(
          (opt) => `<option value="${escapeHtml(opt)}" ${value === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`
        ).join("\n")}
        </select>
      </div>`;
      default:
        return `<div class="xtform-component-unknown">Unknown component: ${escapeHtml(component.type)}</div>`;
    }
  };
  var escapeHtml = (text) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return text.replace(/[&<>"']/g, (char) => map[char]);
  };
  var vscode = acquireVsCodeApi();
  var currentContent = "";
  window.addEventListener("message", (event) => {
    const message = event.data;
    console.log("[XTForm Webview] Received message:", message.type);
    switch (message.type) {
      case "update":
        console.log("[XTForm Webview] Content length:", message.content?.length);
        updateForm(message.content);
        break;
    }
  });
  var updateForm = (content) => {
    currentContent = content;
    console.log("[XTForm Webview] updateForm called, content:", content?.substring(0, 100));
    try {
      const doc = parseYAML(content);
      console.log("[XTForm Webview] Parsed doc:", { uuid: doc.uuid, dataKeys: Object.keys(doc.data), templateLength: doc.template?.length });
      const components = parseComponentTags(doc.template);
      console.log("[XTForm Webview] Found components:", components.length, components);
      const formHtml = renderForm(components, doc.data);
      console.log("[XTForm Webview] Generated HTML length:", formHtml.length);
      const root = document.getElementById("root");
      if (root) {
        console.log("[XTForm Webview] Setting innerHTML to root");
        root.innerHTML = formHtml;
        attachEventListeners();
      } else {
        console.error("[XTForm Webview] Root element not found!");
      }
    } catch (error) {
      console.error("[XTForm Webview] Error in updateForm:", error);
      const root = document.getElementById("root");
      if (root) {
        root.innerHTML = `
        <div class="xtform-error">
          <h3>Error parsing document</h3>
          <p>${escapeHtml(String(error))}</p>
        </div>
      `;
      }
      vscode.postMessage({
        type: "error",
        message: String(error)
      });
    }
  };
  var attachEventListeners = () => {
    document.querySelectorAll(".xtform-input").forEach((input) => {
      const element = input;
      const uuid = element.getAttribute("data-uuid");
      if (uuid) {
        element.addEventListener("input", () => {
          vscode.postMessage({
            type: "edit",
            uuid,
            value: element.value
          });
        });
      }
    });
    document.querySelectorAll(".xtform-checkbox").forEach((checkbox) => {
      const element = checkbox;
      const uuid = element.getAttribute("data-uuid");
      if (uuid) {
        element.addEventListener("change", () => {
          vscode.postMessage({
            type: "edit",
            uuid,
            value: element.checked
          });
        });
      }
    });
    document.querySelectorAll(".xtform-select").forEach((select) => {
      const element = select;
      const uuid = element.getAttribute("data-uuid");
      if (uuid) {
        element.addEventListener("change", () => {
          vscode.postMessage({
            type: "edit",
            uuid,
            value: element.value
          });
        });
      }
    });
  };
  console.log("[XTForm Webview] Sending ready message");
  vscode.postMessage({ type: "ready" });
})();
//# sourceMappingURL=index.js.map
