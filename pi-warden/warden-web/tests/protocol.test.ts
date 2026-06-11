import assert from "node:assert/strict";
import test from "node:test";

import { AGENT_STATUSES, isAgentStatus, isErrorResponse, PROTOCOL_VERSION } from "../src/protocol.js";

test("protocol exposes stable first-slice version", () => {
  assert.equal(PROTOCOL_VERSION, 1);
});

test("isAgentStatus accepts only known agent statuses", () => {
  for (const status of AGENT_STATUSES) {
    assert.equal(isAgentStatus(status), true);
  }
  assert.equal(isAgentStatus("starting"), false);
  assert.equal(isAgentStatus(null), false);
});

test("isErrorResponse validates stable error shape", () => {
  assert.equal(isErrorResponse({ ok: false, error: { code: "not-found", message: "missing" } }), true);
  assert.equal(isErrorResponse({ ok: true, error: { code: "not-found", message: "missing" } }), false);
  assert.equal(isErrorResponse({ ok: false, error: { code: "not-found" } }), false);
});
