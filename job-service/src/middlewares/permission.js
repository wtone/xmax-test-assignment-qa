/**
 * 权限检查中间件
 * @module middlewares/permission
 * @description 检查用户角色和权限，支持B端（企业用户）和C端（候选人）权限分离
 */

import { ERROR_CODES } from '../constants/error_codes.js'
import { sendError } from '../../utils/response.js'
import { getCurrentUser, isAuthenticated } from './gateway-auth.js'
/**
 * 角色枚举
 */
export const ROLES = {
    ADMIN: 'admin',
    ENTERPRISE: 'enterprise',
    CANDIDATE: 'candidate',
}

/**
 * 平台枚举
 */
export const PLATFORMS = {
    B_SIDE: 'b_side', // B端（企业端）
    C_SIDE: 'c_side', // C端（候选人端）
}

/**
 * 权限枚举
 */
export const PERMISSIONS = {
    // 职位相关权限
    JOB_CREATE: 'job:create',
    JOB_UPDATE: 'job:update',
    JOB_DELETE: 'job:delete',
    JOB_VIEW: 'job:view',
    JOB_PUBLISH: 'job:publish',
    JOB_CLOSE: 'job:close',

    // 申请相关权限
    APPLICATION_VIEW_OWN: 'application:view:own',
    APPLICATION_VIEW_ALL: 'application:view:all',
    APPLICATION_CREATE: 'application:create',
    APPLICATION_UPDATE: 'application:update',
    APPLICATION_DELETE: 'application:delete',
    APPLICATION_PROCESS: 'application:process',

    // 面试预约相关权限
    APPOINTMENT_VIEW: 'appointment:view',
    APPOINTMENT_CREATE: 'appointment:create',
    APPOINTMENT_UPDATE: 'appointment:update',
    APPOINTMENT_CANCEL: 'appointment:cancel',
    APPOINTMENT_MANAGE: 'appointment:manage', // 完成、标记缺席等管理操作

    // 公司相关权限
    COMPANY_VIEW: 'company:view',
    COMPANY_UPDATE: 'company:update',
    COMPANY_VERIFY: 'company:verify',

    // 统计相关权限
    STATS_VIEW: 'stats:view',
    STATS_EXPORT: 'stats:export',
}

/**
 * 角色权限映射
 * 注意：新增功能时，请在此处添加对应角色的权限，现有用户将自动获得新权限
 */
const ROLE_PERMISSIONS = {
    [ROLES.ADMIN]: Object.values(PERMISSIONS), // 管理员拥有所有权限
    [ROLES.ENTERPRISE]: [
        // 职位管理
        PERMISSIONS.JOB_CREATE,
        PERMISSIONS.JOB_UPDATE,
        PERMISSIONS.JOB_DELETE,
        PERMISSIONS.JOB_VIEW,
        PERMISSIONS.JOB_PUBLISH,
        PERMISSIONS.JOB_CLOSE,
        // 申请管理
        PERMISSIONS.APPLICATION_VIEW_ALL,
        PERMISSIONS.APPLICATION_PROCESS,
        // 面试预约管理
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_CREATE,
        PERMISSIONS.APPOINTMENT_UPDATE,
        PERMISSIONS.APPOINTMENT_CANCEL,
        PERMISSIONS.APPOINTMENT_MANAGE,
        // 公司信息
        PERMISSIONS.COMPANY_VIEW,
        PERMISSIONS.COMPANY_UPDATE,
        // 统计
        PERMISSIONS.STATS_VIEW,
        PERMISSIONS.STATS_EXPORT,
    ],
    [ROLES.CANDIDATE]: [
        // 职位浏览
        PERMISSIONS.JOB_VIEW,
        // 申请管理
        PERMISSIONS.APPLICATION_VIEW_OWN,
        PERMISSIONS.APPLICATION_CREATE,
        PERMISSIONS.APPLICATION_UPDATE,
        PERMISSIONS.APPLICATION_DELETE,
        // 面试预约（候选人端）
        PERMISSIONS.APPOINTMENT_VIEW,
        PERMISSIONS.APPOINTMENT_UPDATE, // 选择时间、请求改期
        PERMISSIONS.APPOINTMENT_CANCEL,
        // 公司信息
        PERMISSIONS.COMPANY_VIEW,
    ],
}

