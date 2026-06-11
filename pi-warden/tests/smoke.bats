#!/usr/bin/env bats

setup() { PROJECT_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P); }

@test "pi-warden contains current package folders" {
  [ -d "$PROJECT_ROOT/warden-panel" ]
  [ -f "$PROJECT_ROOT/warden-panel/package.json" ]
  [ -d "$PROJECT_ROOT/warden-panel/extensions/warden-panel" ]
  [ -d "$PROJECT_ROOT/warden-panel/extensions/warden-display" ]
  [ -d "$PROJECT_ROOT/warden-panel/extensions/warden-packages" ]

  [ -d "$PROJECT_ROOT/warden-flow" ]
  [ -f "$PROJECT_ROOT/warden-flow/package.json" ]
  [ -d "$PROJECT_ROOT/warden-flow/extensions/warden-map" ]
  [ -d "$PROJECT_ROOT/warden-flow/extensions/warden-commit" ]
  [ -d "$PROJECT_ROOT/warden-flow/skills/warden-map" ]
  [ -d "$PROJECT_ROOT/warden-flow/skills/warden-close" ]
  [ -d "$PROJECT_ROOT/warden-flow/skills/warden-commit" ]

  [ -d "$PROJECT_ROOT/warden-subagents" ]
  [ -f "$PROJECT_ROOT/warden-subagents/package.json" ]
  [ -d "$PROJECT_ROOT/warden-subagents/extensions/subagents" ]

  [ -d "$PROJECT_ROOT/warden-theme" ]
  [ -f "$PROJECT_ROOT/warden-theme/package.json" ]
  [ -d "$PROJECT_ROOT/warden-theme/themes" ]

  [ -d "$PROJECT_ROOT/warden-web" ]
  [ -f "$PROJECT_ROOT/warden-web/package.json" ]
  [ -d "$PROJECT_ROOT/warden-web/src/server" ]
}

@test "warden-panel declares package and bundled extension manifest" {
  run grep -F '"name": "@nekwebdev/warden-panel"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./extensions/*/index.ts"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]
}

@test "warden-flow declares package and bundled flow resources" {
  run grep -F '"name": "@nekwebdev/warden-flow"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./extensions/*/index.ts"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./skills"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]
}

@test "warden-subagents declares package and no-op extension resources" {
  run grep -F '"name": "@nekwebdev/warden-subagents"' "$PROJECT_ROOT/warden-subagents/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./extensions/subagents/index.ts"' "$PROJECT_ROOT/warden-subagents/package.json"
  [ "$status" -eq 0 ]

  [ -f "$PROJECT_ROOT/warden-subagents/extensions/subagents/index.ts" ]
}

@test "warden-theme declares package and bundled theme resources" {
  run grep -F '"name": "@nekwebdev/warden-theme"' "$PROJECT_ROOT/warden-theme/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./themes"' "$PROJECT_ROOT/warden-theme/package.json"
  [ "$status" -eq 0 ]

  [ -f "$PROJECT_ROOT/warden-theme/themes/warden-catppuccin-mocha.json" ]
}

@test "warden-web declares package and server bins without empty Pi resources" {
  run grep -F '"name": "@nekwebdev/warden-web"' "$PROJECT_ROOT/warden-web/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"warden-web-server": "./dist/server/index.js"' "$PROJECT_ROOT/warden-web/package.json"
  [ "$status" -eq 0 ]

  node - "$PROJECT_ROOT/warden-web/package.json" <<'NODE'
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
if (Object.prototype.hasOwnProperty.call(manifest, 'pi')) process.exit(1);
NODE
}

@test "former warden-packages package is folded into warden-panel" {
  [ ! -d "$PROJECT_ROOT/warden-packages" ]
  [ -f "$PROJECT_ROOT/warden-panel/extensions/warden-packages/index.ts" ]
}
