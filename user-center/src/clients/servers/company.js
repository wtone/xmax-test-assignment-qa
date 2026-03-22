import { fetch, commonReturn } from '../lib.js'
import { log } from '../../../utils/logger.js'
import { USER_TYPE } from '../../libs/constants.js'

const logger = log(import.meta.url)

const companyServiceHost = process.env.COMPANY_SERVICE_HOST || 'http://localhost:3005'

/**
 * 获取用户的公司信息（仅对B端用户）
 * @param {Object} user - 用户对象
 * @param {Object} ctx - Koa上下文对象
 * @param {string} operation - 操作名称，用于日志记录
 * @returns {Promise<string|null>} 返回公司ID，C端用户或获取失败返回null
 */
export const getEmployeeCompanyInfo = async (user, ctx, operation = 'get_company') => {
    // C端用户直接返回null
    if (user.type !== USER_TYPE.B_END) {
        return null
    }

    const userId = user._id
    const traceId = ctx.request.header['trace-id'] || ctx.request.header['x-trace-id'] || `${operation}-${Date.now()}`

    try {
        // 调用company-service的 /api/v1/company/my 接口获取用户公司信息
        const result = await fetch(
            {
                uri: '/api/v1/company/my',
                method: 'GET',
                headers: {
                    'X-User-ID': userId,
                },
            },
            companyServiceHost,
            traceId,
        )

        const [data, error] = commonReturn(result)

        if (error) {
            ctx.logger.warn('Failed to get user company info', {
                operation: `${operation}_failed`,
                userId,
                error,
            })
            return null
        }

        // 返回公司ID (company-service 使用 companyId 字段)
        if (data && data.company && (data.company.companyId || data.company._id)) {
            const companyId = data.company.companyId || data.company._id
            ctx.logger.info('Company ID retrieved for B-end user', {
                operation: `${operation}_get_company`,
                userId,
                companyId: companyId,
                companyName: data.company.name,
            })
            return companyId
        }

        ctx.logger.warn('No company found for B-end user', {
            operation: `${operation}_no_company`,
            userId,
        })
        return null
    } catch (error) {
        ctx.logger.error('Error getting user company info', {
            operation: `${operation}_error`,
            userId,
            error: error.message,
        })
        return null
    }
}
