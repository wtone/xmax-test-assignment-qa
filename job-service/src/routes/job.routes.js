/**
 * 职位管理路由
 * @module routes/job
 */

import Router from 'koa-router'
import jobController from '../controllers/jobController.js'
import manualRatingController from '../controllers/manualRatingController.js'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requirePermission } from '../middlewares/permission.js'
import { validate } from '../middlewares/validation.js'
import { requireCompanyAssociation } from '../middlewares/companyAuth.js'
import { requireJobAccess } from '../middlewares/require-job-access.js'
import { requireBUserType } from '../middlewares/require-b-user.js'
import collaboratorController from '../controllers/collaboratorController.js'
import {
    createJobSchema,
    updateJobSchema,
    jobActionSchema,
    batchActionSchema,
    jobListQuerySchema,
    jobIdParamSchema,
} from '../validators/job_validator.js'
import {
    updateManualRatingSchema,
    getManualRatingQuerySchema,
} from '../validators/manualRating_validator.js'

const router = new Router({
    prefix: '/job-b',
})

// 应用认证中间件到所有路由
router.use(gatewayAuth())

/**
 * @swagger
 * /api/v1/job-b/stats:
 *   get:
 *     tags:
 *       - B端-职位管理
 *     summary: 获取职位统计信息
 *     description: 获取企业职位发布统计数据
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 统计信息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                   description: 总职位数
 *                 published:
 *                   type: integer
 *                   description: 已发布职位数
 *                 draft:
 *                   type: integer
 *                   description: 草稿职位数
 *                 closed:
 *                   type: integer
 *                   description: 已关闭职位数
 */
