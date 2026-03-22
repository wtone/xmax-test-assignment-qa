/**
 * 推荐系统服务集成
 * @module services/integration/RecommendService
 * @description 代理调用 recommend-service 的内部 API，用于获取影子候选人详情
 */

import { BaseService } from './base_service.js'
import { log } from '../../../utils/logger.js'

const logger = log('RecommendService')

class RecommendService extends BaseService {
    constructor() {
        super({
            // recommend-service 不在 K8s 内，生产环境必须设置 RECOMMEND_SERVICE_URL
            baseURL: process.env.RECOMMEND_SERVICE_URL || process.env.RECOMMEND_SERVICE_URL || 'http://localhost:3070',
            timeout: 10000,
            serviceName: 'recommend-service',
            retries: 2,
            retryInterval: 1000,
        })
    }

    /**
     * 获取影子候选人最新画像（含邮箱）
     * @param {string} shadowResumeId - 格式 "user-parsed-xxx"
     * @returns {Promise<Object|null>} { userId, basicInfo: { email, name, ... }, ... } 或 null
     */
    async getUserProfile(shadowResumeId) {
        logger.info('[RecommendService] getUserProfile', { shadowResumeId })

        try {
            const response = await this.post('/api/v1/internal/recommend/userProfiles', {
                userIds: [shadowResumeId],
            })
            const body = response.data

            if (body?.code !== 0 && body?.code !== undefined) {
                logger.warn('[RecommendService] getUserProfile returned non-zero code', {
                    shadowResumeId, code: body.code, message: body.message,
                })
                return null
            }

            const profiles = body?.data ?? body
            return Array.isArray(profiles) ? profiles[0] : null
        } catch (error) {
            logger.error('[RecommendService] getUserProfile failed', {
                shadowResumeId, error: error.message, status: error.status,
            })
            return null
        }
    }

    /**
     * 获取影子候选人邀约详情
     * @param {string} key - 格式 "{jobId}:{shadowResumeId}"
     * @returns {Promise<Object>} 包含 candidate、job、evaluation、matchScore 等
     */
    async getInvitationDetail(key) {
        logger.info('[RecommendService] getInvitationDetail', { key })

        try {
            const response = await this.get('/api/v1/internal/recommend/invitationDetail', { key })
            const body = response.data

            // recommend-service 返回 { code: 0, data: {...} } 格式
            if (body?.code !== 0 && body?.code !== undefined) {
                logger.warn('[RecommendService] invitationDetail returned non-zero code', {
                    key,
                    code: body.code,
                    message: body.message,
                })
                return null
            }

            return body?.data ?? body
        } catch (error) {
            logger.error('[RecommendService] getInvitationDetail failed', {
                key,
                error: error.message,
                status: error.status,
            })
            throw error
        }
    }
}

export default new RecommendService()
