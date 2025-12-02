# XForm Extension

This is a built-in extension for VSCode that provides language support and editor registration for `.xtform` files.

## Files

- `package.json` - Extension manifest that registers the `xtform` language for `.xtform` files
- `language-configuration.json` - Language configuration (comments, brackets, etc.)
- `package.nls.json` - Localized strings
- `cgmanifest.json` - Component governance manifest

## Editor Registration

The actual editor registration is handled in `src/vs/workbench/contrib/xtform/browser/xtformEditor.contribution.ts`. This uses the `IEditorResolverService` to register a custom editor with ID `xtform.editor` for `.xtform` files.

## Conflict Avoidance

All custom code is isolated in:
1. `extensions/xtform/` - Extension directory (standard VSCode location)
2. `src/vs/workbench/contrib/xtform/` - Workbench contribution directory (isolated from upstream)

The editor uses:
- Unique editor ID: `xtform.editor` (namespaced to avoid conflicts)
- Standard `FileEditorInput` (uses existing text editor infrastructure)
- Priority: `RegisteredEditorPriority.default` (allows user overrides)

This ensures that merging upstream changes will not conflict with these additions.

