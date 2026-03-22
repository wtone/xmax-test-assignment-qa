/**
 * 全局错误处理中间件
 * @module middlewares/error_handler
 * @description 捕获和处理各类错误，记录错误日志，返回统一的错误响应
 */

import { ERROR_CODES } from '../src/constants/error_codes.js'
import { createErrorResponse, getTraceId } from '../utils/response.js'

/**
 * 错误类型枚举
 */
const ERROR_TYPES = {
    VALIDATION: 'ValidationError',
    CAST: 'CastError',
    DUPLICATE: 'MongoError',
    JWT: 'JsonWebTokenError',
    SYNTAX: 'SyntaxError',
    TYPE: 'TypeError',
    REFERENCE: 'ReferenceError',
    RANGE: 'RangeError',
}

/**
 * HTTP状态码映射
 */
const STATUS_CODE_MAP = {
    // 通用错误
    [ERROR_CODES.INVALID_PARAMS.code]: 400,
    [ERROR_CODES.UNAUTHORIZED.code]: 401,
    [ERROR_CODES.FORBIDDEN.code]: 403,
    [ERROR_CODES.NOT_FOUND.code]: 404,
    [ERROR_CODES.INTERNAL_ERROR.code]: 500,
    [ERROR_CODES.VALIDATION_ERROR.code]: 422,
    [ERROR_CODES.DUPLICATE_ERROR.code]: 409,

    // 职位相关错误 (2000-2999)
    [ERROR_CODES.JOB_NOT_FOUND.code]: 404,
    [ERROR_CODES.JOB_CREATE_FAILED.code]: 400,
    [ERROR_CODES.JOB_UPDATE_FAILED.code]: 400,
    [ERROR_CODES.JOB_DELETE_FAILED.code]: 400,
    [ERROR_CODES.JOB_ALREADY_CLOSED.code]: 409,
    [ERROR_CODES.JOB_ALREADY_EXISTS.code]: 409,
    [ERROR_CODES.JOB_STATUS_INVALID.code]: 400,
    [ERROR_CODES.JOB_QUOTA_EXCEEDED.code]: 429,

    // 申请相关错误 (3000-3999)
    [ERROR_CODES.APPLICATION_NOT_FOUND.code]: 404,
    [ERROR_CODES.APPLICATION_CREATE_FAILED.code]: 400,
    [ERROR_CODES.APPLICATION_UPDATE_FAILED.code]: 400,
    [ERROR_CODES.APPLICATION_DELETE_FAILED.code]: 400,
    [ERROR_CODES.APPLICATION_ALREADY_EXISTS.code]: 409,
    [ERROR_CODES.APPLICATION_STATUS_INVALID.code]: 400,
    [ERROR_CODES.APPLICATION_NOT_ALLOWED.code]: 403,
    [ERROR_CODES.APPLICATION_EXPIRED.code]: 410,
    [ERROR_CODES.RESUME_NOT_FOUND.code]: 404,
    [ERROR_CODES.DUPLICATE_APPLICATION.code]: 409,
    [ERROR_CODES.INVALID_STATUS.code]: 400,

    // 公司相关错误 (4000-4999)
    [ERROR_CODES.COMPANY_NOT_FOUND.code]: 404,
    [ERROR_CODES.COMPANY_NOT_VERIFIED.code]: 403,
    [ERROR_CODES.COMPANY_BLOCKED.code]: 403,
    [ERROR_CODES.COMPANY_INFO_INCOMPLETE.code]: 422,

    // 权限相关错误 (5000-5999)
    [ERROR_CODES.NO_PERMISSION.code]: 403,
    [ERROR_CODES.ROLE_NOT_ALLOWED.code]: 403,
    [ERROR_CODES.RESOURCE_ACCESS_DENIED.code]: 403,
    [ERROR_CODES.COMPANY_ASSOCIATION_REQUIRED.code]: 422,
    [ERROR_CODES.COMPANY_ASSOCIATION_INVALID.code]: 422,

    // 外部服务错误 (6000-6999)
    [ERROR_CODES.USER_SERVICE_ERROR.code]: 503,
    [ERROR_CODES.RESUME_SERVICE_ERROR.code]: 503,
    [ERROR_CODES.OSS_SERVICE_ERROR.code]: 503,
    [ERROR_CODES.AI_SERVICE_ERROR.code]: 503,
    [ERROR_CODES.NOTIFICATION_SERVICE_ERROR.code]: 503,
    [ERROR_CODES.EXTERNAL_SERVICE_TIMEOUT.code]: 504,
    [ERROR_CODES.SERVICE_UNAVAILABLE.code]: 503,
}

