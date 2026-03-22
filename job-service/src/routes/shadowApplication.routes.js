import Router from 'koa-router'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requireBUserType } from '../middlewares/require-b-user.js'
import { requireCompanyAssociation } from '../middlewares/companyAuth.js'
import shadowApplicationController from '../controllers/shadowApplicationController.js'

const router = new Router({
    prefix: '/shadow-applications',
})

/**
 * @swagger
 * /api/v1/shadow-applications/{shadowApplicationId}/invite:
 *   post:
 *     tags:
 *       - B端-影子人才
 *     summary: 邀请影子候选人投递
 *     description: |
 *       B端招聘者邀请影子人才投递职位，发送邀请邮件到候选人邮箱。
 *       - 原子操作防止重复邀请（invitedAt 为 null 时才允许）
 *       - 邮件发送为非阻塞，失败不影响接口返回
 *       - 邮件模板: shadow_talent_invitation
 *       - 邮件发送链路: NotificationService → POST /api/v1/notification/email (notification-service)
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - name: shadowApplicationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: 影子申请 ID（格式 shadow_YYYYMMDD_hex8）
 *         example: shadow_20260304_a1b2c3d4
 *     responses:
 *       200:
 *         description: 邀请发送成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: 邀请已发送
 *                 data:
 *                   type: object
 *                   properties:
 *                     invitedAt:
 *                       type: string
 *                       format: date-time
 *                     candidateName:
 *                       type: string
 *       404:
 *         description: 影子申请不存在
 *       403:
 *         description: 无权限（职位不属于当前公司）
 *       409:
 *         description: 已邀请过，不可重复邀请
 */
router.post(
    '/:shadowApplicationId/invite',
    gatewayAuth({ allowAnonymous: false }),
    requireBUserType(),
    requireCompanyAssociation(),
    shadowApplicationController.inviteShadowCandidate.bind(shadowApplicationController),
)

export default router
