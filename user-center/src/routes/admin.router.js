import Router from 'koa-router'
import adminController from '../controllers/admin.js'
import gatewayAuth from '../middlewares/jwt_auth.js' // 新的网关认证中间件

// Admin管理路由 (需要管理员权限)
const adminRoutes = new Router({ prefix: '/api/v1/admin' })
adminRoutes.use(gatewayAuth)

// 管理员权限检查中间件
adminRoutes.use(async (ctx, next) => {
    const user = ctx.state.user
    if (!user) {
        ctx.throw(401, 'Authentication required')
    }

    // 检查用户是否有管理员角色 (JWT中间件已经填充了roles信息)
    if (!user.roles || !Array.isArray(user.roles)) {
        ctx.logger.warn('Admin access denied - user has no roles', {
            operation: 'admin_middleware_no_roles',
            userId: user.id,
        })
        ctx.throw(403, 'Admin access required')
    }

    const hasAdminRole = user.roles.some(role => role.name === 'admin' || role.name === 'super_admin')

    if (!hasAdminRole) {
        ctx.logger.warn('Admin access denied - insufficient permissions', {
            operation: 'admin_middleware_insufficient_permissions',
            userId: user.id,
            userRoles: user.roles.map(r => r.name),
        })
        ctx.throw(403, 'Admin access required')
    }

    ctx.logger.info('Admin access granted', {
        operation: 'admin_middleware_access_granted',
        userId: user.id,
        userRoles: user.roles.map(r => r.name),
    })

    await next()
})

// User management
adminRoutes.get('/users', adminController.listUsers)
adminRoutes.post('/users/:userId/roles', adminController.assignRolesToUser)
adminRoutes.post('/assign-default-roles', adminController.assignDefaultRoles)

export default adminRoutes
