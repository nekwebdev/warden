#!/usr/bin/env bats

setup() {
  REPO_ROOT=$(cd "$BATS_TEST_DIRNAME/../.." && pwd -P)
  TEST_HOME="$BATS_TEST_TMPDIR/home"
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$TEST_HOME" "$FAKE_BIN"
  cat > "$FAKE_BIN/mise" <<'SH'
#!/usr/bin/env sh
[ -n "${MISE_PWD_LOG:-}" ] && pwd >"$MISE_PWD_LOG"
if [ "$1" = "exec" ]; then shift; [ "$1" = "--" ] && shift; exec "$@"; fi
exit 0
SH
  chmod +x "$FAKE_BIN/mise"
}

copy_repo() {
  clone="$BATS_TEST_TMPDIR/clone"
  mkdir -p "$clone"
  (cd "$REPO_ROOT" && tar --exclude .git -cf - .) | (cd "$clone" && tar -xf -)
  chmod +x "$clone/warden" "$clone/run-warden/bin/warden"
  printf '%s\n' "$clone"
}

@test "fresh clone moves to default WARDEN_HOME and prints welcome" {
  clone=$(copy_repo)
  run env -u WARDEN_HOME -u XDG_CONFIG_HOME HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 MISE_PWD_LOG="$BATS_TEST_TMPDIR/mise-pwd" "$clone/warden"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Welcome to Warden"* ]]
  [ -x "$TEST_HOME/.config/warden/warden" ]
  [ "$(cat "$BATS_TEST_TMPDIR/mise-pwd")" = "$TEST_HOME/.config/warden" ]
}

@test "custom WARDEN_HOME is honored" {
  clone=$(copy_repo)
  custom_home="$BATS_TEST_TMPDIR/custom-warden"
  run env HOME="$TEST_HOME" PATH="$FAKE_BIN:$PATH" WARDEN_YES=1 WARDEN_HOME="$custom_home" "$clone/warden"
  [ "$status" -eq 0 ]
  [[ "$output" == *"WARDEN_HOME: $custom_home"* ]]
  [ -x "$custom_home/warden" ]
}

@test "bootstrap fails clearly when HOME is unset" {
  clone=$(copy_repo)
  run env -u HOME PATH="$FAKE_BIN:$PATH" WARDEN_HOME="$clone" "$clone/warden"
  [ "$status" -ne 0 ]
  [[ "$output" == *"HOME is required"* ]]
}
