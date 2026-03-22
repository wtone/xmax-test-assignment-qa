/**
 * 响应工具函数
 * @module utils/response
 */

import { ERROR_CODES } from '../src/constants/error_codes.js'

/**
 * 获取请求的 traceId
 * @param {Object} ctx - Koa 上下文
 * @returns {string|undefined} traceId
 */
const getTraceId = ctx => {
    return ctx.state.traceId || ctx.headers['x-trace-id'] || ctx.headers['x-request-id']
}

/**
 * 创建成功响应
 * @param {*} data - 响应数据
 * @param {string} [message] - 成功消息
 * @param {Object} [meta] - 元数据
 * @returns {Object} 响应对象
 */
export const createSuccessResponse = (data = null, message = 'Success', meta = null) => {
    const response = {
        success: true,
        message,
        data,
    }

    if (meta) {
        response.meta = meta
    }

    return response
}

/**
 * 创建错误响应
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @param {Object} [data] - 附加数据
 * @returns {Object} 响应对象
 */
export const createErrorResponse = (errorCode = ERROR_CODES.INTERNAL_ERROR, detail = null, data = null) => {
    const response = {
        code: errorCode.code,
        message: detail || errorCode.message,
        timestamp: new Date().toISOString(),
    }

    if (data) {
        response.data = data
    }

    return response
}

/**
 * 创建分页响应
 * @param {Array} items - 数据项列表
 * @param {Object} pagination - 分页信息
 * @param {string} [message] - 成功消息
 * @returns {Object} 响应对象
 */
export const createPaginationResponse = (items, pagination, message = 'Success') => {
    return {
        success: true,
        message,
        data: {
            items,
            pagination: {
                page: pagination.page,
                pageSize: pagination.pageSize,
                total: pagination.total,
                totalPages: Math.ceil(pagination.total / pagination.pageSize),
                hasNext: pagination.page < Math.ceil(pagination.total / pagination.pageSize),
                hasPrev: pagination.page > 1,
            },
        },
    }
}

/**
 * 创建列表响应
 * @param {Array} items - 数据项列表
 * @param {string} [message] - 成功消息
 * @param {Object} [meta] - 元数据
 * @returns {Object} 响应对象
 */
export const createListResponse = (items, message = 'Success', meta = null) => {
    const response = {
        success: true,
        message,
        data: {
            items,
            count: items.length,
        },
    }

    if (meta) {
        response.meta = meta
    }

    return response
}

/**
 * 创建单项响应
 * @param {Object} item - 数据项
 * @param {string} [message] - 成功消息
 * @returns {Object} 响应对象
 */
export const createItemResponse = (item, message = 'Success') => {
    return {
        success: true,
        message,
        data: item,
    }
}

/**
 * 创建删除响应
 * @param {string} [message] - 成功消息
 * @param {Object} [data] - 附加数据
 * @returns {Object} 响应对象
 */
export const createDeleteResponse = (message = 'Deleted successfully', data = null) => {
    return {
        success: true,
        message,
        data,
    }
}

/**
 * 创建批量操作响应
 * @param {Object} result - 批量操作结果
 * @param {string} [message] - 成功消息
 * @returns {Object} 响应对象
 */
export const createBatchResponse = (result, message = 'Batch operation completed') => {
    return {
        success: true,
        message,
        data: {
            total: result.total || 0,
            success: result.success || 0,
            failed: result.failed || 0,
            errors: result.errors || [],
        },
    }
}

/**
 * 创建验证错误响应
 * @param {Array} errors - 验证错误列表
 * @param {string} [message] - 错误消息
 * @returns {Object} 响应对象
 */
export const createValidationErrorResponse = (errors, message = 'Validation failed') => {
    const detailMessage = Array.isArray(errors)
        ? errors
              .map(error => error?.message)
              .filter(Boolean)
              .join('; ')
        : ''
    return {
        code: ERROR_CODES.VALIDATION_ERROR.code,
        message: message || ERROR_CODES.VALIDATION_ERROR.message,
        timestamp: new Date().toISOString(),
        validationErrors: errors,
        detail: detailMessage,
    }
}

/**
 * 设置响应头
 * @param {Object} ctx - Koa 上下文
 * @param {Object} headers - 响应头
 */
export const setResponseHeaders = (ctx, headers = {}) => {
    Object.entries(headers).forEach(([key, value]) => {
        ctx.set(key, value)
    })
}

