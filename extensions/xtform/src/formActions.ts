/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * A button/menu entry declared by another extension's manifest: the
 * Viewer renders `title` and runs `command` when it is clicked.
 */
export interface FormAction {
  command: string;
  title: string;
}

/**
 * Button sets for interaction forms, keyed by the form's root `form_kind`
 * (e.g. `clarify` → Apply/Cancel).
 */
export type InteractionFormActions = Record<string, FormAction[]>;

function isFormAction(value: unknown): value is FormAction {
  return typeof value === 'object' && value !== null
    && typeof (value as FormAction).command === 'string'
    && typeof (value as FormAction).title === 'string';
}

/**
 * Validates a declarative action list (`xtaurida.formQuickActions`, or one
 * entry of `xtaurida.interactionFormActions`), dropping malformed entries.
 */
export function parseFormActionList(value: unknown): FormAction[] {
  return Array.isArray(value) ? value.filter(isFormAction) : [];
}

/**
 * Validates `xtaurida.interactionFormActions` — a map from `form_kind` to
 * its action list. Kinds whose list ends up empty are dropped, so the
 * Viewer falls back to the generic header for them.
 */
export function parseInteractionFormActions(value: unknown): InteractionFormActions {
  const result: InteractionFormActions = {};
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return result;
  }
  for (const [formKind, list] of Object.entries(value)) {
    const actions = parseFormActionList(list);
    if (actions.length > 0) {
      result[formKind] = actions;
    }
  }
  return result;
}

/**
 * Returns the interaction buttons a form with the given `form_kind` should
 * show, or an empty list when it has no kind or no declared button set.
 */
export function getInteractionActionsForForm(actions: InteractionFormActions, formKind: string | undefined): FormAction[] {
  if (!formKind || !Object.prototype.hasOwnProperty.call(actions, formKind)) {
    return [];
  }
  return actions[formKind];
}
