import * as YAML from 'yaml';
import { XtformDocument, XtformNode, XtformParseError } from './xtformDocument';

/**
 * Parses .xtform document content into structured hierarchical format
 *
 * @param content - Raw .xtform file content (pure YAML, no templates)
 * @returns Parsed XtformDocument
 * @throws XtformParseError if parsing fails
 */
export function parseXtformDocument(content: string): XtformDocument {
  try {
    const doc = YAML.parse(content);

    // Validate root node
    if (!doc || typeof doc !== 'object') {
      throw new XtformParseError('Invalid YAML: root must be an object');
    }

    if (doc.type !== 'Form') {
      throw new XtformParseError('Invalid xtform: root type must be "Form"');
    }

    if (!doc.uuid) {
      throw new XtformParseError('Invalid xtform: root must have uuid');
    }

    return doc as XtformDocument;
  } catch (error) {
    if (error instanceof XtformParseError) {
      throw error;
    }
    throw new XtformParseError(
      `YAML parse error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Serializes XtformDocument back to YAML string
 *
 * @param doc - XtformDocument to serialize
 * @returns YAML string representation
 */
export function serializeXtformDocument(doc: XtformDocument): string {
  return YAML.stringify(doc, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE'
  });
}

/**
 * Updates a node's value property
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the node to update
 * @param value - New value
 * @returns Updated XtformDocument
 */
export function updateNodeValue(doc: XtformDocument, uuid: string, value: any): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  function findAndUpdate(node: XtformNode | XtformDocument): boolean {
    if (node.uuid === uuid) {
      (node as any).value = value;
      return true;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        if (findAndUpdate(child)) {
          return true;
        }
      }
    }

    return false;
  }

  findAndUpdate(newDoc);
  return newDoc;
}

/**
 * Updates any property of a node
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the node to update
 * @param property - Property name (supports 'instructions.*' notation)
 * @param value - New value
 * @returns Updated XtformDocument
 */
export function updateNodeProperty(
  doc: XtformDocument,
  uuid: string,
  property: string,
  value: any
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  function findAndUpdate(node: XtformNode | XtformDocument): boolean {
    if (node.uuid === uuid) {
      // Handle instructions.* properties
      if (property.startsWith('instructions.')) {
        const key = property.substring('instructions.'.length);
        if (!node.instructions) {
          node.instructions = {};
        }
        node.instructions[key] = value;
      } else {
        (node as any)[property] = value;
      }
      return true;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        if (findAndUpdate(child)) {
          return true;
        }
      }
    }

    return false;
  }

  findAndUpdate(newDoc);
  return newDoc;
}

/**
 * Adds a new node to the hierarchy
 *
 * @param doc - XtformDocument to update
 * @param parentUuid - UUID of parent node, or null to add to root
 * @param node - Node to add
 * @returns Updated XtformDocument
 */
export function addNode(
  doc: XtformDocument,
  parentUuid: string | null,
  node: XtformNode
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  if (parentUuid === null) {
    // Add to root items
    if (!newDoc.items) {
      newDoc.items = [];
    }
    newDoc.items.push(node);
    return newDoc;
  }

  function findAndAdd(parent: XtformNode | XtformDocument): boolean {
    if (parent.uuid === parentUuid) {
      if (!parent.items) {
        parent.items = [];
      }
      parent.items.push(node);
      return true;
    }

    if (parent.items && Array.isArray(parent.items)) {
      for (const child of parent.items) {
        if (findAndAdd(child)) {
          return true;
        }
      }
    }

    return false;
  }

  findAndAdd(newDoc);
  return newDoc;
}

/**
 * Deletes a node from the hierarchy
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the node to delete
 * @returns Updated XtformDocument
 */
export function deleteNode(doc: XtformDocument, uuid: string): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  function findAndDelete(parent: XtformNode | XtformDocument): boolean {
    if (!parent.items || !Array.isArray(parent.items)) {
      return false;
    }

    const index = parent.items.findIndex(child => child.uuid === uuid);
    if (index !== -1) {
      parent.items.splice(index, 1);
      return true;
    }

    for (const child of parent.items) {
      if (findAndDelete(child)) {
        return true;
      }
    }

    return false;
  }

  findAndDelete(newDoc);
  return newDoc;
}

/**
 * Finds a node by UUID in the hierarchy
 *
 * @param doc - XtformDocument to search
 * @param uuid - UUID to find
 * @returns Found node, or null if not found
 */
export function findNode(
  doc: XtformDocument,
  uuid: string
): XtformNode | XtformDocument | null {
  if (doc.uuid === uuid) {
    return doc;
  }

  function search(node: XtformNode): XtformNode | null {
    if (node.uuid === uuid) {
      return node;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        const result = search(child);
        if (result) {
          return result;
        }
      }
    }

    return null;
  }

  if (doc.items) {
    for (const item of doc.items) {
      const result = search(item);
      if (result) {
        return result;
      }
    }
  }

  return null;
}
