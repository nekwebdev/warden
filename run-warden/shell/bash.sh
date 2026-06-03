# warden shell integration for bash
: "${WARDEN_HOME:=${XDG_DATA_HOME:-$HOME/.local/share}/warden}"
export WARDEN_HOME
case ":$PATH:" in
*:"$WARDEN_HOME/run-warden/bin":*) ;;
*) export PATH="$WARDEN_HOME/run-warden/bin:$PATH" ;;
esac
if command -v mise >/dev/null 2>&1; then
	eval "$(mise activate bash)"
elif [ -x "$HOME/.local/bin/mise" ]; then
	eval "$("$HOME/.local/bin/mise" activate bash)"
fi
