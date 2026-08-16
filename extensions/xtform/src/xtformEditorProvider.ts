import * as vscode from 'vscode';
import { parseXtformDocument, updateYamlData } from './parsers/yamlParser';
import { XtformParseError } from './parsers/xtformDocument';
import { getNonce } from './util/uuid';
import { Disposable } from './util/dispose';

/**
 * Custom editor provider for .xtform files
 */
export class XtformEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'xtform.editor';

  constructor(
    private readonly extensionUri: vscode.Uri
  ) { }

  /**
   * Called when a custom editor is opened
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Configure webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'media')
      ]
    };

    // Set initial HTML
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Create editor instance
    const editor = new XtformEditor(document, webviewPanel);

    // Dispose when panel closes
    webviewPanel.onDidDispose(() => editor.dispose());
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
  <title>XTForm Editor</title>
</head>
<body>
  <div id="root"></div>
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
  private isEditingFromWebview = false;
  private pendingEdit: Promise<void> | undefined;

  constructor(
    private readonly document: vscode.TextDocument,
    private readonly panel: vscode.WebviewPanel
  ) {
    super();

    // Listen for messages from webview
    this._disposables.push(
      this.panel.webview.onDidReceiveMessage(message => this.onMessage(message))
    );

    // Listen for document changes
    this._disposables.push(
      vscode.workspace.onDidChangeTextDocument(e => {
        if (e.document.uri.toString() === this.document.uri.toString()) {
          this.onDocumentChange();
        }
      })
    );

    // Listen for view state changes (when user switches to/from this editor)
    this._disposables.push(
      this.panel.onDidChangeViewState(() => {
        console.log('[XTForm] View state changed, visible:', this.panel.visible);
        if (this.panel.visible) {
          // Refresh webview when it becomes visible
          console.log('[XTForm] Panel became visible, refreshing webview');
          this.updateWebview();
        }
      })
    );

    // Send initial content
    this.updateWebview();
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

      case 'edit':
        // Queue the edit to prevent race conditions
        this.editQueue = this.editQueue.then(async () => {
          await this.applyEdit(message.uuid, message.value);
        });
        await this.editQueue;
        break;

      case 'error':
        // Show error from webview
        vscode.window.showErrorMessage(`XTForm Error: ${message.message}`);
        break;
    }
  }

  /**
   * Applies an edit from the webview to the document
   */
  private async applyEdit(uuid: string, value: any): Promise<void> {
    try {
      // Mark that we're editing from webview
      this.isEditingFromWebview = true;

      // Parse current document
      const doc = parseXtformDocument(this.document.getText());

      // Update the data field
      const newContent = updateYamlData(doc, uuid, value);

      // Create workspace edit
      const edit = new vscode.WorkspaceEdit();
      edit.replace(
        this.document.uri,
        new vscode.Range(0, 0, this.document.lineCount, 0),
        newContent
      );

      // Apply edit to document
      this.pendingEdit = vscode.workspace.applyEdit(edit).then(() => {
        // Wait a bit for the document change event to fire and complete
        return new Promise<void>(resolve => {
          setTimeout(() => {
            this.isEditingFromWebview = false;
            this.pendingEdit = undefined;
            resolve();
          }, 50);
        });
      });

      await this.pendingEdit;
    } catch (error) {
      this.isEditingFromWebview = false;
      this.pendingEdit = undefined;

      if (error instanceof XtformParseError) {
        vscode.window.showErrorMessage(`Failed to update: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Unexpected error: ${String(error)}`);
      }
    }
  }

  /**
   * Handles document changes
   */
  private onDocumentChange(): void {
    // Skip update if we're currently editing from webview
    // This prevents feedback loops while user is typing
    if (this.isEditingFromWebview || this.pendingEdit) {
      return;
    }

    // Update webview for external changes (manual edits, undo/redo, etc.)
    this.updateWebview();
  }

  /**
   * Sends updated content to webview
   */
  private updateWebview(): void {
    const content = this.document.getText();
    console.log('[XTForm] Sending update to webview, content length:', content.length);
    console.log('[XTForm] Content preview:', content.substring(0, 100));
    this.panel.webview.postMessage({
      type: 'update',
      content: content
    });
  }
}
