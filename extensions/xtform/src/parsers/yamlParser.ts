/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as YAML from 'yaml';
import { XtformDocument, XtformItemChangesPrev, XtformNode, XtformParseError, XtformTableRow } from './xtformDocument';

/**
 * Node-level prefixes that are written as flat dotted keys on disk
 * (`instructions.on_change`, `changes.status`, ...) but consumed as nested
 * objects (`node.instructions.on_change`, `node.changes.status`) everywhere
 * else — see spec/xtform-format.md ("Instructions") and
 * spec/xtdraft-format.md. `unflattenNode`/`flattenNode` convert between the
 * two around the YAML boundary.
 */
const DOTTED_KEY_PREFIXES = ['instructions', 'changes'] as const;

/**
 * Converts flat dotted keys (`instructions.on_change`, `changes.data.on_add`)
 * found directly on a freshly-parsed YAML object into the nested
 * `instructions` / `changes` sub-objects the rest of the codebase expects.
 * Mutates in place; does not recurse.
 */
function unflattenObjectKeys(obj: Record<string, any>): void {
  for (const key of Object.keys(obj)) {
    const dotIndex = key.indexOf('.');
    if (dotIndex === -1) {
      continue;
    }

    const prefix = key.substring(0, dotIndex);
    if (!(DOTTED_KEY_PREFIXES as readonly string[]).includes(prefix)) {
      continue;
    }

    const rest = key.substring(dotIndex + 1);
    if (!obj[prefix] || typeof obj[prefix] !== 'object') {
      obj[prefix] = {};
    }
    obj[prefix][rest] = obj[key];
    delete obj[key];
  }
}

/**
 * Reverse of `unflattenObjectKeys` — expands an object's `instructions` /
 * `changes` sub-objects back into flat dotted sibling keys. Mutates in
 * place; does not recurse.
 */
function flattenObjectKeys(obj: Record<string, any>): void {
  for (const prefix of DOTTED_KEY_PREFIXES) {
    const value = obj[prefix];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, val] of Object.entries(value)) {
        obj[`${prefix}.${key}`] = val;
      }
      delete obj[prefix];
    }
  }
}

/**
 * Applies `unflattenObjectKeys` to a node and, recursively, to every node in
 * its `items`. A `modified` item's `changes.prev` snapshot carries its own
 * dotted `instructions.*` keys (see spec/xtdraft-format.md, "Modified
 * fields") and is unflattened the same way.
 *
 * Exported so the webview (`webview-src/index.ts`), which parses `.xtform`
 * YAML independently for rendering, can apply the same conversion instead of
 * duplicating it.
 */
export function unflattenNode(node: Record<string, any>): void {
  unflattenObjectKeys(node);

  if (node.changes?.prev && typeof node.changes.prev === 'object') {
    unflattenObjectKeys(node.changes.prev);
  }

  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      if (child && typeof child === 'object') {
        unflattenNode(child);
      }
    }
  }
}

/**
 * Reverse of `unflattenNode` — expands `node.instructions` / `node.changes`
 * (and a `modified` item's `changes.prev.instructions`) back into flat
 * dotted keys before serializing to YAML, so the on-disk format matches
 * spec/xtform-format.md / spec/xtdraft-format.md. Mutates in place and
 * recurses into `items`.
 */
function flattenNode(node: Record<string, any>): void {
  if (node.changes?.prev && typeof node.changes.prev === 'object') {
    flattenObjectKeys(node.changes.prev);
  }

  flattenObjectKeys(node);

  if (Array.isArray(node.items)) {
    for (const child of node.items) {
      if (child && typeof child === 'object') {
        flattenNode(child);
      }
    }
  }
}

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

    unflattenNode(doc);

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
  const flattened = JSON.parse(JSON.stringify(doc));
  flattenNode(flattened);

  return YAML.stringify(flattened, {
    indent: 2,
    lineWidth: 0,
    defaultStringType: 'QUOTE_DOUBLE'
  });
}

/**
 * Bumps the document's revision counter — called by every mutator below so
 * the Viewer can tell whether a form changed since it was last Applied
 * (`applied_revision`). Applies uniformly to any form, not just ones with
 * `show_apply_action` set.
 */
