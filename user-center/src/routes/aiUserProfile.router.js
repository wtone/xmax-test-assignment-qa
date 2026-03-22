import Router from 'koa-router'
import aiUserProfileController from '../controllers/aiUserProfile.js'
import internalAuth from '../middlewares/internal_auth.js'

const router = new Router({ prefix: '/api/v1/users' })

// 应用内部认证中间件
router.use(internalAuth)

// 获取用户 AI 画像
router.get('/ai-profile', aiUserProfileController.getAiProfile)

// 创建或更新用户 AI 画像
router.put('/ai-profile', aiUserProfileController.upsertAiProfile)

export default router
