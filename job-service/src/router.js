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
import manualCandidateRoutes from './routes/manualCandidateRoutes.js'
import { appointmentRouterB, appointmentRouterC } from './routes/appointment.routes.js'
import internalJobRoutes from './routes/internalJob.routes.js'
import shadowApplicationInternalRoutes from './routes/shadowApplication.internal.routes.js'
import shadowApplicationRoutes from './routes/shadowApplication.routes.js'

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

// 内部服务API路由 (k8s内网调用，不需要认证) - 必须在认证路由之前注册
apiRouter.use(internalJobRoutes.routes(), internalJobRoutes.allowedMethods())
apiRouter.use(shadowApplicationInternalRoutes.routes(), shadowApplicationInternalRoutes.allowedMethods())

// 注册业务路由到 API 路由器
// 注意: 更具体的路由需要先注册，避免被通配符路由拦截
apiRouter.use(manualCandidateRoutes.routes(), manualCandidateRoutes.allowedMethods()) // 手动录入候选人（先注册，避免被 /job-b/:jobId 拦截）
apiRouter.use(jobRoutes.routes(), jobRoutes.allowedMethods()) // B端职位管理
apiRouter.use(jobBrowseRoutes.routes(), jobBrowseRoutes.allowedMethods()) // C端职位浏览
apiRouter.use(applicationRoutes.routes(), applicationRoutes.allowedMethods()) // B端申请管理
apiRouter.use(candidateApplicationRoutes.routes(), candidateApplicationRoutes.allowedMethods()) // C端申请管理
apiRouter.use(contractRoutes.routes(), contractRoutes.allowedMethods()) // 合同管理
apiRouter.use(optionsRoutes.routes(), optionsRoutes.allowedMethods()) // 选项API
apiRouter.use(shadowApplicationRoutes.routes(), shadowApplicationRoutes.allowedMethods()) // B端影子人才邀请
apiRouter.use(appointmentRouterB.routes(), appointmentRouterB.allowedMethods()) // B端面试预约
apiRouter.use(appointmentRouterC.routes(), appointmentRouterC.allowedMethods()) // C端面试预约

// 将 API 路由器挂载到主路由器
router.use(apiRouter.routes(), apiRouter.allowedMethods())

// 注册测试路由（仅开发环境）
if (process.env.NODE_ENV !== 'production') {
    router.use(testRoutes.routes(), testRoutes.allowedMethods())
    router.use(jobSimpleRoutes.routes(), jobSimpleRoutes.allowedMethods())
}

export default router
