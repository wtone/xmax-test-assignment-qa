/**
 * C端职位浏览路由
 * @module routes/job-browse
 */

import Router from 'koa-router'
import jobBrowseController from '../controllers/jobBrowseController.js'

const router = new Router({
    prefix: '/job-c',
})

/**
 * @swagger
 * /api/v1/job-c/search:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 搜索职位
 *     description: 根据关键词、地点、薪资等条件搜索职位
 *     parameters:
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 搜索关键词
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: 工作地点
 *       - in: query
 *         name: remote
 *         schema:
 *           type: boolean
 *         description: 是否远程
 *       - in: query
 *         name: salaryMin
 *         schema:
 *           type: number
 *         description: 最低薪资
 *       - in: query
 *         name: salaryMax
 *         schema:
 *           type: number
 *         description: 最高薪资
 *       - in: query
 *         name: contractType
 *         schema:
 *           type: string
 *           enum: [full-time, part-time, freelance, internship]
 *       - in: query
 *         name: experience
 *         schema:
 *           type: number
 *         description: 工作经验年限
 *       - in: query
 *         name: education
 *         schema:
 *           type: string
 *           enum: [high-school, associate, bachelor, master, doctorate]
 *       - in: query
 *         name: skills
 *         schema:
 *           type: string
 *         description: 技能要求（逗号分隔）
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [publishedAt, salary, viewCount]
 *           default: publishedAt
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
 *         description: 职位列表
 */
