import clients from '../src/clients/index.js'

// Client middleware for external service connections
// 为将来可能的外部服务连接预留
export default async (ctx, next) => {
    ctx.clients = clients(ctx.state.traceId)
    await next()
}
