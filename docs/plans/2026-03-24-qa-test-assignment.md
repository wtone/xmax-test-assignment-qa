# XMAX QA Test Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete all Module A (auth middleware testing) and Module B (job application flow testing) deliverables for the XMAX QA interview assignment.

**Architecture:** Module A focuses on white-box security review of gateway auth middleware with regression tests. Module B covers state machine analysis, unit tests for `createApplication()`, code review, and black-box API tests against the job application API.

**Tech Stack:** Jest 29, Sinon 17, Node.js ESM modules, Koa/Mongoose mocking

---

## Phase 1: Module A — Auth Middleware (30%)

### Task 1: Bug Analysis Report

**Files:**
- Create: `tests/module-a/bug-report.md`

**Step 1: Write the bug report**

Create `tests/module-a/bug-report.md` with the following bugs found during code review:

**Bug 1 — Wrong error code for B-end user missing companyId**
- Location: `gateway/jwt_auth.js:137`
- The code throws `errorCodes.TOKEN_EXPIRED` (401003, "Access token has expired") when a B-end user has no companyId and accesses a non-allowed path
- Should throw a permission/forbidden error (e.g., 403001) or a dedicated COMPANY_REQUIRED error
- Impact: Client receives "token expired", may enter infinite token refresh loop

**Bug 2 — Debug mode auth bypass without token verification**
- Location: `gateway/gateway_auth.js:21`
- Original code had `config.debug.token === ctx.headers['authorization']` check but it's commented out
- Now any request without x-user-id header gets debug credentials when `config.debug.enabled` is true, with no token verification
- Impact: Complete authentication bypass in any environment with debug enabled

**Bug 3 — `const` reassignment crash in `internalAuth`**
- Location: `gateway/gateway_auth.js:182-185`
- `const userId` declared at line 182, then attempted reassignment `userId = config.debug.userId` at line 185
- Impact: Runtime TypeError crash — internal auth with debug fallback is completely broken

**Bug 4 — User-center response overwrites gateway-validated user data**
- Location: `gateway/gateway_auth.js:59-65`
- When user-center responds, userInfo is completely replaced (not merged), losing gateway-provided data
- The `companyId` from gateway headers is never read or preserved
- Impact: Privilege inconsistency if user-center data differs from JWT payload

**Step 2: Commit**

```bash
git add tests/module-a/bug-report.md
git commit -m "docs(module-a): add bug analysis report for auth middleware"
```

---

### Task 2: Regression Tests

**Files:**
- Create: `tests/module-a/auth-regression.test.js`

**Step 1: Write regression tests**

Write Jest tests that mock external dependencies (`jsonwebtoken`, `logger`, `whitelist`, `proxy/routes`) and validate each discovered bug. Key test cases:

