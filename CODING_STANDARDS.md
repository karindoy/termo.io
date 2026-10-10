# Kotlin + Quarkus — Coding Standards & Architecture Guide

Engineering standards for building and maintaining the termo.io backend with Kotlin and Quarkus, following Clean Code principles and market-standard architectural patterns.

## 1. Architecture: Layered (Clean) Architecture

Separate the codebase into independent layers so business logic never depends on frameworks, databases, or transport details.

```
backend/src/main/kotlin/io/termo/
├── domain/            # Entities, value objects, services, repository interfaces, errors — no external deps
├── application/        # Use cases + game-mode strategies that orchestrate domain logic
├── infrastructure/     # Redis, dictionary, timers, session store, registries
└── presentation/       # JAX-RS resources, WebSocket endpoints, request/response DTOs
```

Dependency rule: `presentation → application → domain`, `infrastructure → domain`. The `domain` layer never imports from outer layers or from a framework.

## 2. Design Patterns (market standard)

| Pattern | Use case |
|---|---|
| **Repository** | Abstract data access (`RoomRepository`, `WordRepository` interfaces in `domain`, implementations in `infrastructure`) |
| **Dependency Injection** | CDI/ArC constructor injection — prefer `class Service(private val dep: Dep)` over field injection |
| **Factory** | Creating complex objects with invariants (`Word.create(...)`, `createRoomSettings(...)`) |
| **Strategy** | Swappable algorithms (`GameMode` with `ChampionshipMode` / `RaceMode`) |
| **Adapter** | Wrapping third-party SDKs (Redis `RedisDataSource`, Quarkus `WebSocketConnection`) behind internal interfaces |
| **Observer** | Domain events (`ChampionshipEvents`, `RaceEvents`) decoupled from WebSocket broadcasting |
| **Singleton** | Shared stateless/stateful infrastructure (`@ApplicationScoped` registries, `@Startup` binders) |
| **DTO / Mapper** | Translate domain entities to API/WebSocket shapes in `presentation.dto` |

Avoid pattern overuse: introduce a pattern when it removes duplication or coupling, not preemptively.

## 3. Clean Code Principles

- **SOLID**
  - *S*ingle Responsibility — one reason to change per class/module.
  - *O*pen/Closed — extend via new `GameMode` implementations, not by editing use cases.
  - *L*iskov Substitution — implementations honor the interface contract.
  - *I*nterface Segregation — small, focused interfaces.
  - *D*ependency Inversion — depend on `domain` interfaces, not concrete infrastructure.
- **Naming**: intention-revealing, no abbreviations (`submitGuess`, not `sbm`). Booleans read as predicates (`isResolved`, `hasFinished`).
- **Functions**: do one thing, ≤ 20 lines as a guideline, ≤ 3 parameters (use a data-class input beyond that).
- **No magic values**: extract to named constants (`WORD_LENGTH`, `DEFAULT_TIE_BREAK_MAX_ATTEMPTS`, `ROOM_TTL_SECONDS`).
- **Errors**: throw typed `DomainError` subclasses; never swallow exceptions silently; never use errors for control flow.
- **Comments**: explain *why*, not *what*. Delete code instead of commenting it out.
- **Immutability**: prefer `val` over `var`, `data class` + `copy()`, and pure functions; isolate mutable state (game rounds, registries) in the class that owns it.

## 4. Kotlin Conventions

- Kotlin `2.4.x`, JVM target `21`, explicit imports (no wildcard imports).
- Prefer `val`; use `var` only for genuinely mutable state (e.g. `WordRound.maxAttempts`).
- `data class` for value objects/DTOs; `sealed class`/`sealed interface` for closed hierarchies (`DomainError`).
- Null-safety: model absence with nullable types, use `?:`, `?.let`, `takeIf`; avoid `!!` except immediately after boundary validation.
- Use `java.time` for dates and always pass `Locale.ROOT` to `uppercase()`/`lowercase()`.
- Use `minOf`/`maxOf`, ranges, and `require`/`check` instead of manual comparisons where expressive.
- Keep `domain`/`application` free of Quarkus, Jackson, Jakarta, and Redis imports.

## 5. Quarkus Conventions

- **CDI scopes**: `@ApplicationScoped` for shared stateful beans, `@Singleton` for stateless/config holders, `@Startup` for hooks that must run eagerly (registries/binders). Use constructor injection.
- **all-open**: CDI-proxied classes must be open; the `kotlin-maven-plugin` `all-open` compiler plugin is configured for `@ApplicationScoped` / `@Path` / `@Provider` / `@WebSocket`.
- **REST**: JAX-RS (`quarkus-rest`) resources returning plain objects, serialized by Jackson. Synchronous methods run on worker threads — safe for blocking Redis calls. Use `suspend`/`Uni` only when logic is genuinely non-blocking.
- **API-first**: the REST contract is `src/main/resources/META-INF/openapi.yaml`; `openapi-generator-maven-plugin` (jaxrs-spec) generates the JAX-RS interfaces/models under `target/generated-sources/openapi`, and resources implement `*Api` instead of declaring `@Path` by hand. Never edit generated code. The WebSocket contract lives in `src/main/openapi/asyncapi.yaml`.
- **WebSockets**: `quarkus-websockets-next` endpoints under `/ws/*`, exchanging a JSON envelope `{ "event": ..., "data": ... }`.
- **Validation**: Bean Validation (`hibernate-validator`) on request DTOs at the boundary; validate raw WebSocket payloads explicitly.
- **Config**: `application.properties` with env-var expansion (`${PORT:4000}`), read via `@ConfigProperty` — never hardcode ports/hosts/secrets.
- **Redis**: use the blocking `RedisDataSource` from worker threads; keep key/TTL conventions documented in the repository implementation.

## 6. Naming & File Conventions

- Files: `PascalCase.kt`, named after the primary type (`ChampionshipMode.kt`, `RoomsResource.kt`).
- Packages: `io.termo.<layer>.<area>` (`io.termo.domain.entities`, `io.termo.presentation.sockets`).
- Classes/interfaces: `PascalCase`. Functions/properties: `camelCase`. Constants: `UPPER_SNAKE_CASE`.
- Co-locate a type with its tightly-coupled helpers; one primary concept per file where practical.
- Tests live under `src/test/kotlin` and are named `*Test.kt` / `*IT.kt`.

## 7. Error Handling

- `domain`/`application` throw typed `DomainError` subclasses; never return sentinel error values.
- REST translates them centrally in one `ExceptionMapper` (`presentation/http/ErrorMappers.kt`); WebSocket handlers catch them and emit an error event.
- Never expose stack traces or internal messages to clients in production.

## 8. Testing

- Unit tests for `domain`/`application` (pure, no I/O, fast) — JUnit 5, construct collaborators directly.
- Integration tests for `infrastructure`/`presentation` with `@QuarkusTest` + RestAssured; Redis Dev Services or a containerized Redis.
- E2E/real-time tests drive the browser over the real HTTP + WebSocket contract (Playwright suite in `e2e/`).
- Test naming: `should <expected behavior> when <condition>`.
- Mock at architectural boundaries (repository interfaces), not internal implementation details.

## 9. Tooling Baseline

- **Build**: Maven (wrapper committed at `backend/mvnw`), Kotlin `2.4.10`, Quarkus `3.40` LTS, Java `21`.
- **Lint/format**: detekt / ktlint for Kotlin (recommended), enforced via pre-commit hook.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`) for changelog/versioning automation.
- **CI gate**: Kotlin compile + tests, and frontend type-check, must pass before merge.