function bumpRevision(doc: XtformDocument): void {
  (doc as any).revision = (typeof doc.revision === 'number' ? doc.revision : 0) + 1;
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
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Sets a single property on an already-found node, understanding the same
 * 'instructions.*' / 'changes.*' dotted notation as the on-disk format (see
 * `unflattenNode`). Shared by `updateNodeProperty` and the modified-field
 * mutators below.
 */
function setNodeProperty(node: Record<string, any>, property: string, value: any): void {
  if (property.startsWith('instructions.')) {
    const key = property.substring('instructions.'.length);
    if (!node.instructions) {
      node.instructions = {};
    }
    node.instructions[key] = value;
  } else if (property.startsWith('changes.')) {
    const key = property.substring('changes.'.length);
    if (!node.changes) {
      node.changes = {};
    }
    node.changes[key] = value;
  } else {
    node[property] = value;
  }
}

/**
 * Writes every field in a `changes.prev` snapshot back onto its node —
 * shared by `cancelModifiedField` and `rejectAllChanges`, which both
 * restore a `modified` item's pre-draft values the same way.
 */
function restoreFromPrev(node: Record<string, any>, prev: XtformItemChangesPrev): void {
  for (const [key, value] of Object.entries(prev)) {
    if (key === 'instructions' && value && typeof value === 'object') {
      for (const [instructionKey, instructionValue] of Object.entries(value as Record<string, unknown>)) {
        setNodeProperty(node, `instructions.${instructionKey}`, instructionValue);
      }
    } else {
      setNodeProperty(node, key, value);
    }
  }
}

/**
 * Clears an item's own pending-change status — the `status`/`prev` pair a
 * resolved Accept/Reject/Apply/Reject leaves behind. For an ordinary item,
 * `changes` holds nothing else, so this drops the whole object. For the
 * root document, which is a component like any other and can carry its own
 * `status`/`prev` alongside `kind` (see `XtformRootChanges`), only `status`
 * and `prev` are cleared — `kind` and any other generator metadata describe
 * the document's draft as a whole and survive independently of the root's
 * own resolved status.
 */
function clearNodeChangeStatus(node: XtformNode | XtformDocument): void {
  if (!node.changes) {
    return;
  }

  if ('kind' in node.changes) {
    delete (node.changes as Record<string, unknown>).status;
    delete (node.changes as Record<string, unknown>).prev;
  } else {
    delete (node as any).changes;
  }
}

/**
 * Updates any property of a node
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the node to update
 * @param property - Property name (supports 'instructions.*' and 'changes.*' notation)
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
      setNodeProperty(node, property, value);
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
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Applies a `modified` item's resolved per-field selection — from the
 * Viewer's metadata popup Accept, see spec/xtdraft-format.md ("Modified
 * fields") — and clears its `changes`. Like the form-level "Accept All"/
 * "Reject All" toolbar, this is a mechanical write the Viewer performs
 * itself, not an Agent command.
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the modified node
 * @param values - Field key → resolved value (already chosen between prev/current by the Viewer); keys use the same 'instructions.*' notation as `updateNodeProperty`
 * @returns Updated XtformDocument
 */
export function acceptModifiedField(
  doc: XtformDocument,
  uuid: string,
  values: Record<string, any>
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  function findAndApply(node: XtformNode | XtformDocument): boolean {
    if (node.uuid === uuid) {
      for (const [key, value] of Object.entries(values)) {
        setNodeProperty(node, key, value);
      }
      clearNodeChangeStatus(node);
      return true;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        if (findAndApply(child)) {
          return true;
        }
      }
    }

    return false;
  }

  findAndApply(newDoc);
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Reverts a `modified` item to its `changes.prev` snapshot and clears
 * `changes` — see spec/xtdraft-format.md ("Modified fields", Reject). A
 * no-op (besides clearing `changes`) if the item has no `changes.prev`.
 * Like `acceptModifiedField`, this is a mechanical write owned by the
 * Viewer, not an Agent command.
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the modified node
 * @returns Updated XtformDocument
 */
export function cancelModifiedField(doc: XtformDocument, uuid: string): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  function findAndCancel(node: XtformNode | XtformDocument): boolean {
    if (node.uuid === uuid) {
      const prev = (node as XtformNode).changes?.prev;
      if (prev) {
        restoreFromPrev(node, prev);
      }
      clearNodeChangeStatus(node);
      return true;
    }

    if (node.items && Array.isArray(node.items)) {
      for (const child of node.items) {
        if (findAndCancel(child)) {
          return true;
        }
      }
    }

    return false;
  }

  findAndCancel(newDoc);
  bumpRevision(newDoc);
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
    bumpRevision(newDoc);
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
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Grouping container types whose children move up to the parent level
 * automatically when the container itself is deleted, instead of being
 * discarded along with it (see `deleteNode` below).
 */
const PROMOTABLE_CONTAINER_TYPES = new Set(['Section', 'CollapsibleSection', 'Tab']);

/**
 * Deletes a node from the hierarchy. Deleting a grouping container (Section,
 * CollapsibleSection, Tab) promotes its children to the parent level in its
 * place, rather than discarding them.
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the node to delete
 * @returns Updated XtformDocument
 */
export function deleteNode(doc: XtformDocument, uuid: string): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone
  deleteNodeInPlace(newDoc, uuid);
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Mutates `root` (an already-cloned, mutable tree) to remove the node with
 * the given uuid, applying the same container-promotion rule as
 * `deleteNode`. Shared by `deleteNode` and the added/removed field
 * resolution below, which may need to delete more than one node — an
 * "accepted" removal and a paired "rejected" addition, say — within a
 * single clone.
 *
 * @returns Whether a node was found and removed
 */
function deleteNodeInPlace(root: XtformNode | XtformDocument, uuid: string): boolean {
  if (!root.items || !Array.isArray(root.items)) {
    return false;
  }

  const index = root.items.findIndex(child => child.uuid === uuid);
  if (index !== -1) {
    const [removed] = root.items.splice(index, 1);
    if (PROMOTABLE_CONTAINER_TYPES.has(removed.type) && Array.isArray(removed.items)) {
      root.items.splice(index, 0, ...removed.items);
    }
    return true;
  }

  for (const child of root.items) {
    if (deleteNodeInPlace(child, uuid)) {
      return true;
    }
  }

  return false;
}

/**
 * Strips the `:new` suffix a proposed "added" item's uuid carries while its
 * `changes.status` is `added` — see spec/xtdraft-format.md ("Added /
 * Removed"). Unchanged if the uuid has no such suffix.
 */
function stripNewSuffix(uuid: string): string {
  return uuid.endsWith(':new') ? uuid.slice(0, -4) : uuid;
}

/**
 * Resolves a single `added` or `removed` item per spec/xtdraft-format.md
 * ("Added / Removed"): `accept` on `added` clears `changes` and strips
 * `:new` from its uuid (the item becomes permanent); `accept` on `removed`
 * deletes it; `reject` on `added` deletes it; `reject` on `removed` clears
 * `changes` (the item is restored). Mutates `root` in place.
 *
 * The root document is a component like any other and can carry the same
 * `added`/`removed` status (`XtformRootChanges`), but has no parent to
 * delete it from — resolving that case just clears its own status instead.
 */
function resolveOneAddedRemovedItem(
  root: XtformDocument,
  uuid: string,
  status: 'added' | 'removed',
  action: 'accept' | 'reject'
): void {
  if (status === 'added' && action === 'accept') {
    const node = findMutableNode(root, uuid);
    if (node) {
      clearNodeChangeStatus(node);
      node.uuid = stripNewSuffix(node.uuid);
    }
    return;
  }

  if (status === 'removed' && action === 'reject') {
    const node = findMutableNode(root, uuid);
    if (node) {
      clearNodeChangeStatus(node);
    }
    return;
  }

  // 'added' + reject, or 'removed' + accept: the item goes away either way
  if (uuid === root.uuid) {
    clearNodeChangeStatus(root);
    return;
  }
  deleteNodeInPlace(root, uuid);
}

/**
 * Resolves an `added` or `removed` item — see spec/xtdraft-format.md
 * ("Added / Removed") — and, per its "Paired items" rule, automatically
 * applies the same `action` to its paired counterpart if one exists: for an
 * `added` item `{base-uuid}:new`, that's a `removed` item `{base-uuid}`
 * (and vice versa). Applying the same action to both resolves a
 * rename/replace pair consistently — e.g. accepting the new value also
 * finalizes deletion of the old one; rejecting the new value also restores
 * the old one.
 *
 * @param doc - XtformDocument to update
 * @param uuid - UUID of the added/removed item the user acted on
 * @param action - 'accept' or 'reject', from the item's status popup
 * @returns Updated XtformDocument (unchanged if the item isn't `added`/`removed`)
 */
export function resolveAddedRemovedItem(
  doc: XtformDocument,
  uuid: string,
  action: 'accept' | 'reject'
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  const acted = findMutableNode(newDoc, uuid) as XtformNode | null;
  const actedStatus = acted?.changes?.status;
  if (!acted || (actedStatus !== 'added' && actedStatus !== 'removed')) {
    return newDoc;
  }

  const baseUuid = actedStatus === 'added' ? stripNewSuffix(acted.uuid) : acted.uuid;
  const pairUuid = actedStatus === 'added' ? baseUuid : `${baseUuid}:new`;
  const pairStatus: 'added' | 'removed' = actedStatus === 'added' ? 'removed' : 'added';

  const pair = findMutableNode(newDoc, pairUuid) as XtformNode | null;
  const hasPair = !!pair && pair.uuid !== acted.uuid && pair.changes?.status === pairStatus;

  resolveOneAddedRemovedItem(newDoc, acted.uuid, actedStatus, action);
  if (hasPair) {
    resolveOneAddedRemovedItem(newDoc, pairUuid, pairStatus, action);
  }

  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Collects every item (at any depth below the root) carrying a
 * `changes.status`, in document order. Does not include the root document's
 * own status — `acceptAllChanges`/`rejectAllChanges` check that separately,
 * since resolving it needs different handling (the root has no parent to
 * delete it from).
 */
function collectChangedNodes(root: XtformNode | XtformDocument, out: XtformNode[] = []): XtformNode[] {
  if (Array.isArray(root.items)) {
    for (const child of root.items) {
      if (child.changes?.status) {
        out.push(child);
      }
      collectChangedNodes(child, out);
    }
  }
  return out;
}

/**
 * Accepts every pending change in the document at once — see
 * spec/xtdraft-format.md ("Accept All"): for each item with
 * `changes.status` at any depth, `added` is kept (clearing `changes` and
 * stripping `:new` from its uuid), `removed` is deleted, and `modified`
 * keeps its already-current values (clearing `changes`). The root document
 * is a component like any other and can carry its own `added`/`removed`/
 * `modified` status too (`XtformRootChanges`) — it's resolved the same way,
 * except `removed`/`added` can't delete or recreate the document itself, so
 * only its own status is cleared. Finally strips the root's `changes.*`
 * fields (`kind` and any other generator metadata) now that every pending
 * change is resolved. Like `acceptModifiedField`/`resolveAddedRemovedItem`,
 * this is a mechanical write the Viewer performs itself, not an Agent
 * command.
 *
 * @param doc - XtformDocument to update
 * @returns Updated XtformDocument
 */
export function acceptAllChanges(doc: XtformDocument): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  if (newDoc.changes?.status === 'added') {
    newDoc.uuid = stripNewSuffix(newDoc.uuid);
  }

  // Deletions are collected up front and applied after the walk, since
  // splicing a node out of `items` mid-traversal would disturb it.
  const toDelete: string[] = [];
  for (const node of collectChangedNodes(newDoc)) {
    if (node.changes?.status === 'removed') {
      toDelete.push(node.uuid);
      continue;
    }
    if (node.changes?.status === 'added') {
      node.uuid = stripNewSuffix(node.uuid);
    }
    delete (node as any).changes;
  }
  for (const uuid of toDelete) {
    deleteNodeInPlace(newDoc, uuid);
  }

  delete (newDoc as any).changes;
  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Rejects every pending change in the document at once — see
 * spec/xtdraft-format.md ("Reject All"): for each item with
 * `changes.status` at any depth, `added` is deleted, `removed` is kept
 * (clearing `changes`), and `modified` is restored to its `changes.prev`
 * snapshot (clearing `changes`). The root document is a component like any
 * other and can carry its own `added`/`removed`/`modified` status too
 * (`XtformRootChanges`) — it's resolved the same way, except `added` can't
 * delete the document itself, so only its own status is cleared. Finally
 * strips the root's `changes.*` fields (`kind` and any other generator
 * metadata) now that every pending change is resolved. Like
 * `cancelModifiedField`/`resolveAddedRemovedItem`, this is a mechanical
 * write the Viewer performs itself, not an Agent command.
 *
 * @param doc - XtformDocument to update
 * @returns Updated XtformDocument
 */
export function rejectAllChanges(doc: XtformDocument): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  if (newDoc.changes?.status === 'modified' && newDoc.changes.prev) {
    restoreFromPrev(newDoc, newDoc.changes.prev);
  }

  const toDelete: string[] = [];
  for (const node of collectChangedNodes(newDoc)) {
    const status = node.changes?.status;
    if (status === 'added') {
      toDelete.push(node.uuid);
      continue;
    }
    if (status === 'modified' && node.changes?.prev) {
      restoreFromPrev(node, node.changes.prev);
    }
    delete (node as any).changes;
  }
  for (const uuid of toDelete) {
    deleteNodeInPlace(newDoc, uuid);
  }

  delete (newDoc as any).changes;
  bumpRevision(newDoc);
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

/**
 * Finds a node by UUID within an already-cloned (mutable) tree.
 * Shared by the Table row/cell mutators below.
 */
function findMutableNode(
  root: XtformNode | XtformDocument,
  uuid: string
): XtformNode | XtformDocument | null {
  if (root.uuid === uuid) {
    return root;
  }

  if (root.items && Array.isArray(root.items)) {
    for (const child of root.items) {
      const found = findMutableNode(child, uuid);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

/**
 * Adds a new record to a Table component's `data` array
 *
 * @param doc - XtformDocument to update
 * @param tableUuid - UUID of the Table node
 * @param row - Row to append, e.g. `{ uuid, props: {}, data: {} }`
 * @returns Updated XtformDocument
 */
export function addTableRow(
  doc: XtformDocument,
  tableUuid: string,
  row: XtformTableRow
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  const table = findMutableNode(newDoc, tableUuid) as XtformNode | null;
  if (table) {
    if (!Array.isArray(table.data)) {
      table.data = [];
    }
    table.data.push(row);
  }

  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Removes a record from a Table component's `data` array
 *
 * @param doc - XtformDocument to update
 * @param tableUuid - UUID of the Table node
 * @param rowUuid - UUID of the record to remove
 * @returns Updated XtformDocument
 */
export function deleteTableRow(
  doc: XtformDocument,
  tableUuid: string,
  rowUuid: string
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  const table = findMutableNode(newDoc, tableUuid) as XtformNode | null;
  if (table && Array.isArray(table.data)) {
    table.data = table.data.filter((row: XtformTableRow) => row.uuid !== rowUuid);
  }

  bumpRevision(newDoc);
  return newDoc;
}

/**
 * Updates a single cell value within a Table component's record
 *
 * @param doc - XtformDocument to update
 * @param tableUuid - UUID of the Table node
 * @param rowUuid - UUID of the record to update
 * @param columnUuid - UUID of the column (child node of the Table) being edited
 * @param value - New cell value
 * @returns Updated XtformDocument
 */
export function updateTableCell(
  doc: XtformDocument,
  tableUuid: string,
  rowUuid: string,
  columnUuid: string,
  value: any
): XtformDocument {
  const newDoc = JSON.parse(JSON.stringify(doc)); // Deep clone

  const table = findMutableNode(newDoc, tableUuid) as XtformNode | null;
  const row = table && Array.isArray(table.data)
    ? table.data.find((r: XtformTableRow) => r.uuid === rowUuid)
    : undefined;
  if (row) {
    if (!row.data) {
      row.data = {};
    }
    row.data[columnUuid] = value;
  }

  bumpRevision(newDoc);
  return newDoc;
}
