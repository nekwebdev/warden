warden_web() {
	package_dir=$WARDEN_HOME/pi-warden/warden-web
	package_json=$package_dir/package.json

	if [ ! -d "$package_dir" ] || [ ! -f "$package_json" ]; then
		warden_fail "warden-web package missing: $package_json"
	fi

	command -v node >/dev/null 2>&1 || warden_fail "node is required to run warden web."
	command -v npm >/dev/null 2>&1 || warden_fail "npm is required to run warden web."

	exec npm run start --prefix "$package_dir" -- "$@"
}