/**
 * 获取错误堆栈信息
 * @param {Error} error - 错误对象
 * @param {number} [limit=5] - 堆栈行数限制
 * @returns {string} 格式化的堆栈信息
 */
const getErrorStack = (error, limit = 5) => {
    if (!error.stack) return ''

    const lines = error.stack.split('\n')
    return lines.slice(0, limit + 1).join('\n')
}

/**
 * 记录错误日志
 * @param {Object} ctx - Koa上下文
 * @param {Error} error - 错误对象
 * @param {Object} errorInfo - 错误信息
 */
const logError = (ctx, error, errorInfo) => {
    const logData = {
        timestamp: new Date().toISOString(),
        method: ctx.method,
        url: ctx.url,
        path: ctx.path,
        query: ctx.query,
        body: ctx.request.body,
        headers: {
            'user-agent': ctx.headers['user-agent'],
            'x-user-id': ctx.headers['x-user-id'],
            'x-request-id': ctx.headers['x-request-id'],
        },
        error: {
            name: error.name,
            message: error.message,
            code: errorInfo.code,
            stack: getErrorStack(error),
        },
        user: ctx.state.user
            ? {
                  id: ctx.state.user.id,
                  role: ctx.state.user.role,
              }
            : null,
    }

    // 根据错误级别使用不同的日志方法
    if (errorInfo.code >= 5000) {
        console.error('服务器错误:', JSON.stringify(logData, null, 2))
    } else if (errorInfo.code >= 4000) {
        console.warn('客户端错误:', JSON.stringify(logData, null, 2))
    } else {
        console.info('业务错误:', JSON.stringify(logData, null, 2))
    }
}

/**
 * 处理MongoDB错误
 * @param {Error} error - 错误对象
 * @returns {Object} 错误信息
 */
const handleMongoError = error => {
    // 唯一索引冲突
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || 'field'
        return {
            errorCode: ERROR_CODES.DUPLICATE_ERROR,
            detail: `${field} 已存在`,
        }
    }

    // 验证错误
    if (error.name === ERROR_TYPES.VALIDATION) {
        const errors = Object.values(error.errors || {}).map(err => ({
            field: err.path,
            message: err.message,
        }))
        return {
            errorCode: ERROR_CODES.VALIDATION_ERROR,
            detail: '数据验证失败',
            data: { errors },
        }
    }

    // 类型转换错误
    if (error.name === ERROR_TYPES.CAST) {
        return {
            errorCode: ERROR_CODES.INVALID_PARAMS,
            detail: `无效的${error.path}: ${error.value}`,
        }
    }

    return {
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        detail: '数据库操作失败',
    }
}

/**
 * 处理JWT错误
 * @param {Error} error - 错误对象
 * @returns {Object} 错误信息
 */
const handleJWTError = error => {
    if (error.name === 'TokenExpiredError') {
        return {
            errorCode: ERROR_CODES.UNAUTHORIZED,
            detail: 'Token已过期',
        }
    }

    if (error.name === 'JsonWebTokenError') {
        return {
            errorCode: ERROR_CODES.UNAUTHORIZED,
            detail: 'Token无效',
        }
    }

    return {
        errorCode: ERROR_CODES.UNAUTHORIZED,
        detail: '认证失败',
    }
}

/**
 * 处理业务错误
 * @param {Error} error - 错误对象
 * @returns {Object} 错误信息
 */
