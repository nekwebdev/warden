import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const themePath = resolve(packageRoot, "themes", "warden-catppuccin-mocha.json");
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
const catppuccinMochaVars = {
	rosewater: "#f5e0dc",
	flamingo: "#f2cdcd",
	pink: "#f5c2e7",
	mauve: "#cba6f7",
	red: "#f38ba8",
	maroon: "#eba0ac",
	peach: "#fab387",
	yellow: "#f9e2af",
	green: "#a6e3a1",
	teal: "#94e2d5",
	sky: "#89dceb",
	sapphire: "#74c7ec",
	blue: "#89b4fa",
	lavender: "#b4befe",
	text: "#cdd6f4",
	subtext1: "#bac2de",
	subtext0: "#a6adc8",
	overlay2: "#9399b2",
	overlay1: "#7f849c",
	overlay0: "#6c7086",
	surface2: "#585b70",
	surface1: "#45475a",
	surface0: "#313244",
	base: "#1e1e2e",
	mantle: "#181825",
	crust: "#11111b",
};

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
			"themes/warden-catppuccin-mocha.json",
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
			"themes/warden-catppuccin-mocha.json",
		]);
	});
});

describe("warden-catppuccin-mocha theme JSON", () => {
	it("defines all current Pi theme color tokens and only those tokens", () => {
		assert.ok(
			existsSync(themePath),
			"themes/warden-catppuccin-mocha.json should exist",
		);
		const theme = readJson(themePath);
		assert.equal(
			theme.$schema,
			"https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
		);
		assert.equal(theme.name, "warden-catppuccin-mocha");
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

	it("defines official Catppuccin Mocha palette vars", () => {
		const theme = readJson(themePath);
		assert.deepEqual(theme.vars, catppuccinMochaVars);
	});

	it("uses valid color values and defined variable references", () => {
		const theme = readJson(themePath);
		const vars = theme.vars ?? {};
		const definedVars = new Set(Object.keys(vars));
		assert.ok(
			definedVars.size > 0,
			"vars should define reusable palette names",
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

	it("references Catppuccin Mocha vars from colors and export colors", () => {
		const theme = readJson(themePath);
		const definedVars = new Set(Object.keys(theme.vars ?? {}));
		for (const [sectionName, values] of Object.entries({
			colors: theme.colors ?? {},
			export: theme.export ?? {},
		})) {
			for (const [name, value] of Object.entries(values)) {
				assert.equal(
					typeof value,
					"string",
					`${sectionName}.${name} should be a variable reference`,
				);
				assert.ok(
					definedVars.has(value),
					`${sectionName}.${name} should reference a Catppuccin Mocha var`,
				);
			}
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
	it("documents Catppuccin Mocha color vars and manual loading", () => {
		assert.ok(existsSync(readmePath), "README.md should exist");
		const readme = readFileSync(readmePath, "utf-8");

		assert.match(readme, /Catppuccin Mocha/i);
		assert.match(readme, /dark transparent terminals/i);
		assert.match(readme, /official Catppuccin Mocha hex values/i);
		assert.match(readme, /`#rrggbb`.*explicit RGB/i);
		assert.match(readme, /Vars can name reusable values/i);
		for (const [name, value] of Object.entries(catppuccinMochaVars)) {
			assert.ok(
				readme.includes(`| \`${name}\` | \`${value}\` | Catppuccin Mocha |`),
				`${name} should be documented with its Catppuccin Mocha value`,
			);
		}
		assert.match(readme, /pi -e \.\/pi-warden\/warden-theme/);
		assert.match(
			readme,
			/pi --theme \.\/pi-warden\/warden-theme\/themes\/warden-catppuccin-mocha\.json/,
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
