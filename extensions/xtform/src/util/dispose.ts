import * as vscode from 'vscode';

/**
 * Disposes all disposables in an array
 */
export function disposeAll(disposables: vscode.Disposable[]): void {
  while (disposables.length) {
    const item = disposables.pop();
    item?.dispose();
  }
}

/**
 * Helper class for managing disposables
 */
export abstract class Disposable {
  private _disposed = false;
  protected _disposables: vscode.Disposable[] = [];

  public dispose(): void {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    disposeAll(this._disposables);
  }
}
