import { v4 as uuidv4 } from 'uuid'

// Generate a trace ID for the request context
function genId(ctx) {
    // Use optional chaining to simplify the condition
    if (ctx.request.header['trace-id']) {
        ctx.state.traceId = ctx.request.header['trace-id']
        return
    }
    ctx.state.traceId = uuidv4()
}

// Middleware to add trace ID to the context
export default async (ctx, next) => {
    genId(ctx)
    await next()
}
