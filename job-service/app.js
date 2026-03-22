/**
 * XMAX Job Service - 应用入口
 */

import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import cors from 'koa-cors'
import serve from 'koa-static'
import dotenv from 'dotenv'
import { koaSwagger } from 'koa2-swagger-ui'
import path from 'path'
import { fileURLToPath } from 'url'
import { normalizeBodyParserLimit } from './utils/bodyParserLimit.js'

// 必须先加载环境变量，再导入使用环境变量的模块
dotenv.config()

const BODY_PARSER_LIMIT = normalizeBodyParserLimit(process.env.BODY_PARSER_LIMIT)

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

import logger from './utils/logger.js'
import connectMongo from './utils/mongo.js'
import connectRedis from './utils/redis.js'
import { swaggerSpec } from './utils/swagger.js'

// 导入中间件
import errorHandler from './middlewares/error-handler.js'
import requestLogger from './middlewares/logger.js'
import responseFormatter from './middlewares/response.js'
import traceId from './middlewares/trace-id.js'

// 导入路由
import mainRouter from './src/router.js'

// 导入 veRTC 服务（用于启动时验证配置）
import VerTCService from './src/services/integration/VerTCService.js'

// 导入调度器管理模块
import { startSchedulers, stopSchedulers } from './src/schedulers/index.js'

class Application {
    constructor() {
        this.app = new Koa()
        this.PORT = process.env.PORT || 3005
    }

    async initDatabase() {
        try {
            logger.info('Connecting to databases:mongo...')
            await connectMongo()
            logger.info('Connecting to databases:redis...')
            const redis = await connectRedis()
            this.app.context.redis = redis
            logger.info('All databases connected successfully')

            // 启动所有调度器
            startSchedulers()
        } catch (error) {
            logger.error('Database connection failed:', error)
            process.exit(1)
        }
    }

    setupSwagger() {
        // Swagger JSON endpoint
        this.app.use(async (ctx, next) => {
            if (ctx.path === '/swagger/json') {
                ctx.type = 'application/json'
                ctx.body = swaggerSpec
                return
            }
            await next()
        })

        // Swagger UI
        this.app.use(
            koaSwagger({
                routePrefix: '/swagger',
                swaggerOptions: {
                    spec: swaggerSpec,
                    docExpansion: 'none',
                    persistAuthorization: true,
                },
            }),
        )
    }

    setupRoutes() {
        // 主路由
        this.app.use(mainRouter.routes())
        this.app.use(mainRouter.allowedMethods())
    }

    async start() {
        try {
            // 验证 veRTC 配置（在连接数据库前验证，快速失败）
            await VerTCService.validateOnStartup()

            // 初始化数据库
            await this.initDatabase()

            // 设置基础中间件
            this.app.use(cors())
            this.app.use(
                bodyParser({
                    enableTypes: ['json', 'form', 'text'],
                    jsonLimit: BODY_PARSER_LIMIT,
                    formLimit: BODY_PARSER_LIMIT,
                    textLimit: BODY_PARSER_LIMIT,
                })
            )
            this.app.use(traceId)
            this.app.use(requestLogger)

            // 配置静态文件服务
            this.app.use(serve(path.join(__dirname, 'public')))

            // 错误处理中间件（必须在最外层，才能捕获所有内部错误）
            this.app.use(
                errorHandler({
                    logErrors: true,
                    exposeStack: process.env.NODE_ENV === 'development',
                }),
            )

            // 设置 Swagger（必须在 responseFormatter 之前）
            this.setupSwagger()

            // 设置响应格式化中间件（在 Swagger 之后）
            this.app.use(responseFormatter)

            // 设置路由
            this.setupRoutes()

            // 启动服务
            this.app.listen(this.PORT, () => {
                logger.info(`XMAX Job Service is running on port ${this.PORT}`)
                console.log(`✅ XMAX Job Service is running on port ${this.PORT}`)
                console.log(`📚 API endpoints:`)
                console.log(`   - Health Check: http://localhost:${this.PORT}/health`)
                console.log(`   - Metadata: http://localhost:${this.PORT}/api/v1/metadata`)
                console.log(`   - B-side Jobs API: http://localhost:${this.PORT}/api/v1/job-b`)
                console.log(`   - C-side Jobs API: http://localhost:${this.PORT}/api/v1/job-c`)
                console.log(`   - Manual Candidates API: http://localhost:${this.PORT}/api/v1/job-b/manual-candidates`)
                console.log(`   - B-side Appointments API: http://localhost:${this.PORT}/api/v1/appointment-b`)
                console.log(`   - C-side Appointments API: http://localhost:${this.PORT}/api/v1/appointment-c`)
                console.log(`   - Swagger Docs: http://localhost:${this.PORT}/swagger`)
                console.log(`   - Admin Panel: http://localhost:${this.PORT}/admin.html`)
            })
        } catch (error) {
            logger.error('Failed to start application:', error)
            process.exit(1)
        }
    }
}

// 创建并启动应用
const application = new Application()
application.start().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})

// 优雅关闭处理
process.on('SIGTERM', () => {
    console.log('📴 SIGTERM signal received: closing HTTP server')
    stopSchedulers()
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('📴 SIGINT signal received: closing HTTP server')
    stopSchedulers()
    process.exit(0)
})

export default application.app
