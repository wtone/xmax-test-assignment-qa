/**
 * 路由入口文件
 * @module routes/index
 */

import Router from 'koa-router'
import metadataRoutes from './metadata.routes.js'
import healthRoutes from './health.routes.js'
import jobRoutes from './job.routes.js'
import jobBrowseRoutes from './job-browse.routes.js'
import applicationRoutes from './application.routes.js'
import contractRoutes from './contract.routes.js'
import candidateApplicationRoutes from './candidate-application.routes.js'
import optionsRoutes from './options_routes.js'

// 创建主路由器
const router = new Router()

// API版本前缀
const API_V1_PREFIX = '/api/v1'

// 注册元数据路由（带API前缀）
router.use(API_V1_PREFIX, metadataRoutes.routes(), metadataRoutes.allowedMethods())

// 注册健康检查路由（不带API前缀，直接在根路径下）
router.use('/health', healthRoutes.routes(), healthRoutes.allowedMethods())

// 注册B端职位管理路由（已包含/api/v1/job前缀）
router.use('', jobRoutes.routes(), jobRoutes.allowedMethods())

// 注册C端职位浏览路由（已包含/api/v1/jobs前缀）
router.use('', jobBrowseRoutes.routes(), jobBrowseRoutes.allowedMethods())

// 注册其他业务路由
router.use(API_V1_PREFIX, applicationRoutes.routes(), applicationRoutes.allowedMethods())
router.use(API_V1_PREFIX, contractRoutes.routes(), contractRoutes.allowedMethods())
router.use(API_V1_PREFIX, candidateApplicationRoutes.routes(), candidateApplicationRoutes.allowedMethods())

// 注册选项路由（已包含/api/v1/job-options前缀）
router.use('', optionsRoutes.routes(), optionsRoutes.allowedMethods())

/**
 * 根路径处理
 */
router.get('/', async ctx => {
    ctx.body = {
        service: 'xmax-job-service',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        endpoints: {
            metadata: `${API_V1_PREFIX}/metadata`,
            health: '/health',
            swagger: '/swagger',
        },
    }
})

/**
 * 404 处理
 */
router.all('(.*)', async ctx => {
    ctx.status = 404
    ctx.body = {
        success: false,
        error: {
            code: 1004,
            message: '请求的资源不存在',
            path: ctx.path,
            method: ctx.method,
        },
    }
})

export default router
