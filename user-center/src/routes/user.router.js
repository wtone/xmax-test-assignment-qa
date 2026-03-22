import Router from 'koa-router'
import userController from '../controllers/user.js'
import tutorialController from '../controllers/tutorial.js'
import gatewayAuth from '../middlewares/jwt_auth.js' // 新的网关认证中间件

// 用户相关路由 (支持网关认证和JWT认证)
const userRoutes = new Router({ prefix: '/api/v1/users' })
userRoutes.use(gatewayAuth) // 应用网关认证中间件
userRoutes.get('/profile', userController.getProfile)
userRoutes.put('/profile', userController.updateProfile)
userRoutes.get('/permissions', userController.getUserPermissions)
userRoutes.get('/roles', userController.getUserRoles)

// 新手引导相关路由
userRoutes.post('/tutorial/actions/:actionType', tutorialController.recordAction)
userRoutes.get('/tutorial/status/:actionType', tutorialController.getStatus)

export default userRoutes
