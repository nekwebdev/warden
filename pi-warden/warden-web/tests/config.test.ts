import assert from "node:assert/strict";
import test from "node:test";

import { ConfigError, DEFAULT_HOST, DEFAULT_PORT, formatHelpText, parseServerConfig } from "../src/server/config.js";

test("parseServerConfig uses localhost defaults", () => {
  assert.deepEqual(parseServerConfig([], {}), {
    help: false,
    host: DEFAULT_HOST,
    port: DEFAULT_PORT,
  });
});

test("parseServerConfig uses env fallbacks and cli overrides", () => {
  assert.deepEqual(
    parseServerConfig(["--host", "0.0.0.0", "--port=0"], {
      WARDEN_WEB_HOST: "192.0.2.10",
      WARDEN_WEB_PORT: "4444",
    }),
    {
      help: false,
      host: "0.0.0.0",
      port: 0,
    },
  );
});

test("parseServerConfig accepts equals and split option forms", () => {
  assert.deepEqual(parseServerConfig(["--host=localhost", "--port", "48738"], {}), {
    help: false,
    host: "localhost",
    port: 48738,
  });
});

test("parseServerConfig returns help without validating env", () => {
  assert.deepEqual(parseServerConfig(["--help"], { WARDEN_WEB_PORT: "bad" }), { help: true });
  assert.match(formatHelpText(), /warden-web/);
});

test("parseServerConfig rejects invalid ports", () => {
  for (const port of ["", "abc", "-1", "65536", "1.5"]) {
    assert.throws(() => parseServerConfig(["--port", port], {}), ConfigError);
  }
});

test("parseServerConfig rejects invalid hosts and unknown options", () => {
  assert.throws(() => parseServerConfig(["--host", ""], {}), /host must not be empty/);
  assert.throws(() => parseServerConfig(["--host"], {}), /missing value for --host/);
  assert.throws(() => parseServerConfig(["--wat"], {}), /unknown option/);
});
