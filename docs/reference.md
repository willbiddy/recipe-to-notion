# Development Reference

Quick reference for code standards and development patterns.

## Code Style

We use **Biome** for linting and formatting.

### Key Rules

- **Indentation**: Tabs (not spaces)
- **Quotes**: Double quotes for strings  
- **Semicolons**: Required
- **Line length**: 100 characters (soft limit)
- **Filenames**: kebab-case

### Running Biome

```bash
bun run lint       # Check for issues
bun run format     # Auto-fix issues
bun run typecheck  # TypeScript validation
```

### TypeScript Best Practices

**Avoid `any`**: Use `unknown` instead

```typescript
// Bad
function process(data: any) { }

// Good
function process(data: unknown) {
  if (isObject(data)) {
    // Use type guards to narrow types
  }
}
```

**Use type guards**: Prefer custom type guards over type assertions

```typescript
// Bad
const value = data as string;

// Good
if (isString(data)) {
  // TypeScript knows data is a string here
}
```

**Use Zod for validation**: Validate all external data

```typescript
import { z } from "zod";

const schema = z.object({
  url: z.string().url(),
  stream: z.boolean().optional(),
});

const data = schema.parse(requestBody);
```

## JSDoc Standards

All exported functions, types, and components must have JSDoc comments.

### Format

```typescript
/**
 * Brief one-line description of what the function does.
 *
 * Longer explanation providing context, behavior, and any important details.
 * Can span multiple paragraphs if needed.
 *
 * @param paramName - Description of the parameter.
 * @param optionsParam - Description with additional context.
 * @param optionsParam.nestedProperty - Description of nested property.
 * @returns Description of the return value.
 * @throws {ErrorType} When and why this error is thrown.
 *
 * @example
 * ```typescript
 * // Example usage
 * const result = myFunction("value", { option: true });
 * console.log(result); // Output
 * ```
 */
```

### Style Guide

1. **Use `@param` with dashes**: `@param name - Description` (not colons)
2. **Use `@returns`**: Not `@return`
3. **Use `@throws`**: Document exceptions with error types
4. **Include `@example`**: Provide practical usage examples
5. **Start descriptions with capital**: End with period

## Naming Conventions

### Functions

| Prefix | Meaning | Example | When to Use |
|--------|---------|---------|-------------|
| `create*` | Instantiate new objects | `createStorageAdapter()` | Creating new instances |
| `build*` | Construct complex structures | `buildPageBody()` | Building data structures |
| `get*` | Retrieve or derive values | `getWebsiteName()` | Synchronous value retrieval |
| `fetch*` | Async external data retrieval | `fetchRecipeData()` | Async external operations |
| `handle*` | Event handlers | `handleSave()` | Event handlers and processors |
| `validate*` | Validation functions | `validateRecipeRequest()` | Validation logic |
| `parse*` | Parsing functions | `parseSseStream()` | Parsing data formats |
| `format*` | Formatting functions | `formatTimeMinutes()` | Display formatting |
| `is*` | Type guards & predicates | `isValidHttpUrl()` | Boolean checks |
| `use*` | React/Solid hooks | `useRecipeSave()` | Custom hooks |

### Variables

- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`, `API_BASE_URL`)
- **Variables**: `camelCase` (e.g., `recipeUrl`, `isLoading`)
- **Types/Interfaces**: `PascalCase` (e.g., `RecipeResponse`, `StorageAdapter`)
- **Enums**: `PascalCase` for enum and values (e.g., `StatusType.Info`)

### Files

- **Components**: `kebab-case.tsx` (e.g., `status-message.tsx`)
- **Utilities**: `kebab-case.ts` (e.g., `url-utils.ts`)
- **Types**: `kebab-case.ts` (e.g., `api-types.ts`)

## Common Tasks

### Adding a New Component

1. **Create file**: `shared/components/my-component.tsx`

```tsx
/**
 * MyComponent - Brief description.
 *
 * @example
 * ```tsx
 * <MyComponent prop="value" />
 * ```
 */
export function MyComponent(props: MyComponentProps) {
  return <div>{props.children}</div>;
}
```

2. Add JSDoc with examples
3. Test in extension/web

### Adding a New API Endpoint

1. **Create file**: `api/my-endpoint.ts`

```typescript
import { handleRecipeRequest } from "../backend/server-shared/recipe-handler";

export default async function handler(req: Request) {
  // Implementation with Zod validation
}
```

2. Add Zod validation
3. Add JSDoc with examples
4. Test with curl:

```bash
curl -X POST http://localhost:3000/api/my-endpoint \
  -H "Authorization: Bearer $API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

### Adding a New Utility Function

1. **Create/update file**: `shared/my-utils.ts`

```typescript
/**
 * myFunction - Does something useful.
 *
 * @param input - Description.
 * @returns Description.
 *
 * @example
 * ```typescript
 * myFunction("input") // Output
 * ```
 */
export function myFunction(input: string): string {
  return input.toUpperCase();
}
```

2. Add comprehensive JSDoc
3. Add type guards if applicable

## Error Handling Patterns

### Pattern 1: Critical Errors (Re-throw)

```typescript
try {
  const result = await criticalOperation();
  return result;
} catch (error) {
  console.error("Failed to perform critical operation:", error);
  throw new AppError("Operation failed", { cause: error });
}
```

### Pattern 2: Non-Critical Errors (Log and Continue)

```typescript
try {
  await optionalOperation();
} catch (error) {
  console.warn("Optional operation failed:", error);
  // Return fallback value or continue
  return defaultValue;
}
```

### Pattern 3: User-Facing Errors (Transform and Handle)

```typescript
try {
  const result = await userOperation();
  return result;
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  setStatus({ message, type: StatusType.Error });
  // Don't re-throw - error handled by UI
}
```

**Document error throws in JSDoc:**

```typescript
/**
 * @throws {ValidationError} When the URL is invalid.
 * @throws {NetworkError} When the server is unreachable.
 */
```

## Git Workflow

Use conventional branch prefixes for organization:

- `main`: Production-ready code
- `feature/*`: New features
- `fix/*`: Bug fixes  
- `docs/*`: Documentation updates
- `refactor/*`: Code refactoring

Use conventional commits for clarity:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no behavior change)
- `chore`: Maintenance tasks

Example: `feat(extension): add recipe editing functionality`
