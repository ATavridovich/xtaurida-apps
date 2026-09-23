/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Splits a Select/RadioGroup `options` string into its option list.
 *
 * The current format is multi-line text, one option per line, so an option
 * may itself contain commas. A value without any line break is the legacy
 * comma-separated format (`"Low,Medium,High"`) and is still read as such.
 * Surrounding whitespace is trimmed and blank entries are dropped.
 */
export function parseOptions(options: string | undefined | null): string[] {
  if (!options) {
    return [];
  }
  const separator = options.includes('\n') ? /\r?\n/ : ',';
  return options.split(separator).map(option => option.trim()).filter(option => option.length > 0);
}

/**
 * Formats an option list as multi-line `options` text: every option is
 * terminated by a line break, so even a single option (which may contain a
 * comma) is never mistaken for the legacy comma-separated format.
 */
export function formatOptions(options: readonly string[]): string {
  return options.map(option => `${option}\n`).join('');
}

/**
 * Normalizes text typed into the Options property editor (one option per
 * line) into the stored multi-line `options` format.
 */
export function normalizeOptionsText(text: string): string {
  return formatOptions(text.split(/\r?\n/).map(option => option.trim()).filter(option => option.length > 0));
}
