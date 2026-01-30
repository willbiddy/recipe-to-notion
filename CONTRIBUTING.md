# Contributing Guide

Thank you for your interest in contributing to Recipe Clipper for Notion! This guide will help you get started with development, understand our code standards, and make your first contribution.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style Guide](#code-style-guide)
- [JSDoc Standards](#jsdoc-standards)
- [Naming Conventions](#naming-conventions)
- [Testing Guidelines](#testing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Common Tasks](#common-tasks)

## Getting Started

### Prerequisites

- **Bun**: Package manager and runtime
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```

- **Python 3.11+**: Required for recipe scraping
  ```bash
  python3 --version  # Verify installation
  ```

- **Git**: Version control
  ```bash
  git --version  # Verify installation
  ```

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/yourusername/recipe-to-notion.git
cd recipe-to-notion

# Install dependencies
bun install

# Install Python dependencies
pip3 install -r requirements-dev.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Required
API_SECRET=your-secret-here
ANTHROPIC_API_KEY=sk-ant-...
NOTION_API_KEY=ntn_...
NOTION_DATABASE_ID=...

# Optional
PORT=3000
NODE_ENV=development
```

### Run the Development Server

```bash
# Start all watchers + server
bun run dev

# Or run individually:
bun run build:extension --watch
bun run build:web --watch
bun run server
```

## Development Workflow

### Branch Strategy

- **`main`**: Production-ready code
- **`feature/*`**: New features
- **`fix/*`**: Bug fixes
- **`docs/*`**: Documentation updates
- **`refactor/*`**: Code refactoring

```bash
# Create a new feature branch
git checkout -b feature/add-recipe-editing

# Make changes, commit, and push
git add .
git commit -m "feat: add recipe editing functionality"
git push origin feature/add-recipe-editing
```

### Development Loop

1. **Make changes** to source code
2. **Run linter** to check for issues:
   ```bash
   bun run lint
   ```
3. **Run type checker** to verify TypeScript:
   ```bash
   bun run typecheck
   ```
4. **Test manually** in extension/web interface
5. **Commit changes** with conventional commit message

### Git Hooks

Pre-commit hooks run automatically via `lint-staged`:

- **Linting**: Biome checks all staged files
- **Type checking**: TypeScript validates types
- **Formatting**: Biome auto-formats code

If hooks fail, fix the issues and re-commit.

## Code Style Guide

We use **Biome** for linting and formatting (replaces ESLint + Prettier).

### Configuration

See `biome.json` for full configuration.

### Key Style Rules

1. **Indentation**: Tabs (not spaces)
2. **Quotes**: Double quotes for strings
3. **Semicolons**: Required
4. **Line length**: 100 characters (soft limit)
5. **Import order**: Auto-sorted by Biome

### Running Biome

```bash
# Check for issues
bun run lint

# Auto-fix issues
bun run format

# Both lint and format
bun run lint && bun run format
```

### TypeScript Best Practices

1. **Avoid `any`**: Use `unknown` instead
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

2. **Use type guards**: Prefer custom type guards over type assertions
   ```typescript
   // Bad
   const value = data as string;

   // Good
   if (isString(data)) {
     // TypeScript knows data is a string here
   }
   ```

3. **Prefer `unknown` over `any`**: For unknown types from external sources
   ```typescript
   // External API response
   const result: unknown = await fetchData();

   // Validate before use
   const validated = schema.parse(result);
   ```

4. **Use Zod for validation**: Validate all external data
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

### JSDoc Format

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
 *
 * @example
 * ```typescript
 * // Another example showing different usage
 * const result2 = myFunction("value2");
 * ```
 */
export function myFunction(paramName: string, optionsParam?: Options): Result {
  // ...
}
```

### JSDoc Style Guide

1. **Use `@param` with dashes**: `@param name - Description` (not colons)
2. **Use `@returns`**: Not `@return`
3. **Use `@throws`**: Document exceptions with error types
4. **Include `@example`**: Provide practical usage examples
5. **Start descriptions with capital**: End with period
6. **Be specific**: Describe what the function does, not how it does it

### JSDoc Examples

#### Simple Function
```typescript
/**
 * Validates if a URL is a valid HTTP or HTTPS URL.
 *
 * @param url - The URL string to validate.
 * @returns True if the URL is valid HTTP(S), false otherwise.
 */
export function isValidHttpUrl(url: string): boolean {
  // ...
}
```

#### Complex Function with Examples
```typescript
/**
 * Saves a recipe by sending the URL to the server with progress streaming.
 *
 * Makes a POST request to the API with the recipe URL, then opens an SSE stream
 * to receive real-time progress updates (scraping, AI tagging, Notion save).
 *
 * @param options - Options for saving the recipe.
 * @param options.url - The recipe URL to save.
 * @param options.apiUrl - The API endpoint URL.
 * @param options.storage - Storage adapter for retrieving API key.
 * @param options.callbacks - Progress callbacks.
 * @returns Promise that resolves with the recipe response.
 *
 * @example
 * ```typescript
 * const result = await saveRecipe({
 *   url: "https://example.com/recipe",
 *   apiUrl: "http://localhost:3000/api/recipes",
 *   storage: createStorageAdapter(),
 *   callbacks: {
 *     onProgress: (msg) => console.log(msg),
 *     onComplete: (data) => console.log("Saved:", data.notionUrl),
 *     onError: (err) => console.error(err)
 *   }
 * });
 * ```
 */
export async function saveRecipe(options: SaveRecipeOptions): Promise<RecipeResponse> {
  // ...
}
```

#### Component Documentation
```typescript
/**
 * StatusMessage - Component for displaying status messages with icons.
 *
 * Renders info, success, or error messages with appropriate styling and icons.
 * Supports both plain text and HTML content, as well as JSX children.
 *
 * Features:
 * - Three status types: info, success, error
 * - Configurable text size
 * - HTML rendering support
 * - Accessible with aria-live
 *
 * @example
 * ```tsx
 * <StatusMessage
 *   message="Recipe saved successfully!"
 *   type={StatusType.Success}
 * />
 * ```
 */
export function StatusMessage(props: StatusMessageProps) {
  // ...
}
```

## Naming Conventions

### Functions

Follow these naming patterns for consistency:

| Prefix | Meaning | Example | When to Use |
|--------|---------|---------|-------------|
| `create*` | Instantiate new objects | `createStorageAdapter()` | Creating new instances, objects, or class instances |
| `build*` | Construct complex structures | `buildPageBody()` | Building complex data structures (Notion blocks, properties) |
| `get*` | Retrieve or derive values | `getWebsiteName()` | Retrieving or deriving simple values synchronously |
| `fetch*` | Async external data retrieval | `fetchRecipeData()` | Async operations that retrieve data from external sources |
| `handle*` | Event handlers | `handleSave()` | Event handlers and request processors |
| `validate*` | Validation functions | `validateRecipeRequest()` | Validation logic |
| `parse*` | Parsing functions | `parseSseStream()` | Parsing data from one format to another |
| `format*` | Formatting functions | `formatTimeMinutes()` | Formatting data for display |
| `is*` | Type guards & predicates | `isValidHttpUrl()` | Boolean checks and type guards |

### Variables

- **Constants**: `UPPER_SNAKE_CASE`
  ```typescript
  const MAX_RETRIES = 3;
  const API_BASE_URL = "https://api.example.com";
  ```

- **Variables**: `camelCase`
  ```typescript
  const recipeUrl = "...";
  const isLoading = false;
  ```

- **Types/Interfaces**: `PascalCase`
  ```typescript
  type RecipeResponse = { ... };
  interface StorageAdapter { ... }
  ```

- **Enums**: `PascalCase` for enum, `PascalCase` for values
  ```typescript
  enum StatusType {
    Info = "info",
    Success = "success",
    Error = "error",
  }
  ```

### Files

- **Components**: `kebab-case.tsx`
  ```
  status-message.tsx
  api-secret-prompt.tsx
  ```

- **Utilities**: `kebab-case.ts`
  ```
  url-utils.ts
  format-utils.ts
  ```

- **Types**: `kebab-case.ts`
  ```
  api-types.ts
  notion-types.ts
  ```

## Testing Guidelines

**Note:** Automated tests are not yet implemented. This section documents the planned testing strategy.

### Test Structure

```typescript
// utils/__tests__/url-utils.test.ts
import { describe, it, expect } from "vitest";
import { isValidHttpUrl, getWebsiteName } from "../url-utils";

describe("isValidHttpUrl", () => {
  it("returns true for valid HTTP URLs", () => {
    expect(isValidHttpUrl("http://example.com")).toBe(true);
  });

  it("returns true for valid HTTPS URLs", () => {
    expect(isValidHttpUrl("https://example.com")).toBe(true);
  });

  it("returns false for file:// URLs", () => {
    expect(isValidHttpUrl("file:///Users/...")).toBe(false);
  });

  it("returns false for chrome:// URLs", () => {
    expect(isValidHttpUrl("chrome://extensions")).toBe(false);
  });
});
```

### Test Coverage Goals

- **Utilities**: 80%+ coverage (pure functions, easy to test)
- **API Endpoints**: 70%+ coverage (integration tests)
- **Components**: 60%+ coverage (snapshot + behavior tests)

## Pull Request Process

### Before Submitting

1. **Run all checks**:
   ```bash
   bun run lint       # No linting errors
   bun run format     # Code formatted
   bun run typecheck  # No type errors
   ```

2. **Test manually**:
   - Extension: Test in Chrome
   - Web: Test in browser
   - CLI: Test command-line usage

3. **Update documentation**:
   - Add JSDoc to new functions
   - Update README if needed
   - Add examples for new features

### PR Title Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Examples:
feat(extension): add recipe editing functionality
fix(api): handle malformed recipe URLs
docs(readme): update installation instructions
refactor(notion): simplify block builder logic
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `refactor`: Code refactoring (no behavior change)
- `test`: Adding tests
- `chore`: Maintenance tasks

### PR Description Template

```markdown
## Description
Brief description of what this PR does.

## Changes
- Change 1
- Change 2
- Change 3

## Testing
How was this tested?

## Screenshots (if applicable)
Add screenshots for UI changes.

## Checklist
- [ ] Code follows style guide
- [ ] JSDoc added to new functions
- [ ] Manual testing completed
- [ ] No TypeScript errors
- [ ] No linting errors
```

### Review Process

1. **Automated checks**: GitHub Actions run lint + typecheck
2. **Code review**: Maintainer reviews code
3. **Changes requested**: Address feedback and push updates
4. **Approval**: Maintainer approves and merges

## Project Structure

```
recipe-to-notion/
├── api/                    # Vercel serverless functions
├── backend/                # Core server logic
│   ├── notion/            # Notion API integration
│   └── parsers/           # Python recipe scrapers
├── extension/              # Browser extension
│   ├── popup/
│   ├── background/
│   └── content/
├── web/                    # Web interface
├── shared/                 # Isomorphic code
│   ├── components/        # Solid.js components
│   ├── hooks/             # Custom hooks
│   ├── api/               # API client
│   └── storage.ts         # Storage adapter
├── scripts/                # Build scripts
├── docs/                   # Documentation
├── dist/                   # Build output (gitignored)
└── tests/                  # Test files (future)
```

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## Common Tasks

### Adding a New Component

1. **Create component file**: `shared/components/my-component.tsx`
   ```tsx
   /**
    * MyComponent - Brief description.
    *
    * Longer description with features and usage notes.
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

2. **Add JSDoc** with examples
3. **Export from index** (if applicable)
4. **Test in extension/web**

### Adding a New API Endpoint

1. **Create route file**: `api/my-endpoint.ts`
   ```typescript
   import { handleRecipeRequest } from "../backend/server-shared/recipe-handler";

   export default async function handler(req: Request) {
     // Implementation
   }
   ```

2. **Add validation** with Zod schemas
3. **Add JSDoc** with request/response examples
4. **Test with curl**:
   ```bash
   curl -X POST http://localhost:3000/api/my-endpoint \
     -H "Authorization: Bearer $API_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"key": "value"}'
   ```

### Adding a New Utility Function

1. **Create/update utility file**: `shared/my-utils.ts`
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

2. **Add comprehensive JSDoc**
3. **Add type guards if applicable**
4. **Consider adding tests**

### Debugging

#### Extension
```typescript
// Add to popup/background/content script
console.log("[Extension]", data);

// View logs in:
// - Popup: Right-click popup → Inspect
// - Background: chrome://extensions → Inspect service worker
// - Content: Page DevTools → Console
```

#### Web Interface
```typescript
// Standard browser DevTools
console.log("[Web]", data);
```

#### Backend
```typescript
// Server logs
console.log("[Server]", data);

// View in terminal running `bun run server`
```

## Code Review Checklist

Before requesting review, ensure:

- [ ] Code follows naming conventions
- [ ] All exported functions have JSDoc
- [ ] Examples included for complex functions
- [ ] No `any` types used
- [ ] Type guards used for `unknown` types
- [ ] Errors handled gracefully
- [ ] No sensitive data logged
- [ ] Code formatted with Biome
- [ ] TypeScript compiles without errors
- [ ] Linter passes without errors
- [ ] Manual testing completed
- [ ] PR description is clear and complete

## Error Handling Patterns

### Pattern 1: Critical Errors (Re-throw)

```typescript
try {
  const result = await criticalOperation();
  return result;
} catch (error) {
  console.error('Failed to perform critical operation:', error);
  throw new AppError('Operation failed', { cause: error });
}
```

### Pattern 2: Non-Critical Errors (Log and Continue)

```typescript
try {
  await optionalOperation();
} catch (error) {
  console.warn('Optional operation failed:', error);
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
  const message = error instanceof Error ? error.message : 'Unknown error';
  setStatus({ message, type: StatusType.Error });
  // Don't re-throw - error handled by UI
}
```

**Document these patterns in code:**
```typescript
/**
 * @throws {ValidationError} When the URL is invalid.
 * @throws {NetworkError} When the server is unreachable.
 */
```

## Security Considerations

When contributing, be mindful of:

1. **Input Validation**: Validate all external inputs
2. **SSRF Prevention**: Validate URLs before fetching
3. **No Stack Traces**: Never expose stack traces to users
4. **Secrets**: Never log or commit API keys
5. **Rate Limiting**: Consider impact on rate limits
6. **XSS Prevention**: Sanitize HTML before rendering

## Getting Help

- **Questions**: Open a GitHub Discussion
- **Bugs**: Open a GitHub Issue
- **Feature Requests**: Open a GitHub Issue with `[Feature Request]` prefix
- **Documentation**: Check [README.md](README.md) and [ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Recognition

Contributors will be added to:
- **README.md**: Contributors section
- **GitHub**: Contributor graph
- **Release Notes**: Acknowledged in changelogs

Thank you for contributing! 🎉
