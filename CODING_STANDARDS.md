# Node.js + TypeScript — Coding Standards & Architecture Guide

Engineering standards for building and maintaining this site with Node.js and TypeScript, following Clean Code principles and market-standard architectural patterns.

## 1. Architecture: Layered (Clean) Architecture

Separate the codebase into independent layers so business logic never depends on frameworks, databases, or HTTP details.

```
src/
├── domain/            # Entities, value objects, business rules — no external dependencies
├── application/        # Use cases / services that orchestrate domain logic
├── infrastructure/     # DB, external APIs, file system, third-party SDKs
├── presentation/        # HTTP controllers, routes, request/response DTOs
├── shared/              # Cross-cutting utils, errors, types
└── config/              # Env loading, DI container setup
```

Dependency rule: `presentation → application → domain`, `infrastructure → domain`. The `domain` layer never imports from outer layers.

## 2. Design Patterns (market standard)

| Pattern | Use case |
|---|---|
| **Repository** | Abstract data access (`UserRepository` interface in `domain`, implementation in `infrastructure`) |
| **Dependency Injection** | Constructor injection for testability; use a lightweight container (`tsyringe`, `awilix`) or manual composition root |
| **Factory** | Creating complex objects/entities with invariants (`UserFactory.create(...)`) |
| **Strategy** | Swappable algorithms (payment providers, auth strategies) |
| **Adapter** | Wrapping third-party SDKs to match an internal interface |
| **Decorator** | Cross-cutting concerns (logging, caching, retries) without modifying core logic |
| **Observer / Event Emitter** | Domain events, decoupled side effects (`user.created` → send welcome email) |
| **Singleton** | Shared stateless resources only (DB connection pool, logger) — avoid for business services |
| **DTO / Mapper** | Translate between domain entities and API/persistence shapes |

Avoid pattern overuse: introduce a pattern when it removes duplication or coupling, not preemptively.

## 3. Clean Code Principles

- **SOLID**
  - *S*ingle Responsibility — one reason to change per class/module.
  - *O*pen/Closed — extend via new code, not by editing stable code.
  - *L*iskov Substitution — subtypes must be substitutable without surprises.
  - *I*nterface Segregation — small, focused interfaces over fat ones.
  - *D*ependency Inversion — depend on abstractions (interfaces), not concrete implementations.
- **Naming**: intention-revealing, no abbreviations (`getUserById`, not `getUsr`). Booleans read as predicates (`isActive`, `hasPermission`).
- **Functions**: do one thing, ≤ 20 lines as a guideline, ≤ 3 parameters (use an options object beyond that).
- **No magic values**: extract to named constants or enums.
- **Errors**: throw typed domain errors (`class NotFoundError extends AppError`), never swallow exceptions silently, never use errors for control flow.
- **Comments**: explain *why*, not *what*. Delete code instead of commenting it out.
- **Immutability**: prefer `readonly`, `const`, and pure functions; avoid mutating shared state.
- **DRY, but not premature**: three similar lines are fine; don't abstract until duplication causes real pain.

## 4. TypeScript Conventions

- `strict: true` in `tsconfig.json` (`noImplicitAny`, `strictNullChecks`, etc.) — non-negotiable.
- No `any`; use `unknown` + narrowing, or generics.
- Prefer `type` for unions/utility shapes, `interface` for object contracts that may be extended/implemented.
- Use discriminated unions for state/result modeling instead of optional flags:
  ```ts
  type Result<T> = { ok: true; value: T } | { ok: false; error: AppError };
  ```
- Use enums or `as const` literal unions for fixed sets of values.
- Validate all external input (HTTP body, env vars, third-party responses) at the boundary with a schema library (`zod`) — never trust raw `any` from `JSON.parse` or `req.body`.

## 5. Naming & File Conventions

- Files: `kebab-case.ts` (`user-repository.ts`), classes/types: `PascalCase`, variables/functions: `camelCase`, constants: `UPPER_SNAKE_CASE`.
- One exported concept per file where practical; co-locate tests as `*.spec.ts` next to source.
- Barrel files (`index.ts`) only at module boundaries, not throughout.

## 6. Error Handling

- Centralize HTTP error translation in one middleware (`presentation/middlewares/error-handler.ts`).
- Domain/application layers throw typed errors; presentation layer maps them to HTTP status codes.
- Never expose stack traces or internal error messages to clients in production.

## 7. Testing

- Unit tests for `domain` and `application` layers (pure, no I/O, fast).
- Integration tests for `infrastructure` (real or containerized DB).
- E2E tests for `presentation` (HTTP request → response).
- Test naming: `should <expected behavior> when <condition>`.
- Mock at architectural boundaries (repository interfaces), not internal implementation details.

## 8. Tooling Baseline

- **Lint/format**: ESLint (`@typescript-eslint`) + Prettier, enforced via pre-commit hook.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) for changelog/versioning automation.
- **CI gate**: type-check, lint, test must pass before merge.
