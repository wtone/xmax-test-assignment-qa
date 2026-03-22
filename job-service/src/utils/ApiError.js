/**
 * API错误类
 * 用于处理API错误响应
 */
export class ApiError extends Error {
    constructor(errorCode, detail = null) {
        super(errorCode.message)
        this.name = 'ApiError'
        this.code = errorCode.code
        this.statusCode = this.getHttpStatusCode(errorCode.code)
        this.detail = detail
        Error.captureStackTrace(this, this.constructor)
    }

    /**
     * 根据错误码获取对应的HTTP状态码
     * @param {number} code - 错误码
     * @returns {number} HTTP状态码
     */
    getHttpStatusCode(code) {
        // 根据错误码范围映射到HTTP状态码
        if (code >= 1001 && code <= 1003) return 401 // 认证相关
        if (code === 1004 || (code >= 2001 && code <= 2999)) return 404 // 资源未找到
        if (code >= 3000 && code <= 3999) {
            if (code === 3005 || code === 3010) return 409 // 冲突
            if (code === 3007) return 403 // 禁止
            return 400 // 请求错误
        }
        if (code >= 4000 && code <= 4999) return 404 // 公司相关未找到
        if (code >= 5000 && code <= 5999) return 403 // 权限不足
        if (code >= 6000 && code <= 6999) return 503 // 服务不可用
        return 500 // 默认服务器错误
    }

    /**
     * 转换为响应对象
     * @returns {Object} 响应对象
     */
    toResponse() {
        return {
            success: false,
            error: {
                code: this.code,
                message: this.message,
                detail: this.detail || undefined,
            },
        }
    }
}

/**
 * 创建API错误
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @returns {ApiError} API错误实例
 */
export const createApiError = (errorCode, detail = null) => {
    return new ApiError(errorCode, detail)
}

export default ApiError
