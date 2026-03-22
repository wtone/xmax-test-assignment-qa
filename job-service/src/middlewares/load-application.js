/**
 * 加载申请中间件
 * @module middlewares/load-application
 * @description 从 URL params 中获取 applicationId，查询 DB 后挂载到 ctx.state.application
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import JobApplication from '../models/JobApplication.js'

export const loadApplication = (paramName = 'applicationId') => {
    return async (ctx, next) => {
        const id = ctx.params[paramName]
        const application = await JobApplication.findOne({ applicationId: id })
        if (!application) {
            return sendError(ctx, ERROR_CODES.APPLICATION_NOT_FOUND, '申请不存在', 404)
        }
        ctx.state.application = application
        await next()
    }
}
