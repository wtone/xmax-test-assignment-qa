import Router from 'koa-router'
import applicationController from '../controllers/applicationController.js'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requirePermission } from '../middlewares/permission.js'
import { validate } from '../middlewares/validation.js'
import { requireCompanyAssociation } from '../middlewares/companyAuth.js'
import { requireBUserType } from '../middlewares/require-b-user.js'
import { loadApplication } from '../middlewares/load-application.js'
import { requireApplicationOwnership } from '../middlewares/require-application-ownership.js'
import { reminderRateLimit } from '../middlewares/reminder-rate-limit.js'
import { loadCandidateProfile } from '../middlewares/load-candidate-profile.js'
import { AI_INTERVIEW_REMINDER_MAX, AI_INTERVIEW_REMINDER_COOLDOWN_MS } from '../constants/index.js'
import {
    createApplicationSchema,
    updateStatusSchema,
    batchUpdateStatusSchema,
    getApplicationsQuerySchema,
    applicationIdParamSchema,
    applicationDetailParamSchema,
    updateResumeSchema,
    withdrawApplicationSchema,
    userActionSchema,
    jobIdParamSchema,
    jobAiEvaluationCallbackSchema,
} from '../validators/application_validator.js'
import { shadowApplicationProxy } from '../middlewares/shadow-application-proxy.js'

const router = new Router({
    prefix: '/applications',
})

/**
 * @swagger
 * /api/v1/applications/callbacks/job-ai/evaluation:
 *   post:
 *     tags:
 *       - 服务回调
 *     summary: Job AI 评估结果回调
 *     description: >-
 *       Job AI 服务在完成候选人评估后，调用此接口将评估结果写回申请记录。
 *       该接口会自动更新申请的匹配分和评估摘要，并在必要时推进申请状态。
 *     security:
 *       - GatewayAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - job_id
 *               - candidate_id
 *               - evaluation
 *             properties:
 *               job_id:
 *                 type: string
 *                 example: "68b9a1e5811127fc53b1badc"
 *                 description: 职位ID（支持 MongoId / job_YYYYMMDD_xxxxxxxx 格式）
 *               candidate_id:
 *                 type: string
 *                 example: "42eb4aa7-0f60-4fac-8561-10d53ee4b244"
 *                 description: 候选人ID（UUID）
 *               application_id:
 *                 type: string
 *                 example: "app_20250905_388cb2bf"
 *                 description: 申请ID（可选，若缺失则通过 job/candidate 定位）
 *               resume_id:
 *                 type: string
 *                 example: "afc0dde6-e6fd-4c66-ae53-6e86704798fd"
 *                 description: 简历ID（可选）
 *               evaluation:
 *                 type: object
 *                 description: Job AI 返回的评估结果
 *                 required:
 *                   - id
 *                   - status
 *                 properties:
 *                   id:
 *                     type: integer
 *                     example: 22
 *                   status:
 *                     type: string
 *                     example: "completed"
 *                   overall_matching_score:
 *                     type: number
 *                     example: 78.4
 *                   recommendation_tier:
 *                     type: string
 *                     example: "推荐"
 *                   brief_summary:
 *                     type: string
 *                     example: "候选人具备基础的技术能力和一定的探索精神..."
 *                   total_interviews:
 *                     type: integer
 *                     example: 1
 *                   completed_interviews:
 *                     type: integer
 *                     example: 1
 *               metadata:
 *                 type: object
 *                 additionalProperties: true
 *                 description: 额外元数据
 *     responses:
 *       200:
 *         description: 回调处理成功
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 未找到匹配的申请
 */
