PI_AGENT_PACKAGE="@earendil-works/pi-coding-agent"
WARDEN_PI_TMUX_WINDOW_PREFIX="󱚤"

warden_agents_root() {
	if [ -n "${WARDEN_AGENTS:-}" ]; then
		printf '%s\n' "$WARDEN_AGENTS"
	elif [ -n "${XDG_CONFIG_HOME:-}" ]; then
		printf '%s/pi-agents\n' "$XDG_CONFIG_HOME"
	else
		printf '%s/.config/pi-agents\n' "$HOME"
	fi
}

warden_agents_ensure_root() {
	agents_root=$(warden_agents_root)
	mkdir -p "$agents_root" || return 1
	(cd "$agents_root" && pwd -P) || return 1
}

warden_agent_validate_name() {
	name=${1:-}
	case "$name" in
	"" | "." | ".." | */*)
		printf '%s\n' "warden: invalid agent name: $name" >&2
		printf '%s\n' "Agent names must use A-Z, a-z, 0-9, dot, underscore, or dash; '/' and path segments '.'/'..' are not allowed." >&2
		return 2
		;;
	*[!ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._-]*)
		printf '%s\n' "warden: invalid agent name: $name" >&2
		printf '%s\n' "Agent names must use A-Z, a-z, 0-9, dot, underscore, or dash; '/' and path segments '.'/'..' are not allowed." >&2
		return 2
		;;
	esac
}

warden_agents_prompt_name() {
	if [ -n "${1:-}" ]; then
		printf '%s\n' "$1"
		return 0
	fi
	if [ ! -t 0 ]; then
		printf '%s\n' "usage: warden agents new [name]" >&2
		return 2
	fi
	printf 'Agent name: ' >&2
	read -r name
	if [ -z "$name" ]; then
		printf '%s\n' "warden: agent name is required" >&2
		return 2
	fi
	printf '%s\n' "$name"
}

warden_agent_dir() {
	agents_root=$1
	name=$2
	printf '%s/%s\n' "$agents_root" "$name"
}

warden_agent_npm_prefix() {
	agent_dir=$1
	printf '%s/npm\n' "$agent_dir"
}

warden_agent_pi_bin() {
	agent_dir=$1
	printf '%s/npm/node_modules/.bin/pi\n' "$agent_dir"
}

warden_agent_pi_lens_dir() {
	agent_dir=$1
	printf '%s/pi-lens\n' "$agent_dir"
}

warden_agent_settings_path() {
	agent_dir=$1
	printf '%s/settings.json\n' "$agent_dir"
}

warden_agent_settings_node() {
	if ! command -v node >/dev/null 2>&1; then
		printf '%s\n' "warden: node is required to read and write agent settings.json" >&2
		return 1
	fi
	node - "$@" <<'NODE'
const fs = require("fs");
const path = require("path");

const [op, first, name, ...rest] = process.argv.slice(2);

function fail(message) {
  console.error(`warden: ${message}`);
  process.exit(1);
}

function readSettingsFile(settingsPath) {
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  let raw;
  try {
    raw = fs.readFileSync(settingsPath, "utf8");
  } catch (error) {
    fail(`failed to read agent settings: ${settingsPath}: ${error.message}`);
  }
  if (raw.trim() === "") {
    return {};
  }
  let settings;
  try {
    settings = JSON.parse(raw);
  } catch (error) {
    fail(`failed to read agent settings: ${settingsPath}: ${error.message}`);
  }
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    fail(`failed to read agent settings: ${settingsPath}: top-level JSON value must be an object`);
  }
  return settings;
}

function writeSettingsFile(settingsPath, settings) {
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

function ensureObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function readCwdSetting(settingsPath, label, cwd) {
  if (cwd === undefined || cwd === null || cwd === "") {
    return "";
  }
  if (typeof cwd !== "string") {
    fail(`failed to read agent settings: ${settingsPath}: ${label} must be a string`);
  }
  return cwd;
}

function configuredCwd(settingsPath, settings, agentName) {
  const warden = ensureObject(settings.warden) ? settings.warden : undefined;
  if (warden && ensureObject(warden.agent) && hasOwn(warden.agent, "cwd")) {
    return readCwdSetting(settingsPath, "warden.agent.cwd", warden.agent.cwd);
  }
  if (warden && ensureObject(warden.agents) && ensureObject(warden.agents[agentName]) && hasOwn(warden.agents[agentName], "cwd")) {
    return readCwdSetting(settingsPath, `warden.agents.${agentName}.cwd`, warden.agents[agentName].cwd);
  }
  return "";
}

function normalizeLegacyCwd(settings, agentName) {
  if (!ensureObject(settings.warden) || !ensureObject(settings.warden.agents) || !ensureObject(settings.warden.agents[agentName])) {
    return false;
  }
  if (!hasOwn(settings.warden.agents[agentName], "cwd")) {
    return false;
  }
  delete settings.warden.agents[agentName].cwd;
  if (Object.keys(settings.warden.agents[agentName]).length === 0) {
    delete settings.warden.agents[agentName];
  }
  if (Object.keys(settings.warden.agents).length === 0) {
    delete settings.warden.agents;
  }
  return true;
}

function removeConfiguredCwd(settings, agentName) {
  if (!ensureObject(settings.warden)) {
    return false;
  }
  let changed = false;
  if (ensureObject(settings.warden.agent) && hasOwn(settings.warden.agent, "cwd")) {
    delete settings.warden.agent.cwd;
    changed = true;
    if (Object.keys(settings.warden.agent).length === 0) {
      delete settings.warden.agent;
    }
  }
  if (normalizeLegacyCwd(settings, agentName)) {
    changed = true;
  }
  if (Object.keys(settings.warden).length === 0) {
    delete settings.warden;
  }
  return changed;
}

function expandCwd(cwd) {
  if (!cwd) {
    return "";
  }
  if (cwd === "~") {
    return process.env.HOME || "";
  }
  if (cwd.startsWith("~/")) {
    return path.join(process.env.HOME || "", cwd.slice(2));
  }
  if (path.isAbsolute(cwd)) {
    return cwd;
  }
  return "";
}

function effectiveCwd(cwd) {
  if (!cwd) {
    try {
      return fs.realpathSync(process.cwd());
    } catch {
      return process.cwd();
    }
  }
  const expanded = expandCwd(cwd);
  if (!expanded) {
    return "";
  }
  try {
    return fs.realpathSync(expanded);
  } catch {
    return "";
  }
}

function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function cwdStatus(cwd) {
  if (!cwd) {
    return "unset";
  }
  const expanded = expandCwd(cwd);
  if (!expanded) {
    return "invalid";
  }
  try {
    if (fs.statSync(expanded).isDirectory()) {
      return "ok";
    }
  } catch {
    return "missing";
  }
  return "missing";
}

function buildInfo(settingsPath, agentName, agentDir, piBin, piLensDir) {
  const settings = readSettingsFile(settingsPath);
  const cwd = configuredCwd(settingsPath, settings, agentName);
  return {
    name: agentName,
    agentDir,
    piBin,
    piLensDir,
    settingsPath,
    configuredCwd: cwd || null,
    effectiveCwd: effectiveCwd(cwd) || null,
    cwdStatus: cwdStatus(cwd),
    piExecutable: isExecutable(piBin),
    settings,
  };
}

switch (op) {
  case "get-cwd": {
    const settingsPath = first;
    const settings = readSettingsFile(settingsPath);
    process.stdout.write(configuredCwd(settingsPath, settings, name));
    break;
  }
  case "set-cwd": {
    const settingsPath = first;
    const cwd = rest[0];
    const settings = readSettingsFile(settingsPath);
    if (!ensureObject(settings.warden)) {
      settings.warden = {};
    }
    if (!ensureObject(settings.warden.agent)) {
      settings.warden.agent = {};
    }
    settings.warden.agent.cwd = cwd;
    normalizeLegacyCwd(settings, name);
    writeSettingsFile(settingsPath, settings);
    break;
  }
  case "unset-cwd": {
    const settingsPath = first;
    if (!fs.existsSync(settingsPath)) {
      break;
    }
    const settings = readSettingsFile(settingsPath);
    if (removeConfiguredCwd(settings, name)) {
      writeSettingsFile(settingsPath, settings);
    }
    break;
  }
  case "format": {
    const settingsPath = first;
    const settings = readSettingsFile(settingsPath);
    process.stdout.write(`${JSON.stringify(settings, null, 2)}\n`);
    break;
  }
  case "info-json": {
    const settingsPath = first;
    const [agentDir, piBin, piLensDir] = rest;
    process.stdout.write(`${JSON.stringify(buildInfo(settingsPath, name, agentDir, piBin, piLensDir), null, 2)}\n`);
    break;
  }
  case "list-json": {
    const agentsRoot = first;
    if (!fs.existsSync(agentsRoot)) {
      process.stdout.write("[]\n");
      break;
    }
    const entries = fs.readdirSync(agentsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const infos = entries.map((agentName) => {
      const agentDir = path.join(agentsRoot, agentName);
      const settingsPath = path.join(agentDir, "settings.json");
      const piBin = path.join(agentDir, "npm", "node_modules", ".bin", "pi");
      const piLensDir = path.join(agentDir, "pi-lens");
      return buildInfo(settingsPath, agentName, agentDir, piBin, piLensDir);
    });
    process.stdout.write(`${JSON.stringify(infos, null, 2)}\n`);
    break;
  }
  default:
    fail(`unknown agent settings operation: ${op || ""}`);
}
NODE
}

warden_agent_settings_get_cwd() {
	settings_path=$1
	name=$2
	warden_agent_settings_node get-cwd "$settings_path" "$name"
}

warden_agent_settings_set_cwd() {
	settings_path=$1
	name=$2
	cwd=$3
	warden_agent_settings_node set-cwd "$settings_path" "$name" "$cwd"
}

warden_agent_settings_unset_cwd() {
	settings_path=$1
	name=$2
	warden_agent_settings_node unset-cwd "$settings_path" "$name"
}

warden_agent_settings_format() {
	settings_path=$1
	warden_agent_settings_node format "$settings_path" _
}

warden_agent_settings_info_json() {
	settings_path=$1
	name=$2
	agent_dir=$3
	pi_bin=$4
	pi_lens_dir=$5
	warden_agent_settings_node info-json "$settings_path" "$name" "$agent_dir" "$pi_bin" "$pi_lens_dir"
}

warden_agent_prepare_npm_config() {
	npm_prefix=$1
	mkdir -p "$npm_prefix" || return 1
	: >"$npm_prefix/.npmrc" || return 1
	: >"$npm_prefix/.npm-globalrc" || return 1
}

warden_agent_install_pi() {
	agent_dir=$1
	pi_package=${2:-$PI_AGENT_PACKAGE}
	npm_prefix=$(warden_agent_npm_prefix "$agent_dir")
	warden_agent_prepare_npm_config "$npm_prefix" || return 1
	npm install \
		--prefix "$npm_prefix" \
		--cache "$npm_prefix/.npm-cache" \
		--userconfig "$npm_prefix/.npmrc" \
		--globalconfig "$npm_prefix/.npm-globalrc" \
		"$pi_package"
}

warden_agent_update_pi() {
	name=$1
	agent_dir=$2
	warden_agent_install_pi "$agent_dir" "${PI_AGENT_PACKAGE}@latest" || return $?
	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	if [ ! -x "$pi_bin" ]; then
		printf '%s\n' "warden: Pi update completed, but executable is missing: $pi_bin" >&2
		return 1
	fi
	printf 'updated agent %s Pi: %s\n' "$name" "$pi_bin"
}

warden_agents_new() {
	if [ $# -gt 1 ]; then
		printf '%s\n' "usage: warden agents new [name]" >&2
		return 2
	fi
	name=$(warden_agents_prompt_name "${1:-}") || return $?
	warden_agent_validate_name "$name" || return $?

	agents_root=$(warden_agents_ensure_root) || return 1
	agent_dir=$(warden_agent_dir "$agents_root" "$name")
	if [ -e "$agent_dir" ]; then
		printf '%s\n' "warden: agent already exists: $agent_dir" >&2
		return 2
	fi

	mkdir "$agent_dir" || return 1
	mkdir -p "$agent_dir/pi-lens" || {
		rm -rf "$agent_dir"
		return 1
	}

	if ! warden_agent_install_pi "$agent_dir"; then
		rm -rf "$agent_dir"
		return 1
	fi

	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	if [ ! -x "$pi_bin" ]; then
		printf '%s\n' "warden: Pi install completed, but executable is missing: $pi_bin" >&2
		rm -rf "$agent_dir"
		return 1
	fi

	printf 'created agent %s at %s\n' "$name" "$agent_dir"
	printf 'pi executable: %s\n' "$pi_bin"
}

warden_agent_resolve_dir() {
	name=$1
	agents_root=$(warden_agents_root)
	if [ -d "$agents_root" ]; then
		agents_root=$(cd "$agents_root" && pwd -P) || return 1
	fi
	warden_agent_dir "$agents_root" "$name"
}

warden_agent_require_existing_dir() {
	name=$1
	warden_agent_validate_name "$name" || return $?
	agent_dir=$(warden_agent_resolve_dir "$name") || return 1
	if [ ! -d "$agent_dir" ]; then
		printf '%s\n' "warden: agent not found: $agent_dir" >&2
		return 2
	fi
	printf '%s\n' "$agent_dir"
}

warden_agent_expand_cwd_value() {
	cwd_value=$1
	case "$cwd_value" in
	[~])
		printf '%s\n' "$HOME"
		;;
	[~]/*)
		printf '%s/%s\n' "$HOME" "${cwd_value#\~/}"
		;;
	/*)
		printf '%s\n' "$cwd_value"
		;;
	*)
		printf '%s\n' "warden: cwd must be an absolute path or start with ~: $cwd_value" >&2
		return 2
		;;
	esac
}

warden_agent_resolve_cwd_for_set() {
	cwd_value=$1
	expanded_cwd=$(warden_agent_expand_cwd_value "$cwd_value") || return $?
	if [ ! -d "$expanded_cwd" ]; then
		printf '%s\n' "warden: cwd is not an existing directory: $cwd_value" >&2
		return 2
	fi
	(cd "$expanded_cwd" && pwd -P) || return 1
}

warden_agent_effective_cwd_for_display() {
	cwd_value=${1:-}
	if [ -z "$cwd_value" ]; then
		printf '%s\n' "$(pwd -P)"
		return 0
	fi
	expanded_cwd=$(warden_agent_expand_cwd_value "$cwd_value" 2>/dev/null) || {
		printf '%s\n' "(invalid)"
		return 0
	}
	if [ ! -d "$expanded_cwd" ]; then
		printf '%s\n' "(missing)"
		return 0
	fi
	(cd "$expanded_cwd" && pwd -P) || return 1
}

warden_agent_cwd_status_for_display() {
	cwd_value=${1:-}
	if [ -z "$cwd_value" ]; then
		printf '%s\n' "unset"
		return 0
	fi
	expanded_cwd=$(warden_agent_expand_cwd_value "$cwd_value" 2>/dev/null) || {
		printf '%s\n' "invalid"
		return 0
	}
	if [ -d "$expanded_cwd" ]; then
		printf '%s\n' "ok"
	else
		printf '%s\n' "missing"
	fi
}

warden_agent_cd_to_configured_cwd() {
	name=$1
	cwd_value=${2:-}
	if [ -z "$cwd_value" ]; then
		return 0
	fi
	expanded_cwd=$(warden_agent_expand_cwd_value "$cwd_value") || return $?
	if [ ! -d "$expanded_cwd" ]; then
		printf '%s\n' "warden: configured cwd is not an existing directory for agent '$name': $cwd_value" >&2
		return 2
	fi
	resolved_cwd=$(cd "$expanded_cwd" && pwd -P) || return 1
	cd "$resolved_cwd" || return 1
}

warden_agents_update() {
	if [ $# -ne 1 ]; then
		printf '%s\n' "usage: warden agents update NAME" >&2
		return 2
	fi
	name=$1
	agent_dir=$(warden_agent_require_existing_dir "$name") || return $?
	warden_agent_update_pi "$name" "$agent_dir"
}

warden_agents_set() {
	if [ $# -ne 3 ] || [ "${2:-}" != "cwd" ]; then
		printf '%s\n' "usage: warden agents set NAME cwd DIR" >&2
		return 2
	fi
	name=$1
	cwd_value=$3
	agent_dir=$(warden_agent_require_existing_dir "$name") || return $?
	warden_agent_resolve_cwd_for_set "$cwd_value" >/dev/null || return $?
	settings_path=$(warden_agent_settings_path "$agent_dir")
	warden_agent_settings_set_cwd "$settings_path" "$name" "$cwd_value" || return 1
	printf 'set %s cwd: %s\n' "$name" "$cwd_value"
}

warden_agents_unset() {
	if [ $# -ne 2 ] || [ "${2:-}" != "cwd" ]; then
		printf '%s\n' "usage: warden agents unset NAME cwd" >&2
		return 2
	fi
	name=$1
	agent_dir=$(warden_agent_require_existing_dir "$name") || return $?
	settings_path=$(warden_agent_settings_path "$agent_dir")
	warden_agent_settings_unset_cwd "$settings_path" "$name" || return 1
	printf 'unset %s cwd\n' "$name"
}

warden_agents_show() {
	if [ $# -lt 1 ] || [ $# -gt 2 ]; then
		printf '%s\n' "usage: warden agents show NAME [--json]" >&2
		return 2
	fi
	name=$1
	json=0
	if [ $# -eq 2 ]; then
		if [ "$2" != "--json" ]; then
			printf '%s\n' "usage: warden agents show NAME [--json]" >&2
			return 2
		fi
		json=1
	fi
	agent_dir=$(warden_agent_require_existing_dir "$name") || return $?
	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	pi_lens_dir=$(warden_agent_pi_lens_dir "$agent_dir")
	settings_path=$(warden_agent_settings_path "$agent_dir")
	configured_cwd=$(warden_agent_settings_get_cwd "$settings_path" "$name") || return 1
	effective_cwd=$(warden_agent_effective_cwd_for_display "$configured_cwd") || return 1
	cwd_status=$(warden_agent_cwd_status_for_display "$configured_cwd") || return 1

	if [ "$json" -eq 1 ]; then
		warden_agent_settings_info_json "$settings_path" "$name" "$agent_dir" "$pi_bin" "$pi_lens_dir"
		return $?
	fi

	settings_json=$(warden_agent_settings_format "$settings_path") || return 1
	printf 'name: %s\n' "$name"
	printf 'agent dir: %s\n' "$agent_dir"
	printf 'pi bin: %s\n' "$pi_bin"
	printf 'pi-lens dir: %s\n' "$pi_lens_dir"
	printf 'settings: %s\n' "$settings_path"
	if [ -n "$configured_cwd" ]; then
		printf 'configured cwd: %s\n' "$configured_cwd"
	else
		printf 'configured cwd: (unset)\n'
	fi
	printf 'effective cwd: %s\n' "$effective_cwd"
	printf 'cwd status: %s\n' "$cwd_status"
	if [ -x "$pi_bin" ]; then
		printf 'pi executable: yes\n'
	else
		printf 'pi executable: no\n'
	fi
	printf '\nsettings.json:\n%s\n' "$settings_json"
}

warden_agents_list() {
	if [ $# -gt 1 ]; then
		printf '%s\n' "usage: warden agents list [--json]" >&2
		return 2
	fi
	json=0
	if [ $# -eq 1 ]; then
		if [ "$1" != "--json" ]; then
			printf '%s\n' "usage: warden agents list [--json]" >&2
			return 2
		fi
		json=1
	fi

	agents_root=$(warden_agents_root)
	if [ -d "$agents_root" ]; then
		agents_root=$(cd "$agents_root" && pwd -P) || return 1
	fi

	if [ "$json" -eq 1 ]; then
		warden_agent_settings_node list-json "$agents_root" _
		return $?
	fi

	if [ ! -d "$agents_root" ]; then
		printf 'no agents found in %s\n' "$agents_root"
		return 0
	fi

	found=0
	for agent_dir in "$agents_root"/* "$agents_root"/.[!.]* "$agents_root"/..?*; do
		[ -d "$agent_dir" ] || continue
		found=1
		name=${agent_dir##*/}
		pi_bin=$(warden_agent_pi_bin "$agent_dir")
		settings_path=$(warden_agent_settings_path "$agent_dir")
		configured_cwd=$(warden_agent_settings_get_cwd "$settings_path" "$name") || return 1
		cwd_status=$(warden_agent_cwd_status_for_display "$configured_cwd") || return 1
		if [ -n "$configured_cwd" ]; then
			cwd_display=$configured_cwd
		else
			cwd_display="(unset)"
		fi
		if [ -x "$pi_bin" ]; then
			pi_status=ok
		else
			pi_status=missing-pi
		fi
		printf '%s agent-dir=%s cwd=%s cwd-status=%s status=%s\n' "$name" "$agent_dir" "$cwd_display" "$cwd_status" "$pi_status"
	done

	if [ "$found" -eq 0 ]; then
		printf 'no agents found in %s\n' "$agents_root"
	fi
}

