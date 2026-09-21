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

  suite('dotted key notation (spec/xtform-format.md "Instructions")', () => {
    function makeDocWithDottedChanges(): XtformDocument {
      return parseXtformDocument(`
type: Form
uuid: "form-001"
title: "Test Form"
changes.kind: refine
changes.generated_at: "2026-09-21T16:44:07.976Z"
changes.summary:
  added: 1
  modified: 0
  removed: 0
items:
  - type: TextInput
    uuid: "f-001"
    label: "Concurrent Users"
    value: "50"
    changes.status: added
  - type: TextInput
    uuid: "f-002"
    label: "Old Description"
    value: "..."
    changes.status: removed
  - type: TextInput
    uuid: "f-003"
    label: "Untouched"
    value: "same"
    instructions.on_change: "Update downstream config"
`);
    }

    test('unflattens root changes.* keys into a nested changes object', () => {
      const doc = makeDocWithDottedChanges();

      assert.strictEqual(doc.changes?.kind, 'refine');
      assert.strictEqual(doc.changes?.generated_at, '2026-09-21T16:44:07.976Z');
      assert.deepStrictEqual(doc.changes?.summary, { added: 1, modified: 0, removed: 0 });
    });

    test('unflattens per-item changes.status into a nested changes object', () => {
      const doc = makeDocWithDottedChanges();

      const added = doc.items!.find(i => i.uuid === 'f-001')!;
      const removed = doc.items!.find(i => i.uuid === 'f-002')!;
      const untouched = doc.items!.find(i => i.uuid === 'f-003')!;

      assert.deepStrictEqual(added.changes, { status: 'added' });
      assert.deepStrictEqual(removed.changes, { status: 'removed' });
      assert.strictEqual(untouched.changes, undefined);
    });

    test('unflattens instructions.* alongside changes.* on the same item', () => {
      const doc = makeDocWithDottedChanges();

      const untouched = doc.items!.find(i => i.uuid === 'f-003')!;
      assert.deepStrictEqual(untouched.instructions, { on_change: 'Update downstream config' });
    });

    test('round-trips dotted input back to a re-parseable document', () => {
      const doc = makeDocWithDottedChanges();
      const reparsed = parseXtformDocument(serializeXtformDocument(doc));

      assert.deepStrictEqual(reparsed.changes, doc.changes);
      assert.deepStrictEqual(
        reparsed.items!.find(i => i.uuid === 'f-001')!.changes,
        { status: 'added' }
      );
    });

    test('serializes nested changes/instructions back to flat dotted keys', () => {
      const doc = makeDocWithDottedChanges();
      const yaml = serializeXtformDocument(doc);

      assert.ok(yaml.includes('changes.kind'));
      assert.ok(yaml.includes('changes.status'));
      assert.ok(yaml.includes('instructions.on_change'));
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
