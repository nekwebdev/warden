import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skill = readFileSync(
	resolve(packageRoot, "skills/warden-map/SKILL.md"),
	"utf-8",
);

describe("warden-map skill contract", () => {
	it("refuses dirty repositories before writing maps or map-state", () => {
		assert.match(skill, /git status --porcelain/);
		assert.match(skill, /dirty[^\n]+stop clearly/i);
		assert.match(skill, /do not edit maps/i);
		assert.match(skill, /do not edit `?\.warden\/map-state\.json`?/i);
		assert.match(skill, /commit, stash, or otherwise clean/i);
	});

	it("writes lean map-state only after a successful clean map run", () => {
		assert.match(skill, /successful clean map run/i);
		assert.match(skill, /write\/update `?\.warden\/map-state\.json`?/i);
		assert.match(
			skill,
			/every map file that was generated or confirmed current/i,
		);
		assert.match(skill, /current full Git HEAD SHA/i);
		assert.match(skill, /no map content changed/i);
		assert.match(skill, /do not update map bodies just to refresh/i);
	});

	it("keeps map-state root-owned and out of dirty freshness", () => {
		assert.match(
			skill,
			/only `?warden-map`? writes `?\.warden\/map-state\.json`?/i,
		);
		assert.match(skill, /Do not include dirty state in map freshness/i);
		assert.match(skill, /Git root `?\.warden\/\*\*`?/i);
		assert.doesNotMatch(skill, /\$WARDEN_HOME/);
	});
});
