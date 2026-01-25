# Code Optimization Analysis

This document identifies opportunities to replace custom code with built-in Bun features or existing libraries to reduce maintenance burden.

## Summary

After reviewing the codebase, here are the main opportunities for optimization:

1. **Rate Limiting** - Replace custom in-memory rate limiter with a library
2. **File Reading** - Use Bun's native `Bun.file()` instead of Node.js `readFileSync`
3. **Request ID Generation** - Use a library like `nanoid` instead of custom implementation
4. **Port Management** - Use a library like `get-port` for port detection/killing
5. **URL Validation** - Consider a dedicated URL validation library
6. **Buffer Usage** - Already using Node.js Buffer correctly, but could document Bun's native support

---

## Detailed Recommendations

### 1. Rate Limiting (`src/rate-limit.ts`)

**Current:** Custom in-memory rate limiter (150 lines)

**Recommendation:** Use `@upstash/ratelimit` for production-ready rate limiting

**Benefits:**
- Production-ready with Redis backend
- Works across multiple serverless instances
- Better memory management
- Battle-tested

**Alternative (lighter):** Keep current implementation but document it's for single-instance only

**Code Change:**
```typescript
// Instead of custom implementation
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"),
});
```

**Impact:** High - Reduces 150 lines of custom code, improves scalability

---

### 2. File Reading (`src/tagger.ts`)

**Current:** Using Node.js `readFileSync` for system prompt loading

**Recommendation:** Use Bun's native `Bun.file()` API

**Benefits:**
- Faster (Bun-optimized)
- More idiomatic for Bun
- Async by default (better for serverless)

**Code Change:**
```typescript
// Current (synchronous)
import { readFileSync } from "node:fs";
const SYSTEM_PROMPT = readFileSync(promptPath, "utf-8").trim();

// Better (async, Bun-native)
const SYSTEM_PROMPT = (await Bun.file(promptPath).text()).trim();
```

**Note:** This requires making the module async or loading at runtime

**Impact:** Medium - Better performance, more Bun-idiomatic

---

### 3. Request ID Generation (`src/server.ts`)

**Current:** Custom implementation using `Date.now()` and `Math.random()`

**Recommendation:** Use `nanoid` (tiny, fast, URL-safe unique IDs)

**Benefits:**
- Smaller IDs
- URL-safe
- Collision-resistant
- Well-tested

**Code Change:**
```typescript
// Current
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// Better
import { nanoid } from "nanoid";
function generateRequestId(): string {
  return nanoid();
}
```

**Impact:** Low - Small improvement, but cleaner code

---

### 4. Port Management (`src/cli-server.ts`)

**Current:** Custom port killing logic using `lsof` and `kill` commands

**Recommendation:** Use `get-port` library for port detection

**Benefits:**
- Cross-platform
- Simpler API
- Handles edge cases

**Code Change:**
```typescript
// Current: Custom killProcessOnPort function (80 lines)

// Better
import getPort from "get-port";

const port = await getPort({ port: DEFAULT_PORT });
// Automatically finds next available port if DEFAULT_PORT is in use
```

**Note:** This changes behavior slightly (finds next available port instead of killing)

**Impact:** Medium - Reduces 80 lines, more reliable

---

### 5. URL Validation (`src/security.ts`)

**Current:** Basic URL validation using `new URL()`

**Recommendation:** Current implementation is fine, but could add `is-url` for stricter validation

**Benefits:**
- More comprehensive validation
- Handles edge cases

**Code Change:**
```typescript
import isUrl from "is-url";

if (!isUrl(urlString)) {
  return createErrorResponse("Invalid URL format", ...);
}
```

**Impact:** Low - Current implementation is already good

---

### 6. Buffer Usage (`src/security.ts`)

**Current:** Using Node.js `Buffer.from()` for constant-time comparison

**Status:** ✅ Already optimal - Bun has native Buffer support, and `node:crypto.timingSafeEqual` is the correct approach

**No changes needed**

---

## Libraries to Consider Adding

### High Priority

1. **`nanoid`** (1KB) - Request ID generation
   - Tiny, fast, URL-safe
   - Replace custom ID generation

2. **`get-port`** (2KB) - Port management
   - Cross-platform port detection
   - Replace custom port killing logic

### Medium Priority

3. **`@upstash/ratelimit`** - Rate limiting (if using Redis)
   - Only if moving to distributed rate limiting
   - Current in-memory solution is fine for single-instance

### Low Priority

4. **`is-url`** - URL validation
   - Current validation is sufficient
   - Could add for stricter validation

---

## Code That's Already Optimal

✅ **Config loading** - Using Zod + Bun's auto .env loading (perfect)
✅ **Storage adapters** - Minimal wrappers, appropriate abstraction
✅ **UI utilities** - Simple DOM manipulation, no library needed
✅ **Security** - Using `node:crypto.timingSafeEqual` correctly
✅ **CLI parsing** - Using `citty` (good choice)
✅ **Logging** - Using `consola` with appropriate fallback

---

## Recommended Action Plan

### Phase 1: Quick Wins (Low Risk)
1. Replace request ID generation with `nanoid`
2. Replace file reading with `Bun.file()` (if async loading is acceptable)

### Phase 2: Medium Impact (Test Thoroughly)
3. Replace port management with `get-port`
4. Consider `@upstash/ratelimit` if moving to distributed rate limiting

### Phase 3: Keep As-Is
- Rate limiting (current implementation is fine for single-instance)
- URL validation (current implementation is sufficient)
- Storage adapters (minimal, appropriate abstraction)

---

## Estimated Code Reduction

- **Request ID generation:** ~5 lines → 1 line (using nanoid)
- **Port management:** ~80 lines → ~10 lines (using get-port)
- **File reading:** ~10 lines → ~3 lines (using Bun.file)
- **Total potential reduction:** ~90 lines of custom code

---

## Notes

- Bun's native APIs are generally faster than Node.js equivalents
- Most custom code is minimal and appropriate (storage adapters, UI utils)
- Rate limiting could stay custom if single-instance deployment is acceptable
- All recommendations maintain backward compatibility
