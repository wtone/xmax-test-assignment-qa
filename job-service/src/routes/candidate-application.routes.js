/**
 * C端申请管理路由
 * @module routes/candidate-application
 */

import Router from 'koa-router'
import Joi from 'joi'
import candidateApplicationController from '../controllers/candidateApplicationController.js'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requireCandidate } from '../middlewares/permission.js'
import { validate, validators } from '../middlewares/validation.js'

const router = new Router({
    prefix: '/candidate',
})

// 所有路由都需要候选人身份认证
router.use(gatewayAuth())
router.use(requireCandidate())

/**
 * @swagger
 * /api/v1/candidate/applications:
 *   post:
 *     tags:
 *       - C端-申请管理
 *     summary: 提交职位申请
 *     description: |
 *       候选人提交职位申请
 *
 *       **重要说明：**
 *       - 职位必须配置有效的 interviewTypes 才能接受申请
 *       - 系统会自动使用候选人的主简历并检查是否满足投递要求
 *       - 申请提交后会自动创建评估任务
 *       - 评估系统将根据职位的 interviewTypes 进行匹配评估
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
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 职位ID
 *               coverLetter:
 *                 type: string
 *                 description: 求职信
 *               expectedSalary:
 *                 type: object
 *                 properties:
 *                   min:
 *                     type: number
 *                   max:
 *                     type: number
 *                   currency:
 *                     type: string
 *               availableStartDate:
 *                 type: string
 *                 format: date
 *                 description: 可开始工作日期
 *           examples:
 *             basicApplication:
 *               summary: 基本申请
 *               value:
 *                 jobId: "job_20250806_e8e99862"
 *                 coverLetter: "我对这个职位非常感兴趣..."
 *             autoResume:
 *               summary: 使用系统自动识别的主简历
 *               value:
 *                 jobId: "job_20250806_e8e99862"
 *                 coverLetter: "我的技能非常匹配这个职位..."
 *                 expectedSalary:
 *                   min: 500
 *                   max: 800
 *                   currency: "CNY"
 *                 availableStartDate: "2025-09-01"
 *     responses:
 *       201:
 *         description: 申请成功
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
 *                   example: "申请提交成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     applicationId:
 *                       type: string
 *                       example: "app_20250809_42f5750e"
 *                     jobId:
 *                       type: string
 *                       example: "689d997b06a2b6de57744bb2"
 *                     candidateId:
 *                       type: string
 *                       example: "cand_123e4567-e89b-12d3-a456-426614174000"
 *                     status:
 *                       type: string
 *                       example: "submitted"
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-09T10:30:00.000Z"
 *                     evaluationStatus:
 *                       type: string
 *                       example: "created"
 *                       description: "评估任务状态（created=已创建, pending=待创建）"
 *                     evaluationId:
 *                       type: string
 *                       example: "eval_20250809_abcd1234"
 *                       description: "评估任务ID（如果创建成功）"
 *       400:
 *         description: |
 *           请求错误，可能的原因：
 *           - 已经申请过该职位
 *           - 职位未配置 interviewTypes（需要企业先配置）
 *           - 简历未上传
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 message:
 *                   type: string
 *                 error:
 *                   type: string
 *             examples:
 *               alreadyApplied:
 *                 summary: 已申请
 *                 value:
 *                   code: 400
 *                   message: "Already applied for this job"
 *                   error: "DUPLICATE_APPLICATION"
 *               noInterviewTypes:
 *                 summary: 职位未配置面试类型
 *                 value:
 *                   code: 400
 *                   message: "This job is not accepting applications. The employer needs to configure interview types first."
 *                   error: "SERVICE_ERROR"
 *               noResume:
 *                 summary: 未上传简历
 *                 value:
 *                   code: 404
 *                   message: "You must upload a resume before applying for jobs"
 *                   error: "RESUME_NOT_FOUND"
 *       404:
 *         description: 职位不存在或已关闭
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404
 *                 message:
 *                   type: string
 *                   example: "Job not found"
 *       503:
 *         description: 职位配置错误
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 503
 *                 message:
 *                   type: string
 *                   example: "This job is not accepting applications. The employer needs to configure interview types first."
 *                 detail:
 *                   type: string
 *                   example: "职位未配置面试类型(interviewTypes)，无法创建评估任务"
 */
