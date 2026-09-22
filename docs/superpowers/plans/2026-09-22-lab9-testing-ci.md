# Lab 09 Testing and CI Implementation Plan

> For agentic workers: use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** เพิ่มหลักฐาน Lab 09 ให้ repository มี unit tests, TDD FizzBuzz, Hypothesis properties, GitHub Actions CI และ journal ที่ตรวจสอบได้ โดยไม่แก้ prototypes.

**Architecture:** ใช้ scripts/generate_repo_contributors.normalize_contributors() เป็น behavior จริงสำหรับ unit/property tests และแยก FizzBuzz kata เป็น module เล็กใน src/. Workflow เดียวจะรัน API tests ที่มีอยู่, root tests และ scripts tests พร้อม coverage จาก src และ FastAPI app.

**Tech Stack:** Python 3.12, pytest 9.1.1, pytest-cov 7.1.0, Hypothesis 6.168.0, GitHub Actions.

**Spec:** docs/superpowers/specs/2026-09-22-lab9-testing-ci.md

## Global Constraints

- ห้ามแก้ ย้าย ลบ หรือ import runtime จาก prototypes/.
- normalize_contributors() ต้องรักษา behavior เดิมและใช้ test data แบบ fixture ใน tests.
- FizzBuzz ต้องเป็น module ใหม่ ไม่ผูกกับ prototype หรือ API key.
- CI ต้องรันทั้ง services/api/tests, tests และ scripts/tests.
- PYTHONPATH=services/api ต้องถูกตั้งใน CI เพื่อให้ import app.main จาก root ทำงาน.
- ไม่ตั้งค่า GitHub branch protection อัตโนมัติ; บันทึกเป็น manual follow-up เท่านั้น.

## Review Focus

- Payload ว่าง/null author/ข้อมูล week ผิดรูปแบบต้องถูกข้ามอย่างปลอดภัย — tests/test_unit.py.
- max_contributors และ weeks ที่ต่ำกว่า 1 ต้องถูกปฏิเสธ — tests/test_unit.py.
- Property input ที่มีจำนวน contributor/week มากกว่าขีดจำกัดต้องไม่ทำให้ output เกิน limit — tests/test_property.py.
- FizzBuzz ต้องแยกกรณีหารด้วย 15 ก่อนกรณี 3/5 — tests/test_fizzbuzz.py.
- Workflow ที่ไม่มี hypothesis หรือไม่ได้ตั้ง PYTHONPATH ต้องถูกจับด้วย local CI command และ workflow review.

---

### Task 1: Unit tests for existing contributor normalization

**Files:**
- Create: tests/test_unit.py
- Test: scripts/generate_repo_contributors.py

**Interfaces:**
- Consumes: normalize_contributors(payload, max_contributors, weeks, include_logins).
- Produces: behavior coverage without changing production code.

- [ ] Step 1: Write the failing tests first

Create tests using real dictionaries, not mocks, for:
1. empty payload returns [].
2. deleted author and malformed week are ignored.
3. allow-list matching is case-insensitive.
4. recent weeks are sorted by timestamp and capped.
5. max_contributors limits sorted output.
6. max_contributors below 1 raises ValueError.
7. weeks below 1 raises ValueError.

The tests must assert returned logins, order, weekly commits and aggregates.

