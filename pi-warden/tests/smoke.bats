#!/usr/bin/env bats

setup() { PROJECT_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P); }

@test "pi-warden contains extension package folders" {
  [ -d "$PROJECT_ROOT/warden-panel" ]
  [ -f "$PROJECT_ROOT/warden-panel/package.json" ]
  [ -d "$PROJECT_ROOT/warden-packages" ]
  [ -f "$PROJECT_ROOT/warden-packages/package.json" ]
}

@test "warden-panel declares package and root extension manifest" {
  run grep -F '"name": "@nekwebdev/warden-panel"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./index.ts"' "$PROJECT_ROOT/warden-panel/package.json"
  [ "$status" -eq 0 ]
}

@test "warden-packages declares package and root extension manifest" {
  run grep -F '"name": "@nekwebdev/warden-packages"' "$PROJECT_ROOT/warden-packages/package.json"
  [ "$status" -eq 0 ]

  run grep -F '"./index.ts"' "$PROJECT_ROOT/warden-packages/package.json"
  [ "$status" -eq 0 ]
}
