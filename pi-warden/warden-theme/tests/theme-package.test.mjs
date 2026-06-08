import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themePath = resolve(packageRoot, "themes", "warden-terminal.json");
const readmePath = resolve(packageRoot, "README.md");
const pkg = JSON.parse(
	readFileSync(resolve(packageRoot, "package.json"), "utf-8"),
);

const requiredColorTokens = [
	"accent",
	"border",
	"borderAccent",
	"borderMuted",
	"success",
	"error",
	"warning",
	"muted",
	"dim",
	"text",
	"thinkingText",
	"selectedBg",
	"userMessageBg",
	"userMessageText",
	"customMessageBg",
	"customMessageText",
	"customMessageLabel",
	"toolPendingBg",
	"toolSuccessBg",
	"toolErrorBg",
	"toolTitle",
	"toolOutput",
	"mdHeading",
	"mdLink",
	"mdLinkUrl",
	"mdCode",
	"mdCodeBlock",
	"mdCodeBlockBorder",
	"mdQuote",
	"mdQuoteBorder",
	"mdHr",
	"mdListBullet",
	"toolDiffAdded",
	"toolDiffRemoved",
	"toolDiffContext",
	"syntaxComment",
	"syntaxKeyword",
	"syntaxFunction",
	"syntaxVariable",
	"syntaxString",
	"syntaxNumber",
	"syntaxType",
	"syntaxOperator",
	"syntaxPunctuation",
	"thinkingOff",
	"thinkingMinimal",
	"thinkingLow",
	"thinkingMedium",
	"thinkingHigh",
	"thinkingXhigh",
	"bashMode",
];

const requiredColorSet = new Set(requiredColorTokens);
const optionalExportKeys = ["pageBg", "cardBg", "infoBg"];
const optionalExportSet = new Set(optionalExportKeys);
const hexPattern = /^#[0-9a-fA-F]{6}$/;

function readJson(path) {
	return JSON.parse(readFileSync(path, "utf-8"));
}

function assertColorValue(value, label, definedVars, allowVars = true) {
	if (Number.isInteger(value)) {
		assert.ok(value >= 0 && value <= 255, `${label} integer must be 0-255`);
		return;
	}

	assert.equal(typeof value, "string", `${label} must be string or integer`);
	if (value === "" || hexPattern.test(value)) return;
	if (allowVars && definedVars.has(value)) return;
	assert.fail(
		`${label} references unknown variable or invalid color: ${value}`,
	);
}

describe("warden-theme package manifest", () => {
	it("declares Pi theme package identity and loading metadata", () => {
		assert.equal(pkg.name, "@nekwebdev/warden-theme");
		assert.equal(pkg.type, "module");
		assert.equal(pkg.scripts?.test, "node scripts/run-tests.mjs");
		assert.ok(pkg.keywords?.includes("pi-package"));
		assert.deepEqual(pkg.pi?.themes, ["./themes"]);
	});

	it("packs only intended package resources", () => {
		for (const entry of [
			"README.md",
			"AGENTS.md",
			"LICENSE",
			"themes/warden-terminal.json",
			"scripts/run-tests.mjs",
			"tests/theme-package.test.mjs",
		]) {
			assert.ok(
				existsSync(resolve(packageRoot, entry)),
				`${entry} should exist`,
			);
		}

		const result = spawnSync("npm", ["pack", "--dry-run", "--json"], {
			cwd: packageRoot,
			encoding: "utf-8",
		});

		assert.equal(result.status, 0, result.stderr || result.stdout);
		const [packument] = JSON.parse(result.stdout);
		assert.equal(packument.name, "@nekwebdev/warden-theme");
		const files = packument.files.map((file) => file.path).sort();
		assert.deepEqual(files, [
			"AGENTS.md",
			"LICENSE",
			"README.md",
			"package.json",
			"scripts/run-tests.mjs",
			"tests/theme-package.test.mjs",
			"themes/warden-terminal.json",
		]);
	});
});

describe("warden-terminal theme JSON", () => {
	it("defines all current Pi theme color tokens and only those tokens", () => {
		assert.ok(
			existsSync(themePath),
			"themes/warden-terminal.json should exist",
		);
		const theme = readJson(themePath);
		assert.equal(
			theme.$schema,
			"https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
		);
		assert.equal(theme.name, "warden-terminal");
		assert.equal(typeof theme.vars, "object");
		assert.equal(Array.isArray(theme.vars), false);
		assert.equal(typeof theme.colors, "object");

		const actualColorTokens = Object.keys(theme.colors).sort();
		assert.deepEqual(actualColorTokens, [...requiredColorTokens].sort());
		for (const token of requiredColorTokens) {
			assert.ok(token in theme.colors, `${token} should be defined`);
		}
		for (const token of actualColorTokens) {
			assert.ok(
				requiredColorSet.has(token),
				`${token} should be a known required Pi color token`,
			);
		}
	});

	it("uses valid color values and defined variable references", () => {
		const theme = readJson(themePath);
		const vars = theme.vars ?? {};
		const definedVars = new Set(Object.keys(vars));
		assert.ok(
			definedVars.size > 0,
			"vars should define reusable terminal palette names",
		);

		for (const [name, value] of Object.entries(vars)) {
			assertColorValue(value, `vars.${name}`, definedVars, false);
		}
		for (const [name, value] of Object.entries(theme.colors ?? {})) {
			assertColorValue(value, `colors.${name}`, definedVars, true);
		}
		for (const [name, value] of Object.entries(theme.export ?? {})) {
			assertColorValue(value, `export.${name}`, definedVars, true);
		}
	});

	it("defines only supported optional HTML export colors", () => {
		const theme = readJson(themePath);
		assert.deepEqual(
			Object.keys(theme.export ?? {}).sort(),
			optionalExportKeys.sort(),
		);
		for (const key of Object.keys(theme.export ?? {})) {
			assert.ok(
				optionalExportSet.has(key),
				`${key} should be a supported export color`,
			);
		}
	});
});

describe("README theme inventory", () => {
	it("documents terminal-derived color value forms and manual loading", () => {
		assert.ok(existsSync(readmePath), "README.md should exist");
		const readme = readFileSync(readmePath, "utf-8");

		assert.match(
			readme,
			/terminal-derived.*Pi-referenceable terminal\/default\/palette values/i,
		);
		assert.match(readme, /not active terminal palette probing/i);
		assert.match(readme, /`""` means terminal default foreground\/background/i);
		assert.match(readme, /`0-15`.*terminal-dependent ANSI colors/i);
		assert.match(readme, /`16-231`.*fixed xterm RGB cube/i);
		assert.match(readme, /`232-255`.*xterm grayscale ramp/i);
		assert.match(readme, /`#rrggbb`.*explicit RGB/i);
		assert.match(readme, /Vars can name reusable values/i);
		assert.match(readme, /pi -e \.\/pi-warden\/warden-theme/);
		assert.match(
			readme,
			/pi --theme \.\/pi-warden\/warden-theme\/themes\/warden-terminal\.json/,
		);
	});

	it("maps every required Pi color token in the inventory table", () => {
		const readme = readFileSync(readmePath, "utf-8");
		for (const token of requiredColorTokens) {
			assert.ok(
				readme.includes(`| \`${token}\` |`),
				`${token} should be table-mapped`,
			);
		}
		for (const key of optionalExportKeys) {
			assert.ok(
				readme.includes(`| \`export.${key}\` |`),
				`export.${key} should be table-mapped`,
			);
		}
	});
});
