import jwt from 'jsonwebtoken'
import { log } from '../utils/logger.js'
import errorCodes from '../src/errors.js'
import { isWhitelistPath } from '../config/whitelist.js'
import { getTargetService } from '../src/proxy/routes.js'

const logger = log(import.meta.url)

/**
 * 自定义错误类，支持 code 属性
 */
class CustomError extends Error {
    constructor(message, code) {
        super(message)
        this.code = code
        this.name = 'CustomError'
    }
}

/**
 * JWT认证中间件
 * 从请求头中提取JWT令牌并验证
 * 将用户信息注入到请求上下文中
 */
export default async (ctx, next) => {
    const { path, method } = ctx.request

    // DEBUG: 添加最基础的调试日志确认中间件被调用
    logger.info('JWT middleware called', {
        path,
        method,
        traceId: ctx.state.traceId,
        hasAuthHeader: !!ctx.request.headers.authorization,
        authHeaderValue: ctx.request.headers.authorization ? 'Bearer...' : 'none'
    })

    // 跳过白名单路径和OPTIONS请求
    if (isWhitelistPath(path) || method === 'OPTIONS') {
        return await next()
    }

    // 检查动态路由配置中的认证设置，传递方法参数
    const targetService = getTargetService(path, method)

    // DEBUG: 添加调试日志查看targetService的详细信息
    logger.info('JWT middleware - targetService debug info', {
        path,
        method,
        targetServiceExists: !!targetService,
        targetServiceDetails: targetService
            ? {
                  serviceName: targetService.serviceName,
                  serviceKey: targetService.serviceKey,
                  target: targetService.target,
                  routePattern: targetService.routePattern,
                  metadata: targetService.metadata,
                  authentication: targetService.authentication,
                  metadataAuth: targetService.metadata?.authentication
              }
            : null,
        traceId: ctx.state.traceId
    })

    // 检查路由级别的认证配置
    if (targetService && targetService.authentication === false) {
        logger.info('Skipping authentication for public route', {
            path,
            method,
            service: targetService.serviceKey,
            authentication: targetService.authentication,
            traceId: ctx.state.traceId
        })
        return await next()
    }

    try {
        // 提取Token
        const authHeader = ctx.request.headers.authorization
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            const error = new CustomError(errorCodes.TOKEN_MISSING.message, errorCodes.TOKEN_MISSING.code)
            throw error
        }

        const token = authHeader.slice(7) // 移除 'Bearer ' 前缀

        // 验证Token
        const publicKey = process.env.JWT_PUBLIC_KEY || process.env.JWT_SECRET
        if (!publicKey) {
            logger.error('JWT public key not configured')
            const error = new CustomError('JWT configuration error', 500001)
            throw error
        }

        const decoded = jwt.verify(token, publicKey, {
            issuer: process.env.JWT_ISSUER || 'xmax-user-center',
            audience: process.env.JWT_AUDIENCE || 'xmax-services',
            algorithms: ['HS256'] // 或 ['RS256'] 如果使用非对称加密
        })

        // 确保 decoded 是一个对象而不是字符串
        if (typeof decoded === 'string') {
            const error = new CustomError(errorCodes.TOKEN_INVALID.message, errorCodes.TOKEN_INVALID.code)
            throw error
        }

        // 检查令牌类型 (这里的type是指令牌类型，不是用户类型)
        if (decoded.type && decoded.type !== 'access') {
            const error = new CustomError(errorCodes.TOKEN_INVALID.message, errorCodes.TOKEN_INVALID.code)
            throw error
        }

        // 检查 B 端用户是否有 companyId
        // 特殊处理：允许B端用户在没有companyId时创建公司
        const userType = decoded.userType || 'C'
        if (userType === 'B' && !decoded.companyId) {
            // 允许访问创建公司和查询公司的接口
            const allowedPaths = [
                '/api/v1/company', // POST - 创建公司
                '/api/v1/company/my' // GET - 查询我的公司
            ]

            const isAllowedPath = allowedPaths.some(allowedPath => {
                if (method === 'POST' && path === '/api/v1/company') return true
                if (method === 'GET' && path === '/api/v1/company/my') return true
                return false
            })

            if (!isAllowedPath) {
                logger.warn('B-end user token missing companyId, blocking access', {
                    userId: decoded.userId,
                    username: decoded.username,
                    userType: userType,
                    path,
                    method,
                    traceId: ctx.state.traceId
                })
                const error = new CustomError('B-end user requires company association', errorCodes.PERMISSION_DENIED.code)
                throw error
            }

            logger.info('B-end user without companyId accessing allowed path', {
                userId: decoded.userId,
                userType: userType,
                path,
                method,
                traceId: ctx.state.traceId
            })
        }

        // 将用户信息注入到上下文
        ctx.state.user = {
            userId: decoded.userId || '',
            username: decoded.username || '',
            email: decoded.email || '',
            type: userType, // 用户类型用userType区分
            companyId: decoded.companyId || null, // 添加 companyId
            roles: decoded.roles || [],
            permissions: decoded.permissions || []
        }

        // 注意：不在这里设置 X-User-* 头，避免与代理服务的安全检查冲突
        // X-User-* 头将在代理服务转发请求时设置

        logger.info('JWT authentication successful', {
            userId: decoded.userId,
            username: decoded.username,
            userType: userType,
            companyId: decoded.companyId || null,
            path,
            method,
            traceId: ctx.state.traceId,
            roles: decoded.roles || [],
            permissions: decoded.permissions || []
        })

        await next()
    } catch (error) {
        logger.error('JWT authentication failed', {
            error: error.message,
            path,
            method,
            traceId: ctx.state.traceId
        })

        // 处理不同类型的JWT错误
        if (error.name === 'TokenExpiredError') {
            const expiredError = new CustomError(errorCodes.TOKEN_EXPIRED.message, errorCodes.TOKEN_EXPIRED.code)
            throw expiredError
        } else if (error.name === 'JsonWebTokenError') {
            const invalidError = new CustomError(errorCodes.TOKEN_INVALID.message, errorCodes.TOKEN_INVALID.code)
            throw invalidError
        } else if (error.name === 'NotBeforeError') {
            const notActiveError = new CustomError('Token not active', 401004)
            throw notActiveError
        }

        // 重新抛出已知错误
        throw error
    }
}
