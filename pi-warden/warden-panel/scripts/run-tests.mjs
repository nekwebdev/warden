import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const panelTestFiles = [
	"tests/package-manifest.test.ts",
	"tests/settings.test.ts",
	"tests/glyphs.test.ts",
	"tests/registry.test.ts",
	"tests/display-pane.test.ts",
	"tests/panel.test.ts",
	"tests/packages-settings.test.ts",
	"tests/packages-pane.test.ts",
	"tests/packages-operations.test.ts",
	"tests/packages-index.test.ts",
	"tests/index.test.ts",
];

const missingPanelTests = panelTestFiles.filter((file) => !existsSync(file));
if (missingPanelTests.length !== 0) {
	console.error("Missing warden-panel test files:");
	for (const file of missingPanelTests) console.error(`- ${file}`);
	process.exit(1);
}

const nodeArgs = [
	"--import",
	"tsx",
	"--test",
	...process.argv.slice(2),
	...panelTestFiles,
];
const { status } = spawnSync(process.execPath, nodeArgs, { stdio: "inherit" });
process.exit(status ?? 1);
