/**
 * 影子申请代理中间件
 * @module middlewares/shadow-application-proxy
 * @description 当 ?source=recommend 时，代理到 recommend-service 获取影子候选人详情；
 *              否则 next() 走正常 controller。
 */

import ShadowApplication from '../models/ShadowApplication.js'
import JobPost from '../models/JobPost.js'
import RecommendService from '../services/integration/RecommendService.js'
import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { getUserCompanyId } from '../services/CompanyBusinessService.js'

export const shadowApplicationProxy = () => {
    return async (ctx, next) => {
        if (ctx.query.source !== 'recommend') {
            return next()
        }

        const { applicationId } = ctx.params

        // 仅 B 端用户可查看影子申请
        if (ctx.state.user?.type !== 'B') {
            return sendError(ctx, ERROR_CODES.FORBIDDEN, '仅 B 端用户可查看影子申请', 403)
        }

        // 查找影子申请
        const shadowApp = await ShadowApplication.findOne({ shadowApplicationId: applicationId })
        if (!shadowApp) {
            return sendError(ctx, ERROR_CODES.NOT_FOUND, 'Shadow application not found', 404)
        }

        // 公司归属校验
        let companyId
        try {
            companyId = await getUserCompanyId(ctx, 'shadowApplicationProxy')
        } catch (error) {
            return sendError(ctx, ERROR_CODES.FORBIDDEN, '用户未关联公司', 403)
        }

        const jobPost = await JobPost.findById(shadowApp.jobId).select('companyId jobId').lean()
        if (!jobPost || jobPost.companyId !== companyId) {
            return sendError(ctx, ERROR_CODES.FORBIDDEN, '无权查看该影子申请', 403)
        }

        // shadowResumeId 已经是 "jobId:userId" 复合格式，直接作为 key
        const key = shadowApp.shadowResumeId

        ctx.logger.info('[shadowApplicationProxy] proxy to recommend-service', {
            applicationId,
            jobId: jobPost.jobId,
            shadowResumeId: shadowApp.shadowResumeId,
            companyId,
        })

        try {
            const data = await RecommendService.getInvitationDetail(key)
            if (data) {
                data.source = 'recommend'
                data.shadowApplicationId = shadowApp.shadowApplicationId
                data.invitedAt = shadowApp.invitedAt || null
            }
            ctx.success(data)
        } catch (error) {
            ctx.logger.error('[shadowApplicationProxy] recommend-service proxy failed', {
                key,
                applicationId,
                error: error.message,
            })
            return sendError(ctx, ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT, '获取影子申请详情失败', 502)
        }
    }
}
