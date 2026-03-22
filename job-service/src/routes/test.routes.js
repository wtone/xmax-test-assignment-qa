/**
 * 测试路由
 */

import Router from 'koa-router'

const router = new Router({
    prefix: '/api/v1/test',
})

// 简单的测试路由
router.get('/', async ctx => {
    ctx.body = {
        success: true,
        message: 'Test route works!',
        prefix: router.opts.prefix,
    }
})

router.get('/info', async ctx => {
    ctx.body = {
        success: true,
        path: ctx.path,
        method: ctx.method,
    }
})

export default router
