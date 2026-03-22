/**
 * 合同管理路由
 * @module routes/contract
 */

import Router from 'koa-router'
import Joi from 'joi'
import contractController from '../controllers/contractController.js'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requirePermission } from '../middlewares/permission.js'
import { validate, validators } from '../middlewares/validation.js'

const router = new Router({
    prefix: '/contracts',
})

/**
 * @swagger
 * /api/v1/contracts:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 创建录用通知
 *     description: B端企业创建录用通知（offer）
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - applicationId
 *               - terms
 *             properties:
 *               applicationId:
 *                 type: string
 *                 description: 申请ID
 *               terms:
 *                 type: object
 *                 required:
 *                   - position
 *                   - startDate
 *                   - compensation
 *                 properties:
 *                   position:
 *                     type: string
 *                   department:
 *                     type: string
 *                   startDate:
 *                     type: string
 *                     format: date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                   compensation:
 *                     type: object
 *                     properties:
 *                       rate:
 *                         type: number
 *                       currency:
 *                         type: string
 *                         enum: [CNY, USD, EUR, GBP, JPY]
 *                       period:
 *                         type: string
 *                         enum: [hour, day, week, month, year]
 *               benefits:
 *                 type: array
 *                 items:
 *                   type: object
 *               workArrangement:
 *                 type: object
 *               message:
 *                 type: string
 *                 maxLength: 3000
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: 录用通知创建成功
 *       400:
 *         description: 请求参数错误
 *       409:
 *         description: 已存在有效的录用通知
 */
router.post(
    '/',
    gatewayAuth(),
    requirePermission('contract:create'),
    validate({
        body: Joi.object({
            applicationId: validators.applicationId().required(),
            terms: Joi.object({
                position: Joi.string().required(),
                department: Joi.string(),
                startDate: Joi.date().iso().required(),
                compensation: Joi.object({
                    rate: Joi.number().positive().required(),
                    currency: Joi.string().valid('CNY', 'USD', 'EUR').required(),
                    period: Joi.string().valid('hour', 'day', 'month', 'year').required(),
                }).required(),
                probationPeriod: Joi.number().min(0),
                noticePeriod: Joi.number().min(0),
                contractDuration: Joi.number().min(0),
            }).required(),
            benefits: Joi.array().items(
                Joi.object({
                    type: Joi.string(),
                    name: Joi.string(),
                    description: Joi.string(),
                }),
            ),
            workArrangement: Joi.object({
                location: Joi.string(),
                remote: Joi.boolean(),
                flexibleHours: Joi.boolean(),
                workDays: Joi.array().items(Joi.string()),
                vacation: Joi.object({
                    annualLeave: Joi.number().min(0),
                    sickLeave: Joi.number().min(0),
                    personalLeave: Joi.number().min(0),
                }),
            }),
            message: Joi.string().max(3000),
            attachments: Joi.array().items(
                Joi.object({
                    filename: Joi.string(),
                    url: Joi.string().uri(),
                }),
            ),
            expiresAt: Joi.date().iso(),
        }),
    }),
    contractController.createContract,
)

/**
 * @swagger
 * /api/v1/contracts:
 *   get:
 *     tags:
 *       - 合同管理
 *     summary: 获取合同列表
 *     description: 获取录用通知列表，B端看到发出的，C端看到收到的
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, accepted, rejected, signed, expired, withdrawn]
 *         description: 合同状态
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: pageSize
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [sentAt, expiresAt, respondedAt]
 *           default: sentAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: 合同列表
 */
router.get('/', gatewayAuth(), contractController.getContracts)

/**
 * @swagger
 * /api/v1/contracts/stats:
 *   get:
 *     tags:
 *       - 合同管理
 *     summary: 获取合同统计
 *     description: B端获取录用通知统计数据
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: 统计数据
 */
router.get('/stats', gatewayAuth(), requirePermission('contract:read'), contractController.getContractStats)

/**
 * @swagger
 * /api/v1/contracts/{contractId}:
 *   get:
 *     tags:
 *       - 合同管理
 *     summary: 获取合同详情
 *     description: 获取录用通知详细信息
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *         description: 合同ID（offerId）
 *     responses:
 *       200:
 *         description: 合同详情
 *       404:
 *         description: 合同不存在
 *       403:
 *         description: 无权访问
 */
router.get('/:contractId', gatewayAuth(), contractController.getContractById)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/send:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 发送合同
 *     description: B端发送录用通知给候选人
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 发送成功
 *       403:
 *         description: 无权操作
 */
router.post('/:contractId/send', gatewayAuth(), requirePermission('contract:update'), contractController.sendContract)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/accept:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 接受录用通知
 *     description: C端候选人接受录用通知
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *                 description: 接受消息
 *     responses:
 *       200:
 *         description: 接受成功
 *       400:
 *         description: 合同状态不允许接受
 */
router.post('/:contractId/accept', gatewayAuth(), requirePermission('contract:accept'), contractController.acceptContract)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/reject:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 拒绝录用通知
 *     description: C端候选人拒绝录用通知
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: 拒绝原因
 *     responses:
 *       200:
 *         description: 拒绝成功
 *       400:
 *         description: 合同状态不允许拒绝
 */
router.post('/:contractId/reject', gatewayAuth(), requirePermission('contract:reject'), contractController.rejectContract)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/negotiate:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 协商录用条件
 *     description: C端候选人提出协商要求
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 description: 协商消息
 *               counterOffer:
 *                 type: object
 *                 description: 反向报价
 *     responses:
 *       200:
 *         description: 协商请求已提交
 */
router.post(
    '/:contractId/negotiate',
    gatewayAuth(),
    requirePermission('contract:negotiate'),
    validate({
        body: Joi.object({
            message: Joi.string().required(),
            counterOffer: Joi.object({
                compensation: Joi.object({
                    rate: Joi.number().positive(),
                    currency: Joi.string().valid('CNY', 'USD', 'EUR'),
                    period: Joi.string().valid('hour', 'day', 'month', 'year'),
                }),
                benefits: Joi.array().items(
                    Joi.object({
                        type: Joi.string(),
                        name: Joi.string(),
                        description: Joi.string(),
                    }),
                ),
                workArrangement: Joi.object(),
                startDate: Joi.date().iso(),
            }),
        }),
    }),
    contractController.negotiateContract,
)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/sign:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 签署合同
 *     description: C端候选人签署已接受的录用通知
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 签署成功
 *       400:
 *         description: 合同状态不允许签署
 */
router.post('/:contractId/sign', gatewayAuth(), requirePermission('contract:sign'), contractController.signContract)

/**
 * @swagger
 * /api/v1/contracts/{contractId}/cancel:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 撤回录用通知
 *     description: B端企业撤回已发送的录用通知
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: contractId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: 撤回原因
 *     responses:
 *       200:
 *         description: 撤回成功
 *       400:
 *         description: 合同状态不允许撤回
 */
router.post('/:contractId/cancel', gatewayAuth(), requirePermission('contract:cancel'), contractController.cancelContract)

/**
 * @swagger
 * /api/v1/contracts/batch:
 *   post:
 *     tags:
 *       - 合同管理
 *     summary: 批量创建录用通知
 *     description: B端批量发送录用通知
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - offers
 *             properties:
 *               offers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - applicationId
 *                     - terms
 *                   properties:
 *                     applicationId:
 *                       type: string
 *                     terms:
 *                       type: object
 *     responses:
 *       201:
 *         description: 批量创建结果
 */
router.post('/batch', gatewayAuth(), requirePermission('contract:create'), contractController.batchCreateContracts)

export default router
