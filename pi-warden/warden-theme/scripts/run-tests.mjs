import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tests = ["tests/theme-package.test.mjs"];
const missing = tests.filter((file) => !existsSync(file));
if (missing.length > 0) {
	console.error(`Missing warden-theme test files:\n${missing.join("\n")}`);
	process.exit(1);
}

const result = spawnSync(
	process.execPath,
	["--test", ...process.argv.slice(2), ...tests],
	{
		stdio: "inherit",
	},
);
process.exit(result.status ?? 1);
