/**
 * Crux configuration singleton for Electron main.
 *
 * Design rule for this repo:
 * - Crux is an embedded service, not an optional external microservice.
 * - There is exactly one Crux HTTP base URL for a given IDE process.
 * - CruxSupervisor is responsible for discovering/starting Crux and
 *   setting this base URL once Crux is healthy.
 * - All other main-process Crux clients (e.g. cruxBridge) must read the
 *   URL from this module, not from process.env.
 */

export interface CruxConfig {
	/**
	 * Base URL for the Crux HTTP service, e.g. "http://127.0.0.1:8091".
	 * This value is normalized to have no trailing slash.
	 */
	baseUrl: string;
}

/**
 * In-memory singleton config for this Electron main process.
 *
 * We provide a conservative default for dev so that callers have *some*
 * value even before CruxSupervisor has run, but the intended flow is:
 *
 *   - CruxSupervisor computes host/port (e.g. 127.0.0.1:8091)
 *   - CruxSupervisor waits for `/api/health` to be ok
 *   - CruxSupervisor calls `setCruxBaseUrl(baseUrl)`
 *
 * After that point, all Crux HTTP clients must use `getCruxConfig()`.
 */
let currentConfig: CruxConfig = {
	baseUrl: 'http://127.0.0.1:8091',
};

/**
 * Return the current Crux configuration for this process.
 */
export function getCruxConfig(): CruxConfig {
	return currentConfig;
}

/**
 * Update the Crux base URL used by all main-process Crux HTTP clients.
 *
 * This should normally only be called by CruxSupervisor after it has
 * successfully started or connected to a Crux instance and verified
 * `/api/health`. The URL is normalized to avoid trailing slashes.
 */
export function setCruxBaseUrl(baseUrl: string): void {
	const normalized = baseUrl.replace(/\/+$/, '');
	currentConfig = { baseUrl: normalized };
}