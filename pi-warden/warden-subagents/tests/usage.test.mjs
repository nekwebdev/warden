import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildNotificationPreview,
	extractPassiveUsage,
	formatCompactNumber,
	mergePassiveUsage,
} from "../index.ts";

describe("passive subagent usage helpers", () => {
	it("extracts only supplied usage fields and merges latest values", () => {
		const first = extractPassiveUsage({
			turnCount: 2,
			maxTurns: 5,
			toolUseCount: 3,
			usage: { tokens: 1200, contextTokens: 4000, contextWindow: 100000 },
			compactionCount: 1,
		});
		const second = extractPassiveUsage({
			usage: { tokens: 2400 },
			currentActivity: "calling read",
		});

		assert.deepEqual(mergePassiveUsage(first, second), {
			turnCount: 2,
			maxTurns: 5,
			toolUseCount: 3,
			usage: { tokens: 2400, contextTokens: 4000, contextWindow: 100000 },
			compactionCount: 1,
			currentActivity: "calling read",
		});
	});

	it("formats thresholds and caps notification preview at 600 characters", () => {
		assert.equal(formatCompactNumber(999), "999");
		assert.equal(formatCompactNumber(1234), "1.2K");
		assert.equal(formatCompactNumber(100000), "100K");

		const preview = buildNotificationPreview("x".repeat(650));
		assert.equal([...preview].length, 600);
		assert.match(preview, /…$/);
	});
});
