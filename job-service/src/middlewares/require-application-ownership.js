/**
 * 申请所属公司归属验证中间件
 * @module middlewares/require-application-ownership
 * @description 验证 ctx.state.application 所关联的 job 属于当前 B 端用户的公司
 * @requires requireCompanyAssociation → ctx.state.companyId
 * @requires loadApplication → ctx.state.application
 * @provides ctx.state.job
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import JobPost from '../models/JobPost.js'
import JobCollaborator from '../models/JobCollaborator.js'

export const requireApplicationOwnership = () => {
    return async (ctx, next) => {
        const { application, companyId } = ctx.state
        const { userId } = ctx.state.user
        const job = await JobPost.findById(application.jobId)
        if (!job || job.companyId.toString() !== companyId.toString()) {
            return sendError(ctx, ERROR_CODES.FORBIDDEN, '无权操作该申请', 403)
        }

        // 数据隔离：验证用户是岗位所有者或协作者
        const isOwner = job.publisherId === userId
        if (!isOwner) {
            const collab = await JobCollaborator.findOne({ jobId: job._id, userId }).lean()
            if (!collab) {
                return sendError(ctx, ERROR_CODES.FORBIDDEN, '无权操作该申请', 403)
            }
        }

        ctx.state.job = job
        await next()
    }
}
