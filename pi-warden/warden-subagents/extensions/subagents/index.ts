import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentManager } from "../../src/agent-manager.ts";
import { wardenSubagentsRegister } from "../../src/agent-runner.ts";
import { createAgentWidgetController } from "../../src/ui/agent-widget.ts";
import {
	renderSubagentNotification,
	sendSubagentNotification,
	SUBAGENT_NOTIFICATION_TYPE,
} from "../../src/ui/notification-renderer.ts";

export const WARDEN_SUBAGENTS_PACKAGE = "@nekwebdev/warden-subagents";

export function wardenSubagents(pi: ExtensionAPI): void {
	const manager = new AgentManager();
	let currentCtx: unknown;
	let widget = createAgentWidgetController(undefined);

	registerNotificationRenderer(pi);
	manager.onActivityChange((snapshot) => widget.update(snapshot));
	manager.onTerminalResult((event) => {
		if (currentCtx) sendSubagentNotification(pi, currentCtx, event.result);
	});

	wardenSubagentsRegister(pi, { manager });
	pi.on("session_start", async (_event, ctx) => {
		currentCtx = ctx;
		widget = createAgentWidgetController(ctx);
		widget.update(manager.getActivitySnapshot());
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		widget.shutdown();
		createAgentWidgetController(ctx).shutdown();
		manager.shutdown();
		currentCtx = undefined;
	});
}

function registerNotificationRenderer(pi: ExtensionAPI): void {
	const register = (pi as unknown as { registerMessageRenderer?: unknown })
		.registerMessageRenderer;
	if (typeof register !== "function") return;
	register.call(pi, SUBAGENT_NOTIFICATION_TYPE, renderSubagentNotification);
}

export default wardenSubagents;
