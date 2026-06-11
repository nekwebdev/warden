import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const tests = [
  "tests/config.test.ts",
  "tests/agent-discovery.test.ts",
  "tests/protocol.test.ts",
  "tests/server-smoke.test.ts",
];

const missing = tests.filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error(`Missing warden-web test files:\n${missing.join("\n")}`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...process.argv.slice(2), ...tests], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
