/**
 * Simple in-memory rate limiter.
 *
 * For production use, consider using a distributed rate limiting service
 * like @upstash/ratelimit or Vercel Edge Middleware with Redis.
 *
 * This implementation uses an in-memory Map and is suitable for single-instance
 * deployments. For serverless functions with multiple instances, use a
 * distributed solution.
 */

/**
 * Rate limit configuration.
 */
export type RateLimitConfig = {
	/**
	 * Maximum number of requests allowed in the time window.
	 */
	maxRequests: number;
	/**
	 * Time window in milliseconds.
	 */
	windowMs: number;
};

/**
 * Default rate limit: 10 requests per minute per IP/API key.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
	maxRequests: 10,
	windowMs: 60 * 1000,
};

/**
 * Request tracking entry.
 */
type RateLimitEntry = {
	/**
	 * Number of requests made in the current window.
	 */
	count: number;
	/**
	 * Timestamp when the window started.
	 */
	windowStart: number;
};

/**
 * In-memory store for rate limit tracking.
 * Key: identifier (IP address or API key hash)
 * Value: rate limit entry
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

import { CLEANUP_INTERVAL_MS } from "../shared/constants.js";

/**
 * Cleans up expired rate limit entries to prevent memory leaks.
 *
 * Uses a conservative cleanup threshold (10 minutes) to ensure entries
 * from any reasonable rate limit configuration are cleaned up, even if
 * a custom config with a longer window was used.
 */
function cleanupExpiredEntries(): void {
	const now = Date.now();
	// Use a conservative threshold (10 minutes) to handle any reasonable rate limit window
	// This ensures cleanup works even if custom configs with longer windows are used
	const CLEANUP_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now - entry.windowStart > CLEANUP_THRESHOLD_MS) {
			rateLimitStore.delete(key);
		}
	}
}

if (typeof setInterval !== "undefined") {
	setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Checks if a request should be rate limited.
 *
 * Creates a new window if no entry exists or the current window has expired.
 * Returns rate limit exceeded if the count has reached the maximum. Otherwise
 * increments the count and returns the remaining requests.
 *
 * @param identifier - Unique identifier (IP address or API key hash).
 * @param config - Rate limit configuration (defaults to DEFAULT_RATE_LIMIT).
 * @returns Object with `allowed` boolean, `remaining` requests count, and `resetAt` timestamp.
 */
export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);
	const isWindowExpired = !entry || now - entry.windowStart >= config.windowMs;

	if (isWindowExpired) {
		const windowStart = now;
		rateLimitStore.set(identifier, {
			count: 1,
			windowStart,
		});
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetAt: windowStart + config.windowMs,
		};
	}

	const resetAt = entry.windowStart + config.windowMs;

	if (entry.count >= config.maxRequests) {
		return {
			allowed: false,
			remaining: 0,
			resetAt,
		};
	}

	entry.count += 1;
	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetAt,
	};
}

/**
 * Simple string hash function for rate limiting identifiers.
 * Not cryptographically secure - only used for rate limiting purposes.
 *
 * @param str - String to hash.
 * @returns 32-bit integer hash value.
 */
function hashString(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
	}
	return hash;
}

/**
 * Extracts client identifier from request for rate limiting.
 *
 * Hashes the API key for per-key rate limiting if present in the Authorization header.
 * Falls back to IP address-based identification using x-forwarded-for or x-real-ip headers.
 *
 * @param request - The incoming request.
 * @returns Client identifier string (api-key-{hash} or ip-{address}).
 */
export function getClientIdentifier(request: Request): string {
	const authHeader = request.headers.get("Authorization");

	if (authHeader?.startsWith("Bearer ")) {
		const apiKey = authHeader.slice(7).trim();
		const hash = hashString(apiKey);
		return `api-key-${Math.abs(hash)}`;
	}

	const forwardedFor = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

	return `ip-${ip}`;
}
