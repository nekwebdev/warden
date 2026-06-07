import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	formatPackageOperationReport,
	formatTaggedPackageUpdateReport,
	installPackage,
	removePackages,
	updateTaggedNpmPackages,
} from "../extensions/warden-packages/operations.js";

describe("package operations", () => {
	it("installs through injected package manager", async () => {
		const calls: string[] = [];
		const result = await installPackage("npm:a", {
			packageManager: {
				async install() {
					throw new Error("unused");
				},
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
				async install() {
					throw new Error("unused");
				},
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

	it("updates tagged npm packages after install succeeds and preserves other entries", async () => {
		const installCalls: string[] = [];
		const writes: unknown[][] = [];
		const settingsManager = {
			getGlobalSettings: () => ({
				packages: [
					"npm:left-pad@latest",
					"npm:untagged",
					{ source: "npm:@scope/pkg@^1", extensions: [], custom: true },
					"git:github.com/user/repo@v1",
				],
			}),
			setPackages(packages: unknown[]) {
				writes.push(packages);
			},
			async flush() {},
		};

		const results = await updateTaggedNpmPackages({
			settingsManager,
			packageManager: {
				async install(source) {
					installCalls.push(source);
				},
				async installAndPersist() {
					throw new Error("unused");
				},
				async removeAndPersist() {
					throw new Error("unused");
				},
			},
			async resolveLatestVersion(name) {
				return name === "left-pad" ? "1.3.0" : "2.0.0";
			},
		});

		assert.deepEqual(installCalls, [
			"npm:left-pad@1.3.0",
			"npm:@scope/pkg@2.0.0",
		]);
		assert.deepEqual(writes, [
			[
				"npm:left-pad@1.3.0",
				"npm:untagged",
				{ source: "npm:@scope/pkg@2.0.0", extensions: [], custom: true },
				"git:github.com/user/repo@v1",
			],
		]);
		assert.deepEqual(results, [
			{
				action: "update",
				source: "npm:left-pad@latest",
				newSource: "npm:left-pad@1.3.0",
				ok: true,
				changed: true,
			},
			{
				action: "update",
				source: "npm:@scope/pkg@^1",
				newSource: "npm:@scope/pkg@2.0.0",
				ok: true,
				changed: true,
			},
		]);
	});

	it("keeps failed entries unchanged and reports unchanged tagged packages", async () => {
		const installCalls: string[] = [];
		const writes: unknown[][] = [];
		const settingsManager = {
			getGlobalSettings: () => ({
				packages: ["npm:already@1.0.0", "npm:broken@beta"],
			}),
			setPackages(packages: unknown[]) {
				writes.push(packages);
			},
			async flush() {},
		};

		const results = await updateTaggedNpmPackages({
			settingsManager,
			packageManager: {
				async install(source) {
					installCalls.push(source);
					throw new Error("install failed");
				},
				async installAndPersist() {
					throw new Error("unused");
				},
				async removeAndPersist() {
					throw new Error("unused");
				},
			},
			async resolveLatestVersion(name) {
				return name === "already" ? "1.0.0" : "2.0.0";
			},
		});

		assert.deepEqual(installCalls, ["npm:broken@2.0.0"]);
		assert.deepEqual(writes, []);
		assert.deepEqual(results, [
			{
				action: "update",
				source: "npm:already@1.0.0",
				newSource: "npm:already@1.0.0",
				ok: true,
				changed: false,
			},
			{
				action: "update",
				source: "npm:broken@beta",
				newSource: "npm:broken@2.0.0",
				ok: false,
				error: "install failed",
			},
		]);
	});

	it("formats tagged package update reports", () => {
		assert.match(
			formatTaggedPackageUpdateReport([]),
			/No tagged npm packages found\./,
		);
		const report = formatTaggedPackageUpdateReport([
			{
				action: "update",
				source: "npm:left-pad@latest",
				newSource: "npm:left-pad@1.3.0",
				ok: true,
				changed: true,
			},
			{
				action: "update",
				source: "npm:already@1.0.0",
				newSource: "npm:already@1.0.0",
				ok: true,
				changed: false,
			},
			{
				action: "update",
				source: "npm:broken@beta",
				newSource: "npm:broken@2.0.0",
				ok: false,
				error: "install failed",
			},
		]);

		assert.match(report, /^## Warden tagged package update report/);
		assert.match(report, /- ✅ npm:left-pad@latest -> npm:left-pad@1\.3\.0/);
		assert.match(report, /- ℹ️ npm:already@1\.0\.0 unchanged/);
		assert.match(
			report,
			/- ❌ npm:broken@beta -> npm:broken@2\.0\.0: install failed/,
		);
		assert.match(report, /Restart Pi to load package changes\./);
	});
});
