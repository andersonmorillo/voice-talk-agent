import { createServer, type AddressInfo } from "net";
import type { Server as HttpServer } from "http";

/** Avoids 8000 (uvicorn/FastAPI), 8080, 3000, 5000, and 5173. */
export const DEFAULT_POCKET_TTS_PORT = 18741;
export const LEGACY_POCKET_TTS_PORT = 8000;

/** Preferred settings UI port. Falls back to the next free port if busy. */
export const DEFAULT_SETTINGS_PORT = 3847;

export const DEFAULT_LISTEN_HOST = "127.0.0.1";

const PORT_SCAN_LIMIT = 30;

export function parseListenAddress(
  baseUrl: string,
  fallbackPort = DEFAULT_POCKET_TTS_PORT
): { host: string; port: number } {
  try {
    const url = new URL(baseUrl.replace(/\/+$/, ""));
    const parsed = url.port ? parseInt(url.port, 10) : fallbackPort;
    return {
      host: url.hostname || DEFAULT_LISTEN_HOST,
      port: Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackPort,
    };
  } catch {
    return { host: DEFAULT_LISTEN_HOST, port: fallbackPort };
  }
}

export function buildBaseUrl(host: string, port: number): string {
  return `http://${host}:${port}`;
}

export function isPortAvailable(port: number, host = DEFAULT_LISTEN_HOST): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

export async function findAvailablePort(
  preferred: number,
  host = DEFAULT_LISTEN_HOST,
  maxAttempts = PORT_SCAN_LIMIT
): Promise<number> {
  const start = Number.isFinite(preferred) && preferred > 0 ? preferred : DEFAULT_POCKET_TTS_PORT;

  for (let i = 0; i < maxAttempts; i++) {
    const port = start + i;
    if (port > 65535) {
      break;
    }
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }

  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, host, () => {
      const addr = server.address() as AddressInfo | null;
      const port = addr?.port;
      server.close((error) => {
        if (error) {
          reject(error);
        } else if (port) {
          resolve(port);
        } else {
          reject(new Error("Could not find an available port"));
        }
      });
    });
  });
}

export async function listenOnAvailablePort(
  listen: (port: number, callback: () => void) => HttpServer,
  preferredPort: number
): Promise<{ server: HttpServer; port: number }> {
  const start = Number.isFinite(preferredPort) && preferredPort > 0 ? preferredPort : DEFAULT_SETTINGS_PORT;
  let lastError: unknown;

  for (let i = 0; i < PORT_SCAN_LIMIT; i++) {
    const port = start + i;
    if (port > 65535) {
      break;
    }
    try {
      const server = await listenOnce(listen, port);
      return { server, port };
    } catch (error) {
      lastError = error;
      if ((error as NodeJS.ErrnoException).code !== "EADDRINUSE") {
        throw error;
      }
    }
  }

  const server = await listenOnce(listen, 0);
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  if (!port) {
    throw lastError instanceof Error
      ? lastError
      : new Error(`Could not bind to a port near ${start}`);
  }
  return { server, port };
}

function listenOnce(
  listen: (port: number, callback: () => void) => HttpServer,
  port: number
): Promise<HttpServer> {
  return new Promise((resolve, reject) => {
    const server = listen(port, () => {
      server.removeListener("error", onError);
      resolve(server);
    });
    const onError = (error: Error) => {
      server.removeListener("error", onError);
      reject(error);
    };
    server.once("error", onError);
  });
}
