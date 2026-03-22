import mongoose from 'mongoose'
import 'dotenv/config'
import { log } from './logger.js'

const logger = log(import.meta.url)

// MongoDB 连接配置
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/xmax-user-center'
const MONGO_OPTIONS = {
    // useNewUrlParser 和 useUnifiedTopology 在新版本的 mongoose 中已经默认启用，无需显式设置
}

class MongoManager {
    constructor() {
        this.connections = new Map()
        this.models = new Map()
    }

    async connect(uri = MONGO_URI, options = MONGO_OPTIONS) {
        try {
            if (this.connections.has(uri)) {
                return this.connections.get(uri)
            }

            logger.info(`正在连接 MongoDB: ${uri}`)
            const connection = await mongoose.createConnection(uri, options)

            connection.on('connected', () => {
                logger.info(`MongoDB 连接成功: ${uri}`)
            })

            connection.on('error', err => {
                logger.error(`MongoDB 连接错误: ${err}`)
            })

            connection.on('disconnected', () => {
                logger.warn(`MongoDB 连接断开: ${uri}`)
            })

            this.connections.set(uri, connection)
            return connection
        } catch (error) {
            logger.error(`MongoDB 连接失败: ${error}`)
            throw error
        }
    }

    async getConnection(uri = MONGO_URI) {
        if (!this.connections.has(uri)) {
            await this.connect(uri)
        }
        return this.connections.get(uri)
    }

    async createModel(modelName, schema, uri = MONGO_URI) {
        const modelKey = `${uri}:${modelName}`

        if (this.models.has(modelKey)) {
            return this.models.get(modelKey)
        }

        const connection = await this.getConnection(uri)
        const model = connection.model(modelName, schema)

        this.models.set(modelKey, model)
        return model
    }

    async closeAll() {
        for (const [uri, connection] of this.connections) {
            await connection.close()
            logger.info(`MongoDB 连接已关闭: ${uri}`)
        }
        this.connections.clear()
        this.models.clear()
    }
}

// 创建单例实例
const mongoManager = new MongoManager()

// 初始化默认连接
;(async () => {
    try {
        await mongoManager.connect()
    } catch (error) {
        logger.error('MongoDB 初始化失败:', error)
        process.exit(1)
    }
})()

// 优雅关闭
process.on('SIGINT', async () => {
    await mongoManager.closeAll()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    await mongoManager.closeAll()
    process.exit(0)
})

export default mongoManager
