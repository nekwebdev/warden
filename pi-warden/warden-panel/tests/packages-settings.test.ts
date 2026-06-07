import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	normalizePackageEntries,
	parseTaggedNpmPackageSource,
	replacePackageEntrySource,
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

	it("detects only tagged npm package sources", () => {
		assert.deepEqual(parseTaggedNpmPackageSource("npm:@foo/bar@1.0.0"), {
			name: "@foo/bar",
			tag: "1.0.0",
		});
		assert.deepEqual(parseTaggedNpmPackageSource("npm:left-pad@latest"), {
			name: "left-pad",
			tag: "latest",
		});
		assert.deepEqual(parseTaggedNpmPackageSource("npm:@scope/pkg@^1"), {
			name: "@scope/pkg",
			tag: "^1",
		});
		assert.equal(parseTaggedNpmPackageSource("npm:@foo/bar"), undefined);
		assert.equal(parseTaggedNpmPackageSource("npm:left-pad"), undefined);
		assert.equal(
			parseTaggedNpmPackageSource("git:github.com/user/repo@v1"),
			undefined,
		);
	});

	it("rewrites string and object package sources without losing fields", () => {
		assert.equal(
			replacePackageEntrySource("npm:left-pad@latest", "npm:left-pad@1.3.0"),
			"npm:left-pad@1.3.0",
		);
		assert.deepEqual(
			replacePackageEntrySource(
				{ source: "npm:left-pad@latest", extensions: [], custom: true },
				"npm:left-pad@1.3.0",
			),
			{ source: "npm:left-pad@1.3.0", extensions: [], custom: true },
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
