import log from '../utils/logger.js'
import 'dotenv/config'

const safeStringify = data => {
    try {
        return parseLoggerMessage(JSON.stringify(data))
    } catch (error) {
        return data
    }
}

export default async (ctx, next) => {
    const logger = log(import.meta.url)
    ctx.logger = {
        info: (...data) => {
            logger.info({ traceId: ctx.state.traceId, data: safeStringify(data) })
        },
        warn: (...data) => {
            logger.warn({ traceId: ctx.state.traceId, data: safeStringify(data) })
        },
        error: (...data) => {
            logger.error({ traceId: ctx.state.traceId, data: safeStringify(data) })
        },
    }
    ctx.logger.info({
        traceId: ctx.state.traceId,
        type: 'IN',
        method: ctx.request.method,
        url: ctx.request.url,
        header: ctx.request.header,
        query: ctx.request.query,
        body: ctx.request.body,
    })
    await next()
    ctx.logger.info({
        traceId: ctx.state.traceId,
        type: 'OUT',
        status: ctx.response.status,
        message: parseLoggerMessage(ctx.response.message),
        body: ctx.body,
    })
}

export const parseLoggerMessage = message => {
    return message?.slice(0, 5000) + (message?.length > 5000 ? ' ...  length: ' + message?.length : '')
}