const handleBusinessError = error => {
    // 如果直接抛出了ERROR_CODES对象（旧的错误处理方式）
    if (error && typeof error === 'object' && error.code && error.message && !(error instanceof Error)) {
        return {
            errorCode: error,
            detail: error.detail || error.message,
        }
    }

    // 如果是AppError实例（来自utils/response.js）
    if (error.name === 'AppError') {
        // 如果有 errorCode 属性（新的处理方式）
        if (error.errorCode) {
            return {
                errorCode: error.errorCode,
                detail: error.message,
            }
        }
        // 兼容旧的处理方式
        if (error.code) {
            const errorCode = Object.values(ERROR_CODES).find(e => e.code === error.code)
            if (errorCode) {
                return {
                    errorCode: errorCode,
                    detail: error.message,
                }
            }
        }
    }

    // 如果是ApiError实例
    if (error.name === 'ApiError' && error.code) {
        // 查找对应的ERROR_CODES对象
        const errorCode = Object.values(ERROR_CODES).find(e => e.code === error.code)
        if (errorCode) {
            return {
                errorCode: errorCode,
                detail: error.detail || error.message,
            }
        }
    }

    // 如果错误对象包含错误码属性
    if (error.code) {
        // 尝试通过code值查找ERROR_CODES
        const errorCode = Object.values(ERROR_CODES).find(e => e.code === error.code)
        if (errorCode) {
            return {
                errorCode: errorCode,
                detail: error.detail || error.message,
            }
        }
    }

    // 根据错误消息匹配错误码
    const errorMessage = (error.message || '').toLowerCase()

    if (errorMessage.includes('not found') || errorMessage.includes('不存在')) {
        return {
            errorCode: ERROR_CODES.NOT_FOUND,
            detail: error.message,
        }
    }

    if (errorMessage.includes('unauthorized') || errorMessage.includes('未授权')) {
        return {
            errorCode: ERROR_CODES.UNAUTHORIZED,
            detail: error.message,
        }
    }

    if (errorMessage.includes('forbidden') || errorMessage.includes('禁止')) {
        return {
            errorCode: ERROR_CODES.FORBIDDEN,
            detail: error.message,
        }
    }

    return {
        errorCode: ERROR_CODES.INTERNAL_ERROR,
        detail: error.message || 'Internal server error',
    }
}

/**
 * 错误处理中间件
 * @param {Object} [options] - 中间件配置选项
 * @param {boolean} [options.logErrors=true] - 是否记录错误日志
 * @param {boolean} [options.exposeStack=false] - 是否在响应中暴露错误堆栈（仅开发环境）
 * @returns {Function} Koa中间件函数
 */
export const errorHandler = (options = {}) => {
    const { logErrors = true, exposeStack = false } = options

    return async (ctx, next) => {
        try {
            await next()

            // 处理404错误
            if (ctx.status === 404 && !ctx.body) {
                ctx.status = 404
                ctx.body = {
                    code: ERROR_CODES.NOT_FOUND.code,
                    message: '请求的资源不存在',
                    timestamp: new Date().toISOString(),
                    traceId: getTraceId(ctx),
                }
            }
        } catch (error) {
            let errorInfo

            // 根据错误类型处理
            if (error.name && error.name.includes('Mongo')) {
                errorInfo = handleMongoError(error)
            } else if (error.name && error.name.includes('Token')) {
                errorInfo = handleJWTError(error)
            } else {
                errorInfo = handleBusinessError(error)
            }

            // 设置响应状态码
            ctx.status = STATUS_CODE_MAP[errorInfo.errorCode.code] || 500

            // 构建统一格式的错误响应（与 resume-service 一致）
            const errorResponse = {
                code: errorInfo.errorCode.code,
                message: errorInfo.detail || errorInfo.errorCode.message,
                timestamp: new Date().toISOString(),
                traceId: getTraceId(ctx),
            }

            // 添加额外的错误信息
            if (errorInfo.data && errorInfo.data.errors) {
                errorResponse.errors = errorInfo.data.errors
            }

            // 开发环境添加错误堆栈
            if (exposeStack && process.env.NODE_ENV === 'development') {
                errorResponse.stack = getErrorStack(error)
                errorResponse.details = error.details
            }

            ctx.body = errorResponse

            // 记录错误日志
            if (logErrors) {
                logError(ctx, error, errorInfo.errorCode)
            }

            // 触发错误事件，供其他中间件处理
            ctx.app.emit('error', error, ctx)
        }
    }
}

/**
 * 创建自定义错误
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @returns {Error} 错误对象
 */
export const createError = (errorCode, detail = null) => {
    const error = new Error(detail || errorCode.message)
    error.code = errorCode.code
    error.statusCode = STATUS_CODE_MAP[errorCode.code] || 500
    error.errorCode = errorCode
    return error
}

/**
 * 抛出业务错误
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @throws {Error} 业务错误
 */
export const throwError = (errorCode, detail = null) => {
    throw createError(errorCode, detail)
}

/**
 * 断言条件
 * @param {boolean} condition - 断言条件
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @throws {Error} 如果条件为假，抛出错误
 */
export const assert = (condition, errorCode, detail = null) => {
    if (!condition) {
        throwError(errorCode, detail)
    }
}

export default errorHandler
