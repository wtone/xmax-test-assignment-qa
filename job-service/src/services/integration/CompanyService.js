/**
 * 公司服务集成客户端
 * @module services/integration/company_service
 */

import { BaseService } from './base_service.js'
import { log } from '../../../utils/logger.js'

const logger = log('CompanyService')

/**
 * 公司服务集成类
 */
class CompanyService extends BaseService {
    constructor() {
        super({
            serviceName: 'company-service',
            baseURL: process.env.COMPANY_SERVICE_URL || 'http://localhost:3005',
            timeout: 10000,
            retries: 2,
            retryInterval: 1000,
        })
    }

    /**
     * 获取用户关联的公司信息
     * @param {string} userId - 用户ID
     * @param {string} [traceId] - 请求追踪ID
     * @returns {Promise<Object|null>} 公司信息，如果未找到返回null
     */
    async getUserCompany(userId, traceId = null) {
        try {
            // 设置用户ID和追踪ID头部
            const config = {
                headers: {
                    'X-User-ID': userId,
                },
            }

            // 如果有 traceId，添加到请求头
            if (traceId) {
                config.headers['X-Trace-ID'] = traceId
            }

            const response = await this.get('/api/v1/company/my', {}, config)

            if (response.data && response.data.success) {
                return response.data.data
            }

            return null
        } catch (error) {
            logger.warn(`[CompanyService] 获取用户公司信息失败 (userId: ${userId}): ${error.message}`)

            // 对于404错误（用户未关联公司），返回null而不是抛出异常
            if (error.status === 404 || error.code === 'COMPANY_NOT_FOUND') {
                return null
            }

            // 其他错误继续抛出
            throw error
        }
    }

    /**
     * 根据公司ID获取公司详情
     * @param {string} companyId - 公司ID
     * @param {string} [traceId] - 请求追踪ID
     * @returns {Promise<Object|null>} 公司详情
     */
    async getCompanyById(companyId, traceId = null) {
        try {
            const config = {}

            // 如果有 traceId，添加到请求头
            if (traceId) {
                config.headers = { 'X-Trace-ID': traceId }
            }

            const response = await this.get(`/api/v1/company/${companyId}`, {}, config)

            if (response.data && response.data.success) {
                return response.data.data
            }

            return null
        } catch (error) {
            logger.warn(`[CompanyService] 获取公司详情失败 (companyId: ${companyId}): ${error.message}`)

            if (error.status === 404) {
                return null
            }

            throw error
        }
    }

    /**
     * 批量获取公司信息
     * @param {Array<string>} companyIds - 公司ID数组
     * @returns {Promise<Array<Object>>} 公司信息数组
     */
    async batchGetCompanies(companyIds) {
        try {
            const promises = companyIds.map(id => this.getCompanyById(id))
            const results = await Promise.allSettled(promises)

            return results.map(result => (result.status === 'fulfilled' ? result.value : null)).filter(Boolean)
        } catch (error) {
            logger.error('[CompanyService] 批量获取公司信息失败', { error: error.message })
            return []
        }
    }

    /**
     * 验证用户对公司的权限
     * @param {string} userId - 用户ID
     * @param {string} companyId - 公司ID
     * @param {string} action - 权限动作 (如: 'view', 'edit', 'delete')
     * @returns {Promise<boolean>} 是否有权限
     */
    async checkCompanyPermission(userId, companyId, action = 'view') {
        try {
            const config = {
                headers: {
                    'X-User-ID': userId,
                },
            }

            const response = await this.post(`/api/v1/company/${companyId}/check-permission`, { action }, config)

            return response.data?.success && response.data?.data?.hasPermission === true
        } catch (error) {
            logger.warn(`[CompanyService] 权限验证失败 (userId: ${userId}, companyId: ${companyId}, action: ${action}): ${error.message}`)
            return false
        }
    }

    /**
     * 获取企业员工列表
     * @param {string} companyId - 公司ID
     * @param {Object} [params] - 查询参数（keyword, status, page, pageSize）
     * @returns {Promise<Object[]>} 员工列表
     */
    async getCompanyEmployees(companyId, params = {}) {
        try {
            const config = {
                headers: {
                    'x-user-id': 'system',
                    'x-user-type': 'B',
                },
            }
            const response = await this.get(`/api/v1/company/${companyId}/employee`, {
                status: 'active',
                pageSize: 200,
                ...params,
            }, config)
            const data = response.data?.data || response.data
            return data?.employees || data?.items || (Array.isArray(data) ? data : [])
        } catch (error) {
            logger.warn(`[CompanyService] 获取企业员工列表失败 (companyId: ${companyId}): ${error.message}`)
            return []
        }
    }

    /**
     * 创建公司
     * @param {Object} companyData - 公司数据
     * @param {string} founderId - 创始人用户ID
     * @returns {Promise<Object>} 创建的公司信息
     */
    async createCompany(companyData, founderId) {
        try {
            const config = {
                headers: {
                    'X-User-ID': founderId,
                },
            }

            const response = await this.post('/api/v1/company', companyData, config)

            if (response.data && response.data.success) {
                return response.data.data
            }

            throw new Error('公司创建失败')
        } catch (error) {
            logger.error('[CompanyService] 创建公司失败', { error: error.message })
            throw error
        }
    }
}

// 创建单例实例
const companyService = new CompanyService()

export default companyService
