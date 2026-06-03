#!/usr/bin/env bats

setup() {
  RUN_WARDEN_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P)
  chmod +x "$RUN_WARDEN_ROOT/bin/run-warden"
}

@test "run-warden welcome prints WARDEN_HOME" {
  run env WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/run-warden" welcome
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [[ "$output" == *"WARDEN_HOME: /tmp/warden"* ]]
}

@test "run-warden rejects unknown command" {
  run "$RUN_WARDEN_ROOT/bin/run-warden" nope
  [ "$status" -eq 2 ]
}
