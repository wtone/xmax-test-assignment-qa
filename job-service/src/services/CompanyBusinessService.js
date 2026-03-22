/**
 * 公司业务逻辑服务
 * @module services/CompanyBusinessService
 */

import companyService from './integration/CompanyService.js'

/**
 * 获取请求的trace ID
 * @param {Object} ctx - Koa 上下文
 * @returns {string|undefined} trace ID
 */
const getTraceId = ctx => {
    return ctx.state.traceId || ctx.headers['x-trace-id'] || ctx.headers['x-request-id']
}

/**
 * 获取用户的公司ID（B端用户必须关联公司）
 * @param {Object} ctx - Koa 上下文
 * @param {string} operationName - 操作名称（用于日志）
 * @returns {Promise<string>} companyId
 * @throws {Error} B端用户未关联公司时抛出错误
 */
export const getUserCompanyId = async (ctx, operationName = 'operation') => {
    let { companyId, userId } = ctx.state.user

    // 如果JWT中已有companyId，直接返回
    if (companyId) {
        return companyId
    }

    // B端用户：必须从Company Service获取companyId
    if (ctx.state.user.type === 'B') {
        const traceId = getTraceId(ctx)

        ctx.logger.info(`[${operationName}] B端用户从Company Service获取公司信息`, {
            userId: userId,
            userType: ctx.state.user.type,
            traceId: traceId,
        })

        try {
            const userCompanyInfo = await companyService.getUserCompany(userId, traceId)

            if (userCompanyInfo && userCompanyInfo.company) {
                companyId = userCompanyInfo.company.companyId || userCompanyInfo.company._id

                ctx.logger.info(`[${operationName}] 成功获取B端用户companyId`, {
                    userId: userId,
                    companyId: companyId,
                    companyName: userCompanyInfo.company.name,
                    traceId: traceId,
                })

                return companyId
            } else {
                ctx.logger.warn(`[${operationName}] B端用户未关联任何公司`, {
                    userId: userId,
                    traceId: traceId,
                })
                throw new Error('B端用户未关联公司，无法获取companyId')
            }
        } catch (error) {
            ctx.logger.error(`[${operationName}] 获取B端用户companyId失败`, {
                userId: userId,
                error: error.message,
                traceId: traceId,
            })
            throw error
        }
    }

    // C端用户或其他情况
    return userId
}

/**
 * 获取公司信息（包含Company Service集成逻辑）
 * @param {Object} ctx - Koa 上下文
 * @param {string} userId - 用户ID
 * @param {string} operationName - 操作名称（用于日志）
 * @returns {Promise<Object|null>} 公司信息对象或null
 */
export const getCompanyInfo = async (ctx, userId, operationName = 'operation') => {
    if (!userId || ctx.state.user.type !== 'B') {
        return null
    }

    const traceId = getTraceId(ctx)

    try {
        const userCompanyInfo = await companyService.getUserCompany(userId, traceId)
        if (userCompanyInfo && userCompanyInfo.company) {
            ctx.logger.info(`[${operationName}] 成功获取公司信息`, {
                userId: userId,
                companyName: userCompanyInfo.company.name,
                traceId: traceId,
            })
            return userCompanyInfo.company
        }
    } catch (error) {
        ctx.logger.warn(`[${operationName}] 获取公司信息失败`, {
            userId: userId,
            error: error.message,
            traceId: traceId,
        })
    }

    return null
}

export default {
    getUserCompanyId,
    getCompanyInfo,
}
