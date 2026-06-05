export const WARDEN_MAP_MESSAGE = "warden-map";
export const WARDEN_GIT_CONTEXT_MESSAGE = "warden-git-context";
export const WARDEN_MAP_DEBUG_FLAG = "warden-map-debug";

export const WARDEN_DIR = ".warden";
export const MAP_FILE_NAME = "map.md";
export const ROOT_MAP_RELATIVE_PATH = `${WARDEN_DIR}/${MAP_FILE_NAME}`;
export const SCOPED_MAPS_RELATIVE_DIR = `${WARDEN_DIR}/maps`;

export const INJECT_START_MARKER = "<!-- warden-map:inject:start -->";
export const INJECT_END_MARKER = "<!-- warden-map:inject:end -->";

export const ROOT_CAPSULE_TARGET_BYTES = 3 * 1024;
export const ROOT_CAPSULE_MAX_BYTES = 8 * 1024;
export const SCOPED_CAPSULE_TARGET_BYTES = 1536;
export const SCOPED_CAPSULE_MAX_BYTES = 4 * 1024;
export const SCOPED_INJECTION_MAX_BYTES = 6 * 1024;
export const SESSION_START_MAX_BYTES = 10 * 1024;
export const MAX_SCOPED_MAPS_PER_TOOL_RESULT = 3;

export const GIT_EXEC_TIMEOUT_MS = 5000;
export const GIT_DIRTY_SAMPLE_LIMIT = 8;
