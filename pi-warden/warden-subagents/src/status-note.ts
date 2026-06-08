export function statusNote(status: string): string {
	if (status === "completed") return "completed";
	if (status === "fallback") return "completed with fallback";
	if (status === "steered") return "wrapped-up";
	if (status === "aborted") return "aborted";
	if (status === "error") return "failed";
	if (status === "disabled") return "disabled";
	if (status === "unsupported") return "unsupported";
	if (status === "queued") return "queued";
	if (status === "running") return "running";
	return status || "unknown";
}