warden_pi_rename_tmux_window() {
	name=$1
	WARDEN_PI_TMUX_WINDOW_RENAMED=0
	WARDEN_PI_TMUX_WINDOW_NAME=
	WARDEN_PI_TMUX_AUTOMATIC_RENAME=
	[ -n "${TMUX:-}" ] || return 0
	command -v tmux >/dev/null 2>&1 || return 0
	WARDEN_PI_TMUX_WINDOW_NAME=$(tmux display-message -p '#W' 2>/dev/null || true)
	WARDEN_PI_TMUX_AUTOMATIC_RENAME=$(tmux show-window-option -v automatic-rename 2>/dev/null || true)
	tmux rename-window "$WARDEN_PI_TMUX_WINDOW_PREFIX $name" >/dev/null 2>&1 || return 0
	WARDEN_PI_TMUX_WINDOW_RENAMED=1
}

warden_pi_reset_tmux_window() {
	[ "${WARDEN_PI_TMUX_WINDOW_RENAMED:-0}" = "1" ] || return 0
	WARDEN_PI_TMUX_WINDOW_RENAMED=0
	[ -n "${TMUX:-}" ] || return 0
	command -v tmux >/dev/null 2>&1 || return 0
	if [ -n "${WARDEN_PI_TMUX_WINDOW_NAME:-}" ]; then
		tmux rename-window "$WARDEN_PI_TMUX_WINDOW_NAME" >/dev/null 2>&1 || true
	fi
	if [ -n "${WARDEN_PI_TMUX_AUTOMATIC_RENAME:-}" ]; then
		tmux set-window-option automatic-rename "$WARDEN_PI_TMUX_AUTOMATIC_RENAME" >/dev/null 2>&1 || true
	fi
}

