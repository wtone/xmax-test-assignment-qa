import Router from 'koa-router'
import { createSuccessResponse } from '../../utils/response.js'

const router = new Router()

/**
 * @swagger
 * /health:
 *   get:
 *     tags:
 *       - 健康检查
 *     summary: 服务健康检查
 *     description: 获取服务的健康状态、运行时间和内存使用情况
 *     responses:
 *       200:
 *         description: 服务正常运行
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/', ctx => {
    ctx.body = createSuccessResponse({
        status: 'UP',
        service: 'xmax-job-service',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
    })
})

export default router
