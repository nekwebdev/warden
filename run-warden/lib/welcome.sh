warden_welcome() {
	cat <<EOF
Welcome to Warden.

WARDEN_HOME: ${WARDEN_HOME:-unset}
NixOS config: ${WARDEN_HOME:-unset}/nix-warden

Next steps before shell integration:
  cd ${WARDEN_HOME:-unset}
  ./warden help
  ./warden doctor
  ./warden shell status
  ./warden shell install
  ./warden shell init bash|zsh|fish

After shell integration and reload:
  warden help
  warden doctor
EOF
}
