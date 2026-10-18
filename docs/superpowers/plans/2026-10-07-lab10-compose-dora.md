# Lab 10 Local Stack and DORA Worksheet Plan

For the implementer: execute inline with superpowers:executing-plans. Do not delegate unless the user explicitly requests delegation.

**Goal:** Make the local WebApp/API/PostgreSQL/Redis stack reproducible and document DORA measures without inventing team results.
**Architecture:** Compose starts four local services. PostgreSQL and Redis are available for future integration; the current API remains unconnected and must not claim to persist data.
**Tech stack:** Docker Compose, PostgreSQL, Redis, Markdown, environment-variable substitution.
**Spec:** ../specs/2026-10-07-lab9-11-delivery-security-design.md

## Constraints

- Modify only compose.webapp.yml, .gitignore, README.md if needed for local-start instructions, and new .env.example and docs/lab10/dora.md.
- Do not modify API behavior or add persistence/Redis clients.
- Do not place actual credentials in .env.example. Keep local environment files ignored.
- Do not edit prototypes/ or teammate-owned files; do not commit or push.

## Review focus

- Compose contains WebApp, API, PostgreSQL, and Redis with health checks for stateful services and explicit, local-development-only configuration.
- Secrets are sourced from environment variables; .env.example contains unmistakable sample values only, and .gitignore preserves the example while ignoring real .env variants.
- Do not make API depend on database/cache readiness or imply it uses either service.
- DORA worksheet defines Deployment Frequency, Lead Time for Changes, Change Failure Rate, and Time to Restore Service, with blank values and data-source fields.

## Steps

1. Inspect the current compose.webapp.yml and .gitignore. Preserve existing API/WebApp ports, build contexts, WebApp-to-API dependency, and ignore behavior.
2. Create .env.example with local-only placeholder variables for PostgreSQL database, username, and password. Add explicit ignore rules for .env and .env.* while allowing the tracked .env.example.
3. Extend compose.webapp.yml with version-pinned PostgreSQL and Redis images selected from official maintained tags at implementation, health checks, environment substitution, and localhost-only host-port bindings if host access is needed. Keep all credentials out of the Compose file; do not add API database/cache integration or dependency claims.
4. Create docs/lab10/dora.md with a plain-language definition, numerator/denominator or timing rule, measurement period, source evidence, and an empty result cell for each metric. State that this repository currently has no production deployment/incident data and values must be supplied by the team.
5. If README instructions are needed, add a short command to copy .env.example to .env and start the local Compose stack; warn that these settings are for local development only and link to the worksheet. Do not claim database persistence from the app.
6. Validate with docker compose --env-file .env.example -f compose.webapp.yml config, then docker compose build for the configured app services (or report Docker unavailable). Review resolved config to ensure no sample credentials are treated as production values, run git diff --check, and inspect all touched paths. Do not start or leave containers running unless needed for a test; if started, stop only the containers created for this verification. No commit or push.

**Deliverable:** A valid local four-service Compose definition plus an honest, unfilled DORA measurement worksheet.
