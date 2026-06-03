# warden shell integration for bash
: "${WARDEN_HOME:=${XDG_CONFIG_HOME:-$HOME/.config}/warden}"
export WARDEN_HOME
export PATH="$WARDEN_HOME/run-warden/bin:$PATH"
if command -v mise >/dev/null 2>&1; then
	eval "$(mise activate bash)"
elif [ -x "$HOME/.local/bin/mise" ]; then
	eval "$("$HOME/.local/bin/mise" activate bash)"
fi
