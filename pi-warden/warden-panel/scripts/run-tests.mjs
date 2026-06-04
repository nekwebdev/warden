import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tests = [
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

const missing = tests.filter((file) => !existsSync(file));
if (missing.length > 0) {
	console.error(`Missing reviewed test files:\n${missing.join("\n")}`);
	process.exit(1);
}
const result = spawnSync(
	process.execPath,
	["--import", "tsx", "--test", ...process.argv.slice(2), ...tests],
	{ stdio: "inherit" },
);
process.exit(result.status ?? 1);
