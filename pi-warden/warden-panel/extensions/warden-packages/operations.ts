import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	DefaultPackageManager,
	getAgentDir,
	SettingsManager,
	type PackageManager,
} from "@earendil-works/pi-coding-agent";
import {
	normalizePackageEntries,
	parseTaggedNpmPackageSource,
	replacePackageEntrySource,
	taggedNpmSourceWithVersion,
} from "./packages.js";

const execFileAsync = promisify(execFile);
const NPM_VIEW_TIMEOUT_MS = 10_000;

export type PackageOperationAction = "install" | "remove" | "update";

export type PackageOperationResult = {
	readonly action: PackageOperationAction;
	readonly source: string;
	readonly ok: boolean;
	readonly changed?: boolean;
	readonly newSource?: string;
	readonly error?: string;
};

type WardenPackageManager = Pick<
	PackageManager,
	"install" | "installAndPersist" | "removeAndPersist"
>;

type PackageSettingsManager = Pick<
	SettingsManager,
	"getGlobalSettings" | "setPackages" | "flush"
> &
	Partial<Pick<SettingsManager, "getNpmCommand">>;

export type PackageOperationDependencies = {
	readonly cwd?: string;
	readonly agentDir?: string;
	readonly packageManager?: WardenPackageManager;
};

export type TaggedPackageUpdateDependencies = PackageOperationDependencies & {
	readonly settingsManager?: PackageSettingsManager;
	readonly resolveLatestVersion?: (packageName: string) => Promise<string>;
};

export async function installPackage(
	source: string,
	dependencies: PackageOperationDependencies = {},
): Promise<PackageOperationResult> {
	const packageManager = getPackageManager(dependencies);
	try {
		await packageManager.installAndPersist(source);
		return { action: "install", source, ok: true, changed: true };
	} catch (error) {
		return {
			action: "install",
			source,
			ok: false,
			error: toErrorMessage(error),
		};
	}
}

export async function removePackages(
	sources: readonly string[],
	dependencies: PackageOperationDependencies = {},
): Promise<PackageOperationResult[]> {
	const packageManager = getPackageManager(dependencies);
	const results: PackageOperationResult[] = [];
	for (const source of sources) {
		try {
			const changed = await packageManager.removeAndPersist(source);
			results.push({ action: "remove", source, ok: true, changed });
		} catch (error) {
			results.push({
				action: "remove",
				source,
				ok: false,
				error: toErrorMessage(error),
			});
		}
	}
	return results;
}

export async function updateTaggedNpmPackages(
	dependencies: TaggedPackageUpdateDependencies = {},
): Promise<PackageOperationResult[]> {
	const settingsManager = getSettingsManager(dependencies);
	const packageManager = getPackageManager(dependencies);
	const resolveLatestVersion =
		dependencies.resolveLatestVersion ??
		((packageName: string) =>
			resolveLatestNpmVersion(packageName, settingsManager, dependencies.cwd));
	const globalSettings = settingsManager.getGlobalSettings();
	const packages = Array.isArray(globalSettings.packages)
		? globalSettings.packages
		: [];
	const entries = normalizePackageEntries(packages);
	const rewrites = new Map<number, string>();
	const results: PackageOperationResult[] = [];

	for (const entry of entries) {
		const tagged = parseTaggedNpmPackageSource(entry.source);
		if (!tagged) continue;

		let latestVersion: string;
		try {
			latestVersion = await resolveLatestVersion(tagged.name);
		} catch (error) {
			results.push({
				action: "update",
				source: entry.source,
				ok: false,
				error: toErrorMessage(error),
			});
			continue;
		}

		const newSource = taggedNpmSourceWithVersion(tagged.name, latestVersion);
		if (newSource === entry.source) {
			results.push({
				action: "update",
				source: entry.source,
				newSource,
				ok: true,
				changed: false,
			});
			continue;
		}

		try {
			await packageManager.install(newSource);
			rewrites.set(entry.index, newSource);
			results.push({
				action: "update",
				source: entry.source,
				newSource,
				ok: true,
				changed: true,
			});
		} catch (error) {
			results.push({
				action: "update",
				source: entry.source,
				newSource,
				ok: false,
				error: toErrorMessage(error),
			});
		}
	}

	if (rewrites.size === 0) return results;

	try {
		const nextPackages = packages.map((raw, index) => {
			const newSource = rewrites.get(index);
			return newSource ? replacePackageEntrySource(raw, newSource) : raw;
		});
		settingsManager.setPackages(
			nextPackages as Parameters<SettingsManager["setPackages"]>[0],
		);
		await settingsManager.flush();
	} catch (error) {
		const message = toErrorMessage(error);
		return results.map((result) =>
			result.action === "update" && result.changed === true
				? { ...result, ok: false, error: message }
				: result,
		);
	}

	return results;
}

