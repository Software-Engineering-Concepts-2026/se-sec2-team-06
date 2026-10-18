# Lab 11 Secret-Scanning Plan

For the implementer: execute inline with superpowers:executing-plans. Do not delegate unless the user explicitly requests delegation.

**Goal:** Add a dedicated Gitleaks workflow and document what it scans and what it cannot prove.
**Architecture:** Run Gitleaks on pull requests and pushes with full checkout history. Use GitHub's generated token only as required by the action; never store an actual application key in repository files.
**Tech stack:** GitHub Actions, Gitleaks Action v3, GitHub encrypted secrets.
**Spec:** ../specs/2026-10-07-lab9-11-delivery-security-design.md
**Related plan:** Run after 2026-10-07-lab11-api-validation.md so the security note already exists.

## External prerequisite

The repository belongs to the Software-Engineering-Concepts-2026 organization. The official Gitleaks Action documentation says organization repositories require a GITLEAKS_LICENSE encrypted secret; this must be configured by an organization/repository administrator before the hosted job can pass. This plan does not request, create, or expose that credential. If the secret is unavailable, stop before enabling a workflow that is guaranteed to fail and ask the user whether to configure it or approve a different scanner approach.

## Constraints

- Create .github/workflows/lab11-secret-scan.yml and append scanner details to docs/lab11/security.md.
- Use the official supported Gitleaks Action version and full-history checkout documented at implementation; disable PR comments/artifact upload unless the rubric specifically requires them.
- Do not weaken the scanner with broad allow-lists. Any exception must cite a confirmed false positive and be narrowly scoped.
- Do not change branch protection, secrets, workflows owned by other labs, prototypes/, or teammate files.
- Do not commit or push.

## Review focus

- Workflow runs for pull requests and pushes, checks repository history, and has least-privilege permissions.
- GITLEAKS_LICENSE is read from GitHub encrypted secrets and never written into YAML, logs, or docs.
- Documentation distinguishes a successful scan of the checked history from proof that all secrets are safe; leaked credentials must be rotated, not merely deleted.
- Hosted status is explicitly pending until a real GitHub Actions run can be observed. No push is authorized in this task.

## Steps

1. Re-check the official Gitleaks Action README and current supported major before implementation. Confirm the organization license prerequisite and checkout-history requirement.
2. Create .github/workflows/lab11-secret-scan.yml with pull_request and push triggers, read-only contents permission, a full-depth checkout, and the Gitleaks action. Reference GITLEAKS_LICENSE through secrets context only; use no literal credentials and no repository-write permission.
3. Append the action version, scan scope, expected license-secret setup, local scanner limitation, false-positive policy, and remote-run status to docs/lab11/security.md.
4. Validate YAML and workflow structure with an available actionlint/YAML parser; run the pinned Gitleaks CLI locally only if available and avoid printing any detected secret value. If unavailable, report local scanner validation as not run rather than claiming success.
5. Run git diff --check, inspect the workflow's permissions and secret references, and confirm only the two planned files changed in this plan. No commit or push; hosted Action remains unverified until a later authorized push/PR and license setup.

**Deliverable:** A least-privilege Gitleaks workflow that is ready for a hosted run once the organization secret prerequisite is met, with no false claim of remote verification.

**Reference:** [Official Gitleaks Action README](https://github.com/gitleaks/gitleaks-action/blob/master/README.md).
