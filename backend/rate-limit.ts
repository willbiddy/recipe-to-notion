/**
 * Simple in-memory rate limiter using token bucket algorithm.
 */

import { createHash } from "node:crypto";
import { CLEANUP_INTERVAL_MS } from "../shared/constants.js";

export type RateLimitConfig = {
	maxRequests: number;
	windowMs: number;
};

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
	maxRequests: 10,
	windowMs: 60 * 1000,
};

type RateLimitEntry = {
	count: number;
	windowStart: number;
};

const rateLimitStore: Map<string, RateLimitEntry> = new Map<string, RateLimitEntry>();

let lastCleanupTime: number = Date.now();

function cleanupExpiredEntries(): void {
	const now = Date.now();
	for (const [key, entry] of rateLimitStore.entries()) {
		if (now - entry.windowStart > CLEANUP_INTERVAL_MS) {
			rateLimitStore.delete(key);
		}
	}
}

/**
 * Checks if a request should be rate limited.
 *
 * @param identifier - Unique identifier (IP or API key hash)
 * @param config - Rate limit configuration
 * @returns Object with allowed, remaining, and resetAt
 */
export function checkRateLimit(
	identifier: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: boolean; remaining: number; resetAt: number } {
	const now = Date.now();

	// Perform lazy cleanup if enough time has passed
	// This replaces the setInterval() approach which is incompatible with serverless
	if (now - lastCleanupTime > CLEANUP_INTERVAL_MS) {
		cleanupExpiredEntries();
		lastCleanupTime = now;
	}

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
 * Extracts rate limit identifier from request.
 *
 * @param request - Incoming request
 * @returns Rate limit identifier (api-key-{hash} or ip-{address})
 */
export function getRateLimitIdentifier(request: Request): string {
	const authHeader = request.headers.get("Authorization");

	if (authHeader?.startsWith("Bearer ")) {
		const apiKey = authHeader.slice(7).trim();
		const hash = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
		return `api-key-${hash}`;
	}

	const forwardedFor = request.headers.get("x-forwarded-for");
	const realIp = request.headers.get("x-real-ip");
	const ip = forwardedFor?.split(",")[0]?.trim() || realIp || "unknown";

	return `ip-${ip}`;
}
