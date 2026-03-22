import Router from 'koa-router'
import shadowApplicationController from '../controllers/shadowApplicationController.js'

const router = new Router({ prefix: '/internal' })

/**
 * @swagger
 * /api/v1/internal/shadow-applications:
 *   post:
 *     tags:
 *       - B端-影子人才
 *     summary: 推送影子候选人
 *     description: |
 *       recommend-service 调用，批量推送影子候选人到指定职位。
 *       - 去重键: { jobId, candidateEmail }，重复推送会跳过
 *       - 单次最多 100 个候选人
 *       - 内部接口，无需 JWT 认证
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - candidates
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 职位 ID（ObjectId 或 jobId 字符串）
 *               candidates:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - email
 *                     - name
 *                     - shadowResumeId
 *                     - matchScore
 *                   properties:
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     phone:
 *                       type: string
 *                     title:
 *                       type: string
 *                     location:
 *                       type: string
 *                     summary:
 *                       type: string
 *                     skills:
 *                       type: object
 *                     experience:
 *                       type: object
 *                     education:
 *                       type: object
 *                     shadowResumeId:
 *                       type: string
 *                     matchScore:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                     evaluation:
 *                       type: object
 *     responses:
 *       200:
 *         description: 推送结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 0
 *                 data:
 *                   type: object
 *                   properties:
 *                     created:
 *                       type: integer
 *                       description: 新创建的数量
 *                     skipped:
 *                       type: integer
 *                       description: 跳过（已存在）的数量
 *       400:
 *         description: 参数校验失败
 *       404:
 *         description: 职位不存在
 */
router.post('/shadow-applications', async ctx => {
    await shadowApplicationController.pushShadowCandidates(ctx)
})

/**
 * @swagger
 * /api/v1/internal/shadow-applications/revoke:
 *   post:
 *     tags:
 *       - B端-影子人才
 *     summary: 撤回影子候选人
 *     description: |
 *       recommend-service 调用，批量撤回指定职位的影子候选人。
 *       - 通过 shadowResumeId 匹配
 *       - 仅 active 状态可撤回，hidden/revoked 跳过
 *       - 撤回后可通过 push 接口重新激活
 *       - 内部接口，无需 JWT 认证
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - jobId
 *               - candidates
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 职位 ID
 *               candidates:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 100
 *                 items:
 *                   type: object
 *                   required:
 *                     - shadowResumeId
 *                   properties:
 *                     shadowResumeId:
 *                       type: string
 *                       description: '影子简历 ID（格式: jobId:userId）'
 *     responses:
 *       200:
 *         description: 撤回结果
 *       400:
 *         description: 参数校验失败
 *       404:
 *         description: 职位不存在
 */
router.post('/shadow-applications/revoke', async ctx => {
    await shadowApplicationController.revokeShadowCandidates(ctx)
})

export default router
