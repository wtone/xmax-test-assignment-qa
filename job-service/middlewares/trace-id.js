import { randomUUID } from 'crypto'

// 请求追踪中间件
export default async (ctx, next) => {
    // 从请求头获取或生成新的 trace ID
    ctx.state.traceId = ctx.headers['x-trace-id'] || randomUUID()

    // 设置响应头
    ctx.set('X-Trace-Id', ctx.state.traceId)

    await next()
}