router.post(
    '/applications',
    validate({
        body: Joi.object({
            jobId: validators.jobId().required(),
            coverLetter: Joi.string().max(2000),
            expectedSalary: Joi.object({
                min: Joi.number().min(0),
                max: Joi.number().min(0),
                currency: Joi.string().valid('CNY', 'USD', 'EUR'),
            }),
            availableStartDate: Joi.date().iso(),
        }),
    }),
    candidateApplicationController.submitApplication.bind(candidateApplicationController),
)

/**
 * @swagger
 * /api/v1/candidate/applications:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 获取我的申请列表
 *     description: 获取候选人自己的申请记录
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, screening, interview, offer, rejected, withdrawn]
 *         description: 申请状态筛选
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [appliedAt, updatedAt, interviewDate]
 *           default: appliedAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
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
 *         description: 申请列表
 */
router.get('/applications', candidateApplicationController.getMyApplications.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/applications/check/{jobId}:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 检查职位申请状态
 *     description: 用户根据 jobId 查询是否申请过这个职位以及申请状态
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 职位ID（系统自动识别ID格式）
 *         examples:
 *           mongoId:
 *             summary: MongoDB ObjectId格式
 *             value: "507f1f77bcf86cd799439011"
 *           businessId:
 *             summary: 业务ID格式
 *             value: "job_20250806_e8e99862"
 *     responses:
 *       200:
 *         description: 返回申请状态
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
 *                     hasApplied:
 *                       type: boolean
 *                       description: 是否已申请
 *                     applicationStatus:
 *                       type: string
 *                       nullable: true
 *                       enum: [submitted, screening, interview, offer, rejected, withdrawn, null]
 *                       description: 申请状态，未申请时为null
 *                     applicationId:
 *                       type: string
 *                       nullable: true
 *                       description: 申请ID，未申请时为null
 *                     appliedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: 申请时间，未申请时为null
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       description: 最后更新时间
 *                     matchScore:
 *                       type: number
 *                       nullable: true
 *                       description: 匹配分数
 *                     job:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         jobId:
 *                           type: string
 *                         title:
 *                           type: string
 *                         companyName:
 *                           type: string
 *                         location:
 *                           type: string
 *                     interview:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         status:
 *                           type: string
 *                         startedAt:
 *                           type: string
 *                           format: date-time
 *                         completedAt:
 *                           type: string
 *                           format: date-time
 *                     contract:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         status:
 *                           type: string
 *                         sentAt:
 *                           type: string
 *                           format: date-time
 *                         respondedAt:
 *                           type: string
 *                           format: date-time
 *                         signedAt:
 *                           type: string
 *                           format: date-time
 *             examples:
 *               notApplied:
 *                 summary: 未申请过
 *                 value:
 *                   code: 0
 *                   data:
 *                     hasApplied: false
 *                     applicationStatus: null
 *                     applicationId: null
 *                     appliedAt: null
 *               applied:
 *                 summary: 已申请
 *                 value:
 *                   code: 0
 *                   data:
 *                     hasApplied: true
 *                     applicationStatus: "interview"
 *                     applicationId: "app_20250809_42f5750e"
 *                     appliedAt: "2025-08-09T10:30:00.000Z"
 *                     updatedAt: "2025-08-10T14:20:00.000Z"
 *                     matchScore: 85
 *                     job:
 *                       jobId: "job_20250806_e8e99862"
 *                       title: "前端开发工程师"
 *                       companyName: "科技公司"
 *                       location: "北京"
 *                     interview:
 *                       status: "scheduled"
 *                       startedAt: null
 *                       completedAt: null
 *                     contract: null
 *       401:
 *         description: 未授权
 *       500:
 *         description: 服务器错误
 */
router.get('/applications/check/:jobId', candidateApplicationController.checkApplicationStatus.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/applications/stats:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 获取候选人申请统计
 *     description: |
 *       获取当前候选人所有申请的状态统计，用于面试列表页 Tab 角标显示。
 *       一次请求返回所有 Tab 的数量，避免多次调用列表接口获取 total。
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
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
 *                       description: 总申请数（5个Tab状态之和）
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
 *       401:
 *         description: 未授权
 */
router.get('/applications/stats', candidateApplicationController.getCandidateApplicationStats.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/applications/{applicationId}:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 获取申请详情
 *     description: 获取单个申请的详细信息
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
 *         description: 申请详情
 *       404:
 *         description: 申请不存在
 */
router.get('/applications/:applicationId', candidateApplicationController.getApplicationDetail.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/applications/{applicationId}/withdraw:
 *   put:
 *     tags:
 *       - C端-申请管理
 *     summary: 撤回申请
 *     description: 候选人撤回职位申请
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
 *         description: 当前状态不允许撤回
 */
router.put('/applications/:applicationId/withdraw', candidateApplicationController.withdrawApplication.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/interviews:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 获取面试安排
 *     description: 获取所有面试安排
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [scheduled, completed, cancelled]
 *         description: 面试状态
 *       - in: query
 *         name: upcoming
 *         schema:
 *           type: boolean
 *         description: 只显示即将到来的面试
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
 *         description: 面试列表
 */
router.get('/interviews', candidateApplicationController.getMyInterviews.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/interviews/{interviewId}:
 *   get:
 *     tags:
 *       - C端-申请管理
 *     summary: 获取面试详情
 *     description: 获取单个面试的详细信息
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: interviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: 面试ID
 *     responses:
 *       200:
 *         description: 面试详情
 *       404:
 *         description: 面试不存在
 */
router.get('/interviews/:interviewId', candidateApplicationController.getInterviewDetail.bind(candidateApplicationController))

/**
 * @swagger
 * /api/v1/candidate/interviews/{interviewId}/response:
 *   put:
 *     tags:
 *       - C端-申请管理
 *     summary: 响应面试邀请
 *     description: 候选人确认或拒绝面试邀请
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: interviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: 面试ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - response
 *             properties:
 *               response:
 *                 type: string
 *                 enum: [accept, decline, reschedule]
 *                 description: 响应类型
 *               reason:
 *                 type: string
 *                 description: 拒绝或重新安排的原因
 *               proposedTimes:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     date:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: integer
 *                 description: 建议的面试时间（重新安排时需要）
 *     responses:
 *       200:
 *         description: 响应成功
 *       400:
 *         description: 无效的响应或状态
 */
router.put(
    '/interviews/:interviewId/response',
    validate({
        body: {
            response: { type: 'string', enum: ['accept', 'decline', 'reschedule'], required: true },
            reason: { type: 'string', maxLength: 500 },
            proposedTimes: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        date: { type: 'string' },
                        duration: { type: 'number' },
                    },
                },
            },
        },
    }),
    candidateApplicationController.respondToInterview.bind(candidateApplicationController),
)

/**
 * @swagger
 * /api/v1/candidate/interviews/{interviewId}/feedback:
 *   post:
 *     tags:
 *       - C端-申请管理
 *     summary: 提交面试反馈
 *     description: 候选人提交面试后的反馈
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: interviewId
 *         required: true
 *         schema:
 *           type: string
 *         description: 面试ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 面试体验评分
 *               feedback:
 *                 type: string
 *                 description: 面试反馈
 *               interviewerRating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 description: 面试官评分
 *     responses:
 *       201:
 *         description: 反馈提交成功
 *       400:
 *         description: 面试未完成或已提交反馈
 */
router.post(
    '/interviews/:interviewId/feedback',
    validate({
        body: {
            rating: { type: 'number', min: 1, max: 5, required: true },
            feedback: { type: 'string', maxLength: 1000 },
            interviewerRating: { type: 'number', min: 1, max: 5 },
        },
    }),
    candidateApplicationController.submitInterviewFeedback.bind(candidateApplicationController),
)

/**
 * @swagger
 * /api/v1/candidate/application-stats:
 *   get:
 *     deprecated: true
 *     tags:
 *       - C端-申请管理
 *     summary: 获取申请统计
 *     description: 获取候选人的申请统计数据
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 统计数据
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalApplications:
 *                   type: integer
 *                 activeApplications:
 *                   type: integer
 *                 interviewsScheduled:
 *                   type: integer
 *                 offersReceived:
 *                   type: integer
 *                 applicationsByStatus:
 *                   type: object
 *                 recentActivity:
 *                   type: array
 */
router.get('/application-stats', candidateApplicationController.getApplicationStats.bind(candidateApplicationController))

export default router
