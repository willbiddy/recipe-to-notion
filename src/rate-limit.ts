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
export interface RateLimitConfig {
	/**
	 * Maximum number of requests allowed in the time window.
	 */
	maxRequests: number;
	/**
	 * Time window in milliseconds.
	 */
	windowMs: number;
}

/**
 * Default rate limit: 10 requests per minute per IP/API key.
 */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
	maxRequests: 10,
	windowMs: 60 * 1000, // 1 minute
};

/**
 * Request tracking entry.
 */
interface RateLimitEntry {
	/**
	 * Number of requests made in the current window.
	 */
	count: number;
	/**
	 * Timestamp when the window started.
	 */
	windowStart: number;
}

/**
 * In-memory store for rate limit tracking.
 * Key: identifier (IP address or API key hash)
 * Value: rate limit entry
 */
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Cleanup interval to remove expired entries (runs every 5 minutes).
 */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Cleans up expired rate limit entries to prevent memory leaks.
 */
function cleanupExpiredEntries(): void {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now - entry.windowStart > DEFAULT_RATE_LIMIT.windowMs * 2) {
			rateLimitStore.delete(key);
		}
	}
}

// Start cleanup interval
if (typeof setInterval !== "undefined") {
	setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);
}

/**
 * Checks if a request should be rate limited.
 *
 * @param identifier - Unique identifier (IP address or API key hash).
 * @param config - Rate limit configuration (defaults to DEFAULT_RATE_LIMIT).
 * @returns Object with `allowed` boolean and `remaining` requests count.
 */
export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();
	const entry = rateLimitStore.get(identifier);

	if (!entry || now - entry.windowStart >= config.windowMs) {
		// New window or expired entry
		rateLimitStore.set(identifier, {
			count: 1,
			windowStart: now,
		});
		return {
			allowed: true,
			remaining: config.maxRequests - 1,
			resetAt: now + config.windowMs,
		};
	}

	if (entry.count >= config.maxRequests) {
		// Rate limit exceeded
		return {
			allowed: false,
			remaining: 0,
			resetAt: entry.windowStart + config.windowMs,
		};
	}

	// Increment count
	entry.count += 1;
	return {
		allowed: true,
		remaining: config.maxRequests - entry.count,
		resetAt: entry.windowStart + config.windowMs,
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
		hash = hash & hash; // Convert to 32-bit integer
	}
	return hash;
}

/**
 * Extracts client identifier from request (IP address or API key hash).
 *
 * @param request - The incoming request.
 * @returns Client identifier string.
 */
export function getClientIdentifier(request: Request): string {
	// Hash the API key for per-key rate limiting (if present)
	const authHeader = request.headers.get("Authorization");
	if (authHeader?.startsWith("Bearer ")) {
		const apiKey = authHeader.slice(7).trim();
		const hash = hashString(apiKey);
		return `api-key-${Math.abs(hash)}`;
	}

	// Fall back to IP address-based identification
	const forwardedFor = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

	return `ip-${ip}`;
}
