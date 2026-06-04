import {
	DefaultPackageManager,
	getAgentDir,
	SettingsManager,
	type PackageManager,
} from "@earendil-works/pi-coding-agent";

export type PackageOperationAction = "install" | "remove";

export type PackageOperationResult = {
	readonly action: PackageOperationAction;
	readonly source: string;
	readonly ok: boolean;
	readonly changed?: boolean;
	readonly error?: string;
};

export type PackageOperationDependencies = {
	readonly cwd?: string;
	readonly agentDir?: string;
	readonly packageManager?: Pick<
		PackageManager,
		"installAndPersist" | "removeAndPersist"
	>;
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

export function formatPackageOperationReport(
	results: readonly PackageOperationResult[],
): string {
	if (results.length === 0) return "No package changes requested.";
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

function getPackageManager(
	dependencies: PackageOperationDependencies,
): Pick<PackageManager, "installAndPersist" | "removeAndPersist"> {
	if (dependencies.packageManager) return dependencies.packageManager;
	const cwd = dependencies.cwd ?? process.cwd();
	const agentDir = dependencies.agentDir ?? getAgentDir();
	const settingsManager = SettingsManager.create(cwd, agentDir);
	return new DefaultPackageManager({ cwd, agentDir, settingsManager });
}

function toErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
