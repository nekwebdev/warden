import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { registerWardenMap } from "../../src/extension.js";

export { registerWardenMap } from "../../src/extension.js";

export default function wardenMap(pi: ExtensionAPI): void {
	registerWardenMap(pi);
}
