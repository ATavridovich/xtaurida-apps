/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extname } from '../../../../base/common/resources.js';
import { localize } from '../../../../nls.js';
import { IEditorResolverService, RegisteredEditorPriority } from '../../../services/editor/common/editorResolverService.js';
import { IWorkbenchContribution, WorkbenchPhase, registerWorkbenchContribution2 } from '../../../common/contributions.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { FileEditorInput } from '../../files/browser/editors/fileEditorInput.js';
import { DEFAULT_EDITOR_ASSOCIATION } from '../../../common/editor.js';

/**
 * Unique editor ID for .xtform files
 * Using a namespace prefix to avoid conflicts with upstream
 */
export const XTFORM_EDITOR_ID = 'xtform.editor';

class XtformEditorContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.xtformEditor';

	constructor(
		@IEditorResolverService editorResolverService: IEditorResolverService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		// Register the .xtform editor with priority 'default' to allow user overrides
		editorResolverService.registerEditor(
			'**/*.xtform',
			{
				id: XTFORM_EDITOR_ID,
				label: localize('xtformEditor.displayName', 'XForm Editor'),
				detail: DEFAULT_EDITOR_ASSOCIATION.providerDisplayName,
				priority: RegisteredEditorPriority.default,
			},
			{
				singlePerResource: true,
				canSupportResource: resource => extname(resource) === '.xtform'
			},
			{
				createEditorInput: ({ resource }, group) => {
					return {
						editor: instantiationService.createInstance(FileEditorInput, resource, undefined, undefined, undefined, undefined, undefined, undefined),
						options: {}
					};
				}
			}
		);
	}
}

registerWorkbenchContribution2(XtformEditorContribution.ID, XtformEditorContribution, WorkbenchPhase.BlockStartup);

