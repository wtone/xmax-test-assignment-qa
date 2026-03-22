import Koa from 'koa'
import bodyparser from 'koa-bodyparser'
import bouncer from 'koa-bouncer'
import serve from 'koa-static'
import path from 'path'
import { fileURLToPath } from 'url'
import cors from './middlewares/cors.js'
import mongoManager from './utils/mongo.js'
// 预先导入模型以触发数据库连接
import './src/models/User.js'
import './src/models/Role.js'
import './src/models/Permission.js'
import './src/models/AiUserProfile.js'
import router from './src/router.js'
import errorHandler from './middlewares/error_handler.js'
import traceId from './middlewares/trace_id.js'
import response from './middlewares/response.js'
import logger from './middlewares/logger.js'
import clients from './middlewares/clients.js'
import { setupSwagger } from './utils/swagger.js'
import dotenv from 'dotenv'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = new Koa()

// Enable proxy mode to trust X-Forwarded-* headers from reverse proxy
app.proxy = true

// 静态文件服务 - 提供 public 目录下的文件
app.use(serve(path.join(__dirname, 'public')))

app.use(
    bodyparser({
        enableTypes: ['json', 'form', 'text'],
    }),
)
    .use(bouncer.middleware())
    .use(response)
    .use(errorHandler)
    .use(cors)
    .use(traceId)
    .use(clients)
    .use(logger)

if (process.env.ENABLE_SWAGGER === 'true') {
    setupSwagger(app)
}

router(app)

// 初始化数据库模型，确保所有模型都在连接上正确注册
app.initDatabase = async () => {
    const mongoUri = process.env.MONGO_USER_CENTER_URI
    if (mongoUri) {
        await mongoManager.ensureModelsRegistered(mongoUri)
    }
}

export default app
