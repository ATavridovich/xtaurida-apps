/**
 * XTForm document model
 */

/**
 * Represents a parsed .xtform document
 */
export interface XtformDocument {
  /** Form UUID */
  uuid: string;

  /** Form metadata (title, description, version, etc.) */
  meta: Record<string, any>;

  /** Field data keyed by field UUID */
  data: Record<string, any>;

  /** Template content (after second ---) */
  template: string;

  /** Raw YAML frontmatter string */
  rawYaml: string;
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
