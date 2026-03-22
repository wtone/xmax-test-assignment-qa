/**
 * Payment Service 客户端
 * @module services/integration/PaymentService
 * @description 调用 xmax-payment-service 的 API，处理面试预约支付相关操作
 */

import { BaseService } from './base_service.js'
import logger from '../../../utils/logger.js'

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3020'

/**
 * Payment Service 客户端类
 * 封装对 payment-service 的统一订单 API 调用
 */
class PaymentServiceClient extends BaseService {
    constructor() {
        super({
            baseURL: PAYMENT_SERVICE_URL,
            timeout: 30000,
            serviceName: 'payment-service',
            retries: 2,
            retryInterval: 500,
        })
    }

    /**
     * 获取服务间调用所需的网关认证头
     * payment-service 的 gateway_auth 中间件要求 x-user-id header
     * @param {string} [userId] - 用户ID，默认 'system' 表示服务间调用
     * @returns {Object} headers 配置
     */
    _getServiceHeaders(userId = 'system') {
        return { headers: { 'x-user-id': userId } }
    }

    /**
     * 校验 payment-service 响应
     * payment-service 使用 { code: 0, message: "success" } 格式，
     * 业务错误也返回 HTTP 200，需要检查 code 字段
     * @param {Object} response - axios 响应
     * @param {string} operation - 操作描述（用于错误日志）
     * @returns {Object} response.data.data 或 response.data
     * @throws {Error} 当 code !== 0 时抛出错误
     */
    _extractResult(response, operation) {
        const body = response.data
        if (body && typeof body === 'object' && 'code' in body && body.code !== 0) {
            const error = new Error(body.message || `${operation} failed with code ${body.code}`)
            error.code = body.code
            error.responseBody = body
            throw error
        }
        return body?.data || body
    }

    /**
     * 获取订单详情
     * @param {string} orderId - 订单ID
     * @param {string} [userId] - 调用方用户ID（传递给 payment-service gateway_auth）
     * @returns {Promise<Object>} 订单详情
     */
    async getOrderInfo(orderId, userId) {
        logger.info('[PaymentService] Getting order info', { orderId })

        try {
            const response = await this.get('/api/v1/order/info', { id: orderId }, this._getServiceHeaders(userId))
            return this._extractResult(response, 'getOrderInfo')
        } catch (error) {
            logger.error('[PaymentService] Get order info failed', {
                orderId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 查询订单状态
     * @param {string} orderId - 订单ID
     * @param {string} [userId] - 调用方用户ID
     * @returns {Promise<Object>} 订单状态 { orderId, status, statusText, paidAmount, paidAt, refundStatus, refundAmount }
     */
    async getOrderStatus(orderId, userId) {
        logger.info('[PaymentService] Getting order status', { orderId })

        try {
            const response = await this.get('/api/v1/order/status', { orderId }, this._getServiceHeaders(userId))
            return this._extractResult(response, 'getOrderStatus')
        } catch (error) {
            logger.error('[PaymentService] Get order status failed', {
                orderId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 确认订单（PAID → COMPLETED，触发扣款）
     * @param {string} orderId - 订单ID
     * @param {Object} options - 选项
     * @param {string} [options.description] - 确认描述
     * @param {string} [options.comment] - 备注
     * @param {string} [options.userId] - 调用方用户ID
     * @returns {Promise<Object>} 确认结果 { orderId, status, statusText }
     */
    async confirmOrder(orderId, options = {}) {
        const { description, comment, userId } = options

        logger.info('[PaymentService] Confirming order', {
            orderId,
            description,
            comment,
        })

        try {
            const response = await this.post('/api/v1/order/confirm', {
                orderId,
                description,
                comment,
            }, this._getServiceHeaders(userId))

            const result = this._extractResult(response, 'confirmOrder')

            logger.info('[PaymentService] Order confirmed successfully', {
                orderId,
                status: result?.status,
                statusText: result?.statusText,
            })

            return result
        } catch (error) {
            logger.error('[PaymentService] Confirm order failed', {
                orderId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 订单退款
     * @param {string} orderId - 订单ID
     * @param {Object} options - 选项
     * @param {number} options.amount - 退款金额（required）
     * @param {string} [options.reason] - 退款原因
     * @param {string} [options.comment] - 备注
     * @param {string} [options.userId] - 调用方用户ID
     * @returns {Promise<Object>} 退款结果 { orderId, status, statusText }
     */
    async refundOrder(orderId, options = {}) {
        const { amount, reason, comment, userId } = options

        logger.info('[PaymentService] Refunding order', {
            orderId,
            amount,
            reason,
            comment,
        })

        try {
            const response = await this.post('/api/v1/order/refund', {
                orderId,
                amount,
                reason,
                comment,
            }, this._getServiceHeaders(userId))

            const result = this._extractResult(response, 'refundOrder')

            logger.info('[PaymentService] Order refunded successfully', {
                orderId,
                status: result?.status,
                statusText: result?.statusText,
            })

            return result
        } catch (error) {
            logger.error('[PaymentService] Refund order failed', {
                orderId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
            })
            throw error
        }
    }

    /**
     * 关闭订单
     * @param {string} orderId - 订单ID
     * @param {string} [userId] - 调用方用户ID
     * @returns {Promise<Object>} 关闭结果 { orderId, status, statusText }
     */
    async closeOrder(orderId, userId) {
        logger.info('[PaymentService] Closing order', { orderId })

        try {
            const response = await this.post('/api/v1/order/close', { orderId }, this._getServiceHeaders(userId))

            const result = this._extractResult(response, 'closeOrder')

            logger.info('[PaymentService] Order closed successfully', {
                orderId,
                status: result?.status,
            })

            return result
        } catch (error) {
            logger.error('[PaymentService] Close order failed', {
                orderId,
                error: error.message,
                responseError: error.responseError,
                responseMessage: error.responseMessage,
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
            logger.warn('[PaymentService] Health check failed', { error: error.message })
            return false
        }
    }
}

export default new PaymentServiceClient()
