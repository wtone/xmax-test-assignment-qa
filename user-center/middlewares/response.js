import * as response from '../utils/response.js'

/**
 * Simplify response parameters by removing ctx
 * @param ctx
 * @param next
 * @returns {Promise<*>}
 */
export default async (ctx, next) => {
    ctx.success = function (...args) {
        return response.success(ctx, ...args)
    }
    ctx.error = function (...args) {
        return response.error(ctx, ...args)
    }
    ctx.warn = function (...args) {
        return response.unCaughtError(ctx, ...args)
    }
    return await next()
}
