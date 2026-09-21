/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import {
  parseXtformDocument,
  serializeXtformDocument,
  updateNodeValue,
  deleteNode,
  addNode
} from '../parsers/yamlParser';
import { XtformDocument } from '../parsers/xtformDocument';

suite('changes field (spec/xtdraft-format.md)', () => {
  function makeDocWithChanges(): XtformDocument {
    return parseXtformDocument(`
type: Form
uuid: "form-001"
title: "Test Form"
changes:
  kind: proposal
items:
  - type: TextInput
    uuid: "f-001"
    label: "Concurrent Users"
    value: "50"
    changes:
      status: added
  - type: TextInput
    uuid: "f-002"
    label: "Old Description"
    value: "..."
    changes:
      status: removed
  - type: TextInput
    uuid: "f-003"
    label: "Untouched"
    value: "same"
`);
  }

  suite('parseXtformDocument / serializeXtformDocument', () => {
    test('round-trips the root changes.kind field', () => {
      const doc = makeDocWithChanges();

      assert.deepStrictEqual(doc.changes, { kind: 'proposal' });

      const reparsed = parseXtformDocument(serializeXtformDocument(doc));
      assert.deepStrictEqual(reparsed.changes, { kind: 'proposal' });
    });

    test('round-trips per-item changes.status fields', () => {
      const doc = makeDocWithChanges();

      const added = doc.items!.find(i => i.uuid === 'f-001')!;
      const removed = doc.items!.find(i => i.uuid === 'f-002')!;
      const untouched = doc.items!.find(i => i.uuid === 'f-003')!;

      assert.deepStrictEqual(added.changes, { status: 'added' });
      assert.deepStrictEqual(removed.changes, { status: 'removed' });
      assert.strictEqual(untouched.changes, undefined);

      const reparsed = parseXtformDocument(serializeXtformDocument(doc));
      assert.deepStrictEqual(reparsed.items!.find(i => i.uuid === 'f-001')!.changes, { status: 'added' });
      assert.deepStrictEqual(reparsed.items!.find(i => i.uuid === 'f-002')!.changes, { status: 'removed' });
    });

    test('leaves changes absent entirely on a document without pending changes', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: TextInput
    uuid: "f-001"
    label: "Plain"
`);

      assert.strictEqual(doc.changes, undefined);
      assert.strictEqual(doc.items![0].changes, undefined);
    });
  });

  suite('generic mutators preserve unrelated changes fields', () => {
    test('updateNodeValue leaves other items\' changes untouched', () => {
      const doc = makeDocWithChanges();

      const updated = updateNodeValue(doc, 'f-003', 'edited');

      const added = updated.items!.find(i => i.uuid === 'f-001')!;
      const removed = updated.items!.find(i => i.uuid === 'f-002')!;
      assert.deepStrictEqual(added.changes, { status: 'added' });
      assert.deepStrictEqual(removed.changes, { status: 'removed' });
      assert.strictEqual(updated.changes?.kind, 'proposal');
    });

    test('deleteNode leaves sibling changes fields untouched', () => {
      const doc = makeDocWithChanges();

      const updated = deleteNode(doc, 'f-003');

      const added = updated.items!.find(i => i.uuid === 'f-001')!;
      const removed = updated.items!.find(i => i.uuid === 'f-002')!;
      assert.deepStrictEqual(added.changes, { status: 'added' });
      assert.deepStrictEqual(removed.changes, { status: 'removed' });
    });

    test('addNode does not affect the root changes field', () => {
      const doc = makeDocWithChanges();

      const updated = addNode(doc, null, { type: 'TextInput', uuid: 'f-004', label: 'New' });

      assert.deepStrictEqual(updated.changes, { kind: 'proposal' });
    });
  });
});
