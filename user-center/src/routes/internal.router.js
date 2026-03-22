import Router from 'koa-router'
import internalController from '../controllers/internal.js'
import internalAuth from '../middlewares/internal_auth.js'

// 内部服务API - 不通过 Gateway 暴露，仅集群内部调用
const internalRoutes = new Router({ prefix: '/api/v1/internal' })

// 应用内部认证中间件
internalRoutes.use(internalAuth)

// 用户列表
internalRoutes.get('/users', internalController.getUsers)

// 用户详情
internalRoutes.get('/users/:userId', internalController.getUserById)

// 为用户生成 JWT Token
internalRoutes.post('/users/:userId/token', internalController.generateUserToken)

export default internalRoutes
