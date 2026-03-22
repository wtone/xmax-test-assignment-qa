/**
 * MongoDB 连接工具
 * @module utils/mongo
 */

import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

/**
 * 连接 MongoDB（带重试机制）
 * @returns {Promise<void>}
 */
export async function connectMongo() {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/xmax-job'
    const maxRetries = 5
    let retryCount = 0

    console.log('🔄 Initiating MongoDB connection...')
    console.log(`📍 Target: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`)

    while (retryCount < maxRetries) {
        try {
            const startTime = Date.now()

            // 增强的连接选项 - 针对DNS和网络问题优化
            await mongoose.connect(uri, {
                maxPoolSize: 3, // 减少连接池大小避免并发DNS查询
                minPoolSize: 1, // 最小连接池
                serverSelectionTimeoutMS: 5000, // 服务器选择超时5秒
                socketTimeoutMS: 10000, // Socket超时10秒
                connectTimeoutMS: 5000, // 连接超时5秒
                heartbeatFrequencyMS: 10000, // 心跳频率10秒
                retryWrites: true, // 启用写入重试
                retryReads: true, // 启用读取重试
                maxIdleTimeMS: 60000, // 最大空闲时间60秒
                directConnection: false, // 不使用直连模式
                family: 4, // 强制使用IPv4避免DNS解析问题
                monitorCommands: false, // 关闭命令监控减少开销
                autoIndex: false, // 关闭自动索引创建
            })

            const connectTime = Date.now() - startTime
            console.log(`✅ MongoDB connected successfully (${connectTime}ms)`)

            // 测试连接
            await mongoose.connection.db.admin().ping()
            console.log('✅ MongoDB ping successful')

            break // 连接成功，退出循环
        } catch (error) {
            retryCount++
            console.error(`❌ MongoDB connection attempt ${retryCount}/${maxRetries} failed:`, error.message)

            // DNS解析失败时的特殊处理
            if (error.message.includes('ENOTFOUND')) {
                console.log('💡 DNS resolution issue detected (common with VPN TUN mode)')
                console.log('   Waiting for DNS cache to refresh...')
            }

            if (retryCount < maxRetries) {
                // VPN环境下使用固定等待时间5秒
                const waitTime = 5000
                console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`)
                await new Promise(resolve => setTimeout(resolve, waitTime))
            } else {
                console.error('❌ Failed to connect to MongoDB after all retries')
                console.error('💡 Suggestions:')
                console.error('   1. Check network connectivity to your MongoDB host')
                console.error('   2. Verify MongoDB credentials')
                console.error('   3. Check if MongoDB service is running')
                console.error('   4. Try running: node start-debug.js for detailed diagnostics')
                process.exit(1)
            }
        }
    }

    // 监听连接事件
    mongoose.connection.on('error', err => {
        console.error('❌ MongoDB connection error:', err)
    })

    mongoose.connection.on('disconnected', () => {
        console.warn('⚠️  MongoDB disconnected')
    })

    mongoose.connection.on('reconnected', () => {
        console.log('✅ MongoDB reconnected')
    })

    mongoose.connection.on('connected', () => {
        console.log('📊 MongoDB connection state: connected')
    })
}

/**
 * 关闭 MongoDB 连接
 * @returns {Promise<void>}
 */
export async function closeMongo() {
    try {
        await mongoose.connection.close()
        console.log('👋 MongoDB connection closed')
    } catch (error) {
        console.error('❌ Error closing MongoDB connection:', error)
    }
}

export default connectMongo
