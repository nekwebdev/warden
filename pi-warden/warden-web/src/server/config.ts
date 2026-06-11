export const DEFAULT_HOST = "127.0.0.1";
export const DEFAULT_PORT = 48737;

export interface ServerConfig {
  help: false;
  host: string;
  port: number;
}

export interface HelpConfig {
  help: true;
}

export type ParsedServerConfig = ServerConfig | HelpConfig;
export type Env = Partial<Record<string, string | undefined>>;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function formatHelpText(): string {
  return `usage: warden-web [--host HOST] [--port PORT]\n\nStarts the local Warden web server.\n\nOptions:\n  --host <host>    Host to bind. Defaults to ${DEFAULT_HOST}.\n  --port <port>    Port to bind. Defaults to ${DEFAULT_PORT}. Use 0 for an OS-assigned port.\n  --help           Show this help.\n\nEnvironment:\n  WARDEN_WEB_HOST  Host fallback.\n  WARDEN_WEB_PORT  Port fallback.\n`;
}

export function parseServerConfig(
  argv: readonly string[] = process.argv.slice(2),
  env: Env = process.env,
): ParsedServerConfig {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  let host = validateHost(env.WARDEN_WEB_HOST ?? DEFAULT_HOST);
  let port = parsePort(env.WARDEN_WEB_PORT ?? String(DEFAULT_PORT), "WARDEN_WEB_PORT");

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--host") {
      host = validateHost(readOptionValue(argv, index, "--host"));
      index += 1;
    } else if (arg?.startsWith("--host=")) {
      host = validateHost(arg.slice("--host=".length));
    } else if (arg === "--port") {
      port = parsePort(readOptionValue(argv, index, "--port"), "--port");
      index += 1;
    } else if (arg?.startsWith("--port=")) {
      port = parsePort(arg.slice("--port=".length), "--port");
    } else {
      throw new ConfigError(`unknown option: ${arg ?? ""}`);
    }
  }

  return { help: false, host, port };
}

function readOptionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) throw new ConfigError(`missing value for ${option}`);
  return value;
}

function validateHost(value: string): string {
  if (value.length === 0) throw new ConfigError("host must not be empty");
  if (value.trim() !== value) throw new ConfigError("host must not contain surrounding whitespace");
  if (/\s/u.test(value)) throw new ConfigError("host must not contain whitespace");
  return value;
}

function parsePort(value: string, source: string): number {
  if (!/^\d+$/u.test(value)) throw new ConfigError(`${source} must be an integer from 0 to 65535`);
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new ConfigError(`${source} must be an integer from 0 to 65535`);
  }
  return port;
}
