/**
 * 错误处理中间件
 * @module middlewares/error_handler
 */

import { ApiError } from '../utils/ApiError.js'
import { ERROR_CODES } from '../constants/error_codes.js'

/**
 * 错误处理中间件
 * @param {Object} ctx - Koa上下文
 * @param {Function} next - 下一个中间件
 */
export default async function errorHandler(ctx, next) {
    try {
        await next()
    } catch (error) {
        // 处理AppError（来自utils/response.js）
        if (error.name === 'AppError' && error.errorCode) {
            ctx.status = error.statusCode || 400
            ctx.body = {
                code: error.errorCode.code,
                message: error.message || error.errorCode.message,
                timestamp: new Date().toISOString(),
                traceId: ctx.state.traceId,
            }

            ctx.logger?.error('App Error:', {
                code: error.errorCode.code,
                message: error.message,
                path: ctx.path,
                method: ctx.method,
                traceId: ctx.state.traceId,
            })
            return
        }

        // 处理ApiError
        if (error instanceof ApiError) {
            ctx.status = error.statusCode
            ctx.body = error.toResponse()

            ctx.logger?.error('API Error:', {
                code: error.code,
                message: error.message,
                detail: error.detail,
                path: ctx.path,
                method: ctx.method,
                traceId: ctx.state.traceId,
            })
            return
        }

        // 处理普通对象错误（向后兼容）
        if (error && typeof error === 'object' && error.code && error.message && !(error instanceof Error)) {
            // 创建一个ApiError实例
            const apiError = new ApiError(error)
            ctx.status = apiError.statusCode
            ctx.body = apiError.toResponse()

            ctx.logger?.error('Legacy Error (converted to ApiError):', {
                code: error.code,
                message: error.message,
                path: ctx.path,
                method: ctx.method,
                traceId: ctx.state.traceId,
            })
            return
        }

        // 处理验证错误
        if (error.name === 'ValidationError') {
            ctx.status = 400
            ctx.body = {
                success: false,
                error: {
                    code: ERROR_CODES.VALIDATION_ERROR.code,
                    message: ERROR_CODES.VALIDATION_ERROR.message,
                    detail: error.message,
                },
            }

            ctx.logger?.error('Validation Error:', {
                message: error.message,
                path: ctx.path,
                method: ctx.method,
                traceId: ctx.state.traceId,
            })
            return
        }

        // 处理其他已知错误
        if (error.name === 'MongoError' || error.name === 'MongoServerError') {
            // MongoDB错误
            if (error.code === 11000) {
                // 重复键错误
                ctx.status = 409
                ctx.body = {
                    success: false,
                    error: {
                        code: ERROR_CODES.DUPLICATE_ERROR.code,
                        message: ERROR_CODES.DUPLICATE_ERROR.message,
                        detail: 'Duplicate data',
                    },
                }
            } else {
                ctx.status = 500
                ctx.body = {
                    success: false,
                    error: {
                        code: ERROR_CODES.INTERNAL_ERROR.code,
                        message: ERROR_CODES.INTERNAL_ERROR.message,
                    },
                }
            }

            ctx.logger?.error('Database Error:', {
                message: error.message,
                code: error.code,
                path: ctx.path,
                method: ctx.method,
                traceId: ctx.state.traceId,
            })
            return
        }

        // 默认处理未知错误
        ctx.status = error.status || 500
        ctx.body = {
            success: false,
            error: {
                code: ERROR_CODES.INTERNAL_ERROR.code,
                message:
                    process.env.NODE_ENV === 'production' ? ERROR_CODES.INTERNAL_ERROR.message : error.message || ERROR_CODES.INTERNAL_ERROR.message,
            },
        }

        ctx.logger?.error('Unexpected Error:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            path: ctx.path,
            method: ctx.method,
            traceId: ctx.state.traceId,
        })
    }
}
