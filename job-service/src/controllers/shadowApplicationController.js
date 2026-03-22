import ShadowApplicationService from '../services/ShadowApplicationService.js'
import ShadowApplication from '../models/ShadowApplication.js'
import JobPost from '../models/JobPost.js'
import { pushShadowCandidatesSchema, revokeShadowCandidatesSchema } from '../validators/shadow_application_validator.js'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import NotificationService from '../services/NotificationService.js'
import CompanyBusinessService from '../services/CompanyBusinessService.js'
import RecommendService from '../services/integration/RecommendService.js'

class ShadowApplicationController {
    async pushShadowCandidates(ctx) {
        const { error, value } = pushShadowCandidatesSchema.validate(ctx.request.body, {
            abortEarly: false,
            stripUnknown: true,
        })

        if (error) {
            ctx.status = 400
            ctx.body = {
                code: 400,
                message: 'Validation failed',
                details: error.details.map(d => d.message),
            }
            return
        }

        const { jobId, candidates } = value

        try {
            const result = await ShadowApplicationService.pushShadowCandidates(jobId, candidates)

            ctx.body = {
                code: 0,
                message: 'success',
                data: result,
            }
        } catch (err) {
            if (err.status === 404) {
                ctx.status = 404
                ctx.body = { code: 404, message: err.message }
                return
            }
            throw err
        }
    }

    async revokeShadowCandidates(ctx) {
        const { error, value } = revokeShadowCandidatesSchema.validate(ctx.request.body, {
            abortEarly: false,
            stripUnknown: true,
        })

        if (error) {
            ctx.status = 400
            ctx.body = {
                code: 400,
                message: 'Validation failed',
                details: error.details.map(d => d.message),
            }
            return
        }

        const { jobId, candidates } = value

        try {
            const result = await ShadowApplicationService.revokeShadowCandidates(jobId, candidates)

            ctx.body = {
                code: 0,
                message: 'success',
                data: result,
            }
        } catch (err) {
            if (err.status === 404) {
                ctx.status = 404
                ctx.body = { code: 404, message: err.message }
                return
            }
            throw err
        }
    }

    async inviteShadowCandidate(ctx) {
        const { shadowApplicationId } = ctx.params
        const { userId, email: operatorEmail } = ctx.state.user

        const shadowApp = await ShadowApplication.findOne({ shadowApplicationId })
        if (!shadowApp) {
            throw new AppError('Shadow application not found', ERROR_CODES.NOT_FOUND)
        }

        if (shadowApp.status !== 'active') {
            throw new AppError('Shadow application is not active', ERROR_CODES.APPLICATION_STATUS_INVALID)
        }

        // Verify job belongs to B user's company
        const companyId = await CompanyBusinessService.getUserCompanyId(ctx, 'inviteShadowCandidate')
        const jobPost = await JobPost.findById(shadowApp.jobId).select('companyId jobId title companyName').lean()

        if (!jobPost || jobPost.companyId !== companyId) {
            throw new AppError('No permission to invite for this job', ERROR_CODES.FORBIDDEN)
        }

        // Atomic update to prevent duplicate invitations
        const updated = await ShadowApplication.findOneAndUpdate(
            { shadowApplicationId, status: 'active', invitedAt: null },
            { invitedAt: new Date(), invitedBy: userId },
            { new: true },
        )

        if (!updated) {
            ctx.status = 409
            ctx.body = { code: 409, message: 'Already invited' }
            return
        }

        // Fetch latest email from recommend service (fallback to snapshot)
        let candidateEmail = shadowApp.candidateInfo.email
        let candidateName = shadowApp.candidateInfo.name
        const profile = await RecommendService.getUserProfile(shadowApp.shadowResumeId)
        if (profile?.basicInfo?.email) {
            candidateEmail = profile.basicInfo.email
            candidateName = profile.basicInfo.name || candidateName
            ctx.logger.info('[inviteShadowCandidate] Using latest email from recommend-service', {
                shadowApplicationId, email: candidateEmail,
            })
        }

        // Send invitation email (non-blocking)
        const inviteUrl = `${process.env.JOB_APPOINTMENT_URL_C || ''}/#/jobDetail?id=${jobPost.jobId}&type=refer`
        try {
            await NotificationService.sendShadowTalentInvitationEmail(
                {
                    candidateName,
                    companyName: jobPost.companyName,
                    position: jobPost.title,
                    inviteUrl,
                    operatorEmail,
                },
                candidateEmail,
            )
        } catch (e) {
            ctx.logger.warn('[inviteShadowCandidate] Email send failed', { error: e.message })
        }

        ctx.success({
            invitedAt: updated.invitedAt,
            candidateName: shadowApp.candidateInfo.name,
        }, '邀请已发送')
    }
}

export default new ShadowApplicationController()
