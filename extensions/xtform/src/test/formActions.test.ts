/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { getInteractionActionsForForm, parseFormActionList, parseInteractionFormActions } from '../formActions';

suite('Form Actions', () => {
  const clarifyActions = [
    { command: 'xtaurida.clarifyApply', title: 'Apply' },
    { command: 'xtaurida.clarifyCancel', title: 'Cancel' }
  ];

  suite('parseFormActionList', () => {
    test('keeps well-formed entries and drops malformed ones', () => {
      assert.deepStrictEqual(
        parseFormActionList([clarifyActions[0], { command: 'x' }, null, 'y', { command: 1, title: 'z' }, clarifyActions[1]]),
        clarifyActions
      );
    });

    test('returns an empty list for non-array input', () => {
      assert.deepStrictEqual([undefined, null, {}, 'x'].map(parseFormActionList), [[], [], [], []]);
    });
  });

  suite('parseInteractionFormActions', () => {
    test('maps form_kind to its validated action list, dropping empty kinds', () => {
      assert.deepStrictEqual(
        parseInteractionFormActions({ clarify: clarifyActions, empty: [], broken: [{ title: 'No command' }], notList: 'x' }),
        { clarify: clarifyActions }
      );
    });

    test('returns an empty map for non-object input', () => {
      assert.deepStrictEqual([undefined, null, [], 'x'].map(parseInteractionFormActions), [{}, {}, {}, {}]);
    });
  });

  suite('getInteractionActionsForForm', () => {
    test('resolves the button set by form_kind', () => {
      const actions = parseInteractionFormActions({ clarify: clarifyActions });
      assert.deepStrictEqual(
        [
          getInteractionActionsForForm(actions, 'clarify'),
          getInteractionActionsForForm(actions, undefined),
          getInteractionActionsForForm(actions, 'summarize'),
          getInteractionActionsForForm(actions, 'toString')
        ],
        [clarifyActions, [], [], []]
      );
    });
  });
});
