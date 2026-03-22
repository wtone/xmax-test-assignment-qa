/**
 * 中间件入口文件
 * @module middlewares/index
 * @description 导出所有中间件
 */

// 网关认证中间件
export { gatewayAuth, getCurrentUser, isAuthenticated, hasRole, hasPermission } from './gateway_auth.js'

// 权限检查中间件
export {
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
} from './permission.js'

// 请求验证中间件
export { validate, validators, schemas, createValidator, validateValue } from './validation.js'

// 错误处理中间件
export { errorHandler, createError, throwError, assert } from './error_handler.js'

// 默认导出常用中间件
export default {
    gatewayAuth,
    requireRole,
    requirePermission,
    validate,
    errorHandler,
}
