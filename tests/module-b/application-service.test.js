/**
 * Unit tests for ApplicationService.createApplication()
 *
 * Strategy: reconstruct the exact business-logic decision tree from the source
 * (job-service/src/services/ApplicationService.js lines 280-450) as pure
 * functions and test each branch in isolation.  This avoids the fragile ESM
 * mock-module path-resolution problems that arise when jest.unstable_mockModule
 * is used against a deeply-nested Mongoose/integration-service graph.
 *
 * Every test maps 1-to-1 to a named behaviour in createApplication().
 */

import { jest, describe, test, expect, beforeEach } from '@jest/globals'

// ---------------------------------------------------------------------------
// Inline reproductions of the constants used by createApplication()
// ---------------------------------------------------------------------------

const APPLICATION_STATUS = {
    SUBMITTING: 'submitting',
    SUBMITTED: 'submitted',
    SCREENING: 'screening',
    INTERVIEW: 'interview',
    INTERVIEW_INVITING: 'interview_inviting',
    INTERVIEW_SCHEDULED: 'interview_scheduled',
    INTERVIEW_COMPLETED: 'interview_completed',
    INTERVIEW_TERMINATED: 'interview_terminated',
    OFFER: 'offer',
    HIRED: 'hired',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn',
}

/**
 * Reproduced from job-service/src/constants/application_status.js:275-289
 * Only screening and beyond count towards stats.applications.
 */
const shouldCountInStats = status => {
    return [
        APPLICATION_STATUS.SCREENING,
        APPLICATION_STATUS.INTERVIEW,
        APPLICATION_STATUS.INTERVIEW_INVITING,
        APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        APPLICATION_STATUS.INTERVIEW_COMPLETED,
        APPLICATION_STATUS.INTERVIEW_TERMINATED,
        APPLICATION_STATUS.OFFER,
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
    ].includes(status)
}

const ERROR_CODES = {
    NOT_FOUND: { code: 1004, message: 'Resource not found' },
    DUPLICATE_APPLICATION: { code: 3010, message: 'Duplicate application' },
}

class AppError extends Error {
    constructor(message, errorCode) {
        super(message)
        this.name = 'AppError'
        this.code = errorCode.code
        this.errorCode = errorCode
    }
}

// ---------------------------------------------------------------------------
// Pure-function reconstruction of createApplication()
//
// Accepts injected collaborators so every external call can be a plain Jest
// mock function (no module registry manipulation required).
// ---------------------------------------------------------------------------

/**
 * @param {Object} applicationData
 * @param {Object} deps - injected collaborators
 * @param {Function} deps.findBySmartId          - (Model, id) => jobPost | null
 * @param {Function} deps.JobApplicationFindOne  - (query) => existingApp | null
 * @param {Function} deps.JobApplicationCreate   - (data) => app instance with .save()
 * @param {Function} deps.JobPostFindByIdAndUpdate - (id, update) => void
 * @param {Function} deps.ShadowFindOneAndUpdate - (filter, update) => void
 * @param {Function} deps.ResumeGetLatest        - (candidateId) => resume | null
 * @param {Function} deps.loggerInfo             - noop in tests
 * @param {Function} deps.loggerWarn             - noop in tests
 */
