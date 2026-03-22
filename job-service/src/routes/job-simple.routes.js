/**
 * 简单的职位路由（用于测试）
 */

import Router from 'koa-router'

const router = new Router({
    prefix: '/api/v1/job-simple',
})

// 简单的测试路由，没有任何中间件
router.get('/', async ctx => {
    ctx.body = {
        success: true,
        message: 'Job simple route works!',
        path: ctx.path,
    }
})

// 带中间件的路由
router.get(
    '/with-auth',
    async (ctx, next) => {
        // 简单的认证检查
        const userId = ctx.headers['x-user-id']
        if (!userId) {
            ctx.status = 401
            ctx.body = { error: 'Unauthorized' }
            return
        }
        await next()
    },
    async ctx => {
        ctx.body = {
            success: true,
            message: 'Authenticated route works!',
            userId: ctx.headers['x-user-id'],
        }
    },
)

export default router
