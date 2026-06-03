#!/usr/bin/env bats

setup() {
  RUN_WARDEN_ROOT=$(cd "$BATS_TEST_DIRNAME/.." && pwd -P)
  chmod +x "$RUN_WARDEN_ROOT/bin/warden"
}

@test "run-warden welcome prints WARDEN_HOME" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" welcome
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [[ "$output" == *"WARDEN_HOME: /tmp/warden"* ]]
}

@test "run-warden fails clearly when HOME is unset" {
  run env -u HOME WARDEN_HOME=/tmp/warden "$RUN_WARDEN_ROOT/bin/warden" welcome
  [ "$status" -ne 0 ]
  [[ "$output" == *"HOME is required"* ]]
}

@test "run-warden rejects unknown command" {
  run env HOME="$BATS_TEST_TMPDIR/home" "$RUN_WARDEN_ROOT/bin/warden" nope
  [ "$status" -eq 2 ]
}
