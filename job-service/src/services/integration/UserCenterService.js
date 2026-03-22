import BaseService from './base_service.js'
import { log } from '../../../utils/logger.js'

const logger = log('UserCenterService')

class UserCenterService extends BaseService {
    constructor() {
        const config = {
            serviceName: 'user-center',
            baseURL: process.env.USER_CENTER_URL || 'http://localhost:3001',
            timeout: 30000,
            retries: 3,
        }
        super(config)
    }

    /**
     * 获取用户信息
     */
    async getUserInfo(userId) {
        const response = await this.get(`/api/v1/user/${userId}`)
        return response.data
    }

    /**
     * 批量获取用户信息
     */
    async batchGetUsers(userIds) {
        const config = {
            headers: {
                'x-user-id': 'system',
                'x-user-type': 'B',
            },
        }
        const response = await this.post('/api/v1/user/batch', { userIds }, config)
        return response.data
    }

    /**
     * 获取企业信息
     */
    async getCompanyInfo(companyId) {
        const response = await this.get(`/api/v1/company/${companyId}`)
        return response.data
    }

    /**
     * 验证用户权限
     */
    async verifyPermission(userId, permission) {
        const response = await this.post('/api/v1/auth/verify-permission', { userId, permission })
        return response.data
    }

    /**
     * 获取用户角色
     */
    async getUserRoles(userId) {
        const response = await this.get(`/api/v1/user/${userId}/roles`)
        return response.data
    }

    /**
     * 获取用户档案（通用方法，适用于候选人和面试官）
     * 使用公开API获取用户基本信息
     * @param {string} userId - 用户ID
     * @returns {Promise<Object>} 用户基本信息 { name, email, phone, ... }
     */
    async getUserProfile(userId) {
        try {
            const config = {
                headers: { 'x-user-id': userId },
            }
            const response = await this.get(`/api/v1/users/public/${userId}/basic`, {}, config)
            return response.data?.data || response.data
        } catch (error) {
            console.error(`[UserCenterService] 获取用户档案失败:`, {
                userId,
                error: error.message,
                status: error.status,
            })
            throw error
        }
    }

    /**
     * 获取候选人档案（兼容旧代码）
     * @deprecated 请使用 getUserProfile
     */
    async getCandidateProfile(candidateId) {
        return this.getUserProfile(candidateId)
    }

    /**
     * 更新候选人统计信息
     */
    async updateCandidateStats(candidateId, stats) {
        const response = await this.put(`/api/v1/candidate/${candidateId}/stats`, stats)
        return response.data
    }

    /**
     * 更新企业统计信息
     */
    async updateCompanyStats(companyId, stats) {
        const response = await this.put(`/api/v1/company/${companyId}/stats`, stats)
        return response.data
    }

    /**
     * 搜索内部用户（用于协作者搜索）
     * @param {string} keyword - 搜索关键词（用户名/邮箱）
     * @param {string} [type] - 用户类型 B/C
     * @param {number} [limit=20] - 返回数量
     * @returns {Promise<Object[]>} 用户列表
     */
    async searchInternalUsers(keyword, type = 'B', limit = 20) {
        try {
            const params = { keyword, limit }
            if (type) params.type = type
            const config = {
                headers: {
                    'x-user-id': 'system',
                    'x-user-type': 'B',
                },
            }
            const response = await this.get('/api/v1/internal/users', params, config)
            const data = response.data?.data || response.data
            return Array.isArray(data) ? data : data?.users || data?.items || []
        } catch (error) {
            console.error('[UserCenterService] 搜索内部用户失败:', {
                keyword,
                type,
                error: error.message,
            })
            return []
        }
    }

    /**
     * 获取用户列表偏好（调用 user-center 内部 API）
     * @param {string} userId
     * @returns {{ foldEnabled: boolean, foldThreshold: number } | null}
     */
    async getUserPreferences(userId) {
        try {
            const response = await this.get(`/api/v1/internal/users/${userId}/preferences`)
            const data = response.data?.data || response.data
            return data?.listDisplay || null
        } catch (error) {
            logger.warn('[UserCenterService] getUserPreferences failed, using defaults', {
                userId,
                error: error.message,
            })
            return null
        }
    }

    /**
     * 通过邮箱获取用户基本信息（公开接口）
     * @param {string} email - 用户邮箱
     * @returns {Promise<Object|null>} 用户基本信息
     */
    async getUserByEmail(email) {
        try {
            const encodedEmail = encodeURIComponent(email)
            const response = await this.get(`/api/v1/users/public/by-email/${encodedEmail}/basic`)
            return response.data?.data || response.data
        } catch (error) {
            console.error(`[UserCenterService] 通过邮箱获取用户信息失败:`, {
                email,
                error: error.message,
                status: error.status,
            })
            // 404 表示用户不存在，返回 null
            if (error.status === 404) {
                return null
            }
            throw error
        }
    }
}

export default new UserCenterService()
