import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tests = [
	"tests/package-scaffold.test.mjs",
	"tests/agent-types.test.mjs",
	"tests/custom-agents.test.mjs",
	"tests/agent-runner.test.mjs",
	"tests/agent-manager.test.mjs",
];

const missing = tests.filter((file) => !existsSync(file));
if (missing.length > 0) {
	console.error(`Missing warden-subagents test files:\n${missing.join("\n")}`);
	process.exit(1);
}

const result = spawnSync(
	process.execPath,
	["--import", "tsx", "--test", ...process.argv.slice(2), ...tests],
	{ stdio: "inherit" },
);
process.exit(result.status ?? 1);
