#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")"

# Computed on the host (fast, no Docker needed for this part) and handed to
# docker-compose.yml's backend service via ${E2E_FIXED_WORDS} interpolation,
# so the test and the backend agree on the secret words without installing
# anything else on the host — everything that actually runs the app/browser
# lives inside the containers below.
export E2E_FIXED_WORDS
E2E_FIXED_WORDS="$(npx tsx tests/support/print-fixed-words.ts)"

# Containers run as this uid:gid so bind-mounted files they write (screenshots,
# test-results, node_modules/.vite cache) stay owned by the host user, not root.
export HOST_UID
export HOST_GID
HOST_UID="$(id -u)"
HOST_GID="$(id -g)"

# Allow callers to override player count / per-test timeout for smoke runs, e.g.
# E2E_PLAYER_COUNT=4 E2E_TEST_TIMEOUT_MS=180000 ./run.sh
export E2E_PLAYER_COUNT="${E2E_PLAYER_COUNT:-50}"
export E2E_TEST_TIMEOUT_MS="${E2E_TEST_TIMEOUT_MS:-900000}"

docker compose up --abort-on-container-exit --exit-code-from e2e
exit_code=$?

docker compose down -v

exit $exit_code
