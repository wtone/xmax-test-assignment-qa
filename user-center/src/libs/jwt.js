import jwt from 'jsonwebtoken'
import Redis from 'ioredis'
import 'dotenv/config'
import crypto from 'crypto'
import { log } from '../../utils/logger.js'
import User from '../models/User.js'

const logger = log(import.meta.url)

class JWTService {
    constructor() {
        this.accessTokenSecret = process.env.JWT_SECRET || 'fallback-secret'
        this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || this.accessTokenSecret + '-refresh'
        this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRES_IN || '7d'
        this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '30d'
        this.issuer = process.env.JWT_ISSUER || 'xmax-user-center'
        this.audience = process.env.JWT_AUDIENCE || 'xmax-services'

        // Redis连接
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            db: process.env.REDIS_DB || 0,
            retryDelayOnFailover: 100,
            enableReadyCheck: false,
            maxRetriesPerRequest: null,
        })

        this.redis.on('error', err => {
            console.error('Redis连接错误:', err)
        })
    }

    /**
     * 生成访问令牌（包含完整的Token处理逻辑）
     *
     * 🔧 职责范围：
     * - 生成JWT access token
     * - 计算过期时间
     * - 存储到Redis
     * - 返回完整的token信息
     *
     * @param {Object} user - 用户对象
     * @param {Object} options - 可选参数 { platform, deviceId }
     * @returns {Object} { accessToken, accessTokenExpiryAt } 包含token和过期时间
     */
    async generateAccessToken(user, options = {}) {
        try {
            // 确保用户对象已填充roles和permissions
            let userWithRoles = user
            if (!user.roles || user.roles.length === 0 || !user.roles[0].permissions) {
                userWithRoles = await User.findById(user._id).populate({
                    path: 'roles',
                    populate: {
                        path: 'permissions',
                    },
                })

                // 如果数据库查询失败，回退到原始用户对象
                if (!userWithRoles) {
                    userWithRoles = user
                    // 确保用户对象有必要的属性
                    if (!userWithRoles.roles) {
                        userWithRoles.roles = []
                    }
                }
            }

            // 收集用户的所有权限
            const permissions = new Set()
            const roleNames = []

            if (userWithRoles.roles && userWithRoles.roles.length > 0) {
                userWithRoles.roles.forEach(role => {
                    roleNames.push(role.name)
                    if (role.permissions && role.permissions.length > 0) {
                        role.permissions.forEach(permission => {
                            permissions.add(`${permission.resource}:${permission.action}`)
                        })
                    }
                })
            }

            const payload = {
                userId: userWithRoles._id.toString(),
                username: userWithRoles.username,
                email: userWithRoles.email,
                userType: userWithRoles.type || 'C',
                companyId: options.companyId || null,
                type: 'access',
                roles: roleNames,
                permissions: Array.from(permissions),
                platform: options.platform || userWithRoles.lastLoginPlatform || 'web',
                // deviceId: options.deviceId || 'unknown-device',  // 移除以减小 token 大小
            }

            // 1. 生成JWT访问令牌
            const accessToken = jwt.sign(payload, this.accessTokenSecret, {
                expiresIn: this.accessTokenExpiry,
                issuer: this.issuer,
                audience: this.audience,
            })

            // 2. 计算access_token过期时间
            const accessTokenTTL = this.parseExpiryToSeconds(this.accessTokenExpiry)
            const accessTokenExpiryAt = new Date(Date.now() + accessTokenTTL * 1000).toISOString()

            // 3. 存储新的access_token到Redis（支持多并发会话）
            const accessTokenKey = this.getAccessTokenKey(userWithRoles._id.toString())
            await this.redis.sadd(accessTokenKey, accessToken)
            await this.redis.expire(accessTokenKey, accessTokenTTL)

            logger.info('生成JWT访问令牌完成', {
                userId: payload.userId,
                username: payload.username,
                userType: payload.userType,
                companyId: payload.companyId,
                roles: payload.roles,
                permissionsCount: payload.permissions.length,
                platform: payload.platform,
                accessTokenExpiryAt,
                operation: 'generate_access_token_complete',
            })

            return {
                accessToken,
                accessTokenExpiryAt,
            }
        } catch (error) {
            logger.error('生成访问令牌失败:', {
                userId: user._id,
                error: error.message,
            })
            throw error
        }
    }

    /**
     * 生成刷新令牌
     * @param {Object} user - 用户对象
     * @returns {string} JWT刷新令牌
     */
    generateRefreshToken(user) {
        const payload = {
            userId: user._id.toString(),
            type: 'refresh',
        }

        return jwt.sign(payload, this.refreshTokenSecret, {
            expiresIn: this.refreshTokenExpiry,
            issuer: this.issuer,
            audience: this.audience,
        })
    }

    /**
     * 智能生成令牌对（访问令牌 + 刷新令牌） - 专用于登录场景
     *
     * ⚠️  使用场景限制：
     * - 仅用于用户登录场景（用户已通过密码或其他方式完成身份验证）
     * - 不适用于refresh场景（refresh应直接基于提供的特定token生成access_token）
     *
     * 🔄 内部策略逻辑：
     * - 如果平台已有有效refresh_token，复用它并只生成新access_token
     * - 如果没有有效refresh_token，生成完整的token对
     * - 外部调用者无需关心策略细节，只需调用此方法即可
     *
     * @param {Object} user - 用户对象
     * @param {Object} options - 可选参数 { platform, deviceId }
     * @returns {Object} 包含accessToken和refreshToken的对象
     */
    async generateTokenPair(user, options = {}) {
        const { platform = 'web', deviceId = 'unknown-device' } = options

        // 🔄 Token策略核心逻辑 - 所有策略决策都在这里完成

        // 1. 检查该平台是否已有有效的refresh_token（策略判断的关键）
        const existingRefreshToken = user.findValidRefreshTokenByPlatform(platform)
        const hasValidRefreshToken = existingRefreshToken && existingRefreshToken.expiresAt > new Date()

        // 2. 始终生成新的access_token（无论什么策略）
        const { accessToken, accessTokenExpiryAt } = await this.generateAccessToken(user, options)

        // 3. 根据策略决定refresh_token的处理方式
        let refreshToken, refreshTokenExpiryAt, isNewRefreshToken

        if (hasValidRefreshToken) {
            // 📋 策略A: 复用现有有效的refresh_token
            refreshToken = existingRefreshToken.token
            refreshTokenExpiryAt = existingRefreshToken.expiresAt.toISOString()
            isNewRefreshToken = false

            logger.info('Token策略: 复用现有RefreshToken', {
                userId: user._id.toString(),
                platform,
                deviceId,
                strategy: 'reuse_refresh_token',
                expiresAt: refreshTokenExpiryAt,
            })
        } else {
            // 📋 策略B: 生成新的refresh_token
            refreshToken = this.generateRefreshToken(user)
            const refreshTokenTTL = this.parseExpiryToSeconds(this.refreshTokenExpiry)
            refreshTokenExpiryAt = new Date(Date.now() + refreshTokenTTL * 1000).toISOString()
            isNewRefreshToken = true

            logger.info('Token策略: 生成新的RefreshToken', {
                userId: user._id.toString(),
                platform,
                deviceId,
                strategy: 'generate_new_refresh_token',
                reason: existingRefreshToken ? 'token_expired' : 'no_existing_token',
            })
        }

        // 4. access_token已经在generateAccessToken()内部存储到Redis，无需重复操作

        // 5. 根据策略执行相应的refresh_token存储逻辑
        if (isNewRefreshToken) {
            // 📋 策略A的存储逻辑: 新refresh_token需要完整存储
            const refreshTokenKey = this.getRefreshTokenKey(user._id.toString())
            const refreshTokenTTL = this.parseExpiryToSeconds(this.refreshTokenExpiry)

            // 存储到Redis
            await this.redis.sadd(refreshTokenKey, refreshToken)
            await this.redis.expire(refreshTokenKey, refreshTokenTTL)

            // 存储到MongoDB
            const refreshTokenExpiry = new Date(Date.now() + refreshTokenTTL * 1000)
            const mongoResult = await user.safeAddOrUpdateRefreshTokenByPlatform(refreshToken, refreshTokenExpiry, platform, deviceId)

            if (!mongoResult.success) {
                logger.warn('MongoDB存储RefreshToken失败', {
                    userId: user._id.toString(),
                    platform,
                    error: mongoResult.error,
                })
            }
        } else {
            // 📋 策略B的存储逻辑: 复用refresh_token，确保Redis同步
            const refreshTokenKey = this.getRefreshTokenKey(user._id.toString())
            const exists = await this.redis.sismember(refreshTokenKey, refreshToken)

            if (!exists) {
                logger.info('Redis缺失复用的RefreshToken，恢复到Redis', {
                    userId: user._id.toString(),
                    platform,
                    operation: 'restore_refresh_token_to_redis',
                })

                // 计算剩余TTL
                const now = new Date()
                const expiresAt = new Date(refreshTokenExpiryAt)
                const remainingTTL = Math.max(Math.floor((expiresAt.getTime() - now.getTime()) / 1000), 60)

                await this.redis.sadd(refreshTokenKey, refreshToken)
                await this.redis.expire(refreshTokenKey, remainingTTL)
            }
        }

        // 6. 返回完整的token信息（外部调用者只需要关心这个结果）
        logger.info('Token策略执行完成', {
            userId: user._id.toString(),
            platform,
            strategy: hasValidRefreshToken ? 'reuse_refresh_token' : 'generate_new_refresh_token',
            isNewRefreshToken,
        })

        return {
            accessToken, // 始终是新生成的
            accessTokenExpiryAt, // access_token过期时间
            refreshToken, // 根据策略：可能是复用的，也可能是新生成的
            refreshTokenExpiryAt, // refresh_token过期时间
            isNewRefreshToken, // 策略执行结果：true=生成了新token，false=复用了现有token
        }
    }

    /**
     * 验证访问令牌
     * @param {string} token - JWT令牌
     * @returns {Object|null} 解码后的payload或null
     */
    async verifyAccessToken(token) {
        try {
            const payload = jwt.verify(token, this.accessTokenSecret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: ['HS256'],
            })

            if (payload.type !== 'access') {
                throw new Error('Invalid token type')
            }

            // 检查token是否在Redis中存在（是否被撤销）
            const isValid = await this.isAccessTokenValid(token, payload.userId)
            if (!isValid) {
                throw new Error('Token has been revoked')
            }

            return payload
        } catch (error) {
            console.error('验证访问令牌失败:', error.message)
            return null
        }
    }

    /**
     * 验证刷新令牌
     * @param {string} token - JWT令牌
     * @returns {Object|null} 解码后的payload或null
     */
    verifyRefreshToken(token) {
        try {
            const payload = jwt.verify(token, this.refreshTokenSecret, {
                issuer: this.issuer,
                audience: this.audience,
                algorithms: ['HS256'],
            })

            if (payload.type !== 'refresh') {
                throw new Error('Invalid token type')
            }

            return payload
        } catch (error) {
            console.error('验证刷新令牌失败:', error.message)
            return null
        }
    }

    /**
     * 检查访问令牌是否有效（在Redis中存在）
     * @param {string} token - 访问令牌
     * @param {string} userId - 用户ID
     * @returns {boolean} 是否有效
     */
    async isAccessTokenValid(token, userId) {
        try {
            const accessTokenKey = this.getAccessTokenKey(userId)
            const exists = await this.redis.sismember(accessTokenKey, token)
            return exists === 1
        } catch (error) {
            console.error('检查访问令牌有效性失败:', error)
            return false
        }
    }

    /**
     * 撤销访问令牌
     * @param {string} token - 要撤销的访问令牌
     * @param {string} userId - 用户ID
     * @returns {boolean} 是否成功撤销
     */
    async revokeAccessToken(token, userId) {
        try {
            const accessTokenKey = this.getAccessTokenKey(userId)
            const removed = await this.redis.srem(accessTokenKey, token)
            return removed > 0
        } catch (error) {
            console.error('撤销访问令牌失败:', error)
            return false
        }
    }

    /**
     * 撤销用户的所有访问令牌
     * @param {string} userId - 用户ID
     * @returns {boolean} 是否成功撤销
     */
    async revokeAllAccessTokens(userId) {
        try {
            const accessTokenKey = this.getAccessTokenKey(userId)
            await this.redis.del(accessTokenKey)
            return true
        } catch (error) {
            console.error('撤销所有访问令牌失败:', error)
            return false
        }
    }

    /**
     * 尝试恢复丢失的 refresh token（自修复机制）
     * @private
     * @param {string} token - 刷新令牌
     * @param {string} userId - 用户ID
     * @returns {Promise<boolean>} 是否成功恢复
     */
    async attemptRefreshTokenRecovery(token, userId) {
        const refreshTokenKey = this.getRefreshTokenKey(userId)
        
        logger.info('Attempting refresh token recovery', {
            operation: 'refresh_token_recovery_start',
            userId
        })
        
        // 查询用户以检查 MongoDB 中的 tokens
        const user = await User.findById(userId)
        if (!user) {
            logger.warn('User not found for refresh token recovery', {
                operation: 'refresh_token_recovery_user_not_found',
                userId
            })
            return false
        }
        
        // 策略1：从 MongoDB 恢复
        const tokenInMongo = user.refreshTokens?.find(rt => 
            rt.token === token && rt.expiresAt > new Date()
        )
        
        if (tokenInMongo) {
            logger.info('Valid refresh token found in MongoDB, restoring to Redis', {
                operation: 'refresh_token_restore_from_mongo',
                userId,
                platform: tokenInMongo.platform
            })
            
            // 计算剩余 TTL
            const now = new Date()
            const expiresAt = new Date(tokenInMongo.expiresAt)
            const remainingTTL = Math.max(Math.floor((expiresAt.getTime() - now.getTime()) / 1000), 60)
            
            // 恢复到 Redis
            await this.redis.sadd(refreshTokenKey, token)
            await this.redis.expire(refreshTokenKey, remainingTTL)
            
            logger.info('Refresh token successfully restored from MongoDB', {
                operation: 'refresh_token_restore_success',
                userId,
                ttl: remainingTTL
            })
            
            return true
        }
        
        // 策略2：基于 JWT 有效性恢复（孤儿 token）
        const payload = this.verifyRefreshToken(token)
        if (payload && payload.exp) {
            const tokenExp = new Date(payload.exp * 1000)
            const now = new Date()
            
            if (tokenExp > now) {
                logger.info('JWT valid but not in storage, recovering orphan token', {
                    operation: 'refresh_token_orphan_recovery',
                    userId
                })
                
                // 计算剩余 TTL
                const remainingTTL = Math.max(Math.floor((tokenExp.getTime() - now.getTime()) / 1000), 60)
                
                // 存储到 Redis
                await this.redis.sadd(refreshTokenKey, token)
                await this.redis.expire(refreshTokenKey, remainingTTL)
                
                // 也尝试存储到 MongoDB
                if (typeof user.safeAddOrUpdateRefreshTokenByPlatform === 'function') {
                    await user.safeAddOrUpdateRefreshTokenByPlatform(
                        token,
                        tokenExp,
                        'web',  // 默认平台
                        'recovered'  // 标记为恢复的
                    )
                }
                
                logger.info('Orphan refresh token recovered', {
                    operation: 'refresh_token_orphan_recovery_success',
                    userId,
                    ttl: remainingTTL
                })
                
                return true
            }
        }
        
        // 恢复失败
        logger.warn('Refresh token recovery failed - token is truly invalid', {
            operation: 'refresh_token_recovery_failed',
            userId
        })
        
        return false
    }

    /**
     * 检查刷新令牌是否有效（自动启用自修复）
     * @param {string} token - 刷新令牌
     * @param {string} userId - 用户ID
     * @returns {boolean} 是否有效
     */
    async isRefreshTokenValid(token, userId) {
        try {
            const refreshTokenKey = this.getRefreshTokenKey(userId)
            const exists = await this.redis.sismember(refreshTokenKey, token)
            
            // 如果 Redis 中存在，直接返回
            if (exists === 1) {
                return true
            }
            
            // Redis 中不存在，尝试自修复
            logger.info('Refresh token not in Redis, attempting self-healing', {
                operation: 'refresh_token_self_healing',
                userId
            })
            
            // 调用自修复函数
            const recovered = await this.attemptRefreshTokenRecovery(token, userId)
            return recovered
            
        } catch (error) {
            console.error('检查刷新令牌有效性失败:', error)
            return false
        }
    }

    /**
     * 撤销刷新令牌
     * @param {string} token - 要撤销的刷新令牌
     * @param {string} userId - 用户ID
     * @param {Object} user - 用户对象（可选，用于同时从MongoDB删除）
     * @returns {boolean} 是否成功撤销
     */
    async revokeRefreshToken(token, userId, user = null) {
        try {
            const refreshTokenKey = this.getRefreshTokenKey(userId)
            const removed = await this.redis.srem(refreshTokenKey, token)

            // 如果提供了用户对象，同时从MongoDB中删除
            if (user && typeof user.safeRemoveRefreshToken === 'function') {
                const mongoResult = await user.safeRemoveRefreshToken(token)
                // safe方法内部已处理日志记录，MongoDB操作失败不影响Redis操作结果
            }

            return removed > 0
        } catch (error) {
            console.error('撤销刷新令牌失败:', error)
            return false
        }
    }

    /**
     * 撤销用户的所有刷新令牌
     * @param {string} userId - 用户ID
     * @param {Object} user - 用户对象（可选，用于同时从MongoDB删除）
     * @returns {boolean} 是否成功撤销
     */
    async revokeAllRefreshTokens(userId, user = null) {
        try {
            const refreshTokenKey = this.getRefreshTokenKey(userId)
            await this.redis.del(refreshTokenKey)

            // 如果提供了用户对象，同时清理MongoDB中的refreshTokens数组
            if (user && typeof user.safeClearAllRefreshTokens === 'function') {
                const mongoResult = await user.safeClearAllRefreshTokens()
                // safe方法内部已处理日志记录，MongoDB操作失败不影响Redis操作结果
            }

            return true
        } catch (error) {
            console.error('撤销所有刷新令牌失败:', error)
            return false
        }
    }

    /**
     * 撤销用户的所有令牌（访问令牌和刷新令牌）
     * @param {string} userId - 用户ID
     * @param {Object} user - 用户对象（可选，用于同时从MongoDB删除）
     * @returns {boolean} 是否成功撤销
     */
    async revokeAllTokens(userId, user = null) {
        try {
            await Promise.all([this.revokeAllAccessTokens(userId), this.revokeAllRefreshTokens(userId, user)])
            return true
        } catch (error) {
            console.error('撤销所有令牌失败:', error)
            return false
        }
    }

    /**
     * 获取访问令牌在Redis中的键名
     * @param {string} userId - 用户ID
     * @returns {string} Redis键名
     */
    getAccessTokenKey(userId) {
        return `access_token:${userId}`
    }

    /**
     * 获取刷新令牌在Redis中的键名
     * @param {string} userId - 用户ID
     * @returns {string} Redis键名
     */
    getRefreshTokenKey(userId) {
        return `refresh_token:${userId}`
    }

    /**
     * 将时间表达式转换为秒数
     * @param {string} expiry - 时间表达式（如'1h', '7d'）
     * @returns {number} 秒数
     */
    parseExpiryToSeconds(expiry) {
        const units = {
            s: 1,
            m: 60,
            h: 3600,
            d: 86400,
            w: 604800,
            y: 31536000,
        }

        const match = expiry.match(/^(\d+)([smhdwy])$/)
        if (!match) {
            throw new Error('Invalid expiry format')
        }

        const [, amount, unit] = match
        return parseInt(amount) * units[unit]
    }

    /**
     * 解码令牌（不验证签名）
     * @param {string} token - JWT令牌
     * @returns {Object|null} 解码后的payload或null
     */
    decodeToken(token) {
        try {
            return jwt.decode(token)
        } catch (error) {
            console.error('解码令牌失败:', error.message)
            return null
        }
    }

    /**
     * 获取令牌的剩余有效时间
     * @param {string} token - JWT令牌
     * @returns {number} 剩余秒数，如果令牌无效返回0
     */
    getTokenTTL(token) {
        try {
            const payload = this.decodeToken(token)
            if (!payload || !payload.exp) {
                return 0
            }

            const currentTime = Math.floor(Date.now() / 1000)
            const remainingTime = payload.exp - currentTime

            return Math.max(0, remainingTime)
        } catch (error) {
            console.error('获取令牌TTL失败:', error.message)
            return 0
        }
    }

    /**
     * 关闭Redis连接
     */
    async close() {
        await this.redis.disconnect()
    }
}

export default JWTService
