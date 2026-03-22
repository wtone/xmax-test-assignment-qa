/**
 * Balance Service 客户端
 * @module services/integration/BalanceService
 * @description 调用 xmax-balance-service 的 API，处理面试预约支付相关操作
 */

import { BaseService } from './base_service.js'
import logger from '../../../utils/logger.js'

// 默认配置
const BALANCE_SERVICE_URL = process.env.BALANCE_SERVICE_URL || 'http://localhost:3011'

/**
 * Balance Service 客户端类
 * 封装对 balance-service 的 API 调用
 */
class BalanceServiceClient extends BaseService {
    constructor() {
        super({
            baseURL: BALANCE_SERVICE_URL,
            timeout: 30000,
            serviceName: 'balance-service',
            retries: 2,
            retryInterval: 500,
        })
    }

    /**
     * 确认扣费（从冻结金额中扣款）
     * @param {string} frozenId - 冻结记录ID
     * @param {Object} options - 选项
     * @param {string} [options.description] - 扣款描述
     * @param {string} [options.operatorId] - 操作者ID
     * @returns {Promise<Object>} 扣费结果
     * @throws {Error} 扣费失败时抛出错误
     */
    async charge(frozenId, options = {}) {
        const { description, operatorId } = options

        logger.info('[BalanceService] Charging frozen amount', {
            frozenId,
            description,
            operatorId,
        })

        try {
            const response = await this.post(
                '/api/v1/employee-balance/charge',
                {
                    frozenId,
                    description: description || '面试费用扣款',
                },
                {
                    headers: {
                        'x-user-id': operatorId || 'system',
                    },
                },
            )

            const result = response.data?.data || response.data

            logger.info('[BalanceService] Charge successful', {
                frozenId,
                transactionId: result?.transactionId,
                amount: result?.amount,
            })

            return result
        } catch (error) {
            logger.error('[BalanceService] Charge failed', {
                frozenId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 退款（解冻冻结金额）
     * @param {string} frozenId - 冻结记录ID
     * @param {Object} options - 选项
     * @param {string} [options.reason] - 退款原因
     * @param {string} [options.description] - 退款描述
     * @param {number} [options.refundAmount] - 退款金额（可选，不指定则全额退款）
     * @param {string} [options.operatorId] - 操作者ID
     * @returns {Promise<Object>} 退款结果
     * @throws {Error} 退款失败时抛出错误
     */
    async refund(frozenId, options = {}) {
        const { reason, description, refundAmount, operatorId } = options

        logger.info('[BalanceService] Refunding frozen amount', {
            frozenId,
            reason,
            description,
            refundAmount,
            operatorId,
        })

        try {
            const requestBody = {
                frozenId,
                reason: reason || 'refund',
                description: description || '面试费用退款',
            }

            // 如果指定了退款金额，添加到请求体
            if (refundAmount !== undefined && refundAmount !== null) {
                requestBody.refundAmount = refundAmount
            }

            const response = await this.post('/api/v1/employee-balance/refund', requestBody, {
                headers: {
                    'x-user-id': operatorId || 'system',
                },
            })

            const result = response.data?.data || response.data

            logger.info('[BalanceService] Refund successful', {
                frozenId,
                refundAmount: result?.refundAmount || result?.amount,
            })

            return result
        } catch (error) {
            logger.error('[BalanceService] Refund failed', {
                frozenId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 获取冻结记录详情
     * @param {string} frozenId - 冻结记录ID
     * @returns {Promise<Object>} 冻结记录详情
     */
    async getFrozenById(frozenId) {
        logger.info('[BalanceService] Getting frozen record', { frozenId })

        try {
            const response = await this.get(`/api/v1/employee-balance/frozen/${frozenId}`)
            return response.data?.data || response.data
        } catch (error) {
            logger.error('[BalanceService] Get frozen record failed', {
                frozenId,
                error: error.message,
            })
            throw error
        }
    }

    /**
     * 健康检查
     * @returns {Promise<boolean>} 服务是否健康
     */
    async isHealthy() {
        try {
            const response = await this.get('/health', {}, { timeout: 5000 })
            return response.status === 200
        } catch (error) {
            logger.warn('[BalanceService] Health check failed', { error: error.message })
            return false
        }
    }
}

// 导出单例
export default new BalanceServiceClient()
