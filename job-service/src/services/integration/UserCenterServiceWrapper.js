/**
 * UserCenterService 包装器
 * 自动切换真实服务和模拟服务
 */

import UserCenterService from './UserCenterService.js'
import MockUserCenterService from './MockUserCenterService.js'
import logger from '../../../utils/logger.js'

class UserCenterServiceWrapper {
    constructor() {
        this.realService = UserCenterService
        this.mockService = MockUserCenterService
        this.useMock = process.env.USE_MOCK_USER_CENTER === 'true'
        this.failureCount = 0
        this.maxFailures = 3
        this.lastFailureTime = null
        this.fallbackDuration = 60000 // 1分钟后重试真实服务

        if (this.useMock) {
            logger.info('[UserCenterServiceWrapper] 使用模拟用户中心服务')
        }
    }

    /**
     * 判断是否应该使用模拟服务
     */
    shouldUseMock() {
        // 如果环境变量强制使用模拟
        if (this.useMock) {
            return true
        }

        // 如果最近失败次数过多，临时使用模拟
        if (this.failureCount >= this.maxFailures) {
            const timeSinceLastFailure = Date.now() - this.lastFailureTime
            if (timeSinceLastFailure < this.fallbackDuration) {
                return true
            } else {
                // 重置失败计数，尝试使用真实服务
                this.failureCount = 0
                return false
            }
        }

        return false
    }

    /**
     * 包装服务调用，自动降级
     */
    async wrapCall(methodName, ...args) {
        if (this.shouldUseMock()) {
            logger.debug(`[UserCenterServiceWrapper] 使用模拟服务: ${methodName}`)
            return this.mockService[methodName](...args)
        }

        try {
            const result = await this.realService[methodName](...args)
            // 成功调用，重置失败计数
            if (this.failureCount > 0) {
                logger.info('[UserCenterServiceWrapper] 真实服务恢复正常')
                this.failureCount = 0
            }
            return result
        } catch (error) {
            this.failureCount++
            this.lastFailureTime = Date.now()

            logger.warn(`[UserCenterServiceWrapper] 真实服务调用失败，切换到模拟服务`, {
                method: methodName,
                failureCount: this.failureCount,
                error: error.message,
            })

            // 降级到模拟服务
            return this.mockService[methodName](...args)
        }
    }

    // 代理所有方法
    async getCandidateProfile(candidateId) {
        return this.wrapCall('getCandidateProfile', candidateId)
    }

    async getUserInfo(userId) {
        return this.wrapCall('getUserInfo', userId)
    }

    async batchGetUsers(userIds) {
        return this.wrapCall('batchGetUsers', userIds)
    }

    async getCompanyInfo(companyId) {
        return this.wrapCall('getCompanyInfo', companyId)
    }

    async verifyPermission(userId, permission) {
        return this.wrapCall('verifyPermission', userId, permission)
    }

    async getUserRoles(userId) {
        return this.wrapCall('getUserRoles', userId)
    }

    async updateCandidateStats(candidateId, stats) {
        return this.wrapCall('updateCandidateStats', candidateId, stats)
    }

    async updateCompanyStats(companyId, stats) {
        return this.wrapCall('updateCompanyStats', companyId, stats)
    }
}

export default new UserCenterServiceWrapper()
