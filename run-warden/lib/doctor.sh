warden_doctor_check() {
	label=$1
	shift
	if "$@"; then
		printf 'ok - %s\n' "$label"
		return 0
	fi
	printf 'not ok - %s\n' "$label"
	return 1
}

warden_has_mise() {
	command -v mise >/dev/null 2>&1 || [ -x "$HOME/.local/bin/mise" ]
}

warden_mise_exec_works() {
	if command -v mise >/dev/null 2>&1; then
		mise exec -- true >/dev/null 2>&1
		return $?
	fi
	if [ -x "$HOME/.local/bin/mise" ]; then
		"$HOME/.local/bin/mise" exec -- true >/dev/null 2>&1
		return $?
	fi
	return 1
}

warden_repo_is_home() {
	[ -n "${WARDEN_HOME:-}" ] && [ -x "$WARDEN_HOME/warden" ] && [ -d "$WARDEN_HOME/run-warden" ]
}

warden_runner_delegates() {
	[ -n "${WARDEN_HOME:-}" ] && [ -x "$WARDEN_HOME/run-warden/bin/warden" ]
}

warden_shell_has_any_integration() {
	warden_shell_is_installed bash || warden_shell_is_installed zsh || warden_shell_is_installed fish
}

warden_doctor() {
	failures=0
	warden_doctor_check "WARDEN_HOME is set" test -n "${WARDEN_HOME:-}" || failures=$((failures + 1))
	warden_doctor_check "WARDEN_HOME exists" test -d "${WARDEN_HOME:-/dev/null}" || failures=$((failures + 1))
	warden_doctor_check "repo is located at WARDEN_HOME" warden_repo_is_home || failures=$((failures + 1))
	warden_doctor_check "mise is available" warden_has_mise || failures=$((failures + 1))
	warden_doctor_check "mise exec works" warden_mise_exec_works || failures=$((failures + 1))
	warden_doctor_check "run-warden delegation is available" warden_runner_delegates || failures=$((failures + 1))
	if warden_shell_has_any_integration; then
		printf 'ok - shell integration installed for at least one shell\n'
	else
		printf 'not ok - shell integration not installed; run ./warden shell install or ./warden shell snippet bash|zsh|fish\n'
	fi
	[ "$failures" -eq 0 ]
}
