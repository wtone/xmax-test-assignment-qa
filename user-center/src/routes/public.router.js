import Router from 'koa-router'
import publicController from '../controllers/public.js'

// 公开API路由 (不需要认证)
const publicRoutes = new Router({ prefix: '/api/v1/users' })

// 通过邮箱获取用户基本信息（更具体的路由放前面）
publicRoutes.get('/public/by-email/:userEmail/basic', publicController.getUserBasicInfoByEmail)

// 获取用户基本信息（公开接口，只返回非敏感信息）
publicRoutes.get('/public/:userId/basic', publicController.getUserBasicInfo)

export default publicRoutes
