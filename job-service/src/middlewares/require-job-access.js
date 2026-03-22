/**
 * 岗位访问权限验证中间件
 * @module middlewares/require-job-access
 * @description 验证当前用户是岗位的所有者或协作者
 * @requires gatewayAuth → ctx.state.user
 * @requires requireCompanyAssociation → ctx.state.companyId
 * @provides ctx.state.job, ctx.state.isJobOwner
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import JobPost from '../models/JobPost.js'
import JobCollaborator from '../models/JobCollaborator.js'
import { findBySmartId } from '../utils/dbQueryHelper.js'

export const requireJobAccess = () => {
    return async (ctx, next) => {
        const { userId } = ctx.state.user
        const { companyId } = ctx.state
        const jobId = ctx.params.jobId

        const job = await findBySmartId(JobPost, jobId)
        if (!job || job.companyId.toString() !== companyId.toString()) {
            return sendError(ctx, ERROR_CODES.NOT_FOUND, '职位不存在', 404)
        }

        const isOwner = job.publisherId === userId
        if (!isOwner) {
            const collab = await JobCollaborator.findOne({ jobId: job._id, userId }).lean()
            if (!collab) {
                return sendError(ctx, ERROR_CODES.NOT_FOUND, '职位不存在', 404)
            }
        }

        ctx.state.job = job
        ctx.state.isJobOwner = isOwner
        await next()
    }
}
