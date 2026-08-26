import * as assert from 'assert';
import {
  parseXtformDocument,
  addTableRow,
  deleteTableRow,
  updateTableCell,
  addNode,
  deleteNode
} from '../parsers/yamlParser';
import { XtformDocument, XtformTableRow } from '../parsers/xtformDocument';

suite('Table operations (yamlParser)', () => {
  function makeDocWithTable(): XtformDocument {
    return parseXtformDocument(`
type: Form
uuid: "form-001"
title: "Test Form"
items:
  - type: Table
    uuid: "t-001"
    label: "Rows"
    items:
      - type: TextInput
        uuid: "c-001"
        label: "Name"
    data:
      - uuid: "r-001"
        props: {}
        data:
          c-001: "existing"
`);
  }

  suite('addTableRow', () => {
    test('appends a new record to the table data array', () => {
      const doc = makeDocWithTable();
      const row: XtformTableRow = { uuid: 'r-002', props: {}, data: {} };

      const updated = addTableRow(doc, 't-001', row);

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.data.length, 2);
      assert.deepStrictEqual(table.data[1], row);
    });

    test('initializes data as an array when the table had none', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: Table
    uuid: "t-001"
    items: []
`);
      const row: XtformTableRow = { uuid: 'r-001', props: {}, data: {} };

      const updated = addTableRow(doc, 't-001', row);

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.deepStrictEqual(table.data, [row]);
    });

    test('does not mutate the original document', () => {
      const doc = makeDocWithTable();

      addTableRow(doc, 't-001', { uuid: 'r-002', props: {}, data: {} });

      const table = doc.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.data.length, 1);
    });
  });

  suite('deleteTableRow', () => {
    test('removes the matching record by uuid', () => {
      const doc = makeDocWithTable();

      const updated = deleteTableRow(doc, 't-001', 'r-001');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.deepStrictEqual(table.data, []);
    });

    test('leaves data unchanged when the row uuid is not found', () => {
      const doc = makeDocWithTable();

      const updated = deleteTableRow(doc, 't-001', 'does-not-exist');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.data.length, 1);
    });
  });

  suite('updateTableCell', () => {
    test('sets the value for the given row and column', () => {
      const doc = makeDocWithTable();

      const updated = updateTableCell(doc, 't-001', 'r-001', 'c-001', 'renamed');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.data[0].data['c-001'], 'renamed');
    });

    test('creates the row data map when the record had none', () => {
      const doc = parseXtformDocument(`
type: Form
uuid: "form-001"
items:
  - type: Table
    uuid: "t-001"
    items: []
    data:
      - uuid: "r-001"
        props: {}
`);

      const updated = updateTableCell(doc, 't-001', 'r-001', 'c-001', 'value');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.deepStrictEqual(table.data[0].data, { 'c-001': 'value' });
    });

    test('is a no-op when the row uuid is not found', () => {
      const doc = makeDocWithTable();

      const updated = updateTableCell(doc, 't-001', 'does-not-exist', 'c-001', 'value');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.data[0].data['c-001'], 'existing');
    });
  });

  // Table columns are plain nodes in the Table's `items` array, so adding
  // and removing columns reuses the generic addNode/deleteNode mutators.
  suite('columns via addNode/deleteNode', () => {
    test('addNode appends a new column to the table items', () => {
      const doc = makeDocWithTable();

      const updated = addNode(doc, 't-001', { type: 'Checkbox', uuid: 'c-002', label: 'Done' });

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.strictEqual(table.items!.length, 2);
      assert.strictEqual(table.items![1].type, 'Checkbox');
    });

    test('deleteNode removes a column from the table items', () => {
      const doc = makeDocWithTable();

      const updated = deleteNode(doc, 'c-001');

      const table = updated.items!.find(item => item.uuid === 't-001')!;
      assert.deepStrictEqual(table.items, []);
    });
  });
});
