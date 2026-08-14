import * as assert from 'assert';
import { renderForm } from '../renderers/formRenderer';
import { ComponentTag } from '../parsers/componentTagParser';

suite('Form Renderer', () => {
  suite('renderForm', () => {
    test('should render TextInput component', () => {
      const components: ComponentTag[] = [
        {
          type: 'TextInput',
          uuid: 'f-001',
          label: 'Full Name',
          attributes: {
            uuid: 'f-001',
            label: 'Full Name',
            placeholder: 'Enter your name'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 'John Doe'
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Full Name'));
      assert.ok(html.includes('value="John Doe"'));
      assert.ok(html.includes('placeholder="Enter your name"'));
    });

    test('should render Checkbox component', () => {
      const components: ComponentTag[] = [
        {
          type: 'Checkbox',
          uuid: 'f-001',
          label: 'Active',
          attributes: {
            uuid: 'f-001',
            label: 'Active'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': true
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Active'));
      assert.ok(html.includes('checked'));
    });

    test('should render unchecked Checkbox', () => {
      const components: ComponentTag[] = [
        {
          type: 'Checkbox',
          uuid: 'f-001',
          label: 'Active',
          attributes: {
            uuid: 'f-001',
            label: 'Active'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': false
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(!html.includes('checked'));
    });

    test('should render Select component', () => {
      const components: ComponentTag[] = [
        {
          type: 'Select',
          uuid: 'f-001',
          label: 'Type',
          attributes: {
            uuid: 'f-001',
            label: 'Type',
            options: 'Option1,Option2,Option3'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 'Option2'
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Type'));
      assert.ok(html.includes('Option1'));
      assert.ok(html.includes('Option2'));
      assert.ok(html.includes('Option3'));
      assert.ok(html.includes('value="Option2" selected'));
    });

    test('should render IntegerInput component', () => {
      const components: ComponentTag[] = [
        {
          type: 'IntegerInput',
          uuid: 'f-001',
          label: 'Age',
          attributes: {
            uuid: 'f-001',
            label: 'Age',
            min_value: '0',
            max_value: '120'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 25
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Age'));
      assert.ok(html.includes('value="25"'));
      assert.ok(html.includes('min="0"'));
      assert.ok(html.includes('max="120"'));
      assert.ok(html.includes('step="1"'));
    });

    test('should render Section with children', () => {
      const components: ComponentTag[] = [
        {
          type: 'Section',
          uuid: 's-001',
          label: 'Personal Info',
          attributes: {
            uuid: 's-001',
            label: 'Personal Info'
          },
          selfClosing: false,
          children: [
            {
              type: 'TextInput',
              uuid: 'f-001',
              label: 'Name',
              attributes: {
                uuid: 'f-001',
                label: 'Name'
              },
              selfClosing: true
            },
            {
              type: 'TextInput',
              uuid: 'f-002',
              label: 'Email',
              attributes: {
                uuid: 'f-002',
                label: 'Email'
              },
              selfClosing: true
            }
          ]
        }
      ];

      const data = {
        'f-001': 'John',
        'f-002': 'john@example.com'
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('xtform-section'));
      assert.ok(html.includes('Personal Info'));
      assert.ok(html.includes('data-uuid="s-001"'));
      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('data-uuid="f-002"'));
      assert.ok(html.includes('value="John"'));
      assert.ok(html.includes('value="john@example.com"'));
    });

    test('should render Table component', () => {
      const components: ComponentTag[] = [
        {
          type: 'Table',
          uuid: 't-001',
          label: 'Fields',
          attributes: {
            uuid: 't-001',
            label: 'Fields'
          },
          selfClosing: false,
          children: [
            {
              type: 'TextInput',
              uuid: 'c-001',
              label: 'Name',
              attributes: {
                uuid: 'c-001',
                label: 'Name'
              },
              selfClosing: true
            },
            {
              type: 'Select',
              uuid: 'c-002',
              label: 'Type',
              attributes: {
                uuid: 'c-002',
                label: 'Type'
              },
              selfClosing: true
            }
          ]
        }
      ];

      const data = {
        't-001': [
          {
            uuid: 'r-001',
            data: {
              'c-001': 'title',
              'c-002': 'CharField'
            }
          },
          {
            uuid: 'r-002',
            data: {
              'c-001': 'author',
              'c-002': 'ForeignKey'
            }
          }
        ]
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('xtform-table'));
      assert.ok(html.includes('Fields'));
      assert.ok(html.includes('Name'));
      assert.ok(html.includes('Type'));
      assert.ok(html.includes('title'));
      assert.ok(html.includes('CharField'));
      assert.ok(html.includes('author'));
      assert.ok(html.includes('ForeignKey'));
      assert.ok(html.includes('Phase 2'));
    });

    test('should escape HTML in values', () => {
      const components: ComponentTag[] = [
        {
          type: 'TextInput',
          uuid: 'f-001',
          label: 'Test',
          attributes: {
            uuid: 'f-001',
            label: 'Test'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': '<script>alert("XSS")</script>'
      };

      const html = renderForm(components, data);

      assert.ok(!html.includes('<script>'));
      assert.ok(html.includes('&lt;script&gt;'));
      assert.ok(html.includes('&lt;/script&gt;'));
    });

    test('should handle missing data gracefully', () => {
      const components: ComponentTag[] = [
        {
          type: 'TextInput',
          uuid: 'f-001',
          label: 'Name',
          attributes: {
            uuid: 'f-001',
            label: 'Name'
          },
          selfClosing: true
        }
      ];

      const data = {}; // No data for f-001

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('value=""')); // Empty value
    });

    test('should render multiple components', () => {
      const components: ComponentTag[] = [
        {
          type: 'TextInput',
          uuid: 'f-001',
          label: 'Field 1',
          attributes: {
            uuid: 'f-001',
            label: 'Field 1'
          },
          selfClosing: true
        },
        {
          type: 'TextInput',
          uuid: 'f-002',
          label: 'Field 2',
          attributes: {
            uuid: 'f-002',
            label: 'Field 2'
          },
          selfClosing: true
        },
        {
          type: 'Checkbox',
          uuid: 'f-003',
          label: 'Active',
          attributes: {
            uuid: 'f-003',
            label: 'Active'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 'Value 1',
        'f-002': 'Value 2',
        'f-003': true
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('data-uuid="f-002"'));
      assert.ok(html.includes('data-uuid="f-003"'));
      assert.ok(html.includes('Value 1'));
      assert.ok(html.includes('Value 2'));
    });

    test('should render TextArea component', () => {
      const components: ComponentTag[] = [
        {
          type: 'TextArea',
          uuid: 'f-001',
          label: 'Description',
          attributes: {
            uuid: 'f-001',
            label: 'Description',
            placeholder: 'Enter description'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 'This is a long description'
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Description'));
      assert.ok(html.includes('This is a long description'));
      assert.ok(html.includes('placeholder="Enter description"'));
      assert.ok(html.includes('textarea'));
    });

    test('should render RadioGroup component', () => {
      const components: ComponentTag[] = [
        {
          type: 'RadioGroup',
          uuid: 'f-001',
          label: 'Gender',
          attributes: {
            uuid: 'f-001',
            label: 'Gender',
            options: 'Male,Female,Other'
          },
          selfClosing: true
        }
      ];

      const data = {
        'f-001': 'Female'
      };

      const html = renderForm(components, data);

      assert.ok(html.includes('data-uuid="f-001"'));
      assert.ok(html.includes('Gender'));
      assert.ok(html.includes('Male'));
      assert.ok(html.includes('Female'));
      assert.ok(html.includes('Other'));
      assert.ok(html.includes('value="Female" checked'));
    });
  });
});