```python
from scripts.generate_repo_contributors import normalize_contributors

def test_empty_payload_returns_empty_list():
    assert normalize_contributors([]) == []

def test_invalid_author_and_week_are_ignored():
    payload = [
        {"author": None, "weeks": [{"w": 1, "c": 9}]},
        {"author": {"login": "valid"}, "weeks": [{"w": "bad", "c": 2}, {"w": 2, "c": 3}]},
    ]
    result = normalize_contributors(payload, include_logins=None)
    assert [item["login"] for item in result] == ["valid"]
    assert result[0]["weeks"] == [
        {"timestamp": 0, "commits": 2, "additions": 0, "deletions": 0},
        {"timestamp": 2, "commits": 3, "additions": 0, "deletions": 0},
    ]

def test_allow_list_is_case_insensitive():
    payload = [{"author": {"login": "TeamMember"}, "total": 4}]
    assert [item["login"] for item in normalize_contributors(payload, include_logins=["teammember"])] == ["TeamMember"]

def test_recent_weeks_are_sorted_and_limited():
    payload = [{"author": {"login": "member"}, "weeks": [{"w": 3, "c": 3}, {"w": 1, "c": 1}, {"w": 2, "c": 2}]}]
    result = normalize_contributors(payload, include_logins=None, weeks=2)
    assert [week["timestamp"] for week in result[0]["weeks"]] == [2, 3]

def test_max_contributors_limits_sorted_output():
    payload = [
        {"author": {"login": "low"}, "total": 1},
        {"author": {"login": "high"}, "total": 5},
    ]
    result = normalize_contributors(payload, include_logins=None, max_contributors=1)
    assert [item["login"] for item in result] == ["high"]

def test_invalid_max_contributors_is_rejected():
    with pytest.raises(ValueError, match="max_contributors"):
        normalize_contributors([], max_contributors=0)

def test_invalid_weeks_is_rejected():
    with pytest.raises(ValueError, match="weeks"):
        normalize_contributors([], weeks=0)
```

Import pytest for the two exception assertions. Keep the tests focused on behavior rather than private implementation details.

- [ ] Step 2: Run the focused tests and verify RED

Run from repository root:

```powershell
& .\services\api\.venv\Scripts\python.exe -m pytest tests/test_unit.py -q
```

Expected: a normal test failure if the existing behavior differs from the test contract. Fix an incorrect test expectation rather than weakening a valid boundary assertion.

- [ ] Step 3: Run the focused tests and verify GREEN without production changes

```powershell
& .\services\api\.venv\Scripts\python.exe -m pytest tests/test_unit.py -q
```

Expected: all unit tests pass against the existing function.

- [ ] Step 4: Commit

```powershell
git add tests/test_unit.py
git commit -m "test: cover contributor normalization boundaries"
```

### Task 2: TDD FizzBuzz kata

**Files:**
- Create: src/__init__.py
- Create: src/fizzbuzz.py
- Create: tests/test_fizzbuzz.py

**Interfaces:**
- Produces: fizzbuzz(number: int) -> str with the standard FizzBuzz contract.
- Consumes: no prototype or external service.

- [ ] Step 1: Add first RED test and empty implementation

Create src/fizzbuzz.py with fizzbuzz(number: int) -> str raising NotImplementedError, and add:

```python
from src.fizzbuzz import fizzbuzz

def test_fizzbuzz_three_returns_fizz():
    assert fizzbuzz(3) == "Fizz"
```

Run python -m pytest tests/test_fizzbuzz.py -q, observe the expected failure, and commit:
test: add FizzBuzz(3) test [RED].

- [ ] Step 2: Implement smallest GREEN behavior

Implement only the multiple-of-three behavior, run the focused test, and commit:
feat: minimal FizzBuzz for 3 [GREEN].

- [ ] Step 3: Add remaining examples and complete contract

Add tests for 1 -> "1", 5 -> "Buzz", 15 -> "FizzBuzz", and 7 -> "7". Run to observe RED, then implement the 15 check before 3/5 checks. Run the full FizzBuzz file.

- [ ] Step 4: Refactor only after GREEN

If repeated divisibility checks remain, extract a small private helper without changing behavior. Run the full file again and commit:
refactor: simplify FizzBuzz divisibility checks.

- [ ] Step 5: Verify TDD artifact

```powershell
& .\services\api\.venv\Scripts\python.exe -m pytest tests/test_fizzbuzz.py -q
git log --oneline -- src/fizzbuzz.py tests/test_fizzbuzz.py
```

### Task 3: Hypothesis properties and development dependencies

**Files:**
- Create: tests/test_property.py
- Modify: services/api/requirements-dev.txt

**Interfaces:**
- Consumes: normalize_contributors and Hypothesis strategies.
- Produces: at least three properties for generated contributor payloads.

- [ ] Step 1: Add pinned development dependencies

Append these lines to services/api/requirements-dev.txt:

```text
hypothesis==6.168.0
pytest-cov==7.1.0
```

