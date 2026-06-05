import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenCommit } from "../../src/commit.js";

export { registerWardenCommit } from "../../src/commit.js";

export default function wardenCommit(pi: ExtensionAPI): void {
	registerWardenCommit(pi);
}
