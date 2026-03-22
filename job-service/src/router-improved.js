/**
 * 路由器改进版示例
 *
 * 这是一个使用嵌套路由器模式的改进方案示例。
 * 相比原版本，这种方式更加简洁和优雅。
 *
 * 主要改进：
 * 1. 使用嵌套路由器（apiRouter）管理所有 API 路由
 * 2. 避免重复写 API_PREFIX
 * 3. 更清晰的层次结构
 * 4. 测试路由基于环境变量条件加载
 */

import Router from 'koa-router'
import { swaggerSpec } from '../utils/swagger.js'

// 导入路由模块
import jobRoutes from './routes/job.routes.js'
import jobBrowseRoutes from './routes/job-browse.routes.js'
import applicationRoutes from './routes/application.routes.js'
import candidateApplicationRoutes from './routes/candidate-application.routes.js'
import contractRoutes from './routes/contract.routes.js'
import healthRoutes from './routes/health.routes.js'
import metadataRoutes from './routes/metadata.routes.js'
import testRoutes from './routes/test.routes.js'
import jobSimpleRoutes from './routes/job-simple.routes.js'
import optionsRoutes from './routes/options_routes.js'

// 主路由器
const router = new Router()

// API 版本前缀 - 支持环境变量配置
const API_PREFIX = process.env.API_PREFIX || '/api/v1'

// 创建 API 路由器（使用前缀）
const apiRouter = new Router({ prefix: API_PREFIX })

// 注册基础路由（不需要版本前缀的）
router.use('/health', healthRoutes.routes(), healthRoutes.allowedMethods())

// 元数据路由（注册到 API 路由器）
apiRouter.use('/metadata', metadataRoutes.routes(), metadataRoutes.allowedMethods())

// 注册业务路由到 API 路由器
apiRouter.use(jobRoutes.routes(), jobRoutes.allowedMethods()) // B端职位管理
apiRouter.use(jobBrowseRoutes.routes(), jobBrowseRoutes.allowedMethods()) // C端职位浏览
apiRouter.use(applicationRoutes.routes(), applicationRoutes.allowedMethods()) // B端申请管理
apiRouter.use(candidateApplicationRoutes.routes(), candidateApplicationRoutes.allowedMethods()) // C端申请管理
apiRouter.use(contractRoutes.routes(), contractRoutes.allowedMethods()) // 合同管理
apiRouter.use(optionsRoutes.routes(), optionsRoutes.allowedMethods()) // 选项API

// 将 API 路由器挂载到主路由器
router.use(apiRouter.routes(), apiRouter.allowedMethods())

// 注册测试路由（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
    router.use(testRoutes.routes(), testRoutes.allowedMethods())
    router.use(jobSimpleRoutes.routes(), jobSimpleRoutes.allowedMethods())
}

export default router
