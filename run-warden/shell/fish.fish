# warden shell integration for fish
if not set -q WARDEN_HOME
    if set -q XDG_CONFIG_HOME
        set -gx WARDEN_HOME "$XDG_CONFIG_HOME/warden"
    else
        set -gx WARDEN_HOME "$HOME/.config/warden"
    end
end
fish_add_path "$WARDEN_HOME/run-warden/bin"
if command -q mise
    mise activate fish | source
else if test -x "$HOME/.local/bin/mise"
    "$HOME/.local/bin/mise" activate fish | source
end
