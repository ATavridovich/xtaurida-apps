/**
 * XTForm document model
 */

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

  /** Current data - scalar or list of records (for data fields) */
  data?: any;
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

  /** AI behaviour instructions - see Instructions section */
  instructions?: Record<string, string>;

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