/**
 * 检查用户是否具有指定角色
 * @param {Object} ctx - Koa上下文
 * @param {string|Array<string>} roles - 角色或角色数组
 * @returns {boolean} 是否具有角色
 */
const checkRole = (ctx, roles) => {
    const user = getCurrentUser(ctx)
    if (!user) return false

    const roleArray = Array.isArray(roles) ? roles : [roles]
    return roleArray.includes(user.role)
}

/**
 * 检查用户是否具有指定权限
 * @param {Object} ctx - Koa上下文
 * @param {string|Array<string>} permissions - 权限或权限数组
 * @returns {boolean} 是否具有权限
 */
const checkPermission = (ctx, permissions) => {
    const user = getCurrentUser(ctx)
    if (!user) {
        ctx.logger.warn('[checkPermission] 无法获取用户信息')
        return false
    }

    // 获取用户的权限列表
    const userPermissions = user.permissions || ROLE_PERMISSIONS[user.role] || []
    ctx.logger.debug('[checkPermission] 用户权限检查', {
        userId: user.userId || user.id,
        role: user.role,
        userPermissions,
        requiredPermissions: permissions,
    })

    const permissionArray = Array.isArray(permissions) ? permissions : [permissions]
    const hasPermission = permissionArray.some(permission => userPermissions.includes(permission))

    ctx.logger.info('[checkPermission] 权限检查结果', {
        hasPermission,
        required: permissionArray,
        actual: userPermissions,
    })

    return hasPermission
}

/**
 * 检查用户平台
 * @param {Object} ctx - Koa上下文
 * @param {string} platform - 平台类型
 * @returns {boolean} 是否属于该平台
 */
const checkPlatform = (ctx, platform) => {
    const user = getCurrentUser(ctx)
    if (!user) return false

    return user.platform === platform
}

/**
 * 要求角色中间件
 * @param {string|Array<string>} roles - 必需的角色
 * @returns {Function} Koa中间件函数
 */
export const requireRole = roles => {
    return async (ctx, next) => {
        // 检查是否已认证
        if (!isAuthenticated(ctx)) {
            return sendError(ctx, ERROR_CODES.UNAUTHORIZED, 'Please login first', 401)
        }

        // 检查角色
        if (!checkRole(ctx, roles)) {
            return sendError(ctx, ERROR_CODES.ROLE_NOT_ALLOWED, `Required role(s): ${Array.isArray(roles) ? roles.join(', ') : roles}`, 403)
        }

        await next()
    }
}

/**
 * 要求权限中间件
 * @param {string|Array<string>} permissions - 必需的权限
 * @param {Object} [options] - 选项
 * @param {boolean} [options.requireAll=false] - 是否需要所有权限
 * @returns {Function} Koa中间件函数
 */
export const requirePermission = (permissions, options = {}) => {
    const { requireAll = false } = options

    return async (ctx, next) => {
        ctx.logger.info('[requirePermission] 开始权限检查', {
            path: ctx.path,
            method: ctx.method,
            requiredPermissions: permissions,
            requireAll,
        })

        // 检查是否已认证
        if (!isAuthenticated(ctx)) {
            ctx.logger.warn('[requirePermission] 用户未认证', {
                path: ctx.path,
                headers: ctx.headers,
            })
            return sendError(ctx, ERROR_CODES.UNAUTHORIZED, 'Please login first', 401)
        }

        const user = getCurrentUser(ctx)
        ctx.logger.info('[requirePermission] 当前用户信息', {
            userId: user.userId || user.id,
            userType: user.type,
            role: user.role,
            permissions: user.permissions,
            hasPermissions: !!user.permissions,
        })

        // 获取用户权限：始终合并用户权限和角色默认权限
        // 这样新功能上线时，用户自动获得角色对应的新权限，无需手动更新
        const userTokenPermissions = user.permissions || []
        const rolePermissions = ROLE_PERMISSIONS[user.role] || []

        // 合并用户权限和角色默认权限（去重）
        const userPermissions = [...new Set([...userTokenPermissions, ...rolePermissions])]

        if (rolePermissions.length > 0 && userTokenPermissions.length > 0) {
            ctx.logger.debug('[requirePermission] 用户权限已与角色默认权限合并', {
                tokenPermissions: userTokenPermissions,
                rolePermissions: rolePermissions,
                mergedPermissions: userPermissions,
            })
        }
        const permissionArray = Array.isArray(permissions) ? permissions : [permissions]

        ctx.logger.info('[requirePermission] 权限对比', {
            userPermissions,
            requiredPermissions: permissionArray,
            rolePermissions: ROLE_PERMISSIONS[user.role],
        })

        let hasPermission
        if (requireAll) {
            // 需要所有权限
            hasPermission = permissionArray.every(permission => userPermissions.includes(permission))
        } else {
            // 只需要其中一个权限
            hasPermission = permissionArray.some(permission => userPermissions.includes(permission))
        }

        if (!hasPermission) {
            ctx.logger.warn('[requirePermission] 权限不足', {
                userId: user.userId || user.id,
                required: permissionArray,
                actual: userPermissions,
                requireAll,
            })
            return sendError(
                ctx,
                ERROR_CODES.NO_PERMISSION,
                `Required permissions${requireAll ? ' (all)' : ' (any)'}: ${permissionArray.join(', ')}`,
                403,
            )
        }

        ctx.logger.info('[requirePermission] 权限检查通过', {
            userId: user.userId || user.id,
            permissions: permissionArray,
        })
        await next()
    }
}