warden_pi_run_local() {
	agent_dir=$1
	pi_bin=$2
	pi_lens_dir=$3
	shift 3
	if PI_CODING_AGENT_DIR="$agent_dir" PILENS_DATA_DIR="$pi_lens_dir" "$pi_bin" "$@"; then
		pi_status=0
	else
		pi_status=$?
	fi
	return "$pi_status"
}

warden_pi_run_with_tmux_window() {
	name=$1
	agent_dir=$2
	pi_bin=$3
	pi_lens_dir=$4
	shift 4
	warden_pi_rename_tmux_window "$name"
	trap 'warden_pi_reset_tmux_window' EXIT
	if [ "${1:-}" = "update" ]; then
		if warden_pi_update "$name" "$agent_dir" "$pi_bin" "$pi_lens_dir" "$@"; then
			pi_status=0
		else
			pi_status=$?
		fi
	else
		if warden_pi_run_local "$agent_dir" "$pi_bin" "$pi_lens_dir" "$@"; then
			pi_status=0
		else
			pi_status=$?
		fi
	fi
	trap - EXIT
	warden_pi_reset_tmux_window
	return "$pi_status"
}

warden_pi_update() {
	name=$1
	agent_dir=$2
	pi_bin=$3
	pi_lens_dir=$4
	shift 4

	update_source=
	update_self_flag=0
	update_extensions_flag=0
	update_extension_flag=0
	update_expect_extension_value=0
	update_invalid=0
	update_index=0

	for update_arg in "$@"; do
		if [ "$update_index" -eq 0 ]; then
			update_index=1
			continue
		fi

		if [ "$update_expect_extension_value" -eq 1 ]; then
			case "$update_arg" in
			"" | -*) update_invalid=1 ;;
			esac
			update_expect_extension_value=0
			continue
		fi

		case "$update_arg" in
		--self)
			update_self_flag=1
			;;
		--extensions)
			update_extensions_flag=1
			;;
		--extension)
			update_extension_flag=1
			update_expect_extension_value=1
			;;
		--force)
			;;
		-*)
			update_invalid=1
			;;
		*)
			if [ -n "$update_source" ]; then
				update_invalid=1
			else
				update_source=$update_arg
			fi
			;;
		esac
	done

	if [ "$update_expect_extension_value" -eq 1 ]; then
		update_invalid=1
	fi
	if [ "$update_extension_flag" -eq 1 ] && { [ "$update_self_flag" -eq 1 ] || [ "$update_extensions_flag" -eq 1 ] || [ -n "$update_source" ]; }; then
		update_invalid=1
	fi

	update_has_self=0
	update_has_extensions=0
	if [ "$update_invalid" -eq 0 ]; then
		if [ -n "$update_source" ]; then
			case "$update_source" in
			self | pi)
				update_has_self=1
				if [ "$update_extensions_flag" -eq 1 ]; then
					update_has_extensions=1
				fi
				;;
			*)
				if [ "$update_self_flag" -eq 1 ] || [ "$update_extensions_flag" -eq 1 ]; then
					update_invalid=1
				else
					update_has_extensions=1
				fi
				;;
			esac
		elif [ "$update_self_flag" -eq 1 ] && [ "$update_extensions_flag" -eq 1 ]; then
			update_has_self=1
			update_has_extensions=1
		elif [ "$update_self_flag" -eq 1 ]; then
			update_has_self=1
		elif [ "$update_extensions_flag" -eq 1 ] || [ "$update_extension_flag" -eq 1 ]; then
			update_has_extensions=1
		else
			update_has_self=1
			update_has_extensions=1
		fi
	fi

	if [ "$update_invalid" -eq 1 ] || [ "$update_has_self" -eq 0 ]; then
		if warden_pi_run_local "$agent_dir" "$pi_bin" "$pi_lens_dir" "$@"; then
			return 0
		else
			return $?
		fi
	fi

	if [ "$update_has_extensions" -eq 1 ]; then
		PI_CODING_AGENT_DIR="$agent_dir" PILENS_DATA_DIR="$pi_lens_dir" "$pi_bin" update --extensions || return $?
	fi
	warden_agent_update_pi "$name" "$agent_dir"
}

