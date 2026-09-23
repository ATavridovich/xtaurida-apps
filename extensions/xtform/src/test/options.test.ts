/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { formatOptions, normalizeOptionsText, parseOptions } from '../parsers/options';
import { parseXtformDocument, serializeXtformDocument } from '../parsers/yamlParser';

suite('Options', () => {
  suite('parseOptions', () => {
    test('reads multi-line and legacy comma-separated options', () => {
      assert.deepStrictEqual(
        [
          parseOptions('Low\nMedium, or so\r\n\n  High  \n'),
          parseOptions('Hello, world\n'),
          parseOptions('Low, Medium,,High'),
          parseOptions('Single'),
          parseOptions(''),
          parseOptions(undefined),
          parseOptions(null)
        ],
        [
          ['Low', 'Medium, or so', 'High'],
          ['Hello, world'],
          ['Low', 'Medium', 'High'],
          ['Single'],
          [],
          [],
          []
        ]
      );
    });
  });

  suite('formatOptions', () => {
    test('terminates every option with a line break', () => {
      assert.deepStrictEqual(
        [formatOptions(['Low', 'High']), formatOptions(['Hello, world']), formatOptions([])],
        ['Low\nHigh\n', 'Hello, world\n', '']
      );
    });

    test('round-trips through parseOptions', () => {
      const options = ['Hello, world', 'Low'];
      assert.deepStrictEqual(parseOptions(formatOptions(options)), options);
    });
  });

  suite('normalizeOptionsText', () => {
    test('treats each line as one option, keeping commas', () => {
      assert.deepStrictEqual(
        [normalizeOptionsText(' Low \r\n\nMedium, or so\n'), normalizeOptionsText('Hello, world'), normalizeOptionsText('\n \n')],
        ['Low\nMedium, or so\n', 'Hello, world\n', '']
      );
    });
  });

  suite('serializeXtformDocument', () => {
    test('writes multi-line options as a literal block and reads them back', () => {
      const doc = parseXtformDocument([
        'type: "Form"',
        'uuid: "f-root"',
        'items:',
        '  - type: "Select"',
        '    uuid: "f-001"',
        '    options: "Low,High"',
        '  - type: "RadioGroup"',
        '    uuid: "f-002"',
        '    options: "Hello, world\\nOther\\n"',
        ''
      ].join('\n'));

      const serialized = serializeXtformDocument(doc);

      assert.strictEqual(serialized, [
        '"type": "Form"',
        '"uuid": "f-root"',
        '"items":',
        '  - "type": "Select"',
        '    "uuid": "f-001"',
        '    "options": "Low,High"',
        '  - "type": "RadioGroup"',
        '    "uuid": "f-002"',
        '    "options": |',
        '      Hello, world',
        '      Other',
        ''
      ].join('\n'));
      assert.deepStrictEqual(parseXtformDocument(serialized), doc);
    });
  });
});