/**
 * 要求平台中间件
 * @param {string} platform - 必需的平台
 * @returns {Function} Koa中间件函数
 */
export const requirePlatform = platform => {
    return async (ctx, next) => {
        // 检查是否已认证
        if (!isAuthenticated(ctx)) {
            return sendError(ctx, ERROR_CODES.UNAUTHORIZED, 'Please login first', 401)
        }

        // 检查平台
        if (!checkPlatform(ctx, platform)) {
            const platformName = platform === PLATFORMS.B_SIDE ? 'enterprise' : 'candidate'
            return sendError(ctx, ERROR_CODES.FORBIDDEN, `This feature is only available for ${platformName} users`, 403)
        }

        await next()
    }
}

/**
 * 企业用户权限检查装饰器
 * @returns {Function} Koa中间件函数
 */
export const requireEnterprise = () => {
    return requireRole(ROLES.ENTERPRISE)
}

/**
 * 候选人权限检查装饰器
 * @returns {Function} Koa中间件函数
 */
export const requireCandidate = () => {
    return requireRole(ROLES.CANDIDATE)
}

/**
 * 管理员权限检查装饰器
 * @returns {Function} Koa中间件函数
 */
export const requireAdmin = () => {
    return requireRole(ROLES.ADMIN)
}

/**
 * B端权限检查装饰器
 * @returns {Function} Koa中间件函数
 */
export const requireBSide = () => {
    return requirePlatform(PLATFORMS.B_SIDE)
}

/**
 * C端权限检查装饰器
 * @returns {Function} Koa中间件函数
 */
export const requireCSide = () => {
    return requirePlatform(PLATFORMS.C_SIDE)
}

/**
 * 检查资源所有权中间件
 * @param {Function} getResourceOwnerId - 获取资源所有者ID的函数
 * @returns {Function} Koa中间件函数
 */
export const requireOwnership = getResourceOwnerId => {
    return async (ctx, next) => {
        // 检查是否已认证
        if (!isAuthenticated(ctx)) {
            return sendError(ctx, ERROR_CODES.UNAUTHORIZED, 'Please login first', 401)
        }

        const user = getCurrentUser(ctx)

        try {
            // 获取资源所有者ID
            const ownerId = await getResourceOwnerId(ctx)

            // 管理员可以访问所有资源
            if (user.role === ROLES.ADMIN) {
                return await next()
            }

            // 检查所有权
            if (ownerId !== user.id) {
                // 企业用户检查公司ID
                if (user.role === ROLES.ENTERPRISE && user.companyId && ownerId === user.companyId) {
                    return await next()
                }

                return sendError(ctx, ERROR_CODES.RESOURCE_ACCESS_DENIED, 'You do not have permission to access this resource', 403)
            }

            await next()
        } catch (error) {
            ctx.logger.error('Failed to check resource ownership', { error: error.message })
            return sendError(ctx, ERROR_CODES.INTERNAL_ERROR, 'Permission check failed', 500)
        }
    }
}

export default {
    ROLES,
    PLATFORMS,
    PERMISSIONS,
    requireRole,
    requirePermission,
    requirePlatform,
    requireEnterprise,
    requireCandidate,
    requireAdmin,
    requireBSide,
    requireCSide,
    requireOwnership,
}
