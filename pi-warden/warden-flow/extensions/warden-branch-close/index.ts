import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenBranchClose } from "../../src/branch-close.js";

export { registerWardenBranchClose } from "../../src/branch-close.js";

export default function wardenBranchClose(pi: ExtensionAPI): void {
	registerWardenBranchClose(pi);
}
