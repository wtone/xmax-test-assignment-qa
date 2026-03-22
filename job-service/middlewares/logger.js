import logger from '../utils/logger.js'

// 日志记录中间件
export default async (ctx, next) => {
    const start = Date.now()

    // 创建带 traceId 的 logger 对象
    ctx.logger = {
        info: (...args) => {
            const [message, data = {}] = args
            if (typeof message === 'string') {
                logger.info({
                    msg: message,
                    traceId: ctx.state.traceId,
                    ...data,
                })
            } else {
                logger.info({
                    traceId: ctx.state.traceId,
                    ...message,
                })
            }
        },
        warn: (...args) => {
            const [message, data = {}] = args
            if (typeof message === 'string') {
                logger.warn({
                    msg: message,
                    traceId: ctx.state.traceId,
                    ...data,
                })
            } else {
                logger.warn({
                    traceId: ctx.state.traceId,
                    ...message,
                })
            }
        },
        error: (...args) => {
            const [message, data = {}] = args
            if (typeof message === 'string') {
                logger.error({
                    msg: message,
                    traceId: ctx.state.traceId,
                    ...data,
                })
            } else {
                logger.error({
                    traceId: ctx.state.traceId,
                    ...message,
                })
            }
        },
        debug: (...args) => {
            const [message, data = {}] = args
            if (typeof message === 'string') {
                logger.debug({
                    msg: message,
                    traceId: ctx.state.traceId,
                    ...data,
                })
            } else {
                logger.debug({
                    traceId: ctx.state.traceId,
                    ...message,
                })
            }
        },
    }

    // 记录请求信息
    ctx.logger.info({
        msg: 'IN',
        method: ctx.method,
        url: ctx.url,
        headers: ctx.headers,
        query: ctx.query,
        body: ctx.request.body,
    })

    try {
        await next()
    } finally {
        const ms = Date.now() - start

        // 记录响应信息
        ctx.logger.info({
            msg: 'OUT',
            method: ctx.method,
            url: ctx.url,
            status: ctx.status,
            response_time: ms,
        })
    }
}
