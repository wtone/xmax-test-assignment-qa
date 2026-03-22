/**
 * 公司关联验证中间件
 * @module middlewares/companyAuth
 * @description 验证B端用户必须关联公司才能访问特定功能
 */

import { ERROR_CODES } from '../constants/error_codes.js'
import { sendError } from '../../utils/response.js'
import { getUserCompanyId } from '../services/CompanyBusinessService.js'

/**
 * 强制要求B端用户关联公司的中间件
 * 如果B端用户未关联公司，将返回403错误
 *
 * @returns {Function} Koa中间件函数
 */
export const requireCompanyAssociation = () => {
    return async (ctx, next) => {
        try {
            const { type: userType, userId } = ctx.state.user

            // 只对B端用户进行强制检查
            if (userType === 'B') {
                ctx.logger.info('[requireCompanyAssociation] 开始验证B端用户公司关联', {
                    userId,
                    path: ctx.path,
                    method: ctx.method,
                })

                try {
                    // 尝试获取用户的companyId，如果没有关联公司会抛出错误
                    const companyId = await getUserCompanyId(ctx, 'requireCompanyAssociation')

                    // 将验证过的companyId注入到上下文，供后续使用
                    ctx.state.companyId = companyId

                    ctx.logger.info('[requireCompanyAssociation] B端用户公司关联验证通过', {
                        userId,
                        companyId,
                        path: ctx.path,
                    })
                } catch (error) {
                    ctx.logger.warn('[requireCompanyAssociation] B端用户未关联公司，拒绝访问', {
                        userId,
                        error: error.message,
                        path: ctx.path,
                        method: ctx.method,
                    })

                    // 返回特定错误码，要求用户关联公司
                    return sendError(ctx, ERROR_CODES.COMPANY_ASSOCIATION_REQUIRED, 'B端用户必须关联公司才能使用此功能', 403)
                }
            }
        } catch (error) {
            ctx.logger.error('[requireCompanyAssociation] 公司关联验证中间件错误', {
                error: error.message,
                stack: error.stack,
                path: ctx.path,
            })
            return sendError(ctx, ERROR_CODES.INTERNAL_ERROR, '公司关联验证失败', 500)
        }

        // await next() 在 try-catch 外面，让控制器错误正常冒泡到上层错误处理中间件
        await next()
    }
}

/**
 * 检查B端用户公司关联状态的中间件（不阻止访问）
 * 用于需要降级处理的功能
 *
 * @returns {Function} Koa中间件函数
 */
export const checkCompanyAssociation = () => {
    return async (ctx, next) => {
        try {
            const { type: userType, userId } = ctx.state.user

            if (userType === 'B') {
                try {
                    const companyId = await getUserCompanyId(ctx, 'checkCompanyAssociation')

                    ctx.state.companyId = companyId
                    ctx.state.hasCompanyAssociation = true

                    ctx.logger.info('[checkCompanyAssociation] B端用户已关联公司', {
                        userId,
                        companyId,
                    })
                } catch (error) {
                    ctx.logger.info('[checkCompanyAssociation] B端用户未关联公司，降级处理', {
                        userId,
                        error: error.message,
                    })

                    ctx.state.companyId = null
                    ctx.state.hasCompanyAssociation = false
                }
            } else {
                // C端用户不需要公司关联
                ctx.state.hasCompanyAssociation = true
                ctx.state.companyId = userId // C端用户可以使用userId
            }

        } catch (error) {
            ctx.logger.error('[checkCompanyAssociation] 公司关联检查中间件错误', {
                error: error.message,
                stack: error.stack,
            })
            // 检查失败不阻止访问，降级后继续
            ctx.state.hasCompanyAssociation = false
        }

        // await next() 在 try-catch 外面，避免吞掉控制器错误和 double next()
        await next()
    }
}

export default {
    requireCompanyAssociation,
    checkCompanyAssociation,
}
