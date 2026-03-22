import Router from 'koa-router'
import { createSuccessResponse } from '../../utils/response.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJson = JSON.parse(readFileSync(path.join(__dirname, '../../package.json'), 'utf8'))

const router = new Router()

/**
 * @swagger
 * /api/v1/metadata:
 *   get:
 *     tags:
 *       - 服务元数据
 *     summary: 获取服务元数据
 *     description: 返回服务的名称、版本、应用代码、路由信息和依赖状态
 *     responses:
 *       200:
 *         description: 成功返回服务元数据
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 */
router.get('/', ctx => {
    // 动态收集所有路由信息
    const routes = [
        // 基础路由
        {
            method: 'GET',
            path: '/health',
            description: '健康检查',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/metadata',
            description: '服务元数据',
            authentication: false,
            permissions: [],
        },
        // B端职位管理
        {
            method: 'POST',
            path: '/api/v1/job-b',
            description: 'B端-创建职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/job-b',
            description: 'B端-获取职位列表',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/job-b/:jobId',
            description: 'B端-获取职位详情',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'PUT',
            path: '/api/v1/job-b/:jobId',
            description: 'B端-更新职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/job-b/:jobId/publish',
            description: 'B端-发布职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/job-b/:jobId/close',
            description: 'B端-关闭职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'DELETE',
            path: '/api/v1/job-b/:jobId',
            description: 'B端-删除职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/job-b/batch',
            description: 'B端-批量操作职位',
            authentication: true,
            permissions: ['B_USER'],
        },
        // C端职位浏览
        {
            method: 'GET',
            path: '/api/v1/job-c/search',
            description: 'C端-搜索职位',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/popular',
            description: 'C端-热门职位',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/recommendations',
            description: 'C端-推荐职位',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/categories',
            description: 'C端-职位分类',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/salary-distribution',
            description: 'C端-薪资分布',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/:jobId',
            description: 'C端-职位详情',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-c/:jobId/similar',
            description: 'C端-相似职位',
            authentication: false,
            permissions: [],
        },
        // B端申请管理
        {
            method: 'GET',
            path: '/api/v1/applications',
            description: 'B端-获取申请列表',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/applications/:applicationId',
            description: 'B端-获取申请详情',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'PUT',
            path: '/api/v1/applications/:applicationId/status',
            description: 'B端-更新申请状态',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/applications/batch-status',
            description: 'B端-批量更新申请状态',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/applications/:applicationId/resume',
            description: 'B端-查看申请简历',
            authentication: true,
            permissions: ['B_USER'],
        },
        // C端申请管理
        {
            method: 'POST',
            path: '/api/v1/candidate/applications',
            description: 'C端-提交申请',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/candidate/applications',
            description: 'C端-我的申请列表',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/candidate/applications/:applicationId',
            description: 'C端-申请详情',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'PUT',
            path: '/api/v1/candidate/applications/:applicationId/withdraw',
            description: 'C端-撤回申请',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/candidate/interviews',
            description: 'C端-面试安排',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/candidate/interviews/:interviewId',
            description: 'C端-面试详情',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'PUT',
            path: '/api/v1/candidate/interviews/:interviewId/response',
            description: 'C端-响应面试邀请',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/candidate/interviews/:interviewId/feedback',
            description: 'C端-提交面试反馈',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/candidate/application-stats',
            description: 'C端-申请统计',
            authentication: true,
            permissions: ['C_USER'],
        },
        // 合同管理
        {
            method: 'POST',
            path: '/api/v1/contracts',
            description: '创建录用通知',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/contracts',
            description: '获取合同列表',
            authentication: true,
            permissions: ['B_USER', 'C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/contracts/stats',
            description: '合同统计',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/contracts/:contractId',
            description: '获取合同详情',
            authentication: true,
            permissions: ['B_USER', 'C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/send',
            description: '发送合同',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/accept',
            description: '接受录用',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/reject',
            description: '拒绝录用',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/negotiate',
            description: '协商录用条件',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/sign',
            description: '签署合同',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/:contractId/cancel',
            description: '撤回录用',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/contracts/batch',
            description: '批量创建录用通知',
            authentication: true,
            permissions: ['B_USER'],
        },
        // B端面试预约
        {
            method: 'POST',
            path: '/api/v1/appointment-b',
            description: 'B端-创建面试预约',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-b',
            description: 'B端-获取面试预约列表',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-b/stats',
            description: 'B端-面试预约统计',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-b/:appointmentId',
            description: 'B端-获取面试预约详情',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-b/:appointmentId/select-time',
            description: 'B端-选择改期时间（同意C端提议的时间）',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-b/:appointmentId/reschedule',
            description: 'B端-提供新时间段（循环协商）',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-b/:appointmentId/cancel',
            description: 'B端-取消面试预约',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-b/:appointmentId/complete',
            description: 'B端-完成面试',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-b/:appointmentId/no-show',
            description: 'B端-标记缺席',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'PUT',
            path: '/api/v1/appointment-b/:appointmentId/schedule',
            description: 'B端-手动安排面试时间',
            authentication: true,
            permissions: ['B_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-b/:appointmentId/meeting',
            description: 'B端-获取会议信息',
            authentication: true,
            permissions: ['B_USER'],
        },
        // C端面试预约
        {
            method: 'GET',
            path: '/api/v1/appointment-c/invite/:token',
            description: 'C端-通过邀请链接获取预约详情（公开）',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-c',
            description: 'C端-获取我的面试预约列表',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-c/:appointmentId',
            description: 'C端-获取面试预约详情',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-c/:appointmentId/select-time',
            description: 'C端-选择面试时间',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-c/:appointmentId/reschedule',
            description: 'C端-请求改期',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-c/:appointmentId/reject',
            description: 'C端-拒绝面试邀请',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'POST',
            path: '/api/v1/appointment-c/:appointmentId/cancel',
            description: 'C端-取消面试',
            authentication: true,
            permissions: ['C_USER'],
        },
        {
            method: 'GET',
            path: '/api/v1/appointment-c/:appointmentId/meeting',
            description: 'C端-获取会议信息',
            authentication: true,
            permissions: ['C_USER'],
        },
        // 选项数据路由 (公开接口)
        {
            method: 'GET',
            path: '/api/v1/job-options/job',
            description: '获取职位相关选项',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/contract-types',
            description: '获取职位类型选项',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/education-levels',
            description: '获取学历选项',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/work-modes',
            description: '获取办公方式选项',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/experience',
            description: '获取工作经验选项',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/cities',
            description: '获取城市列表',
            authentication: false,
            permissions: [],
        },
        {
            method: 'GET',
            path: '/api/v1/job-options/interview-pricing',
            description: '获取面试服务阶梯定价',
            authentication: false,
            permissions: [],
        },
        // B端-影子人才
        {
            method: 'POST',
            path: '/api/v1/internal/shadow-applications',
            description: '推送影子候选人（内部服务调用）',
            authentication: false,
            permissions: [],
        },
        {
            method: 'POST',
            path: '/api/v1/shadow-applications/:shadowApplicationId/invite',
            description: 'B端-邀请影子候选人投递',
            authentication: true,
            permissions: ['B_USER'],
        },
        // API文档
        {
            method: 'GET',
            path: '/swagger',
            description: 'Swagger API文档',
            authentication: false,
            permissions: [],
        },
    ]

    ctx.body = createSuccessResponse({
        name: packageJson.name || 'xmax-job-service',
        version: packageJson.version || '1.0.0',
        appName: process.env.APP_NAME || 'xmax-job-service',
        appId: process.env.APP_ID || process.env.APP_NAME || 'xmax-job-service',
        appCode: parseInt(process.env.APP_CODE) || 3006,
        description: '职位管理服务 - 管理职位发布、申请和合同',
        totalRoutes: routes.length,
        routes,
        dependencies: [
            {
                name: 'MongoDB',
                status: 'connected',
                version: '5.0+',
            },
            {
                name: 'Redis',
                status: 'connected',
                version: '6.0+',
            },
            {
                name: 'User Center Service',
                status: 'configured',
                url: process.env.USER_CENTER_URL || 'http://localhost:3001',
            },
            {
                name: 'Resume Service',
                status: 'configured',
                url: process.env.RESUME_SERVICE_URL || 'http://localhost:3002',
            },
            {
                name: 'AI Service',
                status: 'configured',
                url: process.env.AI_SERVICE_URL || 'http://localhost:3003',
            },
            {
                name: 'OSS Service',
                status: 'configured',
                url: process.env.OSS_SERVICE_URL || 'http://localhost:3004',
            },
            {
                name: 'Interview Service',
                status: 'configured',
                url: process.env.INTERVIEW_SERVICE_URL || 'http://localhost:3006',
            },
            {
                name: 'Notification Service',
                status: 'configured',
                url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
            },
        ],
        features: [
            'B端职位管理（创建、更新、发布、批量操作）',
            'C端职位浏览（搜索、推荐、热门、分类）',
            'B端候选人管理（申请审核、状态更新、简历查看）',
            'C端申请管理（申请提交、撤回、面试管理）',
            '合同管理（录用通知、接受、拒绝、协商、签署）',
            'B端面试预约（创建预约、响应改期、取消、完成、标记缺席）',
            'C端面试预约（选择时间、请求改期、拒绝、获取会议信息）',
            '火山引擎veRTC视频会议集成',
            '微服务集成（用户中心、简历、AI、面试、通知）',
            'Swagger API文档',
            'JWT认证和RBAC权限控制',
        ],
    })
})

export default router
