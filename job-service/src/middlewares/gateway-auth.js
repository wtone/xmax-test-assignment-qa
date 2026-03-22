/**
 * 网关认证中间件
 * @module middlewares/gateway_auth
 * @description 处理从API网关转发的请求认证，从请求头获取用户信息
 */

import { ERROR_CODES } from '../constants/error_codes.js'
import { sendError } from '../../utils/response.js'
/**
 * 公开路由列表
 * 这些路由不需要认证即可访问
 */
const PUBLIC_ROUTES = [
    '/api/v1/metadata',
    '/api/v1/health',
    '/api/v1/job/public', // 公开职位列表
    '/api/v1/job/public/:id', // 公开职位详情
    '/api/v1/job-c/official/hiring', // 官网招聘职位列表（免登录）
]

/**
 * 检查路径是否为公开路由
 * @param {string} path - 请求路径
 * @returns {boolean} 是否为公开路由
 */
const isPublicRoute = path => {
    return PUBLIC_ROUTES.some(route => {
        // 处理带参数的路由
        const routeRegex = new RegExp('^' + route.replace(/:[^/]+/g, '[^/]+') + '$')
        return routeRegex.test(path)
    })
}

/**
 * 网关认证中间件
 * @param {Object} [options] - 中间件配置选项
 * @param {boolean} [options.allowAnonymous=false] - 是否允许匿名访问
 * @param {Array<string>} [options.publicRoutes=[]] - 额外的公开路由
 * @returns {Function} Koa中间件函数
 */
export const gatewayAuth = (options = {}) => {
    const { allowAnonymous = false, publicRoutes = [] } = options

    // 合并公开路由
    if (publicRoutes.length > 0) {
        PUBLIC_ROUTES.push(...publicRoutes)
    }

    return async (ctx, next) => {
        try {
            ctx.logger.info('[gatewayAuth] 开始认证检查', {
                path: ctx.path,
                method: ctx.method,
                headers: {
                    'x-user-id': ctx.headers['x-user-id'],
                    'x-user-type': ctx.headers['x-user-type'],
                    'x-user-permissions': ctx.headers['x-user-permissions'],
                },
            })

            // 检查是否为公开路由
            if (isPublicRoute(ctx.path)) {
                ctx.logger.info('[gatewayAuth] 公开路由，跳过认证', {
                    path: ctx.path,
                })
                return await next()
            }

            // 获取网关传递的用户信息
            const userId = ctx.headers['x-user-id']
            const username = ctx.headers['x-user-username']
            const userEmail = ctx.headers['x-user-email']
            const userType = ctx.headers['x-user-type']
            const userRoles = ctx.headers['x-user-roles']
            const userPermissions = ctx.headers['x-user-permissions']
            const companyId = ctx.headers['x-company-id'] || ctx.headers['x-user-company-id']

            // 验证用户ID
            if (!userId) {
                // 如果允许匿名访问，继续处理
                if (allowAnonymous) {
                    ctx.logger.info('[gatewayAuth] 允许匿名访问', {
                        path: ctx.path,
                    })
                    ctx.state.user = null
                    return await next()
                }

                ctx.logger.warn('[gatewayAuth] 缺少认证信息', {
                    path: ctx.path,
                    headers: ctx.headers,
                })
                return sendError(ctx, ERROR_CODES.UNAUTHORIZED, 'Missing authentication information', 401)
            }

            // 设置用户信息到上下文
            // 将 userType 映射到对应的角色
            const USER_TYPE_ROLE_MAP = {
                B: 'enterprise',
                C: 'candidate',
                admin: 'admin',
            }
            const role = USER_TYPE_ROLE_MAP[userType] || 'candidate'

            // 解析权限 - 支持JSON数组格式和逗号分隔格式
            let parsedPermissions = []
            if (userPermissions) {
                try {
                    // 尝试解析为JSON数组
                    parsedPermissions = JSON.parse(userPermissions)
                } catch (e) {
                    // 如果不是JSON，则按逗号分隔
                    parsedPermissions = userPermissions.split(',')
                }
            }

            // 对于B端用户，记录companyId状态（不再强制要求）
            if (userType === 'B' && !companyId) {
                ctx.logger.info('[gatewayAuth] B端用户暂无companyId，将通过Company Service获取', {
                    userId: userId,
                    username: username,
                    email: userEmail,
                    path: ctx.path,
                })
            }

            ctx.state.user = {
                id: userId,
                userId: userId, // 确保有userId字段
                companyId: companyId || null, // 添加公司ID
                username: username || '',
                email: userEmail || '',
                role: role,
                type: userType || 'C',
                roles: userRoles ? userRoles.split(',') : [],
                permissions: parsedPermissions,
            }

            ctx.logger.info('[gatewayAuth] 用户信息设置成功', {
                userId: ctx.state.user.id,
                userType: ctx.state.user.type,
                role: ctx.state.user.role,
                companyId: ctx.state.user.companyId,
                permissions: ctx.state.user.permissions,
                permissionsCount: ctx.state.user.permissions.length,
                rawPermissions: userPermissions,
            })

            // 记录认证信息
            ctx.state.auth = {
                authenticated: true,
                method: 'gateway',
                timestamp: new Date().toISOString(),
            }

            ctx.logger.info('[gatewayAuth] 认证通过，继续处理请求', {
                authenticated: true,
                userId: ctx.state.user.id,
            })

        } catch (error) {
            ctx.logger.error('[gatewayAuth] 认证中间件错误', {
                error: error.message,
                stack: error.stack,
                path: ctx.path,
            })
            return sendError(ctx, ERROR_CODES.INTERNAL_ERROR, 'Authentication processing failed', 500)
        }

        // await next() 在 try-catch 外面，让下游中间件/控制器错误正常冒泡
        await next()
    }
}

/**
 * 获取当前用户信息
 * @param {Object} ctx - Koa上下文
 * @returns {Object|null} 用户信息
 */
export const getCurrentUser = ctx => {
    return ctx.state.user || null
}

/**
 * 检查用户是否已认证
 * @param {Object} ctx - Koa上下文
 * @returns {boolean} 是否已认证
 */
export const isAuthenticated = ctx => {
    return ctx.state.auth?.authenticated === true
}

/**
 * 检查用户角色
 * @param {Object} ctx - Koa上下文
 * @param {string} role - 要检查的角色
 * @returns {boolean} 是否具有该角色
 */
export const hasRole = (ctx, role) => {
    const user = getCurrentUser(ctx)
    return user?.role === role
}

/**
 * 检查用户权限
 * @param {Object} ctx - Koa上下文
 * @param {string} permission - 要检查的权限
 * @returns {boolean} 是否具有该权限
 */
export const hasPermission = (ctx, permission) => {
    const user = getCurrentUser(ctx)
    return user?.permissions?.includes(permission) || false
}

export default gatewayAuth