export function formatPackageOperationReport(
	results: readonly PackageOperationResult[],
): string {
	if (results.length === 0) return "No package changes requested.";
	if (results[0]?.action === "update")
		return formatTaggedPackageUpdateReport(results);
	const action = results[0]?.action === "install" ? "Install" : "Remove";
	const succeeded = results.filter((result) => result.ok).length;
	const lines = [
		`## Warden packages ${action.toLowerCase()} report`,
		"",
		`- ${succeeded}/${results.length} succeeded.`,
		"",
	];
	for (const result of results) {
		if (result.ok) {
			const note = result.changed === false ? " (not found in settings)" : "";
			lines.push(`- ✅ ${result.source}${note}`);
		} else {
			lines.push(`- ❌ ${result.source}: ${result.error ?? "Unknown error"}`);
		}
	}
	lines.push("", "Restart Pi to load package changes.");
	return lines.join("\n");
}

export function formatTaggedPackageUpdateReport(
	results: readonly PackageOperationResult[],
): string {
	const lines = ["## Warden tagged package update report", ""];
	if (results.length === 0) {
		lines.push("No tagged npm packages found.");
		return lines.join("\n");
	}

	const changed = results.filter(
		(result) => result.ok && result.changed === true,
	).length;
	lines.push(`- ${changed}/${results.length} changed.`, "");
	for (const result of results) {
		if (result.ok && result.changed === false) {
			lines.push(`- ℹ️ ${result.source} unchanged`);
		} else if (result.ok) {
			lines.push(
				`- ✅ ${result.source} -> ${result.newSource ?? result.source}`,
			);
		} else if (result.newSource) {
			lines.push(
				`- ❌ ${result.source} -> ${result.newSource}: ${result.error ?? "Unknown error"}`,
			);
		} else {
			lines.push(`- ❌ ${result.source}: ${result.error ?? "Unknown error"}`);
		}
	}
	lines.push("", "Restart Pi to load package changes.");
	return lines.join("\n");
}

function getPackageManager(
	dependencies: PackageOperationDependencies,
): WardenPackageManager {
	if (dependencies.packageManager) return dependencies.packageManager;
	const cwd = dependencies.cwd ?? process.cwd();
	const agentDir = dependencies.agentDir ?? getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	return new DefaultPackageManager({ cwd, agentDir, settingsManager });
}

function getSettingsManager(
	dependencies: TaggedPackageUpdateDependencies,
): PackageSettingsManager {
	if (dependencies.settingsManager) return dependencies.settingsManager;
	return SettingsManager.create(
		dependencies.cwd ?? process.cwd(),
		dependencies.agentDir ?? getAgentDir(),
	);
}

async function resolveLatestNpmVersion(
	packageName: string,
	settingsManager: { readonly getNpmCommand?: () => string[] | undefined },
	cwd = process.cwd(),
): Promise<string> {
	const npmCommand = getNpmCommand(settingsManager);
	const { stdout } = await execFileAsync(
		npmCommand.command,
		[...npmCommand.args, "view", packageName, "version", "--json"],
		{ cwd, timeout: NPM_VIEW_TIMEOUT_MS },
	);
	const raw = stdout.trim();
	if (raw === "") throw new Error("Empty response from npm view");
	const version = JSON.parse(raw);
	if (typeof version !== "string" || version.trim() === "") {
		throw new Error(`Invalid npm version response for ${packageName}`);
	}
	return version;
}

function getNpmCommand(settingsManager: {
	readonly getNpmCommand?: () => string[] | undefined;
}): { readonly command: string; readonly args: string[] } {
	const configuredCommand = settingsManager.getNpmCommand?.();
	if (!configuredCommand || configuredCommand.length === 0) {
		return { command: "npm", args: [] };
	}
	const [command, ...args] = configuredCommand;
	if (!command) {
		throw new Error(
			"Invalid npmCommand: first array entry must be a non-empty command",
		);
	}
	return { command, args };
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
