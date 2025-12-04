/**
 * CruxSupervisor
 * ---------------
 *
 * Electron-main side supervisor responsible for managing the lifecycle of the
 * local Crux provider service. This module is intentionally small and focused:
 *
 * - It owns process orchestration only (start / stop / health-check).
 * - It does not contain any LLM or provider business logic.
 * - It is designed to be wired from the main bootstrap (CodeApplication
 *   in src/vs/code/electron-main/app.ts) as a singleton.
 *
 * Design goals:
 * - When the IDE launches, Crux is automatically started in the background.
 * - When the IDE shuts down, Crux is cleanly terminated.
 * - If CRUX_HTTP_BASE_URL or VOID_CRUX_HTTP_BASE_URL is already set,
 *   the supervisor does not spawn a child process and assumes Crux is
 *   managed externally (advanced / power-user mode).
 */

import { ChildProcess, spawn } from 'child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ILifecycleMainService, ShutdownReason } from '../../../../platform/lifecycle/electron-main/lifecycleMainService.js';
import { setCruxBaseUrl } from './llmMessage/cruxConfig.js';

export interface CruxSupervisorOptions {
	/**
	 * Python executable to use when spawning the Crux dev server.
	 * Defaults to process.env.VOID_PYTHON_PATH or "python".
	 */
	pythonCommand?: string;

	/**
	 * Host where the Crux HTTP service will listen.
	 * Defaults to "127.0.0.1".
	 */
	host?: string;

	/**
	 * Port where the Crux HTTP service will listen.
	 * Must match the dev server configuration in
	 * crux/crux_providers/service/dev_server.py.
	 * Defaults to 8091.
	 */
	port?: number;

	/**
	 * Optional explicit working directory for the Crux process. When omitted,
	 * the supervisor will attempt to derive the "crux" directory from the
	 * Electron app root (for example, a sibling "crux" next to "void_genesis_ide").
	 */
	cwd?: string;

	/**
	 * Timeout for Crux health check during startup (in milliseconds).
	 * Defaults to 15000 ms.
	 */
	startupHealthTimeoutMs?: number;

	/**
	 * Poll interval for Crux health check during startup (in milliseconds).
	 * Defaults to 500 ms.
	 */
	startupHealthPollIntervalMs?: number;
}

/**
 * Small wrapper to await a timeout using promises.
 */
function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * CruxSupervisor encapsulates a single Crux child process and exposes a
 * minimal API to:
 *
 * - Start Crux if it is not already managed externally.
 * - Wait for a successful "/api/health" response.
 * - Expose the resolved base URL.
 * - Dispose the child process on IDE shutdown.
 */
export class CruxSupervisor {
	private child: ChildProcess | null = null;
	private baseUrl: string | null = null;
	private starting: Promise<void> | null = null;
	private disposed = false;

	constructor(
		private readonly environmentMainService: IEnvironmentMainService,
		private readonly logService: ILogService,
		private readonly lifecycleMainService: ILifecycleMainService,
		private readonly options: CruxSupervisorOptions = {},
	) {
		// Ensure we clean up the child process on shutdown.
		this.lifecycleMainService.onWillShutdown(e => {
			// For non-KILL shutdowns, try to dispose gracefully.
			if (e.reason !== ShutdownReason.KILL) {
				void this.dispose();
			}
		});
	}

	/**
	 * Returns the resolved Crux base URL, if available.
	 *
	 * This is typically something like "http://127.0.0.1:8091". Callers should
	 * append the appropriate path segment (for example, "/api/health",
	 * "/api/models").
	 */
	public getBaseUrl(): string | null {
		return this.baseUrl;
	}
	
	/**
	 * Public entrypoint to ensure Crux is available. This method is safe to call
	 * multiple times; concurrent callers will share the same startup promise.
	 *
	 * Behavior:
	 * - Always start (or reuse) the embedded Crux dev server.
	 * - Wait for a successful "/api/health".
	 * - On success, publish the base URL via the Crux config singleton so all
	 *   main-process clients (for example, cruxBridge.ts) share the same URL.
	 */
	public async startIfNeeded(): Promise<void> {
		if (this.disposed) {
			this.logService.warn('[CruxSupervisor] startIfNeeded called after dispose; ignoring.');
			return;
		}
	
		// If we are already starting, share the same promise.
		if (this.starting) {
			return this.starting;
		}
	
		this.starting = this.doStart();
		return this.starting;
	}

