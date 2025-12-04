/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Anastasiia Tavridovich. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Disposable store that tracks and disposes resources
 */
export class DisposableStore {
	private readonly _disposables: vscode.Disposable[] = [];

	public add<T extends vscode.Disposable>(disposable: T): T {
		this._disposables.push(disposable);
		return disposable;
	}

	public dispose(): void {
		while (this._disposables.length) {
			const disposable = this._disposables.pop();
			disposable?.dispose();
		}
	}
}

/**
 * Base class for disposable objects
 */
export abstract class Disposable {
	private readonly _disposables = new DisposableStore();

	protected _register<T extends vscode.Disposable>(disposable: T): T {
		return this._disposables.add(disposable);
	}

	public dispose(): void {
		this._disposables.dispose();
	}
}
