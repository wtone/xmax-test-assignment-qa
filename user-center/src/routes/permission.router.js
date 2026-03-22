import Router from 'koa-router'
import permissionController from '../controllers/permission.js'
import gatewayAuth from '../middlewares/jwt_auth.js' // 新的网关认证中间件

// 权限管理路由 (需要管理员权限)
const permissionRoutes = new Router({ prefix: '/api/v1/permissions' })
permissionRoutes.use(gatewayAuth)
permissionRoutes.get('/', permissionController.listPermissions)
permissionRoutes.post('/', permissionController.createPermission)
permissionRoutes.get('/:permissionId', permissionController.getPermissionDetail)
permissionRoutes.put('/:permissionId', permissionController.updatePermission)
permissionRoutes.delete('/:permissionId', permissionController.deletePermission)

export default permissionRoutes
