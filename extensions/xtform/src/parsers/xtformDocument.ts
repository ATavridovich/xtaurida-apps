/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * XTForm document model
 */

/**
 * Marks the root document as carrying a pending set of proposed changes —
 * see spec/xtdraft-format.md ("Detection"). Any `kind` value shows the
 * draft toolbar; the value itself is meaningful to whichever Agent proposed
 * the changes, not to the Viewer.
 */
export interface XtformRootChanges {
  kind: string;

  /** Additional generator metadata carried alongside `kind` (e.g. `generated_at`, `user_instructions`, `router`, `summary`) — round-tripped but not interpreted by the Viewer. */
  [key: string]: unknown;
}

/**
 * Snapshot of a node's previous field values, carried on `changes.prev` for
 * a `modified` item — see spec/xtdraft-format.md ("Modified fields"). Only
 * fields that actually changed are present; an absent field means it is
 * unchanged from its current value.
 */
export interface XtformItemChangesPrev {
  label?: string;
  description?: string;
  value?: any;
  options?: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  instructions?: Record<string, string>;
}

/**
 * Marks an individual item as part of a pending draft proposal — see
 * spec/xtdraft-format.md ("Rendering", "Field buttons"). Absent on items
 * that aren't part of a pending proposal (rendered with no special color).
 */
export interface XtformItemChanges {
  status: 'added' | 'removed' | 'modified';

  /** Previous field values — present (and meaningful) only when `status` is `modified`. */
  prev?: XtformItemChangesPrev;
}

/**
 * Represents a node in the XTForm hierarchy
 * All components (including the form itself) follow this structure
 */
export interface XtformNode {
  /** Component type (e.g., 'TextInput', 'Section', 'Tab') */
  type: string;

  /** Stable unique identifier */
  uuid: string;

  /** Display label */
  label?: string;

  /** Semantic description for AI context */
  description?: string;

  /** AI behavior instructions on events */
  instructions?: Record<string, string>;

  /** Layout width in px or % */
  width?: string;

  /** Alignment: left, center, or right */
  align?: 'left' | 'center' | 'right';

  /** Current field value (for scalar fields) */
  value?: any;

  /** Comma-separated list of options (for enum fields) */
  options?: string;

  /** Child elements or column definitions (for containers) */
  items?: XtformNode[];

  /** Current data - scalar or list of records (for data fields, e.g. Table) */
  data?: any;

  /** Pending draft proposal for this item — see `XtformItemChanges` */
  changes?: XtformItemChanges;
}

/**
 * A single record in a Table component's `data` array.
 * Field values are keyed by the uuid of the column definition (an
 * XtformNode in the Table's `items`) they belong to.
 */
export interface XtformTableRow {
  /** Stable record identifier */
  uuid: string;

  /** System properties - free map, not displayed */
  props?: Record<string, any>;

  /** Field values keyed by column uuid */
  data?: Record<string, any>;
}

/**
 * Represents a parsed .xtform document (root level)
 * The root is always type: Form and follows the same shape as XtformNode
 */
export interface XtformDocument {
  /** Always 'Form' for root node */
  type: 'Form';

  /** Stable unique identifier - never changes */
  uuid: string;

  /** Display name - filename used if absent */
  title?: string;

  /** Short summary of the form's purpose */
  description?: string;

  /** The user prompt or command that created this form */
  prompt?: string;

  /** Suggested next elaboration steps */
  elaborate_options?: string[];

  /** When true, the Viewer hides the form-header quick-actions menu for this form */
  disable_quick_actions?: boolean;

  /** When true, the Viewer shows the universal Apply button for this form */
  show_apply_action?: boolean;

  /** Bumped by the Viewer on every edit — see `applied_revision` */
  revision?: number;

  /** Snapshot of `revision` at the last successful Apply; null = never applied */
  applied_revision?: number | null;

  /** AI behaviour instructions - see Instructions section */
  instructions?: Record<string, string>;

  /** Presence of `changes.kind` signals a pending draft — see `XtformRootChanges` */
  changes?: XtformRootChanges;

  /** Child elements - sections and fields */
  items?: XtformNode[];
}

/**
 * Error thrown when parsing fails
 */
export class XtformParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'XtformParseError';
  }
}
