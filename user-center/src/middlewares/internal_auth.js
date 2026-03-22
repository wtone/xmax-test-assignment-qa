/**
 * 内部服务认证中间件
 * 用于网关调用的内部API，不需要JWT验证
 * 直接通过，适用于 /api/v1/check/* 等内部接口
 */
const internalAuth = async (ctx, next) => {
    // 记录内部服务调用
    ctx.logger.info('内部服务调用', {
        path: ctx.request.path,
        method: ctx.request.method,
        userAgent: ctx.headers['user-agent'],
        traceId: ctx.headers['x-trace-id'] || 'unknown',
    })

    // 直接通过，不进行认证检查
    await next()
}

export default internalAuth
