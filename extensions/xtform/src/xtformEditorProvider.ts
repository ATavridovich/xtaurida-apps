import * as vscode from 'vscode';
import {
  parseXtformDocument,
  serializeXtformDocument,
  updateNodeValue,
  updateNodeProperty,
  addNode,
  deleteNode,
  findNode
} from './parsers/yamlParser';
import { XtformDocument as XtformDocumentType, XtformNode, XtformParseError } from './parsers/xtformDocument';
import { getNonce } from './util/uuid';
import { Disposable } from './util/dispose';

interface FormQuickAction {
  command: string;
  title: string;
}

/**
 * Reads the form quick-menu actions declared by the xTaurida Agent
 * extension's own manifest (`xtaurida.formQuickActions` in its
 * package.json). This works even if that extension hasn't been activated
 * yet, and returns an empty list if it isn't installed — the caller is
 * expected to hide the quick-menu entirely in that case, rather than
 * hardcode a guessed command list here.
 */
function getFormQuickActions(): FormQuickAction[] {
  const agentExt = vscode.extensions.getExtension('xtaurida.xtaurida-agent');
  const actions = agentExt?.packageJSON?.xtaurida?.formQuickActions;
  return Array.isArray(actions) ? actions : [];
}

/**
 * Custom document for .xtform files with dirty state tracking
 */
class XtformDocument implements vscode.CustomDocument {
  private _content: string;
  private _dirty: boolean = false;
  private readonly _onDidChange = new vscode.EventEmitter<void>();
  public readonly onDidChange = this._onDidChange.event;

  constructor(
    public readonly uri: vscode.Uri,
    initialContent: string
  ) {
    this._content = initialContent;
  }

  get content(): string {
    return this._content;
  }

  setContent(content: string): void {
    if (this._content !== content) {
      this._content = content;
      this._dirty = true;
      this._onDidChange.fire();
    }
  }

  async save(): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(this._content);
    await vscode.workspace.fs.writeFile(this.uri, data);
    this._dirty = false;
  }

  async saveAs(destination: vscode.Uri): Promise<void> {
    const encoder = new TextEncoder();
    const data = encoder.encode(this._content);
    await vscode.workspace.fs.writeFile(destination, data);
    this._dirty = false;
  }

  async revert(): Promise<void> {
    const content = await vscode.workspace.fs.readFile(this.uri);
    this._content = new TextDecoder().decode(content);
    this._dirty = false;
    this._onDidChange.fire();
  }

  async backup(destination: vscode.Uri): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination);
    return {
      id: destination.toString(),
      delete: async () => {
        await vscode.workspace.fs.delete(destination);
      }
    };
  }

  dispose(): void {
    this._onDidChange.dispose();
  }
}

/**
 * Custom editor provider for .xtform files with manual save
 */
export class XtformEditorProvider implements vscode.CustomEditorProvider<XtformDocument> {
  public static readonly viewType = 'xtform.editor';

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<XtformDocument>>();
  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  constructor(
    private readonly extensionUri: vscode.Uri
  ) { }

