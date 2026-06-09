import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { AgentManager } from "../../src/agent-manager.ts";
import {
	registerSubagentsRpc,
	type EventBusLike,
} from "../../src/cross-extension-rpc.ts";
import {
	runForegroundAgent,
	wardenSubagentsRegister,
} from "../../src/agent-runner.ts";
import {
	ScheduleStore,
	resolveScheduleStorePath,
} from "../../src/schedule-store.ts";
import { scheduleErrorResult } from "../../src/schedule.ts";
import { ScheduledAgentManager } from "../../src/scheduler.ts";
import { createAgentWidgetController } from "../../src/ui/agent-widget.ts";
import {
	renderSubagentNotification,
	sendSubagentNotification,
	SUBAGENT_NOTIFICATION_TYPE,
} from "../../src/ui/notification-renderer.ts";
import {
	registerSubagentsCommands,
	registerSubagentsPane,
} from "../../src/ui/subagents-pane.ts";

export const WARDEN_SUBAGENTS_PACKAGE = "@nekwebdev/warden-subagents";

export function wardenSubagents(pi: ExtensionAPI): void {
	const manager = new AgentManager();
	let currentCtx: Record<string, unknown> | undefined;
	let scheduler: ScheduledAgentManager | undefined;
	let widget = createAgentWidgetController(undefined);
	const events = eventBusOf(pi);
	let unregisterRpc: (() => void) | undefined;
	if (events) {
		manager.onLifecycleEvent((event) =>
			events.emit(event.channel, event.payload),
		);
		unregisterRpc = registerSubagentsRpc({
			events,
			manager,
			getCtx: () => currentCtx,
		});
	}

	registerNotificationRenderer(pi);
	registerSubagentsPane();
	registerSubagentsCommands(
		pi,
		manager,
		() => scheduler?.listScheduledJobs() ?? [],
	);
	manager.onActivityChange((snapshot) => widget.update(snapshot));
	manager.onTerminalResult((event) => {
		if (currentCtx) sendSubagentNotification(pi, currentCtx, event.result);
	});

	wardenSubagentsRegister(pi, {
		manager,
		scheduler: {
			async schedule(params, ctx) {
				if (!scheduler) {
					return scheduleErrorResult(
						"Scheduled Agent manager is unavailable until session storage is ready.",
					);
				}
				return scheduler.schedule(params, ctx);
			},
		},
	});
	pi.on("session_start", async (_event, ctx) => {
		currentCtx = ctx as unknown as Record<string, unknown>;
		const storePath = resolveScheduleStorePath(ctx);
		if (storePath) {
			scheduler?.shutdown();
			scheduler = new ScheduledAgentManager({
				store: new ScheduleStore({ filePath: storePath }),
				agentManager: manager,
				sessionId: sessionIdOf(ctx),
				onEvent: events
					? (event) => events.emit(event.channel, event.payload)
					: undefined,
				runAgent: ({ params, ctx, registry, signal, onActivity, agentId }) =>
					runForegroundAgent({
						params,
						ctx,
						registry,
						signal,
						onActivity,
						runId: agentId,
					}),
			});
			await scheduler.rearm();
		}
		widget = createAgentWidgetController(ctx);
		widget.update(manager.getActivitySnapshot());
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		widget.shutdown();
		createAgentWidgetController(ctx).shutdown();
		scheduler?.shutdown();
		scheduler = undefined;
		unregisterRpc?.();
		unregisterRpc = undefined;
		manager.shutdown();
		currentCtx = undefined;
	});
}

function eventBusOf(pi: ExtensionAPI): EventBusLike | undefined {
	const events = (pi as unknown as { events?: unknown }).events;
	if (!events || typeof events !== "object") return undefined;
	const maybe = events as Partial<EventBusLike>;
	if (typeof maybe.on !== "function" || typeof maybe.emit !== "function") {
		return undefined;
	}
	return maybe as EventBusLike;
}

function sessionIdOf(ctx: unknown): string | undefined {
	const manager = (ctx as { sessionManager?: unknown } | undefined)
		?.sessionManager;
	if (!manager || typeof manager !== "object") return undefined;
	const getSessionId = (manager as { getSessionId?: unknown }).getSessionId;
	if (typeof getSessionId !== "function") return undefined;
	const sessionId = getSessionId.call(manager);
	return typeof sessionId === "string" ? sessionId : undefined;
}

function registerNotificationRenderer(pi: ExtensionAPI): void {
	const register = (pi as unknown as { registerMessageRenderer?: unknown })
		.registerMessageRenderer;
	if (typeof register !== "function") return;
	register.call(pi, SUBAGENT_NOTIFICATION_TYPE, renderSubagentNotification);
}

export default wardenSubagents;
