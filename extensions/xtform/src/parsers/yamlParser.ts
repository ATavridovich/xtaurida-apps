import * as yaml from 'yaml';
import { XtformDocument, XtformParseError } from './xtformDocument';

/**
 * Parses .xtform document content into structured format
 *
 * @param content - Raw .xtform file content
 * @returns Parsed XtformDocument
 * @throws XtformParseError if parsing fails
 */
export function parseXtformDocument(content: string): XtformDocument {
  // Split by --- markers
  const parts = content.split(/^---\s*$/m);

  if (parts.length < 3) {
    throw new XtformParseError(
      'Invalid .xtform format: Expected YAML frontmatter between --- markers'
    );
  }

  // Extract YAML (between first two --- markers)
  // parts[0] is empty or whitespace before first ---
  // parts[1] is the YAML content
  // parts[2] onwards is the template
  const rawYaml = parts[1].trim();
  const template = parts.slice(2).join('---').trim();

  // Parse YAML
  let parsed: any;
  try {
    parsed = yaml.parse(rawYaml);
  } catch (error) {
    throw new XtformParseError(
      `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate required fields
  if (!parsed || typeof parsed !== 'object') {
    throw new XtformParseError('YAML frontmatter must be an object');
  }

  if (!parsed.uuid || typeof parsed.uuid !== 'string') {
    throw new XtformParseError('Missing required field: uuid');
  }

  // Extract uuid and data
  const { uuid, data, ...meta } = parsed;

  // Validate data field exists
  if (!data || typeof data !== 'object') {
    throw new XtformParseError('Missing or invalid required field: data');
  }

  return {
    uuid,
    meta,
    data,
    template,
    rawYaml
  };
}

/**
 * Updates a field value in the document's data section
 *
 * @param doc - XtformDocument to update
 * @param fieldUuid - UUID of the field to update
 * @param value - New value for the field
 * @returns New document content with updated value
 */
export function updateYamlData(
  doc: XtformDocument,
  fieldUuid: string,
  value: any
): string {
  // Create updated data object
  const updatedData = {
    ...doc.data,
    [fieldUuid]: value
  };

  // Reconstruct full YAML object
  const yamlObject = {
    uuid: doc.uuid,
    ...doc.meta,
    data: updatedData
  };

  // Serialize to YAML
  const newYaml = yaml.stringify(yamlObject, {
    indent: 2,
    lineWidth: 0 // No line wrapping
  });

  // Reconstruct full document
  return `---\n${newYaml}---\n${doc.template}`;
}

/**
 * Updates multiple field values in the document's data section
 *
 * @param doc - XtformDocument to update
 * @param updates - Map of field UUIDs to new values
 * @returns New document content with updated values
 */
export function updateYamlDataMultiple(
  doc: XtformDocument,
  updates: Record<string, any>
): string {
  // Create updated data object
  const updatedData = {
    ...doc.data,
    ...updates
  };

  // Reconstruct full YAML object
  const yamlObject = {
    uuid: doc.uuid,
    ...doc.meta,
    data: updatedData
  };

  // Serialize to YAML
  const newYaml = yaml.stringify(yamlObject, {
    indent: 2,
    lineWidth: 0
  });

  // Reconstruct full document
  return `---\n${newYaml}---\n${doc.template}`;
}
