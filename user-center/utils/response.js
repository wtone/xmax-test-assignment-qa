/**
 * 成功响应
 * @param {Object} ctx - Koa上下文
 * @param {*} data - 响应数据
 * @returns {Object}
 */
const success = (ctx, data) => {
    ctx.body = {
        code: 0,
        message: 'success',
        data: data || {},
        timestamp: new Date().toISOString(),
        traceId: ctx.state.traceId,
    }
    return ctx.body
}

/**
 * 错误响应
 * @param {Object} ctx - Koa上下文
 * @param {Object} err - 错误对象
 * @returns {Object}
 */
const error = (ctx, err) => {
    const code = err.code || 500000
    const message = err.message || 'Internal Server Error'

    // 记录错误日志
    if (ctx.logger) {
        ctx.logger.error({
            code,
            message,
            stack: err.stack,
            traceId: ctx.state.traceId,
        })
    }

    ctx.status = Math.floor(code / 1000) || 500
    ctx.body = {
        code,
        message: `${message} [trace-id] ${ctx.state.traceId}`,
        timestamp: new Date().toISOString(),
        traceId: ctx.state.traceId,
    }
    return ctx.body
}

/**
 * 未捕获错误处理
 * @param {Object} ctx - Koa上下文
 * @param {*} err - 错误
 * @returns {Object}
 */
const unCaughtError = (ctx, err) => {
    const errorObj = {
        code: err.code || 500001,
        message: err.message || 'Uncaught Error',
        stack: err.stack,
    }

    if (ctx.logger) {
        ctx.logger.error({
            type: 'UNCAUGHT_ERROR',
            error: errorObj,
            traceId: ctx.state.traceId,
        })
    }

    return error(ctx, errorObj)
}

export { success, error, unCaughtError }
