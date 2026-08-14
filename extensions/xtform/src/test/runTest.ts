import * as path from 'path';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test runner script
    const extensionTestsPath = path.resolve(__dirname, './index');

    console.log('Extension Development Path:', extensionDevelopmentPath);
    console.log('Extension Tests Path:', extensionTestsPath);

    // For now, just run tests without VS Code integration
    // Full integration would require @vscode/test-electron
    console.log('Running unit tests...');

    const testRunner = require(extensionTestsPath);
    await testRunner.run();

    console.log('All tests passed!');
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

main();
