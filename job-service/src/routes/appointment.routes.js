/**
 * 面试预约路由
 * @module routes/appointment
 */

import Router from 'koa-router'
import appointmentController from '../controllers/appointmentController.js'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requirePermission } from '../middlewares/permission.js'
import { validate } from '../middlewares/validation.js'
import {
    createAppointmentSchema,
    selectTimeSlotSchema,
    requestRescheduleSchema,
    selectRescheduleTimeSchema,
    respondToRescheduleSchema,
    rejectAppointmentSchema,
    cancelAppointmentSchema,
    completeAppointmentSchema,
    markNoShowSchema,
    getAppointmentsQuerySchema,
    getCandidateAppointmentsQuerySchema,
    appointmentIdParamSchema,
    inviteTokenParamSchema,
    getScheduleQuerySchema,
} from '../validators/appointment_validator.js'

// ============= B 端路由 =============
const routerB = new Router({
    prefix: '/appointment-b',
})

// 应用认证中间件到所有 B 端路由
routerB.use(gatewayAuth())

/**
 * @swagger
 * /api/v1/appointment-b/stats:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取预约统计信息
 *     description: 获取企业面试预约的统计数据
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 统计信息
 */
routerB.get('/stats', requirePermission('appointment:view'), appointmentController.getStats.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/schedule:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取面试官日程
 *     description: 获取当前登录面试官的日程安排
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: 开始日期
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         required: true
 *         description: 结束日期
 *     responses:
 *       200:
 *         description: 日程列表
 */
routerB.get('/schedule', requirePermission('appointment:view'), validate(getScheduleQuerySchema, 'query'), appointmentController.getSchedule.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取预约列表
 *     description: 获取企业的面试预约列表
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *         description: 职位ID
 *       - in: query
 *         name: candidateId
 *         schema:
 *           type: string
 *         description: 候选人ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [initiated, reschedule_requested, schedule_confirmed, completed, rejected, expired, cancelled, no_show]
 *         description: 预约状态
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
 *     responses:
 *       200:
 *         description: 预约列表
 */
routerB.get('/', requirePermission('appointment:view'), validate(getAppointmentsQuerySchema, 'query'), appointmentController.getAppointments.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: 创建面试预约
 *     description: B端发起面试预约，邀请候选人选择时间
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
 *               - candidateId
 *               - jobId
 *               - proposedTimeSlots
 *             properties:
 *               candidateId:
 *                 type: string
 *                 description: 候选人ID
 *               jobId:
 *                 type: string
 *                 description: 职位ID
 *               applicationId:
 *                 type: string
 *                 description: 申请ID（可选）
 *               proposedTimeSlots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                 description: 建议的时间段列表（1-5个）
 *               duration:
 *                 type: integer
 *                 description: 面试时长（分钟），默认60
 *               timezone:
 *                 type: string
 *                 description: 时区，默认 Asia/Shanghai
 *               notes:
 *                 type: string
 *                 description: 备注
 *               payment:
 *                 type: object
 *                 description: |
 *                   支付信息（可选）。B端先通过 payment-service 创建订单（状态为 PAID），
 *                   再将 orderId 传入此接口。后端会验证订单状态并从 payment-service 获取金额和渠道信息。
 *                 properties:
 *                   orderId:
 *                     type: string
 *                     description: payment-service 创建的订单ID（要求订单状态为 PAID）
 *                     example: "o_280693668065710080"
 *     responses:
 *       201:
 *         description: 预约创建成功
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
 *                   example: "面试预约创建成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointmentId:
 *                       type: string
 *                       example: "appt_20260213_a46f83a4"
 *                     status:
 *                       type: string
 *                       example: "initiated"
 *                     payment:
 *                       $ref: '#/components/schemas/AppointmentPayment'
 *                     inviteUrl:
 *                       type: string
 *                       description: 候选人邀请链接
 */
routerB.post('/', requirePermission('appointment:create'), validate(createAppointmentSchema, 'body'), appointmentController.createAppointment.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取预约详情
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 预约详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointmentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                       enum: [initiated, reschedule_requested, schedule_confirmed, completed, rejected, expired, cancelled, no_show]
 *                     payment:
 *                       $ref: '#/components/schemas/AppointmentPayment'
 */
routerB.get('/:appointmentId', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getAppointmentById.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/select-time:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: 选择改期时间
 *     description: B端从候选人提议的时间段中选择一个，确认改期（同意改期）
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *               - slotIndex
 *             properties:
 *               slotIndex:
 *                 type: integer
 *                 description: 选择候选人提议的第几个时间段（从0开始）
 *               responseNote:
 *                 type: string
 *                 description: 回复备注
 *     responses:
 *       200:
 *         description: 已确认改期时间
 */
routerB.post(
    '/:appointmentId/select-time',
    requirePermission('appointment:update'),
    validate(appointmentIdParamSchema, 'params'),
    validate(selectRescheduleTimeSchema, 'body'),
    appointmentController.selectRescheduleTime.bind(appointmentController),
)

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/reschedule:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: B端改期（响应C端改期或主动发起改期）
 *     description: |
 *       B端提供新的时间段供候选人选择，支持两种场景：
 *       - 当前状态为 reschedule_requested：拒绝C端改期请求，提供新时间段（循环协商）
 *       - 当前状态为 schedule_confirmed：B端主动发起改期，提供新时间段
 *
 *       两种场景都会将状态流转到 initiated，等待候选人选择时间。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *               - proposedSlots
 *             properties:
 *               proposedSlots:
 *                 type: array
 *                 description: B端提供的新时间段
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                 example:
 *                   - startTime: "2025-01-15T10:00:00Z"
 *                     endTime: "2025-01-15T11:00:00Z"
 *                   - startTime: "2025-01-16T14:00:00Z"
 *                     endTime: "2025-01-16T15:00:00Z"
 *               responseNote:
 *                 type: string
 *                 description: 回复备注
 *                 example: "这两个时间段我可以安排面试"
 *     responses:
 *       200:
 *         description: 已提供新时间段，等待候选人选择
 */
routerB.post(
    '/:appointmentId/reschedule',
    requirePermission('appointment:update'),
    validate(appointmentIdParamSchema, 'params'),
    validate(respondToRescheduleSchema, 'body'),
    appointmentController.respondToReschedule.bind(appointmentController),
)

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/cancel:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: 取消预约
 *     description: |
 *       B端取消面试预约。如果预约关联了支付订单（payment.orderId），
 *       系统会自动通过 payment-service 发起全额退款（refundOrder）。
 *       退款后 payment.status 变为 REFUNDED。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *                 description: 取消原因
 *     responses:
 *       200:
 *         description: 取消成功（含退款信息）
 */
routerB.post('/:appointmentId/cancel', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(cancelAppointmentSchema, 'body'), appointmentController.cancelAppointmentB.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/complete:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: 标记面试完成
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               feedback:
 *                 type: string
 *                 description: 面试反馈
 *     responses:
 *       200:
 *         description: 标记成功
 */
routerB.post('/:appointmentId/complete', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(completeAppointmentSchema, 'body'), appointmentController.completeAppointment.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/no-show:
 *   post:
 *     tags:
 *       - B端-面试预约
 *     summary: 标记缺席
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: 标记成功
 */
routerB.post('/:appointmentId/no-show', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(markNoShowSchema, 'body'), appointmentController.markNoShow.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/meeting:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取会议加入信息（B端）
 *     description: 获取 veRTC 会议的加入信息（B端加入不触发扣款）
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 会议信息
 */
routerB.get('/:appointmentId/meeting', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getMeetingInfoB.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/room-status:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取面试房间状态
 *     description: |
 *       查询面试房间的综合状态，包括：
 *       - 用户是否在线（实时）
 *       - 会议起始结束时间（历史）
 *       - 会议整体状态：not_started, in_progress, started_but_empty, ended
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 面试预约 ID
 *     responses:
 *       200:
 *         description: 房间状态信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appointmentId:
 *                   type: string
 *                 roomId:
 *                   type: string
 *                 meetingStatus:
 *                   type: string
 *                   enum: [not_configured, not_started, in_progress, started_but_empty, ended]
 *                 realtime:
 *                   type: object
 *                   properties:
 *                     onlineUsers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userId:
 *                             type: string
 *                           joinTime:
 *                             type: string
 *                             format: date-time
 *                     userCount:
 *                       type: integer
 *                 history:
 *                   type: object
 *                   properties:
 *                     actualStartTime:
 *                       type: string
 *                       format: date-time
 *                     actualEndTime:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: integer
 *                       description: 会议时长（秒）
 *                     totalUsers:
 *                       type: integer
 *                 appointment:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                     scheduledStartTime:
 *                       type: string
 *                       format: date-time
 *                     scheduledEndTime:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: integer
 *       403:
 *         description: 无权限
 *       404:
 *         description: 预约不存在
 */
routerB.get('/:appointmentId/room-status', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getRoomStatusB.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-b/{appointmentId}/meeting-duration:
 *   get:
 *     tags:
 *       - B端-面试预约
 *     summary: 获取面试实际时长
 *     description: |
 *       查询面试的实际时长，首次查询从火山 RTC API 获取并缓存到数据库。
 *       后续查询直接返回缓存数据，避免重复调用 API。
 *
 *       注意：
 *       - 火山 RTC API 数据延迟约 60 秒
 *       - 面试结束后才能获取到完整的时长信息
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *         description: 面试预约 ID
 *     responses:
 *       200:
 *         description: 面试时长信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 appointmentId:
 *                   type: string
 *                 roomId:
 *                   type: string
 *                 scheduledDuration:
 *                   type: integer
 *                   description: 预定时长（分钟）
 *                 actualDuration:
 *                   type: integer
 *                   description: 实际时长（分钟），面试未结束时为 null
 *                 actualStartTime:
 *                   type: string
 *                   format: date-time
 *                 actualEndTime:
 *                   type: string
 *                   format: date-time
 *                 isFinished:
 *                   type: boolean
 *                   description: 面试是否已结束
 *                 source:
 *                   type: string
 *                   enum: [cached, realtime]
 *                   description: 数据来源，cached=数据库缓存，realtime=实时从RTC API获取
 *                 error:
 *                   type: string
 *                   description: 错误信息（如面试未结束）
 *       403:
 *         description: 无权限
 *       404:
 *         description: 预约不存在
 */
routerB.get('/:appointmentId/meeting-duration', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getMeetingDuration.bind(appointmentController))

// ============= C 端路由 =============
const routerC = new Router({
    prefix: '/appointment-c',
})

/**
 * @swagger
 * /api/v1/appointment-c/invite/{token}:
 *   get:
 *     tags:
 *       - C端-面试预约
 *     summary: 通过邀请链接获取预约信息
 *     description: 候选人通过邀请链接查看面试预约详情（无需登录）
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *         description: 邀请链接token
 *     responses:
 *       200:
 *         description: 预约信息
 *       404:
 *         description: 邀请链接无效或已过期
 */
routerC.get('/invite/:token', validate(inviteTokenParamSchema, 'params'), appointmentController.getAppointmentByToken.bind(appointmentController))

// 以下 C 端接口需要认证
routerC.use(gatewayAuth())

/**
 * @swagger
 * /api/v1/appointment-c:
 *   get:
 *     tags:
 *       - C端-面试预约
 *     summary: 获取我的预约列表
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: 预约状态，支持逗号分隔的多个状态（如：initiated,reschedule_requested）
 *         example: initiated,reschedule_requested
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
 *           enum: [createdAt, updatedAt, meeting.scheduledStartTime]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: 预约列表
 */
routerC.get('/', requirePermission('appointment:view'), validate(getCandidateAppointmentsQuerySchema, 'query'), appointmentController.getCandidateAppointments.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/stats:
 *   get:
 *     tags:
 *       - C端-面试预约
 *     summary: 获取候选人预约统计
 *     description: |
 *       返回每个 appointment status 的独立计数，前端自行做加法：
 *       - 待接受 = initiated + reschedule_requested
 *       - 待面试 = schedule_confirmed
 *       - 已面试 = completed
 *       - 已终止 = rejected + expired + cancelled + no_show
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 预约统计
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
 *                     total:
 *                       type: integer
 *                       description: 所有状态总数
 *                     screening:
 *                       type: integer
 *                       description: 筛选中（来自 Application）
 *                     initiated:
 *                       type: integer
 *                       description: B端已发邀请，等待C端操作
 *                     reschedule_requested:
 *                       type: integer
 *                       description: C端申请改期，等待B端审批
 *                     schedule_confirmed:
 *                       type: integer
 *                       description: 双方已确认时间
 *                     completed:
 *                       type: integer
 *                       description: 面试已完成
 *                     rejected:
 *                       type: integer
 *                       description: C端拒绝邀请
 *                     expired:
 *                       type: integer
 *                       description: 超时未响应
 *                     cancelled:
 *                       type: integer
 *                       description: 已取消
 *                     no_show:
 *                       type: integer
 *                       description: 未出席
 */
routerC.get('/stats', requirePermission('appointment:view'), appointmentController.getCandidateAppointmentStats.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}:
 *   get:
 *     tags:
 *       - C端-面试预约
 *     summary: 获取预约详情
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 预约详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     appointmentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     payment:
 *                       $ref: '#/components/schemas/AppointmentPayment'
 */
routerC.get('/:appointmentId', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getCandidateAppointmentById.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}/select-time:
 *   post:
 *     tags:
 *       - C端-面试预约
 *     summary: 选择面试时间
 *     description: 候选人从B端提供的时间段中选择一个
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *               - slotIndex
 *             properties:
 *               slotIndex:
 *                 type: integer
 *                 description: 选择的时间段索引（从0开始）
 *     responses:
 *       200:
 *         description: 时间已确认
 */
routerC.post('/:appointmentId/select-time', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(selectTimeSlotSchema, 'body'), appointmentController.selectTimeSlot.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}/reschedule:
 *   post:
 *     tags:
 *       - C端-面试预约
 *     summary: 申请改期
 *     description: 候选人申请更改面试时间
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *               - proposedSlots
 *               - reason
 *             properties:
 *               proposedSlots:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     startTime:
 *                       type: string
 *                       format: date-time
 *                     endTime:
 *                       type: string
 *                       format: date-time
 *                 description: 候选人建议的时间段
 *               reason:
 *                 type: string
 *                 description: 改期原因
 *     responses:
 *       200:
 *         description: 改期申请已提交
 */
routerC.post('/:appointmentId/reschedule', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(requestRescheduleSchema, 'body'), appointmentController.requestReschedule.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}/reject:
 *   post:
 *     tags:
 *       - C端-面试预约
 *     summary: 拒绝面试邀请
 *     description: |
 *       C端拒绝面试邀请。如果预约关联了支付订单（payment.orderId），
 *       系统会自动通过 payment-service 发起全额退款。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *                 description: 拒绝原因（可选）
 *     responses:
 *       200:
 *         description: 已拒绝面试邀请（含退款信息）
 */
routerC.post('/:appointmentId/reject', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(rejectAppointmentSchema, 'body'), appointmentController.rejectAppointment.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}/cancel:
 *   post:
 *     tags:
 *       - C端-面试预约
 *     summary: 取消预约
 *     description: |
 *       C端取消面试预约。如果预约关联了支付订单（payment.orderId），
 *       系统会自动通过 payment-service 发起全额退款。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
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
 *                 description: 取消原因
 *     responses:
 *       200:
 *         description: 取消成功（含退款信息）
 */
routerC.post('/:appointmentId/cancel', requirePermission('appointment:update'), validate(appointmentIdParamSchema, 'params'), validate(cancelAppointmentSchema, 'body'), appointmentController.cancelAppointmentC.bind(appointmentController))

/**
 * @swagger
 * /api/v1/appointment-c/{appointmentId}/meeting:
 *   get:
 *     tags:
 *       - C端-面试预约
 *     summary: 获取会议加入信息（C端）
 *     description: |
 *       获取 veRTC 会议的加入信息。C端首次加入会触发支付扣款：
 *       - 调用 payment-service confirmOrder 将订单从 PAID → COMPLETED
 *       - payment.status 从 FROZEN → CHARGED
 *       - 扣款失败不会阻止加入会议
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: appointmentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: 会议信息
 */
routerC.get('/:appointmentId/meeting', requirePermission('appointment:view'), validate(appointmentIdParamSchema, 'params'), appointmentController.getMeetingInfoC.bind(appointmentController))

export { routerB as appointmentRouterB, routerC as appointmentRouterC }
