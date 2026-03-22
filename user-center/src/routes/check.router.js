import Router from 'koa-router'
import permissionController from '../controllers/permission.js'
import roleController from '../controllers/role.js'
import internalAuth from '../middlewares/internal_auth.js'

// 权限验证API (供网关使用) - 使用内部认证中间件
const checkRoutes = new Router({ prefix: '/api/v1/check' })

// 应用内部认证中间件
checkRoutes.use(internalAuth)

checkRoutes.post('/permission', permissionController.checkPermission)
checkRoutes.post('/role', roleController.checkRole)

export default checkRoutes
