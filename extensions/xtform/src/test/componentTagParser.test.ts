import * as assert from 'assert';
import {
  parseComponentTags,
  findComponentByUuid,
  getAllUuids
} from '../parsers/componentTagParser';

suite('Component Tag Parser', () => {
  suite('parseComponentTags', () => {
    test('should parse self-closing tag', () => {
      const template = `[% TextInput uuid="f-001" label="Name" /%]`;
      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].type, 'TextInput');
      assert.strictEqual(components[0].uuid, 'f-001');
      assert.strictEqual(components[0].label, 'Name');
      assert.strictEqual(components[0].selfClosing, true);
      assert.strictEqual(components[0].children, undefined);
    });

    test('should parse multiple self-closing tags', () => {
      const template = `
[% TextInput uuid="f-001" label="First Name" /%]
[% TextInput uuid="f-002" label="Last Name" /%]
[% Checkbox uuid="f-003" label="Active" /%]`;

      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 3);
      assert.strictEqual(components[0].type, 'TextInput');
      assert.strictEqual(components[1].type, 'TextInput');
      assert.strictEqual(components[2].type, 'Checkbox');
    });

    test('should parse block tag with children', () => {
      const template = `
[% Section uuid="s-001" label="Personal Info" %]
  [% TextInput uuid="f-001" label="Name" /%]
  [% TextInput uuid="f-002" label="Email" /%]
[% /Section %]`;

      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].type, 'Section');
      assert.strictEqual(components[0].uuid, 's-001');
      assert.strictEqual(components[0].selfClosing, false);
      assert.ok(components[0].children);
      assert.strictEqual(components[0].children!.length, 2);
      assert.strictEqual(components[0].children![0].type, 'TextInput');
      assert.strictEqual(components[0].children![1].type, 'TextInput');
    });

    test('should parse nested block tags', () => {
      const template = `
[% Section uuid="s-001" label="Form" %]
  [% Section uuid="s-002" label="Nested" %]
    [% TextInput uuid="f-001" label="Field" /%]
  [% /Section %]
[% /Section %]`;

      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].type, 'Section');
      assert.ok(components[0].children);
      assert.strictEqual(components[0].children!.length, 1);
      assert.strictEqual(components[0].children![0].type, 'Section');
      assert.ok(components[0].children![0].children);
      assert.strictEqual(components[0].children![0].children!.length, 1);
      assert.strictEqual(components[0].children![0].children![0].type, 'TextInput');
    });

    test('should parse attributes with double quotes', () => {
      const template = `[% TextInput uuid="f-001" label="Full Name" placeholder="Enter your name" /%]`;
      const components = parseComponentTags(template);

      assert.strictEqual(components[0].attributes.uuid, 'f-001');
      assert.strictEqual(components[0].attributes.label, 'Full Name');
      assert.strictEqual(components[0].attributes.placeholder, 'Enter your name');
    });

    test('should parse attributes with single quotes', () => {
      const template = `[% TextInput uuid='f-001' label='Name' /%]`;
      const components = parseComponentTags(template);

      assert.strictEqual(components[0].attributes.uuid, 'f-001');
      assert.strictEqual(components[0].attributes.label, 'Name');
    });

    test('should parse attributes with curly braces (expressions)', () => {
      const template = `[% IntegerInput uuid="f-001" min_value={0} max_value={100} /%]`;
      const components = parseComponentTags(template);

      assert.strictEqual(components[0].attributes.min_value, '0');
      assert.strictEqual(components[0].attributes.max_value, '100');
    });

    test('should parse dotted attribute names', () => {
      const template = `[% TextInput uuid="f-001" instructions.on_change="Update model" /%]`;
      const components = parseComponentTags(template);

      assert.strictEqual(components[0].attributes['instructions.on_change'], 'Update model');
    });

    test('should handle Table with column definitions', () => {
      const template = `
[% Table uuid="t-001" label="Fields" %]
  [% TextInput uuid="c-001" label="Name" /%]
  [% Select uuid="c-002" label="Type" options="CharField,IntegerField" /%]
  [% Checkbox uuid="c-003" label="Required" /%]
[% /Table %]`;

      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 1);
      assert.strictEqual(components[0].type, 'Table');
      assert.ok(components[0].children);
      assert.strictEqual(components[0].children!.length, 3);
      assert.strictEqual(components[0].children![0].type, 'TextInput');
      assert.strictEqual(components[0].children![1].type, 'Select');
      assert.strictEqual(components[0].children![2].type, 'Checkbox');
    });

    test('should handle mixed content (tags and text)', () => {
      const template = `
Some text before
[% TextInput uuid="f-001" label="Name" /%]
Some text in between
[% TextInput uuid="f-002" label="Email" /%]
Some text after`;

      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 2);
      assert.strictEqual(components[0].uuid, 'f-001');
      assert.strictEqual(components[1].uuid, 'f-002');
    });

    test('should handle empty template', () => {
      const template = ``;
      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 0);
    });

    test('should handle template with no tags', () => {
      const template = `Just some plain text without any tags`;
      const components = parseComponentTags(template);

      assert.strictEqual(components.length, 0);
    });
  });

  suite('findComponentByUuid', () => {
    const template = `
[% Section uuid="s-001" label="Section 1" %]
  [% TextInput uuid="f-001" label="Field 1" /%]
  [% Section uuid="s-002" label="Nested Section" %]
    [% TextInput uuid="f-002" label="Field 2" /%]
  [% /Section %]
[% /Section %]
[% TextInput uuid="f-003" label="Field 3" /%]`;

    test('should find root-level component', () => {
      const components = parseComponentTags(template);
      const found = findComponentByUuid(components, 'f-003');

      assert.ok(found);
      assert.strictEqual(found.type, 'TextInput');
      assert.strictEqual(found.label, 'Field 3');
    });

    test('should find nested component', () => {
      const components = parseComponentTags(template);
      const found = findComponentByUuid(components, 'f-001');

      assert.ok(found);
      assert.strictEqual(found.type, 'TextInput');
      assert.strictEqual(found.label, 'Field 1');
    });

    test('should find deeply nested component', () => {
      const components = parseComponentTags(template);
      const found = findComponentByUuid(components, 'f-002');

      assert.ok(found);
      assert.strictEqual(found.type, 'TextInput');
      assert.strictEqual(found.label, 'Field 2');
    });

    test('should find container component', () => {
      const components = parseComponentTags(template);
      const found = findComponentByUuid(components, 's-002');

      assert.ok(found);
      assert.strictEqual(found.type, 'Section');
      assert.strictEqual(found.label, 'Nested Section');
    });

    test('should return undefined for non-existent UUID', () => {
      const components = parseComponentTags(template);
      const found = findComponentByUuid(components, 'non-existent');

      assert.strictEqual(found, undefined);
    });
  });

  suite('getAllUuids', () => {
    test('should get all UUIDs from flat structure', () => {
      const template = `
[% TextInput uuid="f-001" label="Field 1" /%]
[% TextInput uuid="f-002" label="Field 2" /%]
[% Checkbox uuid="f-003" label="Active" /%]`;

      const components = parseComponentTags(template);
      const uuids = getAllUuids(components);

      assert.strictEqual(uuids.length, 3);
      assert.ok(uuids.includes('f-001'));
      assert.ok(uuids.includes('f-002'));
      assert.ok(uuids.includes('f-003'));
    });

    test('should get all UUIDs from nested structure', () => {
      const template = `
[% Section uuid="s-001" label="Section" %]
  [% TextInput uuid="f-001" label="Field 1" /%]
  [% Section uuid="s-002" label="Nested" %]
    [% TextInput uuid="f-002" label="Field 2" /%]
  [% /Section %]
[% /Section %]`;

      const components = parseComponentTags(template);
      const uuids = getAllUuids(components);

      assert.strictEqual(uuids.length, 4);
      assert.ok(uuids.includes('s-001'));
      assert.ok(uuids.includes('f-001'));
      assert.ok(uuids.includes('s-002'));
      assert.ok(uuids.includes('f-002'));
    });

    test('should return empty array for empty components', () => {
      const uuids = getAllUuids([]);

      assert.strictEqual(uuids.length, 0);
    });
  });
});
