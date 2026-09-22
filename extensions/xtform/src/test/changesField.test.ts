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
  addNode,
  applyModifiedField,
  cancelModifiedField,
  resolveAddedRemovedItem
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

  suite('modified status and changes.prev (spec/xtdraft-format.md "Modified fields")', () => {
    function makeDocWithModifiedItem(): XtformDocument {
      return parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: TextInput
    uuid: "f-001"
    label: "Model Name"
    description: "Django model class name, PascalCase, singular noun"
    instructions.on_change: "Rename model class in models.py and all related imports"
    value: "BlogPost"
    changes.status: "modified"
    changes.prev:
      label: "Name"
      description: ""
      instructions.on_change: ""
`);
    }

    test('unflattens changes.status: modified and changes.prev, including its own dotted instructions key', () => {
      const doc = makeDocWithModifiedItem();
      const item = doc.items!.find(i => i.uuid === 'f-001')!;

      assert.strictEqual(item.changes?.status, 'modified');
      assert.deepStrictEqual(item.changes?.prev, {
        label: 'Name',
        description: '',
        instructions: { on_change: '' }
      });
    });

    test('leaves value out of changes.prev when unchanged', () => {
      const doc = makeDocWithModifiedItem();
      const item = doc.items!.find(i => i.uuid === 'f-001')!;

      assert.strictEqual(item.value, 'BlogPost');
      assert.strictEqual(item.changes?.prev?.value, undefined);
    });

    test('round-trips modified status and changes.prev, including nested instructions', () => {
      const doc = makeDocWithModifiedItem();
      const reparsed = parseXtformDocument(serializeXtformDocument(doc));
      const item = reparsed.items!.find(i => i.uuid === 'f-001')!;

      assert.deepStrictEqual(item.changes, doc.items!.find(i => i.uuid === 'f-001')!.changes);
    });

    test('serializes changes.prev.instructions back to a flat dotted key', () => {
      const doc = makeDocWithModifiedItem();
      const yaml = serializeXtformDocument(doc);

      assert.ok(yaml.includes('changes.status'));
      assert.ok(yaml.includes('changes.prev'));
      assert.ok(yaml.includes('instructions.on_change'));
    });

    test('applyModifiedField writes the given values and clears changes', () => {
      const doc = makeDocWithModifiedItem();

      const updated = applyModifiedField(doc, 'f-001', {
        label: 'Model Name',
        description: 'Django model class name, PascalCase, singular noun',
        'instructions.on_change': 'Rename model class in models.py and all related imports'
      });
      const item = updated.items!.find(i => i.uuid === 'f-001')!;

      assert.strictEqual(item.label, 'Model Name');
      assert.strictEqual(item.description, 'Django model class name, PascalCase, singular noun');
      assert.deepStrictEqual(item.instructions, {
        on_change: 'Rename model class in models.py and all related imports'
      });
      assert.strictEqual(item.value, 'BlogPost');
      assert.strictEqual(item.changes, undefined);
    });

    test('applyModifiedField can write a mix of prev and current values per field', () => {
      const doc = makeDocWithModifiedItem();

      // Simulates the user toggling only `label` back to its prev value in
      // the metadata popup, leaving description/instructions at current.
      const updated = applyModifiedField(doc, 'f-001', {
        label: 'Name',
        description: 'Django model class name, PascalCase, singular noun',
        'instructions.on_change': 'Rename model class in models.py and all related imports'
      });
      const item = updated.items!.find(i => i.uuid === 'f-001')!;

      assert.strictEqual(item.label, 'Name');
      assert.strictEqual(item.description, 'Django model class name, PascalCase, singular noun');
      assert.strictEqual(item.changes, undefined);
    });

    test('cancelModifiedField reverts every field to changes.prev and clears changes', () => {
      const doc = makeDocWithModifiedItem();

      const updated = cancelModifiedField(doc, 'f-001');
      const item = updated.items!.find(i => i.uuid === 'f-001')!;

      assert.strictEqual(item.label, 'Name');
      assert.strictEqual(item.description, '');
      assert.deepStrictEqual(item.instructions, { on_change: '' });
      assert.strictEqual(item.value, 'BlogPost');
      assert.strictEqual(item.changes, undefined);
    });

    test('cancelModifiedField on an item with no changes.prev only clears changes', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: TextInput
    uuid: "f-005"
    label: "Untouched Label"
    changes.status: "modified"
`);

      const updated = cancelModifiedField(doc, 'f-005');
      const item = updated.items!.find(i => i.uuid === 'f-005')!;

      assert.strictEqual(item.label, 'Untouched Label');
      assert.strictEqual(item.changes, undefined);
    });

    test('applyModifiedField/cancelModifiedField leave sibling items untouched', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: TextInput
    uuid: "f-001"
    label: "Model Name"
    value: "BlogPost"
    changes.status: "modified"
    changes.prev:
      label: "Name"
  - type: TextInput
    uuid: "f-002"
    label: "Untouched"
    changes.status: added
`);

      const updated = applyModifiedField(doc, 'f-001', { label: 'Model Name' });
      const sibling = updated.items!.find(i => i.uuid === 'f-002')!;

      assert.deepStrictEqual(sibling.changes, { status: 'added' });
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

  suite('resolveAddedRemovedItem (spec/xtdraft-format.md "Added / Removed")', () => {
    test('accept on an unpaired added item clears changes and strips :new', () => {
      const doc = makeDocWithChanges();

      const updated = resolveAddedRemovedItem(doc, 'f-001', 'accept');
      const item = updated.items!.find(i => i.label === 'Concurrent Users')!;

      assert.strictEqual(item.uuid, 'f-001');
      assert.strictEqual(item.changes, undefined);
    });

    test('reject on an unpaired added item deletes it', () => {
      const doc = makeDocWithChanges();

      const updated = resolveAddedRemovedItem(doc, 'f-001', 'reject');

      assert.strictEqual(updated.items!.find(i => i.uuid === 'f-001'), undefined);
    });

    test('accept on an unpaired removed item deletes it', () => {
      const doc = makeDocWithChanges();

      const updated = resolveAddedRemovedItem(doc, 'f-002', 'accept');

      assert.strictEqual(updated.items!.find(i => i.uuid === 'f-002'), undefined);
    });

    test('reject on an unpaired removed item clears changes and restores it', () => {
      const doc = makeDocWithChanges();

      const updated = resolveAddedRemovedItem(doc, 'f-002', 'reject');
      const item = updated.items!.find(i => i.uuid === 'f-002')!;

      assert.strictEqual(item.changes, undefined);
    });

    test('is a no-op for an item that is not added/removed', () => {
      const doc = makeDocWithChanges();

      const updated = resolveAddedRemovedItem(doc, 'f-003', 'accept');
      const item = updated.items!.find(i => i.uuid === 'f-003')!;

      assert.strictEqual(item.changes, undefined); // was already untouched
      assert.strictEqual(updated.items!.length, 3);
    });

    function makePairedDoc(): XtformDocument {
      return parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: TextInput
    uuid: "p-001"
    label: "Page Name"
    value: null
    changes.status: removed
  - type: TextInput
    uuid: "p-001:new"
    label: "Page Name"
    value: ""
    changes.status: added
`);
    }

    test('accept on the added half of a pair also deletes the paired removed item', () => {
      const doc = makePairedDoc();

      const updated = resolveAddedRemovedItem(doc, 'p-001:new', 'accept');

      assert.deepStrictEqual(updated.items!.map(i => i.uuid), ['p-001']);
      assert.strictEqual(updated.items![0].changes, undefined);
    });

    test('reject on the added half of a pair also restores the paired removed item', () => {
      const doc = makePairedDoc();

      const updated = resolveAddedRemovedItem(doc, 'p-001:new', 'reject');

      assert.deepStrictEqual(updated.items!.map(i => i.uuid), ['p-001']);
      assert.strictEqual(updated.items![0].changes, undefined);
    });

    test('accept on the removed half of a pair also finalizes the paired added item', () => {
      const doc = makePairedDoc();

      const updated = resolveAddedRemovedItem(doc, 'p-001', 'accept');

      assert.deepStrictEqual(updated.items!.map(i => i.uuid), ['p-001']);
      assert.strictEqual(updated.items![0].changes, undefined);
    });

    test('reject on the removed half of a pair also discards the paired added item', () => {
      const doc = makePairedDoc();

      const updated = resolveAddedRemovedItem(doc, 'p-001', 'reject');

      assert.deepStrictEqual(updated.items!.map(i => i.uuid), ['p-001']);
      assert.strictEqual(updated.items![0].changes, undefined);
    });
  });
});
