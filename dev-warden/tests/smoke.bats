#!/usr/bin/env bats

setup() { PROJECT_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P); }

@test "dev-warden remains skeleton only" {
  run grep -F 'skeleton only' "$PROJECT_ROOT/README.md"
  [ "$status" -eq 0 ]
}
