import { unCaughtError } from '../utils/response.js'

// 统一的错误处理
export default async (ctx, next) => {
    try {
        return await next()
    } catch (err) {
        return unCaughtError(ctx, err)
    }
}
