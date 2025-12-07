// Base utilities for Crux HTTP access used by main-process bridge modules.

import { getCruxConfig } from '../cruxConfig.js';

/**
 * Resolve the Crux HTTP base URL from the shared main-process Crux config.
 *
 * Historically this function read from process.env, but Crux is now treated as
 * an embedded service with a single URL owned by CruxSupervisor. The config
 * module is the only source of truth.
 *
 * The returned string is normalized to have no trailing slash.
 */
export function getCruxBaseUrl(): string {
	const { baseUrl } = getCruxConfig();
	return baseUrl.replace(/\/+$/, '');
}