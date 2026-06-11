#!/usr/bin/env node
import { main } from "../server/index.js";

void (async () => {
  const code = await main();
  if (code !== 0) process.exitCode = code;
})();
