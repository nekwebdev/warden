import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tests = [
	"tests/package-manifest.test.ts",
	"tests/warden-map-skill.test.ts",
	"tests/warden-start-skill.test.ts",
	"tests/map.test.ts",
	"tests/git.test.ts",
	"tests/commit.test.ts",
	"tests/effort.test.ts",
	"tests/effort-pane.test.ts",
	"tests/effort-runtime.test.ts",
	"tests/extension.test.ts",
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