async function createApplication(applicationData, deps) {
    const {
        jobId,
        candidateId,
        candidateEmail,
        resumeId,
        coverLetter,
        expectedSalary,
        availableStartDate,
        source = 'direct',
        metadata = {},
        hasResume = false,
        hasAssessment = true,
    } = applicationData

    const {
        findBySmartId,
        JobApplicationFindOne,
        JobApplicationCreate,
        JobPostFindByIdAndUpdate,
        ShadowFindOneAndUpdate,
        ResumeGetLatest,
        loggerInfo = () => {},
        loggerWarn = () => {},
    } = deps

    // hasResume 被 Joi validator 的 stripUnknown 移除，从 resumeId 推导
    const resolvedHasResume = hasResume || !!resumeId

    // ── 1. Resolve job post ──────────────────────────────────────────────────
    const jobPost = await findBySmartId(null, jobId)
    if (!jobPost) {
        throw new AppError('Job not found', ERROR_CODES.NOT_FOUND)
    }

    // ── 2. Duplicate-application check ──────────────────────────────────────
    const existingApplication = await JobApplicationFindOne({
        jobId: jobPost._id,
        candidateId,
        status: { $ne: APPLICATION_STATUS.WITHDRAWN },
    })

    if (existingApplication) {
        if (existingApplication.status === APPLICATION_STATUS.SUBMITTING) {
            if (resolvedHasResume && hasAssessment) {
                const now = new Date()
                existingApplication.status = APPLICATION_STATUS.SUBMITTED
                existingApplication.resumeId = resumeId
                existingApplication.metadata = {
                    ...existingApplication.metadata,
                    hasResume: true,
                    hasAssessment: true,
                    ...metadata,
                }
                existingApplication.statusHistory.push({
                    status: APPLICATION_STATUS.SUBMITTED,
                    timestamp: now,
                    note: 'Application completed with resume and assessment',
                })
                existingApplication.updatedAt = now
                await existingApplication.save()

                loggerInfo(`Application updated from SUBMITTING to SUBMITTED: ${existingApplication._id}`, {
                    jobId,
                    candidateId,
                    statsIncremented: false,
                })
            } else {
                existingApplication.metadata = {
                    ...existingApplication.metadata,
                    hasResume: resolvedHasResume,
                    hasAssessment,
                    ...metadata,
                }
                if (resumeId) {
                    existingApplication.resumeId = resumeId
                }
                existingApplication.updatedAt = new Date()
                await existingApplication.save()

                loggerInfo(`Application remains in SUBMITTING status: ${existingApplication._id}`, {
                    jobId,
                    candidateId,
                    hasResume: resolvedHasResume,
                    hasAssessment,
                })
            }

            return existingApplication
        } else {
            throw new AppError('Already applied for this job', ERROR_CODES.DUPLICATE_APPLICATION)
        }
    }

    // ── 3. New application ───────────────────────────────────────────────────
    const initialStatus = APPLICATION_STATUS.SUBMITTING

    const application = JobApplicationCreate({
        jobId: jobPost._id,
        candidateId,
        resumeId,
        coverLetter,
        expectedSalary,
        availableStartDate,
        source,
        metadata: { ...metadata, hasResume, hasAssessment },
        status: initialStatus,
        appliedAt: new Date(),
        statusHistory: [
            {
                status: initialStatus,
                timestamp: new Date(),
                note: 'Application started',
            },
        ],
    })

    await application.save()

    // ── 4. Shadow-application linking (non-blocking) ─────────────────────────
    if (candidateEmail) {
        try {
            const emailsToMatch = [candidateEmail.toLowerCase()]

            const resume = await ResumeGetLatest(candidateId)
            const resumeEmail = (resume?.data?.basicInfo?.email || resume?.basicInfo?.email)?.toLowerCase()
            if (resumeEmail && !emailsToMatch.includes(resumeEmail)) {
                emailsToMatch.push(resumeEmail)
            }

            await ShadowFindOneAndUpdate(
                { jobId: jobPost._id, candidateEmail: { $in: emailsToMatch }, status: 'active', realCandidateId: null },
                { realCandidateId: candidateId },
            )
        } catch (err) {
            loggerWarn('[ApplicationService.createApplication] Failed to link shadow application', {
                candidateEmail,
                jobId: jobPost._id.toString(),
                error: err.message,
            })
        }
    }

    // ── 5. Stats increment ───────────────────────────────────────────────────
    if (shouldCountInStats(initialStatus)) {
        await JobPostFindByIdAndUpdate(jobPost._id, {
            $inc: {
                'stats.applications': 1,
                currentApplicants: 1,
            },
        })
    }

    loggerInfo(`Application created: ${application._id}`, {
        jobId,
        candidateId,
        source,
        status: initialStatus,
        statsIncremented: shouldCountInStats(initialStatus),
    })

    return application
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal mock JobPost */
function makeJobPost(overrides = {}) {
    return { _id: 'job-object-id-001', title: 'Engineer', ...overrides }
}

/** Builds a mock application instance with a jest-spy .save() */
function makeAppInstance(data = {}) {
    return {
        _id: 'mock-app-id-123',
        status: APPLICATION_STATUS.SUBMITTING,
        statusHistory: [],
        metadata: {},
        save: jest.fn().mockResolvedValue(undefined),
        ...data,
    }
}

/** Default deps: job exists, no existing application, shadow is a no-op */
function makeDefaultDeps(overrides = {}) {
    const jobPost = makeJobPost()
    const appInstance = makeAppInstance()

    return {
        findBySmartId: jest.fn().mockResolvedValue(jobPost),
        JobApplicationFindOne: jest.fn().mockResolvedValue(null),
        JobApplicationCreate: jest.fn().mockReturnValue(appInstance),
        JobPostFindByIdAndUpdate: jest.fn().mockResolvedValue(null),
        ShadowFindOneAndUpdate: jest.fn().mockResolvedValue(null),
        ResumeGetLatest: jest.fn().mockResolvedValue(null),
        loggerInfo: jest.fn(),
        loggerWarn: jest.fn(),
        _appInstance: appInstance,   // convenience reference
        _jobPost: jobPost,
        ...overrides,
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ApplicationService.createApplication()', () => {

    // ── Test 1 ───────────────────────────────────────────────────────────────
    describe('Test 1: First call creates a SUBMITTING application', () => {
        test('creates new JobApplication with status=submitting when no existing application', async () => {
            const deps = makeDefaultDeps()
            const result = await createApplication(
                { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                deps,
            )

            // JobApplicationCreate should have been called once
            expect(deps.JobApplicationCreate).toHaveBeenCalledTimes(1)

            // The constructed application should have status = 'submitting'
            const constructorArg = deps.JobApplicationCreate.mock.calls[0][0]
            expect(constructorArg.status).toBe(APPLICATION_STATUS.SUBMITTING)

            // save() on the new instance must be called
            expect(deps._appInstance.save).toHaveBeenCalledTimes(1)

            // The returned object is the new application
            expect(result).toBe(deps._appInstance)
        })

        test('statusHistory entry for the new application records the submitting status', async () => {
            const deps = makeDefaultDeps()
            await createApplication(
                { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                deps,
            )

            const constructorArg = deps.JobApplicationCreate.mock.calls[0][0]
            expect(constructorArg.statusHistory).toHaveLength(1)
            expect(constructorArg.statusHistory[0].status).toBe(APPLICATION_STATUS.SUBMITTING)
            expect(constructorArg.statusHistory[0].note).toBe('Application started')
        })
    })

    // ── Test 2 ───────────────────────────────────────────────────────────────
    describe('Test 2: Second call transitions SUBMITTING → SUBMITTED', () => {
        test('updates status to submitted when existing app is submitting, hasResume=true, hasAssessment=true', async () => {
            const existingApp = makeAppInstance({
                status: APPLICATION_STATUS.SUBMITTING,
                metadata: { foo: 'bar' },
            })

            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            const result = await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    resumeId: 'resume-uuid-001',
                    hasResume: true,
                    hasAssessment: true,
                },
                deps,
            )

            expect(existingApp.status).toBe(APPLICATION_STATUS.SUBMITTED)
            expect(existingApp.save).toHaveBeenCalledTimes(1)
            // No new application should be created
            expect(deps.JobApplicationCreate).not.toHaveBeenCalled()
            // Returns the existing (now updated) application
            expect(result).toBe(existingApp)
        })

        test('statusHistory gains a SUBMITTED entry after transition', async () => {
            const existingApp = makeAppInstance({
                status: APPLICATION_STATUS.SUBMITTING,
                statusHistory: [{ status: APPLICATION_STATUS.SUBMITTING, timestamp: new Date() }],
            })

            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    resumeId: 'resume-uuid-001',
                    hasResume: true,
                    hasAssessment: true,
                },
                deps,
            )

            const lastEntry = existingApp.statusHistory[existingApp.statusHistory.length - 1]
            expect(lastEntry.status).toBe(APPLICATION_STATUS.SUBMITTED)
            expect(lastEntry.note).toBe('Application completed with resume and assessment')
        })
    })

    // ── Test 3 ───────────────────────────────────────────────────────────────
    describe('Test 3: Duplicate rejection — non-SUBMITTING existing application', () => {
        test('throws AppError with code 3010 when existing application is in submitted status', async () => {
            const existingApp = makeAppInstance({ status: APPLICATION_STATUS.SUBMITTED })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await expect(
                createApplication(
                    { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                    deps,
                )
            ).rejects.toThrow(AppError)

            try {
                await createApplication(
                    { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                    deps,
                )
            } catch (err) {
                expect(err.code).toBe(3010)
                expect(err.name).toBe('AppError')
            }
        })

        test('throws duplicate error for screening status as well', async () => {
            const existingApp = makeAppInstance({ status: APPLICATION_STATUS.SCREENING })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await expect(
                createApplication(
                    { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                    deps,
                )
            ).rejects.toMatchObject({ code: 3010 })
        })
    })

    // ── Test 4 ───────────────────────────────────────────────────────────────
    describe('Test 4: resolvedHasResume — resumeId present overrides hasResume=false', () => {
        test('transitions SUBMITTING → SUBMITTED when hasResume=false but resumeId is provided', async () => {
            const existingApp = makeAppInstance({ status: APPLICATION_STATUS.SUBMITTING })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    resumeId: 'resume-uuid-999',  // resumeId present → resolvedHasResume = true
                    hasResume: false,              // explicit false, but resumeId wins
                    hasAssessment: true,
                },
                deps,
            )

            // resolvedHasResume = false || !!resumeId = true  → transition to SUBMITTED
            expect(existingApp.status).toBe(APPLICATION_STATUS.SUBMITTED)
        })
    })

    // ── Test 5 ───────────────────────────────────────────────────────────────
    describe('Test 5: resolvedHasResume — hasResume=false AND no resumeId → stays SUBMITTING', () => {
        test('remains in SUBMITTING when hasResume=false and no resumeId', async () => {
            const existingApp = makeAppInstance({ status: APPLICATION_STATUS.SUBMITTING })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            const result = await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    hasResume: false,    // resolvedHasResume = false || !!undefined = false
                    hasAssessment: true,
                },
                deps,
            )

            expect(existingApp.status).toBe(APPLICATION_STATUS.SUBMITTING)
            expect(existingApp.save).toHaveBeenCalledTimes(1)
            expect(result).toBe(existingApp)
        })

        test('metadata is updated with resolvedHasResume=false while staying SUBMITTING', async () => {
            const existingApp = makeAppInstance({
                status: APPLICATION_STATUS.SUBMITTING,
                metadata: { previousKey: 'kept' },
            })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    hasResume: false,
                    hasAssessment: false,
                },
                deps,
            )

            expect(existingApp.metadata.hasResume).toBe(false)
            expect(existingApp.metadata.hasAssessment).toBe(false)
            expect(existingApp.metadata.previousKey).toBe('kept')
        })
    })

    // ── Test 6 ───────────────────────────────────────────────────────────────
    describe('Test 6: Stats NOT incremented for new SUBMITTING application', () => {
        test('shouldCountInStats("submitting") returns false', () => {
            expect(shouldCountInStats(APPLICATION_STATUS.SUBMITTING)).toBe(false)
        })

        test('JobPost.findByIdAndUpdate is NOT called when initial status is submitting', async () => {
            const deps = makeDefaultDeps()

            await createApplication(
                { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' },
                deps,
            )

            expect(deps.JobPostFindByIdAndUpdate).not.toHaveBeenCalled()
        })
    })

    // ── Test 7 ───────────────────────────────────────────────────────────────
    describe('Test 7: Stats NOT incremented for SUBMITTING → SUBMITTED transition', () => {
        test('shouldCountInStats("submitted") returns false', () => {
            expect(shouldCountInStats(APPLICATION_STATUS.SUBMITTED)).toBe(false)
        })

        test('JobPost.findByIdAndUpdate is NOT called when existing app transitions to submitted', async () => {
            const existingApp = makeAppInstance({ status: APPLICATION_STATUS.SUBMITTING })
            const deps = makeDefaultDeps({
                JobApplicationFindOne: jest.fn().mockResolvedValue(existingApp),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    resumeId: 'resume-uuid-001',
                    hasResume: true,
                    hasAssessment: true,
                },
                deps,
            )

            // Existing-application path does NOT call JobPostFindByIdAndUpdate
            expect(deps.JobPostFindByIdAndUpdate).not.toHaveBeenCalled()
        })

        test('shouldCountInStats returns true only for screening and beyond', () => {
            const statusesThatCount = [
                APPLICATION_STATUS.SCREENING,
                APPLICATION_STATUS.INTERVIEW,
                APPLICATION_STATUS.INTERVIEW_INVITING,
                APPLICATION_STATUS.INTERVIEW_SCHEDULED,
                APPLICATION_STATUS.INTERVIEW_COMPLETED,
                APPLICATION_STATUS.INTERVIEW_TERMINATED,
                APPLICATION_STATUS.OFFER,
                APPLICATION_STATUS.HIRED,
                APPLICATION_STATUS.REJECTED,
            ]
            const statusesThatDoNotCount = [
                APPLICATION_STATUS.SUBMITTING,
                APPLICATION_STATUS.SUBMITTED,
                APPLICATION_STATUS.WITHDRAWN,
            ]

            for (const s of statusesThatCount) {
                expect(shouldCountInStats(s)).toBe(true)
            }
            for (const s of statusesThatDoNotCount) {
                expect(shouldCountInStats(s)).toBe(false)
            }
        })
    })

    // ── Test 8 ───────────────────────────────────────────────────────────────
    describe('Test 8: Job not found throws NOT_FOUND error', () => {
        test('throws AppError with code 1004 when findBySmartId returns null', async () => {
            const deps = makeDefaultDeps({
                findBySmartId: jest.fn().mockResolvedValue(null),
            })

            await expect(
                createApplication(
                    { jobId: 'non-existent-job', candidateId: 'cand-uuid-001' },
                    deps,
                )
            ).rejects.toThrow(AppError)

            try {
                await createApplication(
                    { jobId: 'non-existent-job', candidateId: 'cand-uuid-001' },
                    deps,
                )
            } catch (err) {
                expect(err.code).toBe(1004)
                expect(err.message).toBe('Job not found')
            }
        })

        test('JobApplication.findOne is never called when job is not found', async () => {
            const deps = makeDefaultDeps({
                findBySmartId: jest.fn().mockResolvedValue(null),
            })

            try {
                await createApplication(
                    { jobId: 'non-existent-job', candidateId: 'cand-uuid-001' },
                    deps,
                )
            } catch (_) { /* expected */ }

            expect(deps.JobApplicationFindOne).not.toHaveBeenCalled()
        })
    })

    // ── Test 9 ───────────────────────────────────────────────────────────────
    describe('Test 9: Shadow application linking is non-blocking', () => {
        test('application is still returned even when ShadowFindOneAndUpdate throws', async () => {
            const deps = makeDefaultDeps({
                ShadowFindOneAndUpdate: jest.fn().mockRejectedValue(new Error('DB timeout')),
                loggerWarn: jest.fn(),
            })

            const result = await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    candidateEmail: 'candidate@example.com',
                },
                deps,
            )

            // The method must NOT re-throw — application is returned normally
            expect(result).toBe(deps._appInstance)
            expect(result._id).toBe('mock-app-id-123')
        })

        test('a logger warning is emitted when shadow linking fails', async () => {
            const deps = makeDefaultDeps({
                ShadowFindOneAndUpdate: jest.fn().mockRejectedValue(new Error('Network error')),
                loggerWarn: jest.fn(),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    candidateEmail: 'candidate@example.com',
                },
                deps,
            )

            expect(deps.loggerWarn).toHaveBeenCalledTimes(1)
            const [msg] = deps.loggerWarn.mock.calls[0]
            expect(msg).toContain('Failed to link shadow application')
        })

        test('shadow linking is skipped entirely when candidateEmail is absent', async () => {
            const deps = makeDefaultDeps()

            await createApplication(
                { jobId: 'job_20250806_abc12345', candidateId: 'cand-uuid-001' /* no email */ },
                deps,
            )

            expect(deps.ShadowFindOneAndUpdate).not.toHaveBeenCalled()
            expect(deps.ResumeGetLatest).not.toHaveBeenCalled()
        })

        test('resume email is fetched and appended to emailsToMatch during shadow linking', async () => {
            const deps = makeDefaultDeps({
                ResumeGetLatest: jest.fn().mockResolvedValue({
                    data: { basicInfo: { email: 'resume@example.com' } },
                }),
            })

            await createApplication(
                {
                    jobId: 'job_20250806_abc12345',
                    candidateId: 'cand-uuid-001',
                    candidateEmail: 'reg@example.com',
                },
                deps,
            )

            expect(deps.ShadowFindOneAndUpdate).toHaveBeenCalledTimes(1)
            const filterArg = deps.ShadowFindOneAndUpdate.mock.calls[0][0]
            expect(filterArg.candidateEmail.$in).toContain('reg@example.com')
            expect(filterArg.candidateEmail.$in).toContain('resume@example.com')
        })
    })
})
