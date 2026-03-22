/**
 * 外部服务调用基类
 * @module services/integration/base_service
 */

import axios from 'axios'
import { retry } from '../../../utils/index.js'
import { log } from '../../../utils/logger.js'
import { ERROR_CODES } from '../../constants/error_codes.js'

const logger = log('base_service')

/**
 * 外部服务基类
 */
export class BaseService {
    /**
     * 构造函数
     * @param {Object} config - 服务配置
     * @param {string} config.baseURL - 服务基础URL
     * @param {number} [config.timeout] - 超时时间（毫秒）
     * @param {Object} [config.headers] - 默认请求头
     * @param {number} [config.retries] - 重试次数
     * @param {number} [config.retryInterval] - 重试间隔（毫秒）
     * @param {string} [config.serviceName] - 服务名称
     */
    constructor(config) {
        this.serviceName = config.serviceName || 'unknown-service'
        this.retries = config.retries || 3
        this.retryInterval = config.retryInterval || 1000

        // 创建 axios 实例
        this.client = axios.create({
            baseURL: config.baseURL,
            timeout: config.timeout || 30000,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers,
            },
        })

        // 请求拦截器
        this.client.interceptors.request.use(
            config => this.handleRequest(config),
            error => this.handleRequestError(error),
        )

        // 响应拦截器
        this.client.interceptors.response.use(
            response => this.handleResponse(response),
            error => this.handleResponseError(error),
        )
    }

    /**
     * 请求拦截处理
     * @param {Object} config - 请求配置
     * @returns {Object} 处理后的配置
     */
    handleRequest(config) {
        // 添加请求时间戳
        config.metadata = { startTime: new Date() }

        // 如果没有 traceId，则添加请求ID用于追踪
        // 优先使用 X-Trace-ID，其次 X-Request-ID，最后生成新的
        if (!config.headers['X-Trace-ID'] && !config.headers['X-Request-ID']) {
            config.headers['X-Request-ID'] = this.generateRequestId()
        }

        // 检查 x-user-id header - 如果没有提供，记录警告但不自动添加
        // 让问题暴露出来，而不是隐藏它
        if (!config.headers['x-user-id']) {
            logger.warn(`[${this.serviceName}] Missing x-user-id header in request to ${config.url}`)
            // 不自动添加默认值，让服务端返回正确的错误
        }

        // 日志记录
        logger.info(`[${this.serviceName}] Request`, {
            baseURL: config.baseURL,
            method: config.method,
            url: config.url,
            params: config.params,
            data: config.data,
            traceId: config.headers['X-Trace-ID'] || config.headers['X-Request-ID'],
            'x-user-id': config.headers['x-user-id'],
            'x-user-company-id': config.headers['x-user-company-id'],
        })

        return config
    }

    /**
     * 请求错误处理
     * @param {Error} error - 错误对象
     * @returns {Promise} 拒绝的Promise
     */
    handleRequestError(error) {
        logger.error(`[${this.serviceName}] Request Error: ${error.message}`)
        return Promise.reject(error)
    }

    /**
     * 响应拦截处理
     * @param {Object} response - 响应对象
     * @returns {Object} 处理后的响应
     */
    handleResponse(response) {
        const duration = new Date() - response.config.metadata.startTime

        // 日志记录
        logger.info(`[${this.serviceName}] Response`, {
            status: response.status,
            duration: `${duration}ms`,
            url: response.config.url,
        })

        // 处理标准响应格式
        if (response.data && typeof response.data === 'object') {
            // 如果响应包含 success 字段，检查是否成功
            if ('success' in response.data && !response.data.success) {
                const error = new Error(response.data.error?.message || '服务调用失败')
                error.code = response.data.error?.code
                error.response = response
                throw error
            }
        }

        return response
    }

    /**
     * 响应错误处理
     * @param {Error} error - 错误对象
     * @returns {Promise} 拒绝的Promise
     */
    handleResponseError(error) {
        const duration = error.config?.metadata ? new Date() - error.config.metadata.startTime : 0

        // 构建详细错误日志
        const errorLog = {
            message: error.message,
            status: error.response?.status,
            statusText: error.response?.statusText,
            duration: `${duration}ms`,
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
        }

        // 如果有响应体，记录详细错误信息
        if (error.response?.data) {
            errorLog.responseBody = error.response.data
            errorLog.responseError = error.response.data?.error
            errorLog.responseMessage = error.response.data?.message
        }

        logger.error(`[${this.serviceName}] Response Error - DETAILED`, errorLog)

        // 特别处理 400 错误 - 通常是参数问题
        if (error.response?.status === 400) {
            logger.error(`[${this.serviceName}] 400 Bad Request - Likely missing required parameter`, {
                url: error.config?.url,
                sentHeaders: error.config?.headers,
                responseError: error.response?.data?.error || 'Unknown',
                responseMessage: error.response?.data?.message || 'No details provided',
                hint:
                    error.response?.data?.error === 'x-user-id header is required'
                        ? '❌ Missing x-user-id header - Check if header is being sent correctly'
                        : 'Check request parameters',
            })
        }

        // 转换错误格式
        const serviceError = this.createServiceError(error)
        return Promise.reject(serviceError)
    }

    /**
     * 创建服务错误对象
     * @param {Error} error - 原始错误
     * @returns {Object} 标准化错误对象
     */
    createServiceError(error) {
        // 尝试从响应体中获取更详细的错误信息
        const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message

        const serviceError = {
            service: this.serviceName,
            message: errorMessage,
            code: ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT.code,
            originalError: error,
        }

        if (error.response) {
            serviceError.status = error.response.status
            serviceError.data = error.response.data
            serviceError.responseError = error.response.data?.error
            serviceError.responseMessage = error.response.data?.message

            // 根据HTTP状态码设置错误码
            if (error.response.status === 401) {
                serviceError.code = ERROR_CODES.UNAUTHORIZED.code
            } else if (error.response.status === 403) {
                serviceError.code = ERROR_CODES.FORBIDDEN.code
            } else if (error.response.status === 404) {
                serviceError.code = ERROR_CODES.NOT_FOUND.code
            } else if (error.response.status >= 500) {
                serviceError.code = ERROR_CODES.INTERNAL_ERROR.code
            }
        } else if (error.code === 'ECONNABORTED') {
            serviceError.code = ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT.code
            serviceError.message = '服务调用超时'
        }

        return serviceError
    }

    /**
     * 生成请求ID
     * @returns {string} 请求ID
     */
    generateRequestId() {
        return `${this.serviceName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    /**
     * 发送GET请求
     * @param {string} url - 请求URL
     * @param {Object} [params] - 查询参数
     * @param {Object} [config] - 请求配置
     * @returns {Promise} 响应数据
     */
    async get(url, params = {}, config = {}) {
        return retry(() => this.client.get(url, { params, ...config }), this.retries, this.retryInterval)
    }

    /**
     * 发送POST请求
     * @param {string} url - 请求URL
     * @param {Object} [data] - 请求数据
     * @param {Object} [config] - 请求配置
     * @returns {Promise} 响应数据
     */
    async post(url, data = {}, config = {}) {
        return retry(() => this.client.post(url, data, config), this.retries, this.retryInterval)
    }

    /**
     * 发送PUT请求
     * @param {string} url - 请求URL
     * @param {Object} [data] - 请求数据
     * @param {Object} [config] - 请求配置
     * @returns {Promise} 响应数据
     */
    async put(url, data = {}, config = {}) {
        return retry(() => this.client.put(url, data, config), this.retries, this.retryInterval)
    }

    /**
     * 发送DELETE请求
     * @param {string} url - 请求URL
     * @param {Object} [config] - 请求配置
     * @returns {Promise} 响应数据
     */
    async delete(url, config = {}) {
        return retry(() => this.client.delete(url, config), this.retries, this.retryInterval)
    }

    /**
     * 发送PATCH请求
     * @param {string} url - 请求URL
     * @param {Object} [data] - 请求数据
     * @param {Object} [config] - 请求配置
     * @returns {Promise} 响应数据
     */
    async patch(url, data = {}, config = {}) {
        return retry(() => this.client.patch(url, data, config), this.retries, this.retryInterval)
    }

    /**
     * 设置认证Token
     * @param {string} token - 认证Token
     */
    setAuthToken(token) {
        if (token) {
            this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`
        } else {
            delete this.client.defaults.headers.common['Authorization']
        }
    }

    /**
     * 设置网关认证头
     * @param {Object} headers - 网关认证头
     */
    setGatewayHeaders(headers) {
        if (headers['x-gateway-auth']) {
            this.client.defaults.headers.common['x-gateway-auth'] = headers['x-gateway-auth']
        }
        if (headers['x-user-id']) {
            this.client.defaults.headers.common['x-user-id'] = headers['x-user-id']
        }
        if (headers['x-user-role']) {
            this.client.defaults.headers.common['x-user-role'] = headers['x-user-role']
        }
    }

    /**
     * 健康检查
     * @returns {Promise<boolean>} 服务是否健康
     */
    async healthCheck() {
        try {
            const response = await this.get('/health', {}, { timeout: 5000 })
            return response.status === 200
        } catch (error) {
            logger.error(`[${this.serviceName}] Health check failed: ${error.message}`)
            return false
        }
    }

    /**
     * 批量请求
     * @param {Array} requests - 请求配置数组
     * @returns {Promise<Array>} 响应数组
     */
    async batchRequest(requests) {
        const promises = requests.map(req => {
            const method = req.method.toLowerCase()
            return this[method](req.url, req.data || req.params, req.config)
        })

        return Promise.allSettled(promises)
    }
}

export default BaseService