1. **B-end user without companyId on non-allowed path should NOT return TOKEN_EXPIRED** — assert error code is not 401003 (demonstrates bug #1)
2. **Debug mode without token check allows unauthenticated access** — with `config.debug.enabled=true` and no userId header, middleware sets debug user (demonstrates bug #2)
3. **internalAuth const reassignment throws TypeError** — calling internalAuth with debug fallback crashes (demonstrates bug #3)
4. **User-center data should not overwrite gateway companyId** — after user-center fetch, companyId from gateway should be preserved (demonstrates bug #4)

Note: Since gateway files use ESM imports from modules not in this repo (`../utils/logger.js`, `../config/whitelist.js`, etc.), tests need to use `jest.unstable_mockModule` for ESM mocking, or restructure to use dependency injection patterns. A practical approach is to test the logic by reimporting the modules with mocked dependencies.

**Step 2: Run tests**

```bash
cd job-service && npm run test:a
```

Expected: Tests should demonstrate/expose the bugs (some may intentionally fail to prove the bug exists).

**Step 3: Commit**

```bash
git add tests/module-a/auth-regression.test.js
git commit -m "test(module-a): add regression tests for auth middleware bugs"
```

---

### Task 3: Security Test Cases

**Files:**
- Create: `tests/module-a/security-test-cases.md`

**Step 1: Write 5 OWASP-based security test cases**

Each case includes: scenario description, request construction, expected result.

1. **Token missing** — request without Authorization header → 401 TOKEN_MISSING
2. **Token tampering / invalid signature** — modify JWT payload without re-signing → 401 TOKEN_INVALID
3. **Expired token** — JWT with past `exp` claim → 401 TOKEN_EXPIRED
4. **Privilege escalation: C-end accessing B-end resources** — C-type user token accessing B-only endpoints → should be blocked
5. **Algorithm confusion attack** — JWT signed with `none` algorithm or RS256 when server expects HS256 → 401 TOKEN_INVALID

**Step 2: Commit**

```bash
git add tests/module-a/security-test-cases.md
git commit -m "docs(module-a): add OWASP security test cases for auth middleware"
```

---

## Phase 2: Module B — Job Application Flow (70%)

### Task 4: State Transition Diagram

**Files:**
- Create: `tests/module-b/state-diagram.md`

**Step 1: Write state diagram**

Based on `application_status.js:getNextPossibleStatuses()`, create a Mermaid state diagram showing all 12 states, transitions, terminal states, and the two-step submit flow.

Source of truth: `job-service/src/constants/application_status.js:225-267`

**Step 2: Commit**

```bash
git add tests/module-b/state-diagram.md
git commit -m "docs(module-b): add application state transition diagram"
```

---

### Task 5: Unit Tests for `createApplication()`

**Files:**
- Create: `tests/module-b/application-service.test.js`

**Step 1: Write unit tests**

Mock these dependencies:
- `JobPost` (Mongoose model) — `findBySmartId` returns mock job
- `JobApplication` (Mongoose model) — `findOne`, `new JobApplication()`, `.save()`
- `ShadowApplication` — `findOneAndUpdate`
- `EvaluationService` — `createJobEvaluation`
- `ResumeService` — `getUserLatestResume`

Key test cases covering `ApplicationService.createApplication()` (lines 280-450):

1. **Normal first call — creates SUBMITTING application**: no existing app, hasResume=false → new app with status=submitting
2. **Normal second call — SUBMITTING→SUBMITTED**: existing app in submitting, hasResume=true, hasAssessment=true → status updated to submitted
3. **Duplicate application rejection**: existing app in non-submitting status → throws DUPLICATE_APPLICATION (code 3010)
4. **resolvedHasResume derivation — resumeId present**: hasResume=false but resumeId exists → resolvedHasResume=true → can transition to submitted
5. **resolvedHasResume derivation — no resumeId**: hasResume=false, no resumeId → stays submitting
6. **Stats not incremented for SUBMITTING/SUBMITTED**: shouldCountInStats returns false for these → JobPost.findByIdAndUpdate NOT called
7. **Shadow application linking**: candidateEmail provided → ShadowApplication.findOneAndUpdate called
8. **Shadow application linking failure is non-blocking**: ShadowApplication throws → application still created

**Step 2: Run tests**

```bash
cd job-service && npm run test:b
```

Expected: All tests PASS.

**Step 3: Commit**

```bash
git add tests/module-b/application-service.test.js
git commit -m "test(module-b): add unit tests for ApplicationService.createApplication"
```

---

### Task 6: Code Review Report

**Files:**
- Create: `tests/module-b/code-review.md`

**Step 1: Write code review**

Key issues to document:

1. **withdrawApplication uses wrong status list** (`candidateApplicationController.js:601`): checks `['pending', 'screening']` but 'pending' is not a valid status; should use `canWithdrawApplication()` helper which correctly lists [submitting, submitted, screening, interview, interview_inviting, interview_scheduled]

2. **Concurrency race condition in createApplication** (`ApplicationService.js:306-370`): check-then-update (findOne→save) is not atomic; concurrent requests could create duplicate applications. Fix: use `findOneAndUpdate` with upsert or add a unique compound index on (jobId, candidateId, status≠withdrawn)

3. **Joi validator strips unknown fields from request body** (`candidate-application.routes.js:194`): the route-level Joi schema only allows `jobId, coverLetter, expectedSalary, availableStartDate` — any extra fields like `expectedSalary.currency` work, but `hasResume`/`hasAssessment` would be stripped if sent from client. This is actually correct (controller derives them), but worth noting the coupling

**Step 2: Commit**

```bash
git add tests/module-b/code-review.md
git commit -m "docs(module-b): add code review report for application flow"
```

---

### Task 7: Black-box API Test Matrix

**Files:**
- Create: `tests/module-b/api-test-matrix.md`

**Step 1: Write test matrix**

Design 8+ test cases using equivalence class partitioning and boundary value analysis for `POST /api/v1/candidate/applications`:

| # | Category | Test Case | Input | Expected |
|---|----------|-----------|-------|----------|
| 1 | Normal | First application | valid jobId, valid headers | 201, status=submitting |
| 2 | Normal | Second application (submit) | same jobId+candidateId, resume ready | 201, status=submitted |
| 3 | Error-Duplicate | Already applied (non-submitting) | existing submitted app | 400, code=3010 |
| 4 | Error-Auth | Missing x-user-id | no auth header | 401 |
| 5 | Error-Validation | Missing jobId | empty body | 400, code=1006 |
| 6 | Error-NotFound | Non-existent jobId | random jobId | 404, code=2001 |
| 7 | Error-NotFound | Unpublished job | draft job's jobId | 404, code=2001 |
| 8 | Boundary | coverLetter at max length | 2000 chars | 201 |
| 9 | Boundary | coverLetter exceeds max | 2001 chars | 400 |
| 10 | Error-Salary | Negative salary | min=-1 | 400 |

**Step 2: Commit**

```bash
git add tests/module-b/api-test-matrix.md
git commit -m "docs(module-b): add black-box API test matrix"
```

---

### Task 8: Black-box API Automated Tests

**Files:**
- Create: `tests/module-b/api-blackbox.test.js`

**Step 1: Write automated API tests**

Use native `fetch` (Node 18+) to test against `http://localhost:3020`. Tests require services to be running (`docker-compose up -d` + both services started).

Implement the test matrix from Task 7 as executable Jest tests. Each test sends HTTP requests with appropriate headers (`x-user-id`, `x-user-type`) and validates response status codes and body structure.

Note: These tests are integration tests that need a running environment. Mark them with a descriptive `describe` block and add a setup note.

**Step 2: Run tests (requires running services)**

```bash
cd job-service && npm run test:b
```

**Step 3: Commit**

```bash
git add tests/module-b/api-blackbox.test.js
git commit -m "test(module-b): add black-box API automated tests"
```

---

## Phase 3: Final Review

### Task 9: Final Verification

**Step 1: Run all tests**

```bash
cd job-service && npm test
```

**Step 2: Review all deliverables checklist**

- [ ] `tests/module-a/bug-report.md`
- [ ] `tests/module-a/auth-regression.test.js`
- [ ] `tests/module-a/security-test-cases.md`
- [ ] `tests/module-b/state-diagram.md`
- [ ] `tests/module-b/application-service.test.js`
- [ ] `tests/module-b/code-review.md`
- [ ] `tests/module-b/api-test-matrix.md`
- [ ] `tests/module-b/api-blackbox.test.js`

**Step 3: Final commit**

```bash
git add -A
git commit -m "chore: complete QA test assignment - all deliverables"
```
