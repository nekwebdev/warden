import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatPackageOperationReport,
	installPackage,
	removePackages,
} from "../src/operations.js";

describe("package operations", () => {
	it("installs through injected package manager", async () => {
		const calls: string[] = [];
		const result = await installPackage("npm:a", {
			packageManager: {
				async installAndPersist(source) {
					calls.push(source);
				},
				async removeAndPersist() {
					throw new Error("unused");
				},
			},
		});

		assert.deepEqual(calls, ["npm:a"]);
		assert.deepEqual(result, {
			action: "install",
			source: "npm:a",
			ok: true,
			changed: true,
		});
	});

	it("removes packages sequentially and records failures", async () => {
		const calls: string[] = [];
		const results = await removePackages(["npm:a", "npm:b"], {
			packageManager: {
				async installAndPersist() {
					throw new Error("unused");
				},
				async removeAndPersist(source) {
					calls.push(source);
					if (source === "npm:b") throw new Error("boom");
					return true;
				},
			},
		});

		assert.deepEqual(calls, ["npm:a", "npm:b"]);
		assert.deepEqual(results, [
			{ action: "remove", source: "npm:a", ok: true, changed: true },
			{ action: "remove", source: "npm:b", ok: false, error: "boom" },
		]);
	});

	it("formats concise chat report with restart reminder", () => {
		const report = formatPackageOperationReport([
			{ action: "remove", source: "npm:a", ok: true, changed: true },
			{ action: "remove", source: "npm:b", ok: false, error: "boom" },
		]);

		assert.match(report, /^## Warden packages remove report/);
		assert.match(report, /- 1\/2 succeeded\./);
		assert.match(report, /- ✅ npm:a/);
		assert.match(report, /- ❌ npm:b: boom/);
		assert.match(report, /Restart Pi to load package changes\./);
	});
});
