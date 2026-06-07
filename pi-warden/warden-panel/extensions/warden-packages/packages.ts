import { getAgentDir, SettingsManager } from "@earendil-works/pi-coding-agent";

export type PackageEntry = {
	readonly id: string;
	readonly index: number;
	readonly source: string;
	readonly filtered: boolean;
	readonly raw: unknown;
};

export type InstallSourceValidation =
	| { readonly ok: true; readonly source: string }
	| { readonly ok: false; readonly message: string };

export type GlobalSettingsReader = {
	getGlobalSettings(): { readonly packages?: unknown };
};

export type TaggedNpmPackageSource = {
	readonly name: string;
	readonly tag: string;
};

export function readGlobalPackageEntries(
	reader: GlobalSettingsReader = SettingsManager.create(
		process.cwd(),
		getAgentDir(),
	),
): PackageEntry[] {
	return normalizePackageEntries(reader.getGlobalSettings().packages);
}

export function normalizePackageEntries(packages: unknown): PackageEntry[] {
	if (!Array.isArray(packages)) return [];
	const entries: PackageEntry[] = [];
	packages.forEach((raw, index) => {
		const source = packageSource(raw);
		if (!source || source.trim() === "") return;
		entries.push({
			id: `${index}:${source}`,
			index,
			source,
			filtered: typeof raw === "object" && raw !== null && !Array.isArray(raw),
			raw,
		});
	});
	return entries;
}

export function validateInstallSource(
	input: string | undefined,
): InstallSourceValidation {
	const source = input?.trim() ?? "";
	if (source === "")
		return { ok: false, message: "Package source is required." };
	if (/[\r\n]/.test(source)) {
		return {
			ok: false,
			message: "Package source must be a single line.",
		};
	}
	return { ok: true, source };
}

export function parseTaggedNpmPackageSource(
	source: string,
): TaggedNpmPackageSource | undefined {
	if (!source.startsWith("npm:")) return undefined;
	const spec = source.slice("npm:".length).trim();
	const match = spec.match(/^(@?[^@]+(?:\/[^@]+)?)(?:@(.+))?$/);
	const name = match?.[1];
	const tag = match?.[2];
	if (!name || !tag) return undefined;
	return { name, tag };
}

export function taggedNpmSourceWithVersion(
	name: string,
	version: string,
): string {
	return `npm:${name}@${version}`;
}

export function replacePackageEntrySource(
	raw: unknown,
	newSource: string,
): unknown {
	if (typeof raw === "string") return newSource;
	if (!isPlainObject(raw) || typeof raw.source !== "string") return raw;
	return { ...raw, source: newSource };
}

function packageSource(raw: unknown): string | undefined {
	if (typeof raw === "string") return raw;
	if (!isPlainObject(raw)) return undefined;
	return typeof raw.source === "string" ? raw.source : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