warden_pi() {
	if [ $# -lt 1 ]; then
		printf '%s\n' "usage: warden pi <name> [args...]" >&2
		return 2
	fi

	name=$1
	shift
	warden_agent_validate_name "$name" || return $?

	agent_dir=$(warden_agent_resolve_dir "$name") || return 1
	if [ ! -d "$agent_dir" ]; then
		printf '%s\n' "warden: agent not found: $agent_dir" >&2
		if ! warden_confirm "Create agent '$name' now?"; then
			printf '%s\n' "Create it with: warden agents new $name" >&2
			return 2
		fi
		warden_agents_new "$name" || return $?
		agents_root=$(warden_agents_ensure_root) || return 1
		agent_dir=$(warden_agent_dir "$agents_root" "$name")
	fi

	pi_bin=$(warden_agent_pi_bin "$agent_dir")
	if [ ! -x "$pi_bin" ]; then
		printf '%s\n' "warden: Pi executable missing for agent '$name': $pi_bin" >&2
		printf '%s\n' "Remove or move the broken agent directory, then recreate it with: warden agents new $name" >&2
		return 1
	fi

	settings_path=$(warden_agent_settings_path "$agent_dir")
	configured_cwd=$(warden_agent_settings_get_cwd "$settings_path" "$name") || return 1
	warden_agent_cd_to_configured_cwd "$name" "$configured_cwd" || return $?

	pi_lens_dir=$(warden_agent_pi_lens_dir "$agent_dir")
	mkdir -p "$pi_lens_dir" || return 1
	if [ -n "${TMUX:-}" ]; then
		warden_pi_run_with_tmux_window "$name" "$agent_dir" "$pi_bin" "$pi_lens_dir" "$@"
		return $?
	fi
	if [ "${1:-}" = "update" ]; then
		warden_pi_update "$name" "$agent_dir" "$pi_bin" "$pi_lens_dir" "$@"
		return $?
	fi
	PI_CODING_AGENT_DIR="$agent_dir" PILENS_DATA_DIR="$pi_lens_dir" exec "$pi_bin" "$@"
}