router.get('/stats', requirePermission('job:view'), jobController.getJobStats.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/batch-action:
 *   post:
 *     deprecated: true
 *     tags:
 *       - B端-职位管理
 *     summary: 批量操作职位
 *     description: 批量执行职位操作（发布、暂停、恢复、关闭、删除）
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
 *               - jobIds
 *               - action
 *             properties:
 *               jobIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 职位ID列表
 *               action:
 *                 type: string
 *                 enum: [publish, pause, resume, close, delete]
 *                 description: 操作类型
 *     responses:
 *       200:
 *         description: 批量操作结果
 *       400:
 *         description: 请求参数错误
 */
router.post(
    '/batch-action',
    requirePermission(['job:update', 'job:publish', 'job:close', 'job:delete']),
    validate(batchActionSchema, 'body'),
    jobController.batchAction.bind(jobController),
)

/**
 * @swagger
 * /api/v1/job-b:
 *   get:
 *     tags:
 *       - B端-职位管理
 *     summary: 获取职位列表
 *     description: |
 *       获取企业发布的职位列表
 *
 *       **安全说明：**
 *       - 此接口严格按企业隔离，只返回当前用户所属企业的职位数据
 *       - 需要通过 X-User-Company-ID 头部提供有效的企业ID
 *       - 如果缺少企业ID或企业ID无效，将返回空列表而不是错误，确保数据安全
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, paused, closed]
 *         description: 职位状态
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: 搜索关键词
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
 *           enum: [createdAt, updatedAt, title]
 *           default: createdAt
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *     responses:
 *       200:
 *         description: 职位列表
 */
router.get('/', requirePermission('job:view'), validate(jobListQuerySchema, 'query'), jobController.getJobList.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b:
 *   post:
 *     tags:
 *       - B端-职位管理
 *     summary: 创建职位
 *     description: 创建新的职位
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
 *               - companyName
 *               - title
 *               - description
 *               - salaryRange
 *               - contractType
 *               - workMode
 *               - maxApplicants
 *               - contractDuration
 *               - startDate
 *             properties:
 *               companyId:
 *                 type: string
 *                 description: 公司ID（系统自动设置，无需在请求中提供）
 *                 readOnly: true
 *                 example: "comp_123e4567-e89b-12d3-a456-426614174000"
 *               companyName:
 *                 type: string
 *                 description: 公司名称
 *                 example: "示例科技有限公司"
 *               showCompanyName:
 *                 type: boolean
 *                 description: 是否显示公司真实名称（false时使用companyAlias）
 *                 default: true
 *                 example: false
 *               companyAlias:
 *                 type: string
 *                 description: 公司代称（匿名展示时使用，不填则默认为"匿名公司"）
 *                 maxLength: 100
 *                 example: "某大型科技公司"
 *               title:
 *                 type: string
 *                 description: 职位名称
 *                 example: "高级JAVA工程师"
 *               description:
 *                 type: string
 *                 description: 职位描述（50-30000字符）
 *                 minLength: 50
 *                 maxLength: 30000
 *                 example: "1. 负责公司核心产品的前端架构设计、技术选型，主导并实现业务模块的前端开发，确保代码质量和性能优化\n2. 负责数据可视化大屏项目的开发与优化\n3. 制定并完善前端开发规范，建立技术文档体系，解决前端疑难技术问题，进行技术攻关\n4. 推动前端工程化建设，优化开发流程和工具，指导初中级工程师，促进团队技术能力提升"
 *               requirements:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 职位要求列表
 *                 example: ["本科及以上学历", "3年以上Java开发经验", "熟悉Spring Boot框架"]
 *               otherRequirements:
 *                 type: string
 *                 description: 供模型评估使用的补充要求（不对C端展示）
 *                 maxLength: 5000
 *                 example: "请重点关注候选人的科研背景与团队协作能力"
 *               location:
 *                 type: string
 *                 description: 公司地点（可选）
 *                 example: "中国/上海"
 *                 required: false
 *               remote:
 *                 type: boolean
 *                 description: 是否支持远程
 *                 default: false
 *               workMode:
 *                 type: string
 *                 description: 办公方式
 *                 enum: [onsite, remote, hybrid]
 *                 example: "onsite"
 *               salaryRange:
 *                 type: object
 *                 required: [min, max, currency, period]
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 300
 *                   max:
 *                     type: number
 *                     example: 800
 *                   currency:
 *                     type: string
 *                     default: "CNY"
 *                     example: "CNY"
 *                   period:
 *                     type: string
 *                     enum: [hour, day, month, year]
 *                     default: "day"
 *                     example: "day"
 *                   months:
 *                     type: integer
 *                     description: N薪（年薪月数，仅当 period 为 month 时有效）
 *                     minimum: 12
 *                     default: 12
 *                     example: 13
 *               contractType:
 *                 type: string
 *                 description: 职位类型
 *                 enum: [full-time, part-time, contract, internship]
 *                 example: "full-time"
 *               contractDuration:
 *                 type: object
 *                 description: 预计签约时长
 *                 required: [value, unit]
 *                 properties:
 *                   value:
 *                     type: number
 *                     example: 20
 *                   unit:
 *                     type: string
 *                     enum: [hour, day, month, year]
 *                     example: "hour"
 *               education:
 *                 type: string
 *                 description: 学历要求（可选）
 *                 enum: [none, high-school, associate, bachelor, master, phd]
 *                 default: "none"
 *                 example: "bachelor"
 *               experience:
 *                 type: object
 *                 description: 工作经验要求（可选）
 *                 properties:
 *                   min:
 *                     type: number
 *                     example: 3
 *                   max:
 *                     type: number
 *                     example: 5
 *                   unit:
 *                     type: string
 *                     default: "years"
 *                     example: "years"
 *               maxApplicants:
 *                 type: number
 *                 description: 招聘人数
 *                 example: 10
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 description: 工作开始时间
 *                 example: "2025-10-05T00:00:00.000Z"
 *               applicationDeadline:
 *                 type: string
 *                 format: date-time
 *                 description: 申请截止时间
 *                 example: "2025-09-30T23:59:59.999Z"
 *               interviewTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 面试类型列表（必需配置，用于评估系统）
 *                 example: ["technical-interview", "behavioral-interview", "system-design"]
 *                 default: []
 *     responses:
 *       201:
 *         description: 职位创建成功
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
 *                   example: "职位创建成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_20250806_e8e99862"
 *                     _id:
 *                       type: string
 *                       example: "689d997b06a2b6de57744bb2"
 *                     title:
 *                       type: string
 *                       example: "高级JAVA工程师"
 *                     status:
 *                       type: string
 *                       example: "draft"
 *                     interviewTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["technical-interview", "behavioral-interview"]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-06T12:00:00.000Z"
 *       400:
 *         description: 请求参数错误
 */
router.post('/', requireCompanyAssociation(), requirePermission('job:create'), validate(createJobSchema, 'body'), jobController.createJob.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/{jobId}:
 *   get:
 *     tags:
 *       - B端-职位管理
 *     summary: 获取职位详情
 *     description: 获取职位详细信息（B端企业用户查看自己公司的职位）
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^job_\d{8}_[a-f0-9]{8}$'
 *         description: 职位ID
 *         example: "job_20250806_e8e99862"
 *     responses:
 *       200:
 *         description: 职位详情获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 0
 *                   description: 响应状态码，0表示成功
 *                 message:
 *                   type: string
 *                   example: "获取职位详情成功"
 *                   description: 响应消息
 *                 data:
 *                   type: object
 *                   description: 职位详细数据
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_20250806_e8e99862"
 *                       description: 职位唯一标识
 *                     _id:
 *                       type: string
 *                       example: "689d997b06a2b6de57744bb2"
 *                       description: MongoDB文档ID
 *                     title:
 *                       type: string
 *                       example: "高级JAVA工程师"
 *                       description: 职位名称
 *                     companyId:
 *                       type: string
 *                       example: "comp_20250101_a1b2c3d4"
 *                       description: 公司ID
 *                     companyName:
 *                       type: string
 *                       example: "示例科技有限公司"
 *                       description: 公司名称（showCompanyName为true时显示）
 *                     displayCompanyName:
 *                       type: string
 *                       example: "示例科技有限公司"
 *                       description: 显示的公司名称（根据showCompanyName决定显示真名或代称）
 *                     showCompanyName:
 *                       type: boolean
 *                       example: true
 *                       description: 是否显示真实公司名
 *                     companyAlias:
 *                       type: string
 *                       example: "某互联网科技公司"
 *                       description: 公司代称（匿名展示时使用）
 *                     publisherId:
 *                       type: string
 *                       example: "user_20250101_x1y2z3w4"
 *                       description: 发布者用户ID
 *                     description:
 *                       type: string
 *                       example: "负责公司核心产品的后端开发，包括架构设计、代码实现、性能优化等工作。与产品、前端团队紧密合作，保证项目高质量交付。"
 *                       description: 职位描述（50-30000字）
 *                     descriptionLength:
 *                       type: integer
 *                       example: 120
 *                       description: 描述字符长度
 *                     descriptionLimit:
 *                       type: integer
 *                       example: 1000
 *                       description: 描述字符限制
 *                     requirements:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["本科及以上学历", "3年以上Java开发经验", "熟悉Spring Boot框架", "有微服务架构经验优先"]
 *                       description: 职位要求列表
 *                     location:
 *                       type: string
 *                       example: "成都市高新区"
 *                       description: 工作地点
 *                     remote:
 *                       type: boolean
 *                       example: false
 *                       description: 是否支持远程工作
 *                     workMode:
 *                       type: string
 *                       example: "onsite"
 *                       enum: [onsite, remote, hybrid]
 *                       description: 工作模式
 *                     workModeLabel:
 *                       type: string
 *                       example: "现场办公"
 *                       description: 工作模式中文标签
 *                     salaryRange:
 *                       type: object
 *                       description: 薪资范围
 *                       properties:
 *                         min:
 *                           type: number
 *                           example: 300
 *                           description: 最低薪资
 *                         max:
 *                           type: number
 *                           example: 800
 *                           description: 最高薪资
 *                         currency:
 *                           type: string
 *                           example: "CNY"
 *                           enum: [CNY, USD, EUR]
 *                           description: 货币类型
 *                         period:
 *                           type: string
 *                           example: "day"
 *                           enum: [hour, day, month, year]
 *                           description: 计薪周期
 *                         periodLabel:
 *                           type: string
 *                           example: "元/天"
 *                           description: 计薪周期中文标签
 *                         months:
 *                           type: integer
 *                           example: 13
 *                           description: N薪（年薪月数，仅当 period 为 month 时有效）
 *                         monthsLabel:
 *                           type: string
 *                           example: "13薪"
 *                           description: N薪中文标签
 *                     salaryRangeText:
 *                       type: string
 *                       example: "300-800 元/天"
 *                       description: 格式化的薪资范围文本
 *                     contractType:
 *                       type: string
 *                       example: "full-time"
 *                       enum: [full-time, part-time, contract, internship, temporary]
 *                       description: 合同类型
 *                     contractTypeLabel:
 *                       type: string
 *                       example: "全职"
 *                       description: 合同类型中文标签
 *                     contractDuration:
 *                       type: object
 *                       description: 合同时长（临时/合同制职位）
 *                       properties:
 *                         value:
 *                           type: number
 *                           example: 6
 *                           description: 时长数值
 *                         unit:
 *                           type: string
 *                           example: "month"
 *                           enum: [hour, day, week, month, year]
 *                           description: 时长单位
 *                         unitLabel:
 *                           type: string
 *                           example: "个月"
 *                           description: 时长单位中文标签
 *                     contractDurationText:
 *                       type: string
 *                       example: "6 个月"
 *                       description: 格式化的合同时长文本
 *                     experience:
 *                       type: object
 *                       description: 经验要求
 *                       properties:
 *                         min:
 *                           type: number
 *                           example: 3
 *                           description: 最低经验年限
 *                         max:
 *                           type: number
 *                           example: 5
 *                           description: 最高经验年限
 *                         unit:
 *                           type: string
 *                           example: "years"
 *                           enum: [months, years]
 *                           description: 经验单位
 *                     experienceLabel:
 *                       type: string
 *                       example: "3-5年"
 *                       description: 经验要求中文标签
 *                     education:
 *                       type: string
 *                       example: "bachelor"
 *                       enum: [none, high-school, associate, bachelor, master, phd]
 *                       description: 学历要求
 *                     educationLabel:
 *                       type: string
 *                       example: "本科"
 *                       description: 学历要求中文标签
 *                     interviewConfig:
 *                       type: object
 *                       description: 面试配置
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                           example: true
 *                           description: 是否启用面试
 *                         processId:
 *                           type: string
 *                           example: "507f1f77bcf86cd799439011"
 *                           description: 面试流程ID
 *                         requiredModules:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["coding", "technical", "behavioral"]
 *                           description: 必需的面试模块
 *                         estimatedDuration:
 *                           type: number
 *                           example: 90
 *                           description: 预计面试时长（分钟）
 *                     interviewTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["technical-interview", "behavioral-interview", "coding-test"]
 *                       description: 面试类型列表（评估系统必需）
 *                     status:
 *                       type: string
 *                       example: "published"
 *                       enum: [draft, published, paused, closed]
 *                       description: 职位状态
 *                     statusLabel:
 *                       type: string
 *                       example: "已发布"
 *                       description: 职位状态中文标签
 *                     currentApplicants:
 *                       type: number
 *                       example: 5
 *                       description: 当前申请人数
 *                     maxApplicants:
 *                       type: number
 *                       example: 10
 *                       description: 最大申请人数限制
 *                     stats:
 *                       type: object
 *                       description: 统计信息
 *                       properties:
 *                         views:
 *                           type: integer
 *                           example: 256
 *                           description: 浏览次数
 *                         applications:
 *                           type: integer
 *                           example: 12
 *                           description: 申请次数
 *                         avgMatchScore:
 *                           type: number
 *                           example: 78.5
 *                           description: 平均匹配分数
 *                     publishedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-06T14:30:00.000Z"
 *                       description: 发布时间
 *                     closedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-06T14:30:00.000Z"
 *                       description: 关闭时间
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-06T12:00:00.000Z"
 *                       description: 创建时间
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-07T10:15:00.000Z"
 *                       description: 最后更新时间
 *             examples:
 *               normalJob:
 *                 summary: 正常展示公司名的职位
 *                 value:
 *                   code: 0
 *                   message: "获取职位详情成功"
 *                   data:
 *                     jobId: "job_20250806_e8e99862"
 *                     _id: "689d997b06a2b6de57744bb2"
 *                     title: "高级JAVA工程师"
 *                     companyId: "comp_20250101_a1b2c3d4"
 *                     companyName: "示例科技有限公司"
 *                     displayCompanyName: "示例科技有限公司"
 *                     showCompanyName: true
 *                     publisherId: "user_20250101_x1y2z3w4"
 *                     description: "负责公司核心产品的后端开发，包括架构设计、代码实现、性能优化等工作。"
 *                     descriptionLength: 80
 *                     descriptionLimit: 1000
 *                     requirements: ["本科及以上学历", "3年以上Java开发经验", "熟悉Spring Boot框架"]
 *                     location: "成都市高新区"
 *                     remote: false
 *                     workMode: "onsite"
 *                     workModeLabel: "现场办公"
 *                     salaryRange:
 *                       min: 300
 *                       max: 800
 *                       currency: "CNY"
 *                       period: "day"
 *                       periodLabel: "元/天"
 *                     salaryRangeText: "300-800 元/天"
 *                     contractType: "full-time"
 *                     contractTypeLabel: "全职"
 *                     experience:
 *                       min: 3
 *                       max: 5
 *                       unit: "years"
 *                     experienceLabel: "3-5年"
 *                     education: "bachelor"
 *                     educationLabel: "本科"
 *                     interviewTypes: ["technical-interview", "behavioral-interview"]
 *                     status: "published"
 *                     statusLabel: "已发布"
 *                     currentApplicants: 5
 *                     maxApplicants: 10
 *                     stats:
 *                       views: 256
 *                       applications: 12
 *                       avgMatchScore: 78.5
 *                     publishedAt: "2025-08-06T14:30:00.000Z"
 *                     createdAt: "2025-08-06T12:00:00.000Z"
 *                     updatedAt: "2025-08-07T10:15:00.000Z"
 *               anonymousJob:
 *                 summary: 匿名展示的职位
 *                 value:
 *                   code: 0
 *                   message: "获取职位详情成功"
 *                   data:
 *                     jobId: "job_20250807_f9e88761"
 *                     _id: "689d997b06a2b6de57744bb3"
 *                     title: "前端开发工程师"
 *                     companyId: "comp_20250101_a1b2c3d4"
 *                     displayCompanyName: "某互联网科技公司"
 *                     showCompanyName: false
 *                     publisherId: "user_20250101_x1y2z3w4"
 *                     description: "负责公司产品的前端开发，使用React技术栈，与设计师和后端工程师紧密合作。"
 *                     requirements: ["熟练掌握React", "2年以上前端开发经验"]
 *                     location: "北京市朝阳区"
 *                     workMode: "hybrid"
 *                     workModeLabel: "混合办公"
 *                     salaryRange:
 *                       min: 15000
 *                       max: 25000
 *                       currency: "CNY"
 *                       period: "month"
 *                       months: 13
 *                       monthsLabel: "13薪"
 *                       periodLabel: "元/月"
 *                     salaryRangeText: "15000-25000 元/月"
 *                     contractType: "full-time"
 *                     contractTypeLabel: "全职"
 *                     experience:
 *                       min: 2
 *                       max: 4
 *                       unit: "years"
 *                     experienceLabel: "2-4年"
 *                     education: "bachelor"
 *                     educationLabel: "本科"
 *                     interviewTypes: ["technical-interview"]
 *                     status: "published"
 *                     statusLabel: "已发布"
 *                     currentApplicants: 3
 *                     maxApplicants: 5
 *                     createdAt: "2025-08-07T09:00:00.000Z"
 *                     updatedAt: "2025-08-07T09:00:00.000Z"
 *       404:
 *         description: 职位不存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 404001
 *                 message:
 *                   type: string
 *                   example: "职位不存在"
 *                 detail:
 *                   type: string
 *                   example: "未找到指定的职位信息"
 *       403:
 *         description: 无权限访问该职位
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 403001
 *                 message:
 *                   type: string
 *                   example: "无权限"
 *                 detail:
 *                   type: string
 *                   example: "您无权访问该公司的职位信息"
 */

// ==================== 人工面试评分路由 ====================
// 注意：静态路由必须在动态路由 /:jobId 之前定义，否则会被错误匹配

/**
 * @swagger
 * /api/v1/job-b/manual-rating:
 *   put:
 *     tags:
 *       - B端-人工面试评分
 *     summary: 提交或更新人工面试评分
 *     description: B端对候选人的人工面试进行评分（1-10分，对应5颗星，支持半星）
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
 *               - rating
 *             properties:
 *               jobId:
 *                 type: string
 *                 description: 职位ID
 *                 example: "job_20251201_abc123"
 *               candidateId:
 *                 type: string
 *                 description: 候选人ID
 *                 example: "candidate_123"
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 10
 *                 description: 评分（1-10，对应半星到5星）
 *                 example: 7
 *               tagRatings:
 *                 type: array
 *                 description: 基于职位标签的评分（每项 1-3：差/一般/好，可选）
 *                 items:
 *                   type: object
 *                   required:
 *                     - tagId
 *                     - label
 *                     - category
 *                     - score
 *                   properties:
 *                     tagId:
 *                       type: string
 *                       description: 标签ID
 *                       example: "communication"
 *                     label:
 *                       type: string
 *                       description: 标签名称
 *                       example: "沟通表达"
 *                     category:
 *                       type: string
 *                       description: 标签分类
 *                       example: "universal"
 *                     score:
 *                       type: integer
 *                       minimum: 1
 *                       maximum: 3
 *                       description: 评分（1-3：差/一般/好）
 *                       example: 3
 *               comment:
 *                 type: string
 *                 maxLength: 500
 *                 description: 补充评价
 *                 example: "候选人技术基础不错，但架构经验偏少"
 *     responses:
 *       200:
 *         description: 评分提交成功
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
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_20251201_abc123"
 *                     candidateId:
 *                       type: string
 *                       example: "candidate_123"
 *                     rating:
 *                       type: integer
 *                       example: 7
 *                     tagRatings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           tagId:
 *                             type: string
 *                             example: "communication"
 *                           label:
 *                             type: string
 *                             example: "沟通表达"
 *                           category:
 *                             type: string
 *                             example: "universal"
 *                           score:
 *                             type: integer
 *                             example: 3
 *                     comment:
 *                       type: string
 *                       example: "候选人技术基础不错，但架构经验偏少"
 *                     ratedBy:
 *                       type: string
 *                       example: "user_456"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-22T10:30:00.000Z"
 *       400:
 *         description: 请求参数错误
 */
router.put(
    '/manual-rating',
    requirePermission('job:update'),
    validate(updateManualRatingSchema, 'body'),
    manualRatingController.upsertRating.bind(manualRatingController),
)

/**
 * @swagger
 * /api/v1/job-b/manual-rating:
 *   get:
 *     tags:
 *       - B端-人工面试评分
 *     summary: 查询人工面试评分
 *     description: 查询某个职位下某个候选人的人工面试评分
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 职位ID
 *         example: "job_20251201_abc123"
 *       - in: query
 *         name: candidateId
 *         required: true
 *         schema:
 *           type: string
 *         description: 候选人ID
 *         example: "candidate_123"
 *     responses:
 *       200:
 *         description: 查询成功
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
 *                   example: "success"
 *                 data:
 *                   type: object
 *                   nullable: true
 *                   description: 评分数据，未评分时为 null
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_20251201_abc123"
 *                     candidateId:
 *                       type: string
 *                       example: "candidate_123"
 *                     rating:
 *                       type: integer
 *                       example: 7
 *                     tagRatings:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           tagId:
 *                             type: string
 *                             example: "communication"
 *                           label:
 *                             type: string
 *                             example: "沟通表达"
 *                           category:
 *                             type: string
 *                             example: "universal"
 *                           score:
 *                             type: integer
 *                             example: 3
 *                     comment:
 *                       type: string
 *                       example: "候选人技术基础不错，但架构经验偏少"
 *                     ratedBy:
 *                       type: string
 *                       example: "user_456"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-12-22T10:30:00.000Z"
 *       400:
 *         description: 请求参数错误
 */
router.get(
    '/manual-rating',
    requirePermission('job:view'),
    validate(getManualRatingQuerySchema, 'query'),
    manualRatingController.getRating.bind(manualRatingController),
)

// ==================== 动态路由 /:jobId 开始 ====================

router.get('/:jobId', requirePermission('job:view'), validate(jobIdParamSchema, 'params'), jobController.getJobById.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/{jobId}:
 *   put:
 *     tags:
 *       - B端-职位管理
 *     summary: 更新职位
 *     description: 更新职位信息
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               department:
 *                 type: string
 *               description:
 *                 type: string
 *               requirements:
 *                 type: string
 *               location:
 *                 type: string
 *               remote:
 *                 type: boolean
 *               showCompanyName:
 *                 type: boolean
 *                 description: 是否显示公司真实名称（false时使用companyAlias）
 *               companyAlias:
 *                 type: string
 *                 description: 公司代称（匿名展示时使用）
 *                 maxLength: 100
 *               salaryRange:
 *                 type: object
 *               contractType:
 *                 type: string
 *               experienceLevel:
 *                 type: string
 *               interviewTypes:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 面试类型列表（用于评估系统，空数组会导致无法接收申请）
 *                 example: ["technical-interview", "behavioral-interview", "system-design"]
 *     responses:
 *       200:
 *         description: 更新成功
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
 *                   example: "职位更新成功"
 *                 data:
 *                   type: object
 *                   properties:
 *                     jobId:
 *                       type: string
 *                       example: "job_20250806_e8e99862"
 *                     _id:
 *                       type: string
 *                       example: "689d997b06a2b6de57744bb2"
 *                     title:
 *                       type: string
 *                       example: "高级JAVA工程师"
 *                     status:
 *                       type: string
 *                       example: "published"
 *                     interviewTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["technical-interview", "behavioral-interview"]
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-06T14:30:00.000Z"
 *       404:
 *         description: 职位不存在
 */
router.put(
    '/:jobId',
    requirePermission('job:update'),
    validate(jobIdParamSchema, 'params'),
    validate(updateJobSchema, 'body'),
    jobController.updateJob.bind(jobController),
)

/**
 * @swagger
 * /api/v1/job-b/{jobId}/publish:
 *   post:
 *     tags:
 *       - B端-职位管理
 *     summary: 发布职位
 *     description: 将草稿状态的职位发布上线
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
 *         description: 发布成功
 *       400:
 *         description: 职位状态不允许发布
 *       404:
 *         description: 职位不存在
 */
router.post('/:jobId/publish', requirePermission('job:publish'), validate(jobIdParamSchema, 'params'), jobController.publishJob.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/{jobId}/duplicate:
 *   post:
 *     tags:
 *       - B端-职位管理
 *     summary: 复制职位
 *     description: 复制现有职位创建新的职位草稿
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 源职位ID
 *     responses:
 *       201:
 *         description: 复制成功，返回新职位信息
 *       404:
 *         description: 源职位不存在
 */
router.post('/:jobId/duplicate', requirePermission('job:create'), validate(jobIdParamSchema, 'params'), jobController.duplicateJob.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/{jobId}/ai-parsed:
 *   put:
 *     tags:
 *       - B端-职位管理
 *       - AI服务集成
 *     summary: 更新AI解析的职位描述和标签
 *     description: 供job-ai-service调用，更新职位的AI解析后描述和评价标签列表（至少提供一个字段）
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parsedDescription:
 *                 type: string
 *                 description: AI解析后的职位描述
 *                 maxLength: 10000
 *               parsedTagList:
 *                 type: array
 *                 description: AI解析出的职位评价标签列表
 *                 items:
 *                   type: object
 *                   required:
 *                     - id
 *                     - label
 *                     - category
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: 标签ID
 *                       example: "communication"
 *                     label:
 *                       type: string
 *                       description: 标签名称
 *                       example: "沟通表达"
 *                     category:
 *                       type: string
 *                       description: 标签分类
 *                       example: "universal"
 *     responses:
 *       200:
 *         description: 更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                   description: 职位ID
 *                 parsedDescription:
 *                   type: string
 *                   description: AI解析后的职位描述
 *                 parsedTagList:
 *                   type: array
 *                   description: AI解析出的评价标签列表
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       label:
 *                         type: string
 *                       category:
 *                         type: string
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                   description: 更新时间
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 职位不存在
 */
router.put('/:jobId/ai-parsed', validate(jobIdParamSchema, 'params'), jobController.updateParsedDescription.bind(jobController))
// Also support PATCH method for ai-parsed (job-ai-service uses PATCH)
router.patch('/:jobId/ai-parsed', validate(jobIdParamSchema, 'params'), jobController.updateParsedDescription.bind(jobController))

/**
 * @swagger
 * /api/v1/job-b/{jobId}/action:
 *   post:
 *     tags:
 *       - B端-职位管理
 *     summary: 执行职位操作
 *     description: 执行职位状态变更操作（暂停/恢复/关闭/删除）
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [pause, resume, close, delete]
 *                 description: 操作类型
 *               reason:
 *                 type: string
 *                 description: 操作原因（可选）
 *     responses:
 *       200:
 *         description: 操作成功
 *       400:
 *         description: 操作不允许
 *       404:
 *         description: 职位不存在
 */
router.post(
    '/:jobId/action',
    requirePermission(['job:update', 'job:publish', 'job:close', 'job:delete']),
    validate(jobIdParamSchema, 'params'),
    validate(jobActionSchema, 'body'),
    jobController.executeAction.bind(jobController),
)

// ==================== 岗位协作者 ====================

/**
 * @swagger
 * /api/v1/job-b/{jobId}/collaborators/search:
 *   get:
 *     tags:
 *       - B端-岗位协作者
 *     summary: 搜索同企业可分享用户
 *     description: 根据关键词搜索同企业的B端用户，用于添加协作者前的用户查找。已有协作者和所有者会被自动排除。
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
 *       - in: query
 *         name: keyword
 *         required: true
 *         schema:
 *           type: string
 *         description: 搜索关键词（用户名/邮箱）
 *     responses:
 *       200:
 *         description: 用户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   avatar:
 *                     type: string
 *                   position:
 *                     type: string
 *       404:
 *         description: 职位不存在或无权访问
 */
router.get(
    '/:jobId/collaborators/search',
    requireBUserType(),
    requireCompanyAssociation(),
    requireJobAccess(),
    collaboratorController.searchUsers.bind(collaboratorController),
)

/**
 * @swagger
 * /api/v1/job-b/{jobId}/collaborators:
 *   get:
 *     tags:
 *       - B端-岗位协作者
 *     summary: 获取协作者列表
 *     description: 返回岗位的所有协作者，包括所有者（role=owner）和协作者（role=collaborator），附带用户名/邮箱/头像信息。
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
 *         description: 协作者列表
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   userId:
 *                     type: string
 *                   role:
 *                     type: string
 *                     enum: [owner, collaborator]
 *                   permissions:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [manage, interview]
 *                   username:
 *                     type: string
 *                   email:
 *                     type: string
 *                   avatar:
 *                     type: string
 *                   grantedAt:
 *                     type: string
 *                     format: date-time
 *                     nullable: true
 *                   grantedBy:
 *                     type: string
 *                     nullable: true
 *       404:
 *         description: 职位不存在或无权访问
 */
router.get(
    '/:jobId/collaborators',
    requireBUserType(),
    requireCompanyAssociation(),
    requireJobAccess(),
    collaboratorController.getCollaborators.bind(collaboratorController),
)

/**
 * @swagger
 * /api/v1/job-b/{jobId}/collaborators:
 *   post:
 *     tags:
 *       - B端-岗位协作者
 *     summary: 添加协作者
 *     description: 将同企业用户添加为岗位协作者。不能添加自己、不能添加所有者、不能重复添加、不能添加其他公司的用户。单次最多添加20人。
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userIds
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 20
 *                 description: 要添加的用户ID列表
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [manage, interview]
 *                 description: 权限列表，默认全量权限
 *     responses:
 *       200:
 *         description: 批量添加结果
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       userId:
 *                         type: string
 *                       success:
 *                         type: boolean
 *                       error:
 *                         type: string
 *       404:
 *         description: 职位不存在或无权访问
 */
router.post(
    '/:jobId/collaborators',
    requireBUserType(),
    requireCompanyAssociation(),
    requireJobAccess(),
    collaboratorController.addCollaborators.bind(collaboratorController),
)

/**
 * @swagger
 * /api/v1/job-b/{jobId}/collaborators/{targetUserId}:
 *   delete:
 *     tags:
 *       - B端-岗位协作者
 *     summary: 移除协作者
 *     description: 将用户从岗位协作者中移除。不能移除岗位所有者。
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
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *         description: 要移除的用户ID
 *     responses:
 *       200:
 *         description: 移除成功
 *       404:
 *         description: 职位不存在或协作者不存在
 */
router.delete(
    '/:jobId/collaborators/:targetUserId',
    requireBUserType(),
    requireCompanyAssociation(),
    requireJobAccess(),
    collaboratorController.removeCollaborator.bind(collaboratorController),
)

export default router
