import * as vscode from 'vscode';
import { XtformEditorProvider } from './xtformEditorProvider';

/**
 * Extension activation point
 */
export function activate(context: vscode.ExtensionContext) {
  console.log('XTForm extension is now active');

  // Register custom editor provider
  const provider = new XtformEditorProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      XtformEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );
}

/**
 * Extension deactivation point
 */
export function deactivate() {
  console.log('XTForm extension is now deactivated');
}
