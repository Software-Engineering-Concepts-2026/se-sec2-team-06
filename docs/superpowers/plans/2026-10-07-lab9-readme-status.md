# Lab 09 README and CI Status Plan

For the implementer: execute inline with superpowers:executing-plans. Do not delegate unless the user explicitly requests delegation.

**Goal:** Make the Lab 09 result and remaining GitHub-side checks easy to find without overstating what was verified.
**Architecture:** Documentation-only update. Preserve the existing Python workflow and all test behavior.
**Tech stack:** Markdown, existing GitHub Actions workflow, Python 3.12 / pytest.
**Spec:** ../specs/2026-10-07-lab9-11-delivery-security-design.md

## Constraints

- Work in se-sec2-team-06-main-new on its current branch.
- Do not modify workflow code, tests, branch protection, or GitHub settings.
- Do not edit teammate-owned files or anything under prototypes/.
- Do not commit or push. The plan's final result is a reviewed local diff.
- Do not call the hosted workflow “latest” or “green” unless GitHub's current run was actually checked.

## Review focus

- The badge points to the existing .github/workflows/test.yml on the repository's main branch and opens the workflow page.
- Text distinguishes local evidence (39 tests and 100% coverage for the measured src/ and services/api/app/ scope, subject to rerun) from remote Actions and branch-protection state, which remain unverified.
- README wording does not change the Lab 09 scope or imply that branch protection is active.

## Steps

1. Inspect the README Testing & CI and Project Status sections plus .github/workflows/test.yml. Confirm the workflow filename and current repository URL before adding a badge.
2. Update only README.md: add a Lab 09 Actions status badge linked to the repository's test workflow; phrase local verification and pending remote verification separately; retain the existing test-suite descriptions and style.
3. Verify that the badge URL references the correct workflow and main branch, all README links touched still resolve to existing paths, and the status wording makes no claim about a remote run.
4. Run the existing CI-equivalent pytest command with PYTHONPATH=services/api and the 90% coverage threshold; then run git diff --check and inspect git diff -- README.md. Report actual outputs; make no commit or push.

**Deliverable:** An accurate README-only Lab 09 status update, with local tests passing and no GitHub-side state claimed.
