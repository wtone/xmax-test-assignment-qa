import mongoose from 'mongoose'
import { log } from './logger.js'
import 'dotenv/config'
import path from 'path'

const logger = log(path.basename(import.meta.url))

class MongoManager {
    constructor() {
        this.connections = new Map()
        this.models = new Map()
        this.reconnectTimers = new Map()
        this.reconnectAttempts = new Map()
    }

    /**
     * 获取或创建数据库连接
     * @param {string} uri - MongoDB 连接字符串
     * @param {string} name - 连接名称
     * @returns {Promise<mongoose.Connection>} Mongoose 连接实例
     */
    async getConnection(uri, name) {
        // 从 URI 中提取数据库名称
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'
        const connectionName = name || urlDbName

        if (this.connections.has(connectionName)) {
            const existingConnection = this.connections.get(connectionName)
            // 检查连接状态
            // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
            if (existingConnection.readyState === 1 || existingConnection.readyState === 2) {
                // 如果已连接或正在连接，返回现有连接
                return existingConnection
            }
            // 如果连接断开，删除旧连接
            this.connections.delete(connectionName)
        }
        try {
            const connection = mongoose.createConnection(uri, {
                dbName: urlDbName, // 显式指定数据库名称
                serverSelectionTimeoutMS: 10000, // 服务器选择超时 10秒
                socketTimeoutMS: 20000, // Socket 超时 20秒
                maxPoolSize: 10, // 连接池大小
                minPoolSize: 2,
                wtimeoutMS: 10000, // 写操作超时 10秒
                // 自动重连配置
                bufferCommands: true, // 缓冲命令，等待重连
                autoCreate: true, // 自动创建集合
                autoIndex: true, // 自动创建索引
                // 心跳检测
                heartbeatFrequencyMS: 10000, // 心跳频率 10秒
                minHeartbeatFrequencyMS: 5000, // 最小心跳频率 5秒
            })

            // 添加连接事件监听
            connection.on('connecting', () => {
                logger.info(`🔗 MongoDB connecting to ${connectionName} (db: ${urlDbName})`)
            })

            connection.on('connected', () => {
                logger.info(`✅ MongoDB connection established for ${connectionName} (db: ${urlDbName})`)
            })

            connection.on('error', err => {
                logger.error(`❌ MongoDB connection error for ${connectionName}:`, err)
            })

            connection.on('disconnected', () => {
                logger.warn(`⚠️  MongoDB disconnected for ${connectionName}`)

                // 启动手动重连机制
                this.startReconnection(connectionName, uri)
            })

            connection.on('reconnected', () => {
                logger.info(`✅ MongoDB reconnected for ${connectionName}`)
                // 清理重连相关的状态
                this.reconnectTimers.delete(connectionName)
                this.reconnectAttempts.delete(connectionName)
            })

            connection.on('reconnectFailed', () => {
                logger.error(`❌ MongoDB reconnect failed for ${connectionName}`)
                this.connections.delete(connectionName)
            })

            this.connections.set(connectionName, connection)
            return connection
        } catch (error) {
            logger.error(`Error creating MongoDB connection for ${connectionName}:`, error)
            throw error
        }
    }

    /**
     * 启动重连机制
     * @param {string} connectionName - 连接名称
     * @param {string} uri - MongoDB 连接字符串
     */
    startReconnection(connectionName, uri) {
        // 如果已经在重连，不要重复启动
        if (this.reconnectTimers.has(connectionName)) {
            return
        }

        const maxRetries = 10
        const retryDelay = 10000 // 10秒

        const attemptReconnect = () => {
            const attempts = this.reconnectAttempts.get(connectionName) || 0

            if (attempts >= maxRetries) {
                logger.error(`❌ MongoDB reconnection failed after ${maxRetries} attempts for ${connectionName}`)
                this.reconnectTimers.delete(connectionName)
                this.reconnectAttempts.delete(connectionName)
                this.connections.delete(connectionName)
                return
            }

            logger.info(`🔄 MongoDB reconnection attempt ${attempts + 1}/${maxRetries} for ${connectionName}`)
            this.reconnectAttempts.set(connectionName, attempts + 1)

            // 尝试重新连接
            this.getConnection(uri, connectionName)
                .then(connection => {
                    logger.info(`✅ MongoDB reconnection successful for ${connectionName}`)
                    this.reconnectTimers.delete(connectionName)
                    this.reconnectAttempts.delete(connectionName)
                })
                .catch(error => {
                    logger.error(`❌ MongoDB reconnection attempt failed for ${connectionName}:`, error.message)
                    // 继续重试
                    this.reconnectTimers.set(connectionName, setTimeout(attemptReconnect, retryDelay))
                })
        }

        // 延迟开始重连，给驱动一些时间自己恢复
        this.reconnectTimers.set(connectionName, setTimeout(attemptReconnect, retryDelay))
    }

    /**
     * 创建模型
     * @param {string} uri - MongoDB 连接字符串
     * @param {string} modelName - 模型名称
     * @param {mongoose.Schema} schema - Mongoose Schema
     * @returns {Promise<mongoose.Model>} Mongoose 模型实例
     */
    async createModel(uri, modelName, schema) {
        // 从 URL 中提取数据库名称
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'
        const modelKey = `${urlDbName}:${modelName}`
        console.log('[MongoManager.createModel] modelKey', modelKey)
        if (this.models.has(modelKey)) {
            return this.models.get(modelKey)
        }

        const connection = await this.getConnection(uri, urlDbName)
        const model = connection.model(modelName, schema)
        this.models.set(modelKey, model)

        return model
    }

    /**
     * 获取模型
     * @param {string} uri - MongoDB 连接字符串
     * @param {string} modelName - 模型名称
     * @returns {mongoose.Model|null} Mongoose 模型实例
     */
    getModel(uri, modelName) {
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'
        const modelKey = `${urlDbName}:${modelName}`
        return this.models.get(modelKey) || null
    }

    /**
     * 获取连接上的所有模型
     * @param {string} uri - MongoDB 连接字符串
     * @returns {mongoose.Connection|null} Mongoose 连接实例
     */
    getConnectionForUri(uri) {
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'
        return this.connections.get(urlDbName) || null
    }

    /**
     * 确保所有相关模型都在连接上注册
     * 这解决了 populate 找不到模型的问题
     * @param {string} uri - MongoDB 连接字符串
     */
    async ensureModelsRegistered(uri) {
        const connection = await this.getConnection(uri)
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'

        // 遍历所有该数据库的模型，确保它们都在连接上注册
        for (const [modelKey, model] of this.models) {
            if (modelKey.startsWith(`${urlDbName}:`)) {
                const modelName = modelKey.split(':')[1]
                // 如果连接上没有这个模型，就注册它
                if (!connection.models[modelName]) {
                    connection.model(modelName, model.schema)
                }
            }
        }
    }

    /**
     * 检查连接状态
     * @param {string} uri - MongoDB 连接字符串
     * @returns {boolean} 连接是否正常
     */
    isConnected(uri) {
        const urlDbName = uri.split('/').pop()?.split('?')[0] || 'default'
        const connection = this.connections.get(urlDbName)
        return connection && connection.readyState === 1
    }

    /**
     * 关闭所有连接
     */
    async closeAll() {
        for (const [name, connection] of this.connections) {
            try {
                await connection.close()
                logger.info(`Closed MongoDB connection for ${name}`)
            } catch (error) {
                logger.error(`Error closing MongoDB connection for ${name}:`, error)
            }
        }
        this.connections.clear()
        this.models.clear()
    }
}

// 创建单例实例
const mongoManager = new MongoManager()
export default mongoManager
