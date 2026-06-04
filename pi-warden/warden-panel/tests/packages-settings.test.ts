import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	normalizePackageEntries,
	readGlobalPackageEntries,
	validateInstallSource,
	type GlobalSettingsReader,
} from "../extensions/warden-packages/packages.js";

describe("package settings parsing", () => {
	it("normalizes string and filtered object package entries", () => {
		assert.deepEqual(
			normalizePackageEntries([
				"npm:@foo/bar@1.0.0",
				{ source: "git:github.com/user/repo@v1", extensions: [] },
				42,
				{ source: 42 },
				"",
			]),
			[
				{
					id: "0:npm:@foo/bar@1.0.0",
					index: 0,
					source: "npm:@foo/bar@1.0.0",
					filtered: false,
					raw: "npm:@foo/bar@1.0.0",
				},
				{
					id: "1:git:github.com/user/repo@v1",
					index: 1,
					source: "git:github.com/user/repo@v1",
					filtered: true,
					raw: { source: "git:github.com/user/repo@v1", extensions: [] },
				},
			],
		);
	});

	it("treats missing or malformed packages as empty", () => {
		assert.deepEqual(normalizePackageEntries(undefined), []);
		assert.deepEqual(normalizePackageEntries({}), []);
	});

	it("reads global settings only", () => {
		const reader: GlobalSettingsReader = {
			getGlobalSettings: () => ({ packages: ["npm:global"] }),
		};

		assert.deepEqual(
			readGlobalPackageEntries(reader).map((entry) => entry.source),
			["npm:global"],
		);
	});
});

describe("install source validation", () => {
	it("accepts any one-line source and trims whitespace", () => {
		assert.deepEqual(validateInstallSource(" npm:@foo/bar "), {
			ok: true,
			source: "npm:@foo/bar",
		});
		assert.deepEqual(validateInstallSource("git:github.com/user/repo@v1"), {
			ok: true,
			source: "git:github.com/user/repo@v1",
		});
		assert.deepEqual(validateInstallSource("./relative/path"), {
			ok: true,
			source: "./relative/path",
		});
	});

	it("rejects blank and multiline sources", () => {
		assert.deepEqual(validateInstallSource("   "), {
			ok: false,
			message: "Package source is required.",
		});
		assert.deepEqual(validateInstallSource("npm:a\nnpm:b"), {
			ok: false,
			message: "Package source must be a single line.",
		});
	});
});
