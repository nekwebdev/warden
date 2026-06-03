#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  chmod +x "$REPO_ROOT/run-warden/bin/run-warden"
}

@test "shell snippet preserves custom WARDEN_HOME" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$BATS_TEST_TMPDIR/custom home" "$REPO_ROOT/run-warden/bin/run-warden" shell snippet bash
  [ "$status" -eq 0 ]
  [[ "$output" == *"# warden begin"* ]]
  [[ "$output" == *"export WARDEN_HOME="* ]]
  [[ "$output" == *"custom home"* ]]
}

@test "shell install writes guarded blocks after consent env" {
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/run-warden" shell install
  [ "$status" -eq 0 ]
  grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.bashrc"
  grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.zshrc"
  grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.config/fish/config.fish"
}

@test "shell remove deletes guarded blocks" {
  env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" WARDEN_YES=1 "$REPO_ROOT/run-warden/bin/run-warden" shell install
  run env HOME="$BATS_TEST_TMPDIR/home" WARDEN_HOME="$REPO_ROOT" "$REPO_ROOT/run-warden/bin/run-warden" shell remove
  [ "$status" -eq 0 ]
  ! grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.bashrc"
  ! grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.zshrc"
  ! grep -F '# warden begin' "$BATS_TEST_TMPDIR/home/.config/fish/config.fish"
}
