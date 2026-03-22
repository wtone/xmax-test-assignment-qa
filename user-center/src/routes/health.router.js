import Router from 'koa-router'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取 package.json 获取版本信息
const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'))

const router = new Router()

// 健康检查
router.get('/health', async ctx => {
    ctx.success({
        service: 'xmax-user-center-service',
        status: 'healthy',
        version: packageJson.version,
        timestamp: new Date().toISOString(),
    })
})

export default router