	private async doStart(): Promise<void> {
		const host = this.options.host ?? '127.0.0.1';
		const port = this.options.port ?? 8091;
		const baseUrl = `http://${host}:${port}`;
		this.baseUrl = baseUrl;

		const pythonCommand = this.options.pythonCommand ?? process.env.VOID_PYTHON_PATH ?? 'python';

		// Derive "crux" directory relative to the app root if no explicit cwd is given.
		let cwd = this.options.cwd;
		if (!cwd) {
			// environmentMainService.appRoot typically points to the void_genesis_ide
			// root (dev) or the app root inside the built product.
			//
			// We support two repo layouts:
			//   1. Mono-repo sibling: <repo_root>/void_genesis_ide and <repo_root>/crux
			//   2. Nested submodule:  <repo_root>/void_genesis_ide/crux
			const appRoot = this.environmentMainService.appRoot;
			if (appRoot) {
				// Try common candidates in order and pick the first that exists.
				const candidateDirs = [
					// Nested: void_genesis_ide/crux
					join(appRoot, 'crux'),
					// Mono-repo sibling: <repo_root>/void_genesis_ide + <repo_root>/crux
					join(appRoot, '..', 'crux'),
					// Fallback for deeper appRoot (e.g. resources/app)
					join(appRoot, '..', '..', 'crux'),
				];

				for (const candidate of candidateDirs) {
					if (existsSync(candidate)) {
						cwd = candidate;
						break;
					}
				}

				if (!cwd) {
					this.logService.error('[CruxSupervisor] Unable to resolve Crux working directory from appRoot; will spawn using default cwd.', { appRoot, candidateDirs });
				}
			}
		}

		this.logService.info('[CruxSupervisor] Spawning Crux dev server...', { pythonCommand, cwd, host, port });

		// Spawn the dev server:
		//   python -m crux_providers.service.dev_server
		const child = spawn(
			pythonCommand,
			['-m', 'crux_providers.service.dev_server'],
			{
				cwd,
				env: {
					...process.env,
					// Allow users to override host/port in the future if dev_server.py honors them.
					PROVIDER_SERVICE_HOST: host,
					PROVIDER_SERVICE_PORT: String(port),
				},
				stdio: 'pipe',
			},
		);

		child.on('error', (err) => {
			// Prevent unhandled 'error' events from crashing the main process.
			this.logService.error('[CruxSupervisor] Crux process failed to spawn', err);
		});

		this.child = child;

		child.stdout?.on('data', chunk => {
			this.logService.info('[CruxSupervisor][stdout]', String(chunk).trim());
		});

		child.stderr?.on('data', chunk => {
			this.logService.error('[CruxSupervisor][stderr]', String(chunk).trim());
		});

		child.on('exit', (code, signal) => {
			this.logService.info('[CruxSupervisor] Crux process exited', { code, signal });
			this.child = null;
		});

		// Wait for /api/health to be ready.
		const healthUrl = `${baseUrl}/api/health`;
		const timeoutMs = this.options.startupHealthTimeoutMs ?? 15000;
		const pollIntervalMs = this.options.startupHealthPollIntervalMs ?? 500;

		const startTime = Date.now();
		let healthy = false;
		let lastError: unknown = null;

		this.logService.info('[CruxSupervisor] Waiting for Crux health at', healthUrl);

		while (Date.now() - startTime < timeoutMs) {
			if (this.disposed) {
				this.logService.warn('[CruxSupervisor] Aborting health wait because supervisor was disposed.');
				break;
			}

			try {
				const response = await fetch(healthUrl, { method: 'GET' });
				if (response.ok) {
					const data: any = await response.json().catch(() => ({}));
					if (data && typeof data === 'object' && (data as any).ok === true) {
						healthy = true;
						break;
					}
				}
				lastError = new Error(`Unexpected health response: ${response.status} ${response.statusText}`);
			} catch (err) {
				lastError = err;
			}

			await delay(pollIntervalMs);
		}

		if (!healthy) {
			this.logService.error('[CruxSupervisor] Crux did not become healthy within timeout.', lastError);
			throw new Error('[CruxSupervisor] Failed to start Crux service in time.');
		}
	
		// Publish the base URL via the Crux config singleton for downstream consumers.
		setCruxBaseUrl(baseUrl);
		this.logService.info('[CruxSupervisor] Crux is healthy at', baseUrl);
	}

	/**
	 * Dispose the supervisor and attempt to terminate the Crux child process if
	 * it was spawned by this supervisor.
	 */
	public async dispose(): Promise<void> {
		this.disposed = true;

		const child = this.child;
		if (!child) {
			return;
		}

		this.logService.info('[CruxSupervisor] Disposing Crux child process...');

		return new Promise(resolve => {
			const timeout = setTimeout(() => {
				if (!child.killed) {
					this.logService.warn('[CruxSupervisor] Forcibly killing Crux process after timeout.');
					try {
						child.kill('SIGKILL');
					} catch {
						// ignore
					}
				}
				this.child = null;
				resolve();
			}, 5000);

			child.on('exit', () => {
				clearTimeout(timeout);
				this.child = null;
				resolve();
			});

			try {
				// Try graceful termination first.
				if (!child.killed) {
					child.kill('SIGTERM');
				}
			} catch {
				// Ignore errors when sending signals; we will rely on the timeout.
			}
		});
	}
}