  /**
   * Opens a custom document
   */
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): Promise<XtformDocument> {
    const content = await vscode.workspace.fs.readFile(uri);
    const textContent = new TextDecoder().decode(content);
    return new XtformDocument(uri, textContent);
  }

  /**
   * Resolves a custom editor
   */
  async resolveCustomEditor(
    document: XtformDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };

    // Set initial HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Listen to document changes and notify VS Code for dirty state tracking
    const changeSubscription = document.onDidChange(() => {
      this._onDidChangeCustomDocument.fire({
        document,
        undo: async () => {},
        redo: async () => {}
      });
    });

    // Create editor instance
    const editor = new XtformEditor(document, webviewPanel);

    // Dispose when panel closes
    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      editor.dispose();
    });
  }

  /**
   * Saves a custom document
   */
  async saveCustomDocument(
    document: XtformDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.save();
  }

  /**
   * Saves a custom document to a new location
   */
  async saveCustomDocumentAs(
    document: XtformDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.saveAs(destination);
  }

  /**
   * Reverts a custom document to its saved state
   */
  async revertCustomDocument(
    document: XtformDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    await document.revert();
  }

  /**
   * Backs up a custom document
   */
  async backupCustomDocument(
    document: XtformDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    return document.backup(context.destination);
  }

  /**
   * Generates HTML for webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Use a nonce to whitelist scripts for CSP
    const nonce = getNonce();

    // Cache-busting version
    const version = Date.now();

    // Script and style URIs
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css')
    );

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <link rel="stylesheet" href="${styleUri}?v=${version}" />
  <title>XTForm Viewer</title>
</head>
<body>
  <div class="xtform-app">
    <div class="component-palette">
      <div class="palette-tabs">
        <button class="palette-tab active" data-category="inputs">Inputs</button>
        <button class="palette-tab" data-category="layout">Layout</button>
        <button class="palette-tab" data-category="advanced">Advanced</button>
      </div>
      <div class="palette-components" id="palette-components">
        <!-- Populated dynamically by webview script -->
      </div>
    </div>

    <div class="editor-container">
      <!-- Floating toggle button for when property editor is collapsed -->
      <button class="property-toggle-float" id="property-toggle-float" style="display: none;">▶</button>

      <div class="property-editor" id="property-editor">
        <div class="property-header">
          <h3>Properties</h3>
          <button class="collapse-btn" id="collapse-properties">◀</button>
        </div>
        <div class="property-content" id="property-content">
          <p class="no-selection">No component selected</p>
        </div>
      </div>

      <div class="form-preview" id="form-preview">
        <!-- Form components rendered here -->
      </div>
    </div>
  </div>
  <script nonce="${nonce}" src="${scriptUri}?v=${version}"></script>
</body>
</html>`;
  }
}

/**
 * Manages a single xtform editor instance
 */
class XtformEditor extends Disposable {
  private editQueue = Promise.resolve();

  constructor(
    private readonly document: XtformDocument,
    private readonly panel: vscode.WebviewPanel
  ) {
    super();

    // Listen for messages from webview
    this._disposables.push(
      this.panel.webview.onDidReceiveMessage(message => this.onMessage(message))
    );

    // Listen for document changes
    this._disposables.push(
      this.document.onDidChange(() => {
        this.updateWebview();
      })
    );

    // Listen for view state changes (when user switches to/from this editor)
    this._disposables.push(
      this.panel.onDidChangeViewState(() => {
        if (this.panel.visible) {
          // Refresh webview when it becomes visible
          this.updateWebview();
        }
      })
    );

    // Watch for external file changes using a glob pattern
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
    if (workspaceFolder) {
      const relativePath = vscode.workspace.asRelativePath(document.uri, false);
      const fileWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(workspaceFolder, relativePath)
      );

      this._disposables.push(
        fileWatcher.onDidChange(async () => {
          // File changed externally - reload it
          await this.reloadFromDisk();
        })
      );

      this._disposables.push(fileWatcher);
    }

