/**
 * 路由日志记录中间件
 * @module middlewares/route-logger
 * @description 记录每个路由的请求和响应详情
 */

/**
 * 路由日志记录中间件
 * @returns {Function} Koa中间件函数
 */
export const routeLogger = () => {
    return async (ctx, next) => {
        const startTime = Date.now()
        const requestId = Math.random().toString(36).substring(7)

        // 记录请求信息
        ctx.logger.info('[RouteLogger] 请求开始', {
            requestId,
            method: ctx.method,
            path: ctx.path,
            url: ctx.url,
            headers: {
                'content-type': ctx.headers['content-type'],
                'x-user-id': ctx.headers['x-user-id'],
                'x-user-type': ctx.headers['x-user-type'],
                'x-user-permissions': ctx.headers['x-user-permissions'],
            },
            query: ctx.query,
            body: ctx.request.body,
            ip: ctx.ip,
            userAgent: ctx.headers['user-agent'],
        })

        try {
            await next()

            const duration = Date.now() - startTime

            // 记录响应信息
            ctx.logger.info('[RouteLogger] 请求完成', {
                requestId,
                method: ctx.method,
                path: ctx.path,
                status: ctx.status,
                duration: `${duration}ms`,
                responseHeaders: ctx.response.headers,
                user: ctx.state.user
                    ? {
                          id: ctx.state.user.id,
                          type: ctx.state.user.type,
                          role: ctx.state.user.role,
                      }
                    : null,
            })
        } catch (error) {
            const duration = Date.now() - startTime

            // 记录错误信息
            ctx.logger.error('[RouteLogger] 请求失败', {
                requestId,
                method: ctx.method,
                path: ctx.path,
                duration: `${duration}ms`,
                error: {
                    message: error.message,
                    stack: error.stack,
                    code: error.code,
                    detail: error.detail,
                },
                user: ctx.state.user
                    ? {
                          id: ctx.state.user.id,
                          type: ctx.state.user.type,
                          role: ctx.state.user.role,
                      }
                    : null,
            })

            throw error
        }
    }
}

export default routeLogger
