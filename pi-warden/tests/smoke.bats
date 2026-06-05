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
  [ -d "$PROJECT_ROOT/warden-flow/skills/warden-map" ]
}

@test "warden-panel declares package and bundled extension manifest" {
  run grep -F '"name": "@nekwebdev/warden-panel"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./extensions/*/index.ts"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]
}

@test "warden-flow declares package and bundled warden-map resources" {
  run grep -F '"name": "@nekwebdev/warden-flow"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./extensions/*/index.ts"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./skills"' "$PROJECT_ROOT/warden-flow/package.json"
  [ "$status" -eq 0 ]
}

@test "former warden-packages package is folded into warden-panel" {
  [ ! -d "$PROJECT_ROOT/warden-packages" ]
  [ -f "$PROJECT_ROOT/warden-panel/extensions/warden-packages/index.ts" ]
}
