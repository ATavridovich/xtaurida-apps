/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { parseXtformDocument, deleteNode } from '../parsers/yamlParser';
import { XtformDocument } from '../parsers/xtformDocument';

suite('deleteNode (spec/xtdraft-format.md, "Editing")', () => {
  function makeDocWithSection(): XtformDocument {
    return parseXtformDocument(`
type: Form
uuid: "form-001"
label: "Test Form"
items:
  - type: Section
    uuid: "s-001"
    label: "A Section"
    items:
      - type: TextInput
        uuid: "f-001"
        label: "First"
      - type: TextInput
        uuid: "f-002"
        label: "Second"
  - type: TextInput
    uuid: "f-003"
    label: "After"
`);
  }

  suite('deleting a grouping container (Section, CollapsibleSection, Tab)', () => {
    test('promotes children to the parent level in its place', () => {
      const doc = makeDocWithSection();

      const updated = deleteNode(doc, 's-001');

      assert.deepStrictEqual(
        updated.items!.map(item => item.uuid),
        ['f-001', 'f-002', 'f-003']
      );
    });

    test('promotes no items when the container had none', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: Tab
    uuid: "t-001"
    label: "Empty Tab"
    items: []
  - type: TextInput
    uuid: "f-001"
    label: "After"
`);

      const updated = deleteNode(doc, 't-001');

      assert.deepStrictEqual(
        updated.items!.map(item => item.uuid),
        ['f-001']
      );
    });

    test('works for nested containers, promoting into the immediate parent', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: Tab
    uuid: "t-001"
    label: "Outer"
    items:
      - type: CollapsibleSection
        uuid: "cs-001"
        label: "Inner"
        items:
          - type: TextInput
            uuid: "f-001"
            label: "Nested Field"
`);

      const updated = deleteNode(doc, 'cs-001');

      const outer = updated.items!.find(item => item.uuid === 't-001')!;
      assert.deepStrictEqual(
        outer.items!.map(item => item.uuid),
        ['f-001']
      );
    });
  });

  suite('deleting a non-container node', () => {
    test('removes the node and its descendants, without promotion', () => {
      const doc = makeDocWithSection();

      const updated = deleteNode(doc, 'f-001');

      const section = updated.items!.find(item => item.uuid === 's-001')!;
      assert.deepStrictEqual(
        section.items!.map(item => item.uuid),
        ['f-002']
      );
    });

    test('does not mutate the original document', () => {
      const doc = makeDocWithSection();

      deleteNode(doc, 's-001');

      assert.strictEqual(doc.items!.length, 2);
      assert.strictEqual(doc.items![0].uuid, 's-001');
    });
  });
});
