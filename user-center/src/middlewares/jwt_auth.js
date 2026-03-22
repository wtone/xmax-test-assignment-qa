import JWTService from '../libs/jwt.js'
import User from '../models/User.js'
import errors, { errorProcess } from '../errors.js'
import { USER_STATUS } from '../libs/constants.js'

const jwtService = new JWTService()

/**
 * 网关用户信息验证中间件
 * 验证来自网关的X-User-*头部信息，避免重复JWT验证
 */
const gatewayAuth = async (ctx, next) => {
    try {
        // 检查是否来自网关的用户信息
        const userId = ctx.headers['x-user-id']
        const username = ctx.headers['x-user-username']
        const userType = ctx.headers['x-user-type']
        const userRoles = ctx.headers['x-user-roles']

        if (userId) {
            // 来自网关，检查并补充用户信息
            let userInfo = {
                id: userId,
                username: username || '',
                email: ctx.headers['x-user-email'] || '',
                type: userType || 'C',
                roles: userRoles ? JSON.parse(userRoles) : [],
            }

            // 如果关键信息缺失，从数据库查询最新数据
            if (!username || !userType || !userRoles) {
                try {
                    const user = await User.findById(userId).populate('roles')
                    if (user) {
                        userInfo = {
                            id: userId,
                            username: user.username,
                            email: user.email,
                            type: user.userType || 'C',
                            roles: user.roles || [],
                        }

                        ctx.logger.info('从数据库补充用户信息', {
                            userId,
                            username: user.username,
                            userType: user.userType,
                            traceId: ctx.headers['x-trace-id'],
                        })
                    } else {
                        ctx.logger.warn('用户不存在', { userId })
                        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
                    }
                } catch (error) {
                    ctx.logger.error('查询用户信息失败', { userId, error: error.message })
                    return ctx.error(errorProcess(errors.AUTH_FAILED, [error.message]))
                }
            }

            ctx.state.user = userInfo

            ctx.logger.info('使用网关用户信息认证', {
                userId: userInfo.id,
                username: userInfo.username,
                userType: userInfo.type,
                source: !username || !userType || !userRoles ? 'database' : 'headers',
                traceId: ctx.headers['x-trace-id'],
            })

            return await next()
        }

        // 没有网关用户信息，使用原JWT验证（兼容直接访问）
        const authHeader = ctx.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return ctx.error(errorProcess(errors.MISSING_AUTH_BEARER_HEADER))
        }

        const token = authHeader.substring(7) // 移除 'Bearer ' 前缀

        // 使用异步验证token
        const payload = await jwtService.verifyAccessToken(token)
        if (!payload) {
            return ctx.error(errorProcess(errors.INVALID_ACCESS_TOKEN))
        }

        // 查找用户
        const user = await User.findById(payload.userId).populate('roles')
        if (!user) {
            return ctx.error(errorProcess(errors.USER_NOT_FOUND, [payload.userId]))
        }

        // 检查用户状态
        if (user.status !== USER_STATUS.ACTIVE) {
            return ctx.error(errorProcess(errors.USER_INACTIVE))
        }

        // 将用户信息添加到context state
        ctx.state.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            status: user.status,
            roles: user.roles,
        }

        await next()
    } catch (error) {
        ctx.logger.error('认证失败:', error)
        return ctx.error(errorProcess(errors.AUTH_FAILED, [error.message]))
    }
}

/**
 * 原JWT认证中间件（保留用于特殊需要）
 */
const jwtAuth = async (ctx, next) => {
    try {
        // 从header中获取token
        const authHeader = ctx.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return ctx.error(errorProcess(errors.MISSING_AUTH_BEARER_HEADER))
        }

        const token = authHeader.substring(7) // 移除 'Bearer ' 前缀

        // 使用异步验证token
        const payload = await jwtService.verifyAccessToken(token)
        if (!payload) {
            return ctx.error(errorProcess(errors.INVALID_ACCESS_TOKEN))
        }

        // 查找用户
        const user = await User.findById(payload.userId).populate('roles')
        if (!user) {
            return ctx.error(errorProcess(errors.USER_NOT_FOUND, [payload.userId]))
        }

        // 检查用户状态
        if (user.status !== USER_STATUS.ACTIVE) {
            return ctx.error(errorProcess(errors.USER_INACTIVE))
        }

        // 将用户信息添加到context state
        ctx.state.user = {
            id: user._id.toString(),
            username: user.username,
            email: user.email,
            status: user.status,
            roles: user.roles,
        }

        await next()
    } catch (error) {
        ctx.logger.error('JWT认证失败:', error)
        return ctx.error(errorProcess(errors.AUTH_FAILED, [error.message]))
    }
}

export default gatewayAuth
export { jwtAuth }
