import * as assert from 'assert';
import { parseXtformDocument, updateYamlData, updateYamlDataMultiple } from '../parsers/yamlParser';
import { XtformParseError } from '../parsers/xtformDocument';

suite('YAML Parser', () => {
  const validDocument = `---
uuid: f3a1d820-cc74-4e1b-9a2f-8b3e5c6d7f90
title: Test Form
description: A test form
data:
  f-001: "Test Value"
  f-002: 42
  f-003:
    - uuid: "r-001"
      data:
        c-001: "nested value"
---
[% Section uuid="s-001" label="Test Section" %]
  [% TextInput uuid="f-001" label="Test Field" /%]
[% /Section %]`;

  suite('parseXtformDocument', () => {
    test('should parse valid document', () => {
      const doc = parseXtformDocument(validDocument);

      assert.strictEqual(doc.uuid, 'f3a1d820-cc74-4e1b-9a2f-8b3e5c6d7f90');
      assert.strictEqual(doc.meta.title, 'Test Form');
      assert.strictEqual(doc.meta.description, 'A test form');
      assert.strictEqual(doc.data['f-001'], 'Test Value');
      assert.strictEqual(doc.data['f-002'], 42);
      assert.ok(Array.isArray(doc.data['f-003']));
      assert.ok(doc.template.includes('Section'));
    });

    test('should throw error on missing frontmatter markers', () => {
      const invalidDoc = `uuid: test\ndata: {}`;

      assert.throws(
        () => parseXtformDocument(invalidDoc),
        XtformParseError
      );
    });

    test('should throw error on missing uuid', () => {
      const invalidDoc = `---
title: Test
data:
  f-001: "value"
---
template`;

      assert.throws(
        () => parseXtformDocument(invalidDoc),
        XtformParseError
      );
    });

    test('should throw error on missing data field', () => {
      const invalidDoc = `---
uuid: test-uuid
title: Test
---
template`;

      assert.throws(
        () => parseXtformDocument(invalidDoc),
        XtformParseError
      );
    });

    test('should throw error on invalid YAML', () => {
      const invalidDoc = `---
uuid: test
data: [unmatched
---
template`;

      assert.throws(
        () => parseXtformDocument(invalidDoc),
        XtformParseError
      );
    });

    test('should extract template correctly', () => {
      const doc = parseXtformDocument(validDocument);

      assert.ok(doc.template.includes('[% Section'));
      assert.ok(doc.template.includes('[% TextInput'));
      assert.ok(doc.template.includes('[% /Section %]'));
    });
  });

  suite('updateYamlData', () => {
    test('should update single field value', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlData(doc, 'f-001', 'Updated Value');
      const reparsed = parseXtformDocument(updated);

      assert.strictEqual(reparsed.data['f-001'], 'Updated Value');
      assert.strictEqual(reparsed.data['f-002'], 42); // Other fields unchanged
      assert.strictEqual(reparsed.uuid, doc.uuid); // UUID preserved
      assert.ok(updated.includes('[% Section')); // Template preserved
    });

    test('should add new field if it does not exist', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlData(doc, 'f-new', 'New Value');
      const reparsed = parseXtformDocument(updated);

      assert.strictEqual(reparsed.data['f-new'], 'New Value');
      assert.strictEqual(reparsed.data['f-001'], 'Test Value'); // Existing fields preserved
    });

    test('should preserve metadata fields', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlData(doc, 'f-001', 'Updated');
      const reparsed = parseXtformDocument(updated);

      assert.strictEqual(reparsed.meta.title, 'Test Form');
      assert.strictEqual(reparsed.meta.description, 'A test form');
    });

    test('should preserve template content', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlData(doc, 'f-001', 'Updated');

      assert.ok(updated.includes('[% Section uuid="s-001"'));
      assert.ok(updated.includes('[% TextInput uuid="f-001"'));
    });
  });

  suite('updateYamlDataMultiple', () => {
    test('should update multiple fields at once', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlDataMultiple(doc, {
        'f-001': 'Updated 1',
        'f-002': 999,
        'f-new': 'New Field'
      });
      const reparsed = parseXtformDocument(updated);

      assert.strictEqual(reparsed.data['f-001'], 'Updated 1');
      assert.strictEqual(reparsed.data['f-002'], 999);
      assert.strictEqual(reparsed.data['f-new'], 'New Field');
      assert.ok(Array.isArray(reparsed.data['f-003'])); // Unchanged field preserved
    });

    test('should preserve document structure', () => {
      const doc = parseXtformDocument(validDocument);
      const updated = updateYamlDataMultiple(doc, {
        'f-001': 'Updated',
        'f-002': 100
      });
      const reparsed = parseXtformDocument(updated);

      assert.strictEqual(reparsed.uuid, doc.uuid);
      assert.strictEqual(reparsed.meta.title, doc.meta.title);
      assert.ok(updated.includes(doc.template));
    });
  });
});
