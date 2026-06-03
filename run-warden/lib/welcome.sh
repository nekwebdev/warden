warden_welcome() {
	cat <<EOF
Welcome to Warden.

WARDEN_HOME: ${WARDEN_HOME:-unset}
NixOS config: ${WARDEN_HOME:-unset}/nix-warden

Next steps:
  ./warden doctor
  ./warden shell status
  ./warden shell install
EOF
}
