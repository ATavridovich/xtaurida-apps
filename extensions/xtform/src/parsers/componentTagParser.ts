/**
 * Component tag parser for .xtform templates
 */

/**
 * Represents a parsed component tag
 */
export interface ComponentTag {
  /** Component type (e.g., "Section", "TextInput") */
  type: string;

  /** Component UUID */
  uuid: string;

  /** Display label */
  label?: string;

  /** All tag attributes */
  attributes: Record<string, string>;

  /** Child components (for container tags) */
  children?: ComponentTag[];

  /** Whether this is a self-closing tag */
  selfClosing: boolean;
}

/**
 * Token types for component tag parsing
 */
enum TokenType {
  OPEN_TAG,      // [% ComponentName ...
  CLOSE_TAG,     // [% /ComponentName
  SELF_CLOSING,  // [% ComponentName ... /%]
  TEXT           // Everything else
}

interface Token {
  type: TokenType;
  componentType?: string;
  attributes?: Record<string, string>;
  raw: string;
  position: number;
}

/**
 * Parses component tags from template content
 *
 * @param template - Template content containing component tags
 * @returns Array of root-level ComponentTag objects
 */
export function parseComponentTags(template: string): ComponentTag[] {
  const tokens = tokenize(template);
  const { components } = buildTree(tokens, 0);
  return components;
}

/**
 * Tokenizes template content into component tag tokens
 */
function tokenize(template: string): Token[] {
  const tokens: Token[] = [];
  const tagPattern = /\[%\s*(\/?)(\w+)(.*?)\s*(\/)?\s*%\]/gs;

  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(template)) !== null) {
    const [fullMatch, closingSlash, componentType, attributesStr, selfClosingSlash] = match;
    const position = match.index;

    if (closingSlash) {
      // Closing tag: [% /ComponentName %]
      tokens.push({
        type: TokenType.CLOSE_TAG,
        componentType,
        raw: fullMatch,
        position
      });
    } else if (selfClosingSlash) {
      // Self-closing tag: [% ComponentName ... /%]
      const attributes = parseAttributes(attributesStr.trim());
      tokens.push({
        type: TokenType.SELF_CLOSING,
        componentType,
        attributes,
        raw: fullMatch,
        position
      });
    } else {
      // Opening tag: [% ComponentName ... %]
      const attributes = parseAttributes(attributesStr.trim());
      tokens.push({
        type: TokenType.OPEN_TAG,
        componentType,
        attributes,
        raw: fullMatch,
        position
      });
    }
  }

  return tokens;
}

/**
 * Parses attributes from attribute string
 * Supports: key="value", key='value', key={expr}
 */
function parseAttributes(attributeStr: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  if (!attributeStr) {
    return attributes;
  }

  // Pattern to match: key="value" or key='value' or key={value}
  const attrPattern = /(\w+(?:\.\w+)*)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g;

  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attributeStr)) !== null) {
    const [, key, doubleQuoted, singleQuoted, braced] = match;
    const value = doubleQuoted ?? singleQuoted ?? braced ?? '';
    attributes[key] = value;
  }

  return attributes;
}

/**
 * Builds component tree from tokens
 */
function buildTree(
  tokens: Token[],
  startIndex: number
): { components: ComponentTag[]; nextIndex: number } {
  const components: ComponentTag[] = [];
  let i = startIndex;

  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === TokenType.CLOSE_TAG) {
      // End of current container
      return { components, nextIndex: i + 1 };
    }

    if (token.type === TokenType.SELF_CLOSING) {
      // Self-closing tag - no children
      if (!token.componentType || !token.attributes) {
        i++;
        continue;
      }

      const component: ComponentTag = {
        type: token.componentType,
        uuid: token.attributes.uuid || '',
        label: token.attributes.label,
        attributes: token.attributes,
        selfClosing: true
      };

      components.push(component);
      i++;
    } else if (token.type === TokenType.OPEN_TAG) {
      // Opening tag - may have children
      if (!token.componentType || !token.attributes) {
        i++;
        continue;
      }

      // Recursively parse children
      const { components: children, nextIndex } = buildTree(tokens, i + 1);

      const component: ComponentTag = {
        type: token.componentType,
        uuid: token.attributes.uuid || '',
        label: token.attributes.label,
        attributes: token.attributes,
        children,
        selfClosing: false
      };

      components.push(component);
      i = nextIndex;
    } else {
      i++;
    }
  }

  return { components, nextIndex: i };
}

/**
 * Finds a component by UUID in the component tree
 *
 * @param components - Array of components to search
 * @param uuid - UUID to find
 * @returns ComponentTag if found, undefined otherwise
 */
export function findComponentByUuid(
  components: ComponentTag[],
  uuid: string
): ComponentTag | undefined {
  for (const component of components) {
    if (component.uuid === uuid) {
      return component;
    }

    if (component.children) {
      const found = findComponentByUuid(component.children, uuid);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}

/**
 * Gets all UUIDs from component tree (flattened)
 *
 * @param components - Array of components
 * @returns Array of all UUIDs
 */
export function getAllUuids(components: ComponentTag[]): string[] {
  const uuids: string[] = [];

  for (const component of components) {
    if (component.uuid) {
      uuids.push(component.uuid);
    }

    if (component.children) {
      uuids.push(...getAllUuids(component.children));
    }
  }

  return uuids;
}
