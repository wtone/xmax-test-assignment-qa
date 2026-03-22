/**
 * B 端用户类型检查中间件
 * @module middlewares/require-b-user
 * @description 检查 ctx.state.user.type === 'B'，拒绝非 B 端用户
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'

export const requireBUserType = () => {
    return async (ctx, next) => {
        if (ctx.state.user?.type !== 'B') {
            return sendError(ctx, ERROR_CODES.FORBIDDEN, '仅 B 端用户可操作', 403)
        }
        await next()
    }
}