    // Send initial content
    this.updateWebview();
  }

  /**
   * Reloads document content from disk
   */
  private async reloadFromDisk(): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(this.document.uri);
      const textContent = new TextDecoder().decode(content);
      this.document.setContent(textContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to reload file: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles messages from webview
   */
  private async onMessage(message: any): Promise<void> {
    switch (message.type) {
      case 'ready':
        // Webview is ready, send initial content
        this.updateWebview();
        break;

      case 'updateValue':
        // Update a node's value
        this.editQueue = this.editQueue.then(async () => {
          await this.handleUpdateValue(message.uuid, message.value);
        });
        await this.editQueue;
        break;

      case 'updateProperty':
        // Update any node property
        this.editQueue = this.editQueue.then(async () => {
          await this.handleUpdateProperty(message.uuid, message.property, message.value);
        });
        await this.editQueue;
        break;

      case 'addComponent':
        // Add new component from palette
        this.editQueue = this.editQueue.then(async () => {
          await this.handleAddComponent(message.parentUuid, message.node);
        });
        await this.editQueue;
        break;

      case 'deleteComponent':
        // Delete component
        this.editQueue = this.editQueue.then(async () => {
          await this.handleDeleteComponent(message.uuid);
        });
        await this.editQueue;
        break;

      case 'duplicateComponent':
        // Duplicate component
        this.editQueue = this.editQueue.then(async () => {
          await this.handleDuplicateComponent(message.uuid);
        });
        await this.editQueue;
        break;

      case 'runCommand':
        // Quick action from the form header menu (Clarify | Elaborate | Summarize)
        await this.handleRunCommand(message.command);
        break;

      case 'error':
        // Show error from webview
        vscode.window.showErrorMessage(`XTForm Error: ${message.message}`);
        break;
    }
  }

  /**
   * Runs an SDD command (from the form header quick-menu) against this
   * document. `command` is the full command id as declared by whichever
   * extension contributed it (see `getFormQuickActions`) — resolves the
   * target file from the active editor tab, which is this custom editor's
   * panel.
   */
  private async handleRunCommand(command: string): Promise<void> {
    try {
      await vscode.commands.executeCommand(command);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to run "${command}": ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles updating a node's value
   */
  private async handleUpdateValue(uuid: string, value: any): Promise<void> {
    try {
      const doc = parseXtformDocument(this.document.content);
      const newDoc = updateNodeValue(doc, uuid, value);
      const newContent = serializeXtformDocument(newDoc);
      this.document.setContent(newContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update value: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles updating any node property
   */
  private async handleUpdateProperty(uuid: string, property: string, value: any): Promise<void> {
    try {
      const doc = parseXtformDocument(this.document.content);
      const newDoc = updateNodeProperty(doc, uuid, property, value);
      const newContent = serializeXtformDocument(newDoc);
      this.document.setContent(newContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update property: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles adding a new component
   */
  private async handleAddComponent(parentUuid: string | null, node: XtformNode): Promise<void> {
    try {
      const doc = parseXtformDocument(this.document.content);
      const newDoc = addNode(doc, parentUuid, node);
      const newContent = serializeXtformDocument(newDoc);
      this.document.setContent(newContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to add component: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles deleting a component
   */
  private async handleDeleteComponent(uuid: string): Promise<void> {
    try {
      const doc = parseXtformDocument(this.document.content);
      const newDoc = deleteNode(doc, uuid);
      const newContent = serializeXtformDocument(newDoc);
      this.document.setContent(newContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete component: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Handles duplicating a component
   */
  private async handleDuplicateComponent(uuid: string): Promise<void> {
    try {
      const doc = parseXtformDocument(this.document.content);

      // Find the node to duplicate
      const nodeToDuplicate = findNode(doc, uuid);
      if (!nodeToDuplicate || !('type' in nodeToDuplicate) || nodeToDuplicate.type === 'Form') {
        throw new Error('Cannot duplicate root form or node not found');
      }

      // Deep clone the node
      const clonedNode: XtformNode = JSON.parse(JSON.stringify(nodeToDuplicate));

      // Generate new UUID for cloned node and all descendants
      function regenerateUuids(node: XtformNode): void {
        node.uuid = 'f-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        if (node.items && Array.isArray(node.items)) {
          for (const child of node.items) {
            regenerateUuids(child);
          }
        }
      }
      regenerateUuids(clonedNode);

      // Find parent of original node to add cloned node as sibling
      function findParentUuid(doc: XtformDocumentType, targetUuid: string): string | null {
        function search(node: XtformNode | XtformDocumentType, parentUuid: string | null): string | null {
          if (node.items && Array.isArray(node.items)) {
            for (const child of node.items) {
              if (child.uuid === targetUuid) {
                return parentUuid;
              }
              const result = search(child, node.uuid);
              if (result !== null) {
                return result;
              }
            }
          }
          return null;
        }
        return search(doc, null);
      }

      const parentUuid = findParentUuid(doc, uuid);
      const newDoc = addNode(doc, parentUuid, clonedNode);
      const newContent = serializeXtformDocument(newDoc);
      this.document.setContent(newContent);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to duplicate component: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Sends updated content to webview
   */
  private updateWebview(): void {
    this.panel.webview.postMessage({
      type: 'update',
      content: this.document.content,
      quickActions: getFormQuickActions()
    });
  }
}
