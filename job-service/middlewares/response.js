// 响应格式化中间件
import { getTraceId } from '../utils/response.js'

export default async (ctx, next) => {
    // 添加成功响应方法
    ctx.success = (data = null, message = 'Success', code = 0) => {
        ctx.body = {
            code,
            message,
            data,
            timestamp: new Date().toISOString(),
            traceId: getTraceId(ctx),
        }
    }

    // 添加错误响应方法
    ctx.error = (message = 'Error', code = 50000, status = 500) => {
        ctx.status = status
        ctx.body = {
            code,
            message,
            data: null,
            timestamp: new Date().toISOString(),
            traceId: getTraceId(ctx),
        }
    }

    await next()

    // 跳过 swagger 相关路径
    if (ctx.path.startsWith('/swagger')) {
        return
    }

    // 跳过非 JSON 响应（如 HTML、文件等）
    const contentType = ctx.get('Content-Type')
    if (contentType && !contentType.includes('application/json')) {
        return
    }

    // 只处理成功的响应（2xx）
    if (ctx.status >= 200 && ctx.status < 300 && ctx.body) {
        // 如果已经是标准格式（包含 code 字段），直接返回
        if (ctx.body && typeof ctx.body === 'object' && 'code' in ctx.body) {
            return
        }

        // 处理旧格式的成功响应
        if (ctx.body && typeof ctx.body === 'object' && ctx.body.success === true) {
            // 转换为新格式
            const formattedResponse = {
                code: 0,
                message: ctx.body.message || 'success',
                data: ctx.body.data,
                timestamp: new Date().toISOString(),
                traceId: getTraceId(ctx),
            }

            // 如果有分页信息，保留它
            if (ctx.body.meta) {
                formattedResponse.meta = ctx.body.meta
            }

            ctx.body = formattedResponse
        }
    }
}