router.get('/search', jobBrowseController.searchJobs.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/popular:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取热门职位
 *     description: 获取当前热门的职位列表
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 职位类别
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: 地点
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 热门职位列表
 */
router.get('/popular', jobBrowseController.getPopularJobs.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/recommendations:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取推荐职位
 *     description: 基于用户画像和行为获取推荐职位（登录用户个性化推荐，未登录用户热门推荐）
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: 推荐职位列表
 */
router.get('/recommendations', jobBrowseController.getRecommendations.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/categories:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取职位分类
 *     description: 获取所有职位分类及数量统计
 *     responses:
 *       200:
 *         description: 职位分类列表
 */
router.get('/categories', jobBrowseController.getJobCategories.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/salary-distribution:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取薪资分布
 *     description: 获取指定条件下的薪资分布统计
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: 职位类别
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: 地点
 *       - in: query
 *         name: experience
 *         schema:
 *           type: number
 *         description: 工作经验
 *     responses:
 *       200:
 *         description: 薪资分布数据
 */
router.get('/salary-distribution', jobBrowseController.getSalaryDistribution.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/official/hiring:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取官网招聘职位（免登录）
 *     description: |
 *       获取指定B端用户（默认为官方账号）所属公司的正在招聘职位列表。
 *       用于公司官网「加入我们」模块展示。
 *       - 无需登录即可访问
 *       - email 参数可选，默认使用环境变量配置的官方账号
 *     parameters:
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *           format: email
 *         description: B端用户邮箱（可选，默认为官方账号 hr@example.com）
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: 每页数量（最大50）
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           default: -publishedAt
 *           enum: [publishedAt, -publishedAt, title, -title]
 *         description: 排序字段（-表示降序）
 *     responses:
 *       200:
 *         description: 成功获取职位列表
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
 *                   example: success
 *                 data:
 *                   type: object
 *                   properties:
 *                     company:
 *                       type: object
 *                       properties:
 *                         companyId:
 *                           type: string
 *                         name:
 *                           type: string
 *                         logo:
 *                           type: string
 *                     jobs:
 *                       type: array
 *                       items:
 *                         type: object
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       400:
 *         description: 请求参数错误
 *       404:
 *         description: 用户不存在或无关联公司
 */
router.get('/official/hiring', jobBrowseController.getOfficialHiringJobs.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/{jobId}:
 *   get:
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取职位详情
 *     description: 获取职位的公开信息（登录用户会返回是否已申请状态和候选人基本信息）
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
 *                   type: number
 *                   example: 0
 *                   description: 响应状态码，0表示成功
 *                 message:
 *                   type: string
 *                   example: "Success"
 *                   description: 响应消息
 *                 data:
 *                   type: object
 *                   description: 职位公开数据（C端展示）
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
 *                       example: "高级前端开发工程师"
 *                       description: 职位名称
 *                     displayCompanyName:
 *                       type: string
 *                       example: "示例科技有限公司"
 *                       description: 显示的公司名称（根据showCompanyName决定显示真名或代称）
 *                     showCompanyName:
 *                       type: boolean
 *                       example: true
 *                       description: 是否显示真实公司名
 *                     description:
 *                       type: string
 *                       example: "负责公司核心产品的前端开发，使用React/Vue技术栈，与设计师和后端工程师紧密合作，确保产品用户体验的极致性。"
 *                       description: 职位描述
 *                     descriptionLength:
 *                       type: integer
 *                       example: 85
 *                       description: 描述字符长度
 *                     descriptionLimit:
 *                       type: integer
 *                       example: 1000
 *                       description: 描述字符限制
 *                     requirements:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["本科及以上学历", "3年以上前端开发经验", "精通React或Vue框架", "熟悉TypeScript"]
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
 *                       example: "hybrid"
 *                       enum: [onsite, remote, hybrid]
 *                       description: 工作模式
 *                     workModeLabel:
 *                       type: string
 *                       example: "混合办公"
 *                       description: 工作模式中文标签
 *                     salaryRange:
 *                       type: object
 *                       description: 薪资范围
 *                       properties:
 *                         min:
 *                           type: number
 *                           example: 15000
 *                           description: 最低薪资
 *                         max:
 *                           type: number
 *                           example: 25000
 *                           description: 最高薪资
 *                         currency:
 *                           type: string
 *                           example: "CNY"
 *                           enum: [CNY, USD, EUR]
 *                           description: 货币类型
 *                         period:
 *                           type: string
 *                           example: "month"
 *                           enum: [hour, day, month, year]
 *                           description: 计薪周期
 *                         periodLabel:
 *                           type: string
 *                           example: "元/月"
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
 *                       example: "15000-25000 元/月"
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
 *                           example: 12
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
 *                       example: "12 个月"
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
 *                     interviewTypes:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["technical-interview", "behavioral-interview"]
 *                       description: 面试类型列表
 *                     status:
 *                       type: string
 *                       example: "published"
 *                       enum: [draft, published, paused, closed]
 *                       description: 职位状态（仅显示published的职位）
 *                     statusLabel:
 *                       type: string
 *                       example: "已发布"
 *                       description: 职位状态中文标签
 *                     currentApplicants:
 *                       type: number
 *                       example: 8
 *                       description: 当前申请人数
 *                     maxApplicants:
 *                       type: number
 *                       example: 20
 *                       description: 最大申请人数限制
 *                     stats:
 *                       type: object
 *                       description: 统计信息
 *                       properties:
 *                         views:
 *                           type: integer
 *                           example: 512
 *                           description: 浏览次数
 *                         applications:
 *                           type: integer
 *                           example: 23
 *                           description: 申请次数
 *                         avgMatchScore:
 *                           type: number
 *                           example: 82.3
 *                           description: 平均匹配分数
 *                     publishedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-06T14:30:00.000Z"
 *                       description: 发布时间
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-08-07T10:15:00.000Z"
 *                       description: 最后更新时间
 *                     hasApplied:
 *                       type: boolean
 *                       example: false
 *                       description: 用户是否已申请该职位（仅登录用户）
 *                     candidate:
 *                       type: object
 *                       description: 候选人基本信息（仅登录用户）
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: "user_20250101_abc12345"
 *                           description: 用户ID
 *                         name:
 *                           type: string
 *                           example: "张三"
 *                           description: 姓名
 *                         email:
 *                           type: string
 *                           example: "zhangsan@example.com"
 *                           description: 邮箱
 *                         phone:
 *                           type: string
 *                           example: "13800138000"
 *                           description: 手机号
 *                         avatar:
 *                           type: string
 *                           example: "https://example.com/avatar/user123.jpg"
 *                           description: 头像URL
 *                         title:
 *                           type: string
 *                           example: "前端开发工程师"
 *                           description: 当前职位
 *                         summary:
 *                           type: string
 *                           example: "5年前端开发经验，擅长React和Vue框架"
 *                           description: 个人简介
 *                         location:
 *                           type: string
 *                           example: "成都市"
 *                           description: 所在地
 *                         experience:
 *                           type: object
 *                           example: {"years": 5, "companies": 3}
 *                           description: 工作经验信息
 *                         education:
 *                           type: object
 *                           example: {"degree": "bachelor", "major": "计算机科学"}
 *                           description: 教育背景
 *                         skills:
 *                           type: array
 *                           items:
 *                             type: string
 *                           example: ["JavaScript", "React", "Vue", "TypeScript", "Node.js"]
 *                           description: 技能列表
 *                         isProfileComplete:
 *                           type: boolean
 *                           example: true
 *                           description: 个人资料是否完整
 *             examples:
 *               guestUser:
 *                 summary: 游客访问（未登录）
 *                 value:
 *                   code: 0
 *                   message: "Success"
 *                   data:
 *                     jobId: "job_20250806_e8e99862"
 *                     _id: "689d997b06a2b6de57744bb2"
 *                     title: "高级前端开发工程师"
 *                     displayCompanyName: "示例科技有限公司"
 *                     showCompanyName: true
 *                     description: "负责公司核心产品的前端开发，使用React/Vue技术栈。"
 *                     descriptionLength: 65
 *                     descriptionLimit: 1000
 *                     requirements: ["本科及以上学历", "3年以上前端开发经验", "精通React或Vue框架"]
 *                     location: "成都市高新区"
 *                     remote: false
 *                     workMode: "hybrid"
 *                     workModeLabel: "混合办公"
 *                     salaryRange:
 *                       min: 15000
 *                       max: 25000
 *                       currency: "CNY"
 *                       period: "month"
 *                       periodLabel: "元/月"
 *                       months: 13
 *                       monthsLabel: "13薪"
 *                     salaryRangeText: "15000-25000 元/月 · 13薪"
 *                     contractType: "full-time"
 *                     contractTypeLabel: "全职"
 *                     experience:
 *                       min: 3
 *                       max: 5
 *                       unit: "years"
 *                     experienceLabel: "3-5年"
 *                     education: "bachelor"
 *                     educationLabel: "本科"
 *                     interviewTypes: ["technical-interview"]
 *                     status: "published"
 *                     statusLabel: "已发布"
 *                     currentApplicants: 8
 *                     maxApplicants: 20
 *                     stats:
 *                       views: 512
 *                       applications: 23
 *                       avgMatchScore: 82.3
 *                     publishedAt: "2025-08-06T14:30:00.000Z"
 *                     updatedAt: "2025-08-07T10:15:00.000Z"
 *               loggedInUserNotApplied:
 *                 summary: 登录用户访问（未申请）
 *                 value:
 *                   code: 0
 *                   message: "Success"
 *                   data:
 *                     jobId: "job_20250806_e8e99862"
 *                     _id: "689d997b06a2b6de57744bb2"
 *                     title: "高级前端开发工程师"
 *                     displayCompanyName: "示例科技有限公司"
 *                     showCompanyName: true
 *                     description: "负责公司核心产品的前端开发，使用React/Vue技术栈。"
 *                     requirements: ["本科及以上学历", "3年以上前端开发经验"]
 *                     location: "成都市高新区"
 *                     workMode: "hybrid"
 *                     workModeLabel: "混合办公"
 *                     salaryRange:
 *                       min: 15000
 *                       max: 25000
 *                       currency: "CNY"
 *                       period: "month"
 *                     salaryRangeText: "15000-25000 元/月"
 *                     contractType: "full-time"
 *                     contractTypeLabel: "全职"
 *                     experienceLabel: "3-5年"
 *                     educationLabel: "本科"
 *                     status: "published"
 *                     currentApplicants: 8
 *                     maxApplicants: 20
 *                     hasApplied: false
 *                     candidate:
 *                       id: "user_20250101_abc12345"
 *                       name: "张三"
 *                       email: "zhangsan@example.com"
 *                       phone: "13800138000"
 *                       avatar: "https://example.com/avatar/user123.jpg"
 *                       title: "前端开发工程师"
 *                       summary: "5年前端开发经验，擅长React和Vue框架"
 *                       location: "成都市"
 *                       skills: ["JavaScript", "React", "Vue"]
 *                       isProfileComplete: true
 *               loggedInUserApplied:
 *                 summary: 登录用户访问（已申请）
 *                 value:
 *                   code: 0
 *                   message: "Success"
 *                   data:
 *                     jobId: "job_20250806_e8e99862"
 *                     _id: "689d997b06a2b6de57744bb2"
 *                     title: "高级前端开发工程师"
 *                     displayCompanyName: "示例科技有限公司"
 *                     showCompanyName: true
 *                     description: "负责公司核心产品的前端开发，使用React/Vue技术栈。"
 *                     requirements: ["本科及以上学历", "3年以上前端开发经验"]
 *                     location: "成都市高新区"
 *                     salaryRangeText: "15000-25000 元/月"
 *                     contractTypeLabel: "全职"
 *                     experienceLabel: "3-5年"
 *                     educationLabel: "本科"
 *                     status: "published"
 *                     hasApplied: true
 *                     candidate:
 *                       id: "user_20250101_abc12345"
 *                       name: "张三"
 *                       isProfileComplete: true
 *               anonymousCompany:
 *                 summary: 匿名公司职位
 *                 value:
 *                   code: 0
 *                   message: "Success"
 *                   data:
 *                     jobId: "job_20250807_f9e88761"
 *                     _id: "689d997b06a2b6de57744bb3"
 *                     title: "Java开发工程师"
 *                     displayCompanyName: "某互联网科技公司"
 *                     showCompanyName: false
 *                     description: "负责后端服务开发，参与系统架构设计。"
 *                     requirements: ["本科学历", "2年以上Java开发经验"]
 *                     location: "北京市朝阳区"
 *                     salaryRangeText: "20000-30000 元/月"
 *                     contractTypeLabel: "全职"
 *                     experienceLabel: "2-4年"
 *                     educationLabel: "本科"
 *                     status: "published"
 *                     currentApplicants: 15
 *                     maxApplicants: 30
 *       404:
 *         description: 职位不存在或已下架
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
 *                   example: "该职位不存在或已下架"
 */
router.get('/:jobId', jobBrowseController.getJobDetail.bind(jobBrowseController))

/**
 * @swagger
 * /api/v1/job-c/{jobId}/similar:
 *   get:
 *     deprecated: true
 *     tags:
 *       - C端-职位浏览
 *     summary: 获取相似职位
 *     description: 基于当前职位获取相似的其他职位
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 职位ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 5
 *     responses:
 *       200:
 *         description: 相似职位列表
 */
router.get('/:jobId/similar', jobBrowseController.getSimilarJobs.bind(jobBrowseController))

export default router
