/**
 * 人工面试评分控制器
 * @module controllers/manualRating_controller
 */

import manualRatingService from '../services/manualRating_service.js'
import { sendSuccess, sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { getUserCompanyId } from '../services/CompanyBusinessService.js'

/**
 * 人工评分控制器类
 */
class ManualRatingController {
    /**
     * 提交或更新评分
     * PUT /api/v1/job-b/manual-rating
     */
    async upsertRating(ctx) {
        try {
            const { jobId, candidateId, rating, tagRatings, comment } = ctx.request.body
            const { userId } = ctx.state.user

            ctx.logger.info('[upsertRating] 开始提交人工评分', {
                jobId,
                candidateId,
                rating,
                userId,
            })

            // 获取用户的公司ID
            const companyId = await getUserCompanyId(ctx, 'upsertRating')
            if (!companyId) {
                ctx.logger.warn('[upsertRating] B端用户缺少公司ID', { userId })
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: '缺少企业信息' }
            }

            const result = await manualRatingService.upsertRating(
                { jobId, candidateId, rating, tagRatings, comment },
                companyId,
                userId,
            )

            ctx.logger.info('[upsertRating] 人工评分提交成功', {
                jobId,
                candidateId,
                rating,
            })

            sendSuccess(ctx, result)
        } catch (error) {
            ctx.logger.error('[upsertRating] 提交人工评分失败', {
                error: error.message || error,
            })
            sendError(ctx, error)
        }
    }

    /**
     * 查询评分
     * GET /api/v1/job-b/manual-rating?jobId=xxx&candidateId=xxx
     */
    async getRating(ctx) {
        try {
            const { jobId, candidateId } = ctx.query
            const { userId } = ctx.state.user

            ctx.logger.info('[getRating] 查询人工评分', {
                jobId,
                candidateId,
                userId,
            })

            // 获取用户的公司ID
            const companyId = await getUserCompanyId(ctx, 'getRating')
            if (!companyId) {
                ctx.logger.warn('[getRating] B端用户缺少公司ID', { userId })
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: '缺少企业信息' }
            }

            const result = await manualRatingService.getRating(jobId, candidateId, companyId)

            ctx.logger.info('[getRating] 查询人工评分完成', {
                jobId,
                candidateId,
                found: !!result,
            })

            sendSuccess(ctx, result)
        } catch (error) {
            ctx.logger.error('[getRating] 查询人工评分失败', {
                error: error.message || error,
            })
            sendError(ctx, error)
        }
    }
}

export default new ManualRatingController()
