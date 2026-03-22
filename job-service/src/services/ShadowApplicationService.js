import ShadowApplication from '../models/ShadowApplication.js'
import JobPost from '../models/JobPost.js'
import JobApplication from '../models/JobApplication.js'
import { findBySmartId } from '../utils/dbQueryHelper.js'
import userCenterService from './integration/UserCenterService.js'
import logger from '../../utils/logger.js'

class ShadowApplicationService {
    async pushShadowCandidates(jobId, candidates) {
        const jobPost = await findBySmartId(JobPost, jobId)
        if (!jobPost) {
            const error = new Error('Job not found')
            error.status = 404
            throw error
        }

        const jobObjectId = jobPost._id
        const results = []
        let created = 0
        let updated = 0
        let skipped = 0

        for (const candidate of candidates) {
            const email = candidate.email.toLowerCase()
            const result = { email }

            try {
                // Check if a real application already exists for this email
                const hasRealApplication = await this._checkRealApplication(email, jobObjectId)
                if (hasRealApplication) {
                    result.status = 'skipped'
                    result.reason = 'real_application_exists'
                    skipped++
                    results.push(result)
                    continue
                }

                const pseudoCandidateId = ShadowApplication.generatePseudoCandidateId(email)

                const existing = await ShadowApplication.findOne({
                    jobId: jobObjectId,
                    candidateEmail: email,
                })

                if (existing) {
                    // Already hidden → skip
                    if (existing.status === 'hidden') {
                        result.status = 'skipped'
                        result.reason = 'already_hidden'
                        skipped++
                        results.push(result)
                        continue
                    }

                    // Revoked → reactivate with fresh data
                    if (existing.status === 'revoked') {
                        existing.status = 'active'
                        existing.revokedAt = null
                        existing.candidateInfo = {
                            name: candidate.name,
                            email: candidate.email,
                            phone: candidate.phone,
                            title: candidate.title,
                            location: candidate.location,
                            summary: candidate.summary,
                            skills: candidate.skills,
                            experience: candidate.experience,
                            education: candidate.education,
                        }
                        existing.shadowResumeId = candidate.shadowResumeId
                        existing.matchScore = candidate.matchScore
                        existing.evaluation = candidate.evaluation || null
                        existing.invitedAt = null
                        existing.invitedBy = null
                        await existing.save()

                        result.status = 'reactivated'
                        result.shadowApplicationId = existing.shadowApplicationId
                        updated++
                        results.push(result)
                        continue
                    }

                    // Active but already linked to a real user → skip
                    if (existing.realCandidateId) {
                        result.status = 'skipped'
                        result.reason = 'real_user_applying'
                        skipped++
                        results.push(result)
                        continue
                    }

                    // Active and no real candidate → update
                    existing.candidateInfo = {
                        name: candidate.name,
                        email: candidate.email,
                        phone: candidate.phone,
                        title: candidate.title,
                        location: candidate.location,
                        summary: candidate.summary,
                        skills: candidate.skills,
                        experience: candidate.experience,
                        education: candidate.education,
                    }
                    existing.shadowResumeId = candidate.shadowResumeId
                    existing.matchScore = candidate.matchScore
                    existing.evaluation = candidate.evaluation || null
                    await existing.save()

                    result.status = 'updated'
                    result.shadowApplicationId = existing.shadowApplicationId
                    updated++
                } else {
                    // Create new
                    const shadowApp = new ShadowApplication({
                        jobId: jobObjectId,
                        candidateEmail: email,
                        pseudoCandidateId,
                        candidateInfo: {
                            name: candidate.name,
                            email: candidate.email,
                            phone: candidate.phone,
                            title: candidate.title,
                            location: candidate.location,
                            summary: candidate.summary,
                            skills: candidate.skills,
                            experience: candidate.experience,
                            education: candidate.education,
                        },
                        shadowResumeId: candidate.shadowResumeId,
                        matchScore: candidate.matchScore,
                        evaluation: candidate.evaluation || null,
                        status: 'active',
                    })
                    await shadowApp.save()

                    result.status = 'created'
                    result.shadowApplicationId = shadowApp.shadowApplicationId
                    created++
                }
            } catch (err) {
                logger.error('[ShadowApplicationService] Failed to process candidate', {
                    email,
                    jobId: jobObjectId.toString(),
                    error: err.message,
                })
                result.status = 'error'
                result.reason = err.message
                skipped++
            }

            results.push(result)
        }

        return {
            results,
            summary: { total: candidates.length, created, updated, skipped },
        }
    }

    async revokeShadowCandidates(jobId, candidates) {
        const jobPost = await findBySmartId(JobPost, jobId)
        if (!jobPost) {
            const error = new Error('Job not found')
            error.status = 404
            throw error
        }

        const jobObjectId = jobPost._id
        const results = []
        let revoked = 0
        let skipped = 0

        for (const candidate of candidates) {
            const { shadowResumeId } = candidate
            const result = { shadowResumeId }

            try {
                const existing = await ShadowApplication.findOne({
                    jobId: jobObjectId,
                    shadowResumeId,
                })

                if (!existing) {
                    result.status = 'skipped'
                    result.reason = 'not_found'
                    skipped++
                    results.push(result)
                    continue
                }

                if (existing.status === 'hidden') {
                    result.status = 'skipped'
                    result.reason = 'already_hidden'
                    skipped++
                    results.push(result)
                    continue
                }

                if (existing.status === 'revoked') {
                    result.status = 'skipped'
                    result.reason = 'already_revoked'
                    skipped++
                    results.push(result)
                    continue
                }

                existing.status = 'revoked'
                existing.revokedAt = new Date()
                await existing.save()

                result.status = 'revoked'
                result.shadowApplicationId = existing.shadowApplicationId
                revoked++
            } catch (err) {
                logger.error('[ShadowApplicationService] Failed to revoke candidate', {
                    shadowResumeId,
                    jobId: jobObjectId.toString(),
                    error: err.message,
                })
                result.status = 'error'
                result.reason = err.message
                skipped++
            }

            results.push(result)
        }

        return {
            results,
            summary: { total: candidates.length, revoked, skipped },
        }
    }

    async _checkRealApplication(email, jobObjectId) {
        try {
            const userInfo = await userCenterService.getUserByEmail(email)
            if (!userInfo || !userInfo.id) {
                return false
            }

            const application = await JobApplication.findOne({
                jobId: jobObjectId,
                candidateId: userInfo.id,
            })
            return !!application
        } catch (err) {
            logger.warn('[ShadowApplicationService] Failed to check real application', {
                email,
                error: err.message,
            })
            return false
        }
    }
}

export default new ShadowApplicationService()