Install with:
```powershell
& .\services\api\.venv\Scripts\python.exe -m pip install -r services/api/requirements-dev.txt
```

- [ ] Step 2: Write three property tests

Use generated contributor dictionaries and assert:
1. output length never exceeds max_contributors.
2. every output has at most weeks week records sorted by timestamp.
3. totals, additions and deletions are non-negative.

Use Hypothesis given/strategies rather than mocks. Run:
```powershell
& .\services\api\.venv\Scripts\python.exe -m pytest tests/test_property.py -q
```

- [ ] Step 3: Commit

```powershell
git add tests/test_property.py services/api/requirements-dev.txt
git commit -m "test: add Hypothesis properties for contributor normalization"
```

### Task 4: GitHub Actions CI and invalid workflow cleanup

**Files:**
- Create: .github/workflows/test.yml
- Delete: .github/workflows/ci.yml

**Interfaces:**
- CI runs on push and pull_request using Python 3.12.
- CI installs services/api/requirements-dev.txt, sets PYTHONPATH=services/api, runs all tests and fails below 90% coverage.

- [ ] Step 1: Replace placeholder workflow

Create .github/workflows/test.yml:

```yaml
name: Tests

on:
  push:
  pull_request:

permissions:
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      PYTHONPATH: services/api
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: pip
          cache-dependency-path: services/api/requirements-dev.txt
      - run: python -m pip install -r services/api/requirements-dev.txt
      - run: python -m pytest services/api/tests tests scripts/tests --cov=src --cov=services/api/app --cov-branch --cov-report=term-missing --cov-fail-under=90
```

Delete .github/workflows/ci.yml because it contains only invalid placeholder text ....

- [ ] Step 2: Validate locally

```powershell
$env:PYTHONPATH = (Resolve-Path services/api).Path
& .\services\api\.venv\Scripts\python.exe -m pytest services/api/tests tests scripts/tests --cov=src --cov=services/api/app --cov-branch --cov-report=term-missing --cov-fail-under=90
Remove-Item Env:PYTHONPATH
```

Expected: all tests pass and coverage is at least 90% for src and services/api/app.

- [ ] Step 3: Commit CI

```powershell
git add .github/workflows/test.yml
git rm .github/workflows/ci.yml
git commit -m "ci: run Lab 9 tests and coverage on pull requests"
```

### Task 5: Saboteur journal, reflections, AI disclosure and final verification

**Files:**
- Create: docs/saboteur-journal.md
- Modify: reflect.md
- Modify: AI_USAGE.md

**Interfaces:**
- Documentation references actual tests, CI command and one reversible sabotage.
- No secrets, API keys or personal data are added.

- [ ] Step 1: Run one reversible sabotage

Temporarily change the FizzBuzz multiple-of-15 condition so tests/test_fizzbuzz.py fails, run the focused test, restore the correct condition, and run the test again. Do not commit the broken version.

- [ ] Step 2: Record docs/saboteur-journal.md

Record the mutation, failing assertion, restored implementation, passing result, and the limitation that branch protection still needs manual GitHub configuration.

- [ ] Step 3: Update reflect.md and AI_USAGE.md

Append three Lab 09 reflections (test behavior, property assumptions, CI/saboteur lesson) and an AI Usage section with at least three prompts, direct AI-assisted parts, and team verification.

- [ ] Step 4: Run final verification

```powershell
$env:PYTHONPATH = (Resolve-Path services/api).Path
& .\services\api\.venv\Scripts\python.exe -m pytest services/api/tests tests scripts/tests --cov=src --cov=services/api/app --cov-branch --cov-report=term-missing --cov-fail-under=90
Remove-Item Env:PYTHONPATH
git diff --check
git diff -- prototypes
git status --short
```

Expected: all tests pass, coverage is at least 90%, git diff -- prototypes is empty, and every changed path is an approved Lab 09 path.

- [ ] Step 5: Commit Lab 09 evidence

```powershell
git add docs/saboteur-journal.md reflect.md AI_USAGE.md
git commit -m "docs: record Lab 9 testing and saboteur evidence"
```