/**
 * 发送成功响应
 * @param {Object} ctx - Koa 上下文
 * @param {*} data - 响应数据
 * @param {string} [message] - 成功消息
 * @param {number} [status] - HTTP 状态码
 */
export const sendSuccess = (ctx, data = null, message = 'Success', status = 200) => {
    ctx.status = status
    ctx.body = createSuccessResponse(data, message)
}

/**
 * 发送错误响应
 * @param {Object} ctx - Koa 上下文
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @param {number} [status] - HTTP 状态码
 */
export const sendError = (ctx, errorCode = ERROR_CODES.INTERNAL_ERROR, detail = null, status = 400) => {
    ctx.status = status
    const response = createErrorResponse(errorCode, detail)
    // 添加 traceId
    response.traceId = getTraceId(ctx)
    ctx.body = response
}

/**
 * 发送分页响应
 * @param {Object} ctx - Koa 上下文
 * @param {Array} items - 数据项列表
 * @param {Object} pagination - 分页信息
 * @param {string} [message] - 成功消息
 */
export const sendPagination = (ctx, items, pagination, message = 'Success') => {
    ctx.status = 200
    ctx.body = createPaginationResponse(items, pagination, message)
}

/**
 * 自定义错误类
 */
export class AppError extends Error {
    constructor(message, codeOrErrorObj, statusCode = 400) {
        super(message)
        this.name = 'AppError'

        // 兼容两种调用方式：
        // 1. AppError(message, ERROR_CODES.XXX) - 传入错误码对象
        // 2. AppError(message, code, statusCode) - 传入错误码数字
        if (typeof codeOrErrorObj === 'object' && codeOrErrorObj.code && codeOrErrorObj.message) {
            // 传入的是 ERROR_CODES 对象
            this.code = codeOrErrorObj.code
            this.errorCode = codeOrErrorObj
            // 根据错误码自动设置状态码
            if (codeOrErrorObj.code >= 2001 && codeOrErrorObj.code <= 2999) {
                this.statusCode = 404 // 职位相关错误
            } else if (codeOrErrorObj.code >= 3000 && codeOrErrorObj.code <= 3999) {
                this.statusCode = 400 // 申请相关错误
            } else if (codeOrErrorObj.code >= 5000 && codeOrErrorObj.code <= 5999) {
                this.statusCode = 403 // 权限相关错误
            } else if (codeOrErrorObj.code >= 6000 && codeOrErrorObj.code <= 6999) {
                this.statusCode = 503 // 外部服务错误
            } else {
                this.statusCode = statusCode
            }
        } else {
            // 传入的是错误码数字
            this.code = codeOrErrorObj
            this.statusCode = statusCode
        }
    }
}

/**
 * 异步处理器包装器
 */
export const asyncHandler = fn => async (ctx, next) => {
    try {
        await fn(ctx, next)
    } catch (error) {
        if (error instanceof AppError) {
            ctx.status = error.statusCode
            // 如果有 errorCode 对象，使用它；否则构造一个
            const errorCode = error.errorCode || { code: error.code, message: error.message }
            const response = createErrorResponse(errorCode, error.message, error.details)
            // 添加 traceId
            response.traceId = getTraceId(ctx)
            ctx.body = response
        } else {
            ctx.status = 500
            const response = createErrorResponse(ERROR_CODES.INTERNAL_ERROR, error.message)
            // 添加 traceId
            response.traceId = getTraceId(ctx)
            ctx.body = response
        }
    }
}

/**
 * 发送响应
 */
export const sendResponse = (ctx, status, body) => {
    ctx.status = status
    ctx.body = body
}

// 导出 getTraceId 函数
export { getTraceId }

/**
 * 格式化响应数据
 * @param {*} data - 响应数据
 * @param {string} [message] - 消息
 * @param {number} [code] - 状态码
 * @returns {Object} 格式化后的响应对象
 */
export const formatResponse = (data = null, message = 'Success', code = 0) => {
    return {
        code,
        message,
        data,
        timestamp: new Date().toISOString()
    }
}

export default {
    createSuccessResponse,
    createErrorResponse,
    createPaginationResponse,
    createListResponse,
    createItemResponse,
    createDeleteResponse,
    createBatchResponse,
    createValidationErrorResponse,
    setResponseHeaders,
    sendSuccess,
    sendError,
    sendPagination,
    AppError,
    asyncHandler,
    sendResponse,
    getTraceId,
    formatResponse,
}