router.post(
    '/callbacks/job-ai/evaluation',
    gatewayAuth({ allowAnonymous: false }),
    validate(jobAiEvaluationCallbackSchema, 'body'),
    applicationController.handleJobAiEvaluationCallback.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications:
 *   post:
 *     tags:
 *       - B端-候选人管理
 *     summary: 创建求职申请
 *     description: 企业端创建候选人申请记录。场景：企业代表候选人创建申请（如线下收到简历）
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
 *               - jobId
 *               - candidateId
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 职位ID
 *               candidateId:
 *                 type: string
 *                 description: 候选人ID
 *               resumeId:
 *                 type: string
 *                 description: 简历ID
 *               coverLetter:
 *                 type: string
 *                 description: 求职信
 *     responses:
 *       201:
 *         description: 申请创建成功
 *       400:
 *         description: 请求参数错误
 */
router.post(
    '/',
    gatewayAuth(),
    requirePermission('application:create'),
    validate(createApplicationSchema, 'body'),
    applicationController.createApplication.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications:
 *   get:
 *     tags:
 *       - B端-候选人管理
 *     summary: 获取申请列表
 *     description: 获取候选人申请列表，支持筛选和分页。status参数支持单个值或逗号分隔的多个值
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [submitting, submitted, pending, screening, interview, interview_inviting, interview_scheduled, interview_completed, interview_terminated, offer, hired, rejected, withdrawn]
 *           example: "screening,interview_inviting,interview_scheduled"
 *         description: |
 *           申请状态（支持单个值或逗号分隔的多个值）
 *           - screening: 待邀请（筛选中）
 *           - interview_inviting: 邀约中
 *           - interview_scheduled: 待面试
 *           - interview_completed: 已面试
 *           - interview_terminated: 已终止
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
 *           enum: [appliedAt, updatedAt, screeningAt, candidateName, matchScore]
 *           default: appliedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *       - in: query
 *         name: readStatus
 *         schema:
 *           type: string
 *           enum: [read, unread]
 *         description: 筛选已读/未读（仅B端用户生效）
 *       - in: query
 *         name: hideExcluded
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'true'
 *         description: 是否隐藏暂不考虑的候选人（仅B端用户生效，默认true）
 *     responses:
 *       200:
 *         description: 申请列表
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
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           applicationId:
 *                             type: string
 *                             example: "app_20250101_abc123"
 *                           jobId:
 *                             type: string
 *                             example: "68b9a1e5811127fc53b1badc"
 *                           candidateId:
 *                             type: string
 *                             example: "42eb4aa7-0f60-4fac-8561-10d53ee4b244"
 *                           status:
 *                             type: string
 *                             example: "interview_completed"
 *                           matchScore:
 *                             type: number
 *                             example: 78.5
 *                           job:
 *                             type: object
 *                             properties:
 *                               jobId:
 *                                 type: string
 *                               title:
 *                                 type: string
 *                               location:
 *                                 type: string
 *                               companyName:
 *                                 type: string
 *                           candidate:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                               email:
 *                                 type: string
 *                               phone:
 *                                 type: string
 *                           appointment:
 *                             type: object
 *                             nullable: true
 *                             description: 面试预约信息
 *                             properties:
 *                               appointmentId:
 *                                 type: string
 *                               status:
 *                                 type: string
 *                               selectedTimeSlot:
 *                                 type: object
 *                           manualRating:
 *                             type: object
 *                             nullable: true
 *                             description: 人工面试评分（B端对C端的打分）
 *                             properties:
 *                               rating:
 *                                 type: integer
 *                                 minimum: 1
 *                                 maximum: 10
 *                                 example: 8
 *                                 description: 评分（1-10整数，对应5星制半星）
 *                               tagRatings:
 *                                 type: array
 *                                 description: 基于职位标签的评分（每项 1-3）
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     tagId:
 *                                       type: string
 *                                       example: "communication"
 *                                     label:
 *                                       type: string
 *                                       example: "沟通表达"
 *                                     category:
 *                                       type: string
 *                                       example: "universal"
 *                                     score:
 *                                       type: integer
 *                                       example: 3
 *                               comment:
 *                                 type: string
 *                                 example: "候选人技术基础不错"
 *                                 description: 补充评价（最多500字符）
 *                               ratedBy:
 *                                 type: string
 *                                 example: "user-uuid-123"
 *                                 description: 评分人ID
 *                               updatedAt:
 *                                 type: string
 *                                 format: date-time
 *                                 example: "2025-12-23T10:00:00Z"
 *                                 description: 评分更新时间
 *                           userAction:
 *                             type: object
 *                             nullable: true
 *                             description: 用户操作标记（仅B端用户返回）
 *                             properties:
 *                               isRead:
 *                                 type: boolean
 *                                 description: 是否已读
 *                                 example: true
 *                               isExcluded:
 *                                 type: boolean
 *                                 description: 是否暂不考虑
 *                                 example: false
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         pageSize:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 */
router.get(
    '/',
    gatewayAuth(),
    requireCompanyAssociation(), // B端用户必须关联公司才能查看申请列表
    validate(getApplicationsQuerySchema, 'query'),
    applicationController.getApplications.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/stats:
 *   get:
 *     tags:
 *       - B端-候选人管理
 *     summary: 获取公司申请统计
 *     description: |
 *       获取当前用户公司下所有职位的申请状态统计，用于面试列表页 Tab 角标显示。
 *       一次请求返回所有 Tab 的数量，避免多次调用列表接口获取 total。
 *       支持按 jobId 筛选特定职位的统计数据。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         schema:
 *           type: string
 *         description: |
 *           职位ID（可选）。支持 MongoDB ObjectId 或业务ID（如 job_20260204_acd0f217）。
 *           不传则返回公司下所有职位的统计。
 *         example: "job_20260204_acd0f217"
 *       - in: query
 *         name: hideExcluded
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'true'
 *         description: 是否隐藏"暂不考虑"的申请（默认 true）
 *       - in: query
 *         name: readStatus
 *         schema:
 *           type: string
 *           enum: ['unread']
 *         description: 传 unread 时只统计未读申请
 *     responses:
 *       200:
 *         description: 申请统计数据
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
 *                       description: 总申请数
 *                       example: 150
 *                     screening:
 *                       type: integer
 *                       description: 待邀请（筛选中）数量
 *                       example: 30
 *                     interview_inviting:
 *                       type: integer
 *                       description: 邀约中数量
 *                       example: 25
 *                     interview_scheduled:
 *                       type: integer
 *                       description: 待面试数量
 *                       example: 40
 *                     interview_completed:
 *                       type: integer
 *                       description: 已面试数量
 *                       example: 45
 *                     interview_terminated:
 *                       type: integer
 *                       description: 已终止数量
 *                       example: 10
 *       403:
 *         description: 无权限（非 B 端用户或未关联公司）
 */
router.get(
    '/stats',
    gatewayAuth(),
    requireCompanyAssociation(),
    applicationController.getCompanyApplicationStats.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/{applicationId}:
 *   get:
 *     tags:
 *       - B端-候选人管理
 *       - B端-影子人才
 *     summary: 获取申请详情（含影子申请代理）
 *     description: |
 *       获取候选人申请详细信息。
 *       - 普通申请：直接查询本地数据
 *       - 影子申请：当 source=recommend 时，代理到 recommend-service 的 invitationDetail 接口
 *       影子申请 ID 格式为 shadow_YYYYMMDD_hex，需配合 source=recommend 查询参数使用。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 申请ID（支持 app_xxx 和 shadow_xxx 格式）
 *         examples:
 *           normal:
 *             value: app_20260214_d200979a
 *             summary: 普通申请
 *           shadow:
 *             value: shadow_20260304_abc123ef
 *             summary: 影子申请
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *           enum: [recommend]
 *         description: 传 recommend 触发影子申请代理
 *     responses:
 *       200:
 *         description: 申请详情
 *       403:
 *         description: 无权限查看该影子申请
 *       404:
 *         description: 申请不存在
 */
router.get(
    '/:applicationId',
    gatewayAuth(),
    validate(applicationDetailParamSchema, 'params'),
    shadowApplicationProxy(),
    applicationController.getApplicationById.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/{applicationId}/user-action:
 *   put:
 *     tags:
 *       - B端-候选人管理
 *     summary: 更新用户操作标记（已读/暂不考虑）
 *     description: |
 *       B端用户对候选人申请进行已读/暂不考虑标记，支持部分更新。
 *       同时支持普通申请（app_xxx）和影子申请（shadow_xxx）。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 申请ID（支持 app_xxx 和 shadow_xxx 格式）
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isRead:
 *                 type: boolean
 *                 description: 是否已读
 *               isExcluded:
 *                 type: boolean
 *                 description: 是否暂不考虑
 *               excludedReason:
 *                 type: string
 *                 maxLength: 500
 *                 description: 暂不考虑原因
 *           examples:
 *             markRead:
 *               value: { "isRead": true }
 *               summary: 标记已读
 *             markUnread:
 *               value: { "isRead": false }
 *               summary: 标记未读
 *             exclude:
 *               value: { "isExcluded": true, "excludedReason": "不符合岗位要求" }
 *               summary: 暂不考虑
 *             undoExclude:
 *               value: { "isExcluded": false }
 *               summary: 撤回暂不考虑
 *     responses:
 *       200:
 *         description: 操作成功
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
 *                     isRead:
 *                       type: boolean
 *                     readAt:
 *                       type: string
 *                       format: date-time
 *                     isExcluded:
 *                       type: boolean
 *                     excludedAt:
 *                       type: string
 *                       format: date-time
 *                     excludedReason:
 *                       type: string
 *       400:
 *         description: 参数错误
 *       403:
 *         description: 无权操作（非B端用户）
 */
router.put(
    '/:applicationId/user-action',
    gatewayAuth({ allowAnonymous: false }),
    requireBUserType(),
    requireCompanyAssociation(),
    validate(applicationDetailParamSchema, 'params'),
    validate(userActionSchema, 'body'),
    applicationController.updateUserAction.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/{applicationId}/status:
 *   put:
 *     tags:
 *       - B端-候选人管理
 *     summary: 更新申请状态
 *     description: 企业端更新候选人申请状态
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 申请ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [screening, interview, interview_inviting, interview_scheduled, interview_completed, interview_terminated, offer, hired, rejected]
 *                 description: |
 *                   新状态
 *                   - screening: 待邀请
 *                   - interview_inviting: 邀约中
 *                   - interview_scheduled: 待面试
 *                   - interview_completed: 已面试
 *                   - interview_terminated: 已终止
 *               note:
 *                 type: string
 *                 description: 状态更新备注
 *     responses:
 *       200:
 *         description: 状态更新成功
 *       400:
 *         description: 无效的状态转换
 *       404:
 *         description: 申请不存在
 */
router.put(
    '/:applicationId/status',
    gatewayAuth(),
    requirePermission('application:update'),
    validate(applicationIdParamSchema, 'params'),
    validate(updateStatusSchema, 'body'),
    applicationController.updateApplicationStatus.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/batch/status:
 *   put:
 *     deprecated: true
 *     tags:
 *       - B端-候选人管理
 *     summary: 批量更新申请状态
 *     description: 批量更新多个候选人申请状态
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
 *               - applicationIds
 *               - status
 *             properties:
 *               applicationIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 申请ID列表
 *               status:
 *                 type: string
 *                 enum: [screening, interview, interview_inviting, interview_scheduled, interview_completed, interview_terminated, offer, hired, rejected]
 *                 description: |
 *                   新状态
 *                   - screening: 待邀请
 *                   - interview_inviting: 邀约中
 *                   - interview_scheduled: 待面试
 *                   - interview_completed: 已面试
 *                   - interview_terminated: 已终止
 *               note:
 *                 type: string
 *                 description: 状态更新备注
 *     responses:
 *       200:
 *         description: 批量更新结果
 *       400:
 *         description: 请求参数错误
 */
router.put(
    '/batch/status',
    gatewayAuth(),
    requirePermission('application:update'),
    validate(batchUpdateStatusSchema, 'body'),
    applicationController.batchUpdateStatus.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/{applicationId}/remind-ai-interview:
 *   post:
 *     tags:
 *       - B端-候选人管理
 *     summary: 提醒候选人完成AI面试
 *     description: |
 *       B端用户向候选人发送邮件+站内信，提醒其完成AI面试。
 *       每个申请最多发送2次，两次间隔至少24小时。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 申请ID
 *     responses:
 *       200:
 *         description: 提醒发送成功
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
 *                     remindersSent:
 *                       type: integer
 *                       description: 已发送提醒次数
 *                       example: 1
 *                     remainingReminders:
 *                       type: integer
 *                       description: 剩余可发送次数
 *                       example: 1
 *                     nextAvailableAt:
 *                       type: string
 *                       format: date-time
 *                       description: 下次可发送时间
 *       403:
 *         description: 无权操作（非B端用户或申请不属于当前公司）
 *       404:
 *         description: 申请不存在
 *       422:
 *         description: 候选人邮箱不可用
 *       429:
 *         description: 提醒频率限制（已达上限或冷却中）
 */
router.post(
    '/:applicationId/remind-ai-interview',
    gatewayAuth({ allowAnonymous: false }),
    requireBUserType(),
    requireCompanyAssociation(),
    loadApplication(),
    requireApplicationOwnership(),
    reminderRateLimit({ field: 'aiInterviewReminders', maxCount: AI_INTERVIEW_REMINDER_MAX, cooldownMs: AI_INTERVIEW_REMINDER_COOLDOWN_MS }),
    loadCandidateProfile(),
    applicationController.remindAiInterview.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/{applicationId}/withdraw:
 *   post:
 *     tags:
 *       - B端-候选人管理
 *     summary: 撤回申请
 *     description: 候选人撤回求职申请
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: 申请ID
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
 *         description: 申请状态不允许撤回
 *       403:
 *         description: 无权撤回
 *       404:
 *         description: 申请不存在
 */
router.post(
    '/:applicationId/withdraw',
    gatewayAuth(),
    requirePermission('application:update:own'),
    validate(applicationIdParamSchema, 'params'),
    validate(withdrawApplicationSchema, 'body'),
    applicationController.withdrawApplication.bind(applicationController),
)

/**
 * @swagger
 * /api/v1/applications/job/{jobId}/stats:
 *   get:
 *     tags:
 *       - B端-候选人管理
 *     summary: 获取职位申请统计
 *     description: 获取指定职位的申请统计数据
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 职位ID
 *     responses:
 *       200:
 *         description: 申请统计数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: 总申请数
 *                 statusBreakdown:
 *                   type: object
 *                   description: 各状态申请数量
 *                 timeline:
 *                   type: array
 *                   description: 申请时间线统计
 *       404:
 *         description: 职位不存在
 */
router.get(
    '/job/:jobId/stats',
    gatewayAuth(),
    requirePermission('application:read'),
    validate(jobIdParamSchema, 'params'),
    applicationController.getApplicationStats.bind(applicationController),
)

export default router
