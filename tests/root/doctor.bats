#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/mise" <<'SH'
#!/usr/bin/env sh
if [ "$1" = "exec" ]; then shift; [ "$1" = "--" ] && shift; exec "$@"; fi
exit 0
SH
  chmod +x "$FAKE_BIN/mise" "$REPO_ROOT/warden" "$REPO_ROOT/run-warden/bin/run-warden"
}

@test "doctor reports readiness checks" {
  run env HOME="$BATS_TEST_TMPDIR/home" PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$REPO_ROOT" "$REPO_ROOT/warden" doctor
  [ "$status" -eq 0 ]
  [[ "$output" == *"ok - WARDEN_HOME is set"* ]]
  [[ "$output" == *"ok - repo is located at WARDEN_HOME"* ]]
  [[ "$output" == *"ok - mise exec works"* ]]
  [[ "$output" == *"ok - run-warden delegation is available"* ]]
  [[ "$output" == *"shell integration"* ]]
}
