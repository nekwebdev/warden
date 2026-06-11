import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const testFiles = ["tests/fresh-command.test.ts"];
const missing = testFiles.filter((file) => !existsSync(file));
if (missing.length !== 0) {
	console.error("Missing fresh-skill test files:");
	for (const file of missing) console.error(`- ${file}`);
	process.exit(1);
}

const { status } = spawnSync(
	process.execPath,
	["--import", "tsx", "--test", ...process.argv.slice(2), ...testFiles],
	{ stdio: "inherit" },
);
process.exit(status ?? 1);
