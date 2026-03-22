import Router from 'koa-router'
import roleController from '../controllers/role.js'
import gatewayAuth from '../middlewares/jwt_auth.js' // 新的网关认证中间件

// 角色管理路由 (需要管理员权限)
const roleRoutes = new Router({ prefix: '/api/v1/roles' })
roleRoutes.use(gatewayAuth)
roleRoutes.get('/', roleController.listRoles)
roleRoutes.post('/', roleController.createRole)
roleRoutes.get('/:roleId', roleController.getRoleDetail)
roleRoutes.put('/:roleId', roleController.updateRole)
roleRoutes.delete('/:roleId', roleController.deleteRole)
roleRoutes.post('/:roleId/permissions', roleController.assignPermissions)

export default roleRoutes
