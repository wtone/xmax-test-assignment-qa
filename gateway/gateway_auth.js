import config from "../config/env.js";
import logger from "../utils/logger.js";

// 生成请求ID的工具函数
function generateRequestId() {
    return 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

// Gateway认证中间件 - 用于处理来自API Gateway的用户信息
export const gatewayAuth = async (ctx, next) => {
    // 认证阶段的错误处理
    try {
        // 检查是否来自网关的用户信息
        let userId = ctx.headers['x-user-id']
        let username = ctx.headers['x-user-username']
        let userEmail = ctx.headers['x-user-email']
        let userType = ctx.headers['x-user-type']
        let userRoles = ctx.headers['x-user-roles']

        if (!userId && config.debug.enabled && config.debug.userId && config.debug.token === ctx.headers['authorization']) {
            userId = config.debug.userId
            username = config.debug.userName
            userEmail = config.debug.userEmail
            userType = config.debug.userType
            userRoles = config.debug.userRoles
        }

        if (!userId) {
            ctx.throw(401, 'Missing user authentication from gateway')
        }

        // 来自网关，检查并补充用户信息
        const companyId = ctx.headers['x-company-id'] || null
        let userInfo = {
            userId: userId,
            username: username || '',
            email: userEmail || '',
            type: userType || 'C',
            companyId: companyId,
            roles: userRoles ? JSON.parse(userRoles) : [],
        }

        // 如果关键信息缺失，从user-center服务查询最新数据
        if (!username || !userEmail || !userType || !userRoles) {
            try {
                const userCenterUrl = process.env.USER_CENTER_URL || 'http://localhost:3001'
                const response = await fetch(`${userCenterUrl}/api/v1/users/profile`, {
                    method: 'GET',
                    headers: {
                        'X-User-ID': userId,
                        'Content-Type': 'application/json',
                        'X-Trace-ID': ctx.headers['x-trace-id'] || ctx.state.traceId || generateRequestId(),
                    },
                })

                if (response.ok) {
                    const result = await response.json()
                    if (result.code === 0 && result.data) {
                        const user = result.data
                        // 合并策略：网关已验证的字段优先，user-center仅补充缺失字段
                        userInfo = {
                            userId,
                            username: username || user.username,
                            email: userEmail || user.email,
                            type: userType || user.type || 'C',
                            companyId: companyId || user.companyId || null,
                            roles: userRoles ? JSON.parse(userRoles) : (user.roles || []),
                        }

                        logger.info('从user-center服务补充用户信息', {
                            userId,
                            username: userInfo.username,
                            userType: userInfo.type,
                            traceId: ctx.state.traceId,
                        })
                    } else {
                        ctx.throw(404, 'User not found')
                    }
                } else {
                    // 尝试解析错误响应，保持原始错误码和消息
                    try {
                        const errorResult = await response.json()

                        logger.warn('user-center 返回错误', {
                            userId,
                            errorCode: errorResult.code,
                            errorMessage: errorResult.message,
                            httpStatus: response.status,
                            traceId: ctx.state.traceId,
                        })

                        // 创建错误对象，保持原始错误码
                        const error = new Error(errorResult.message || 'Failed to fetch user info from user-center')
                        error.status = response.status // HTTP 状态码
                        error.code = errorResult.code // 保持原始业务错误码
                        throw error
                    } catch (parseError) {
                        // 如果是已经抛出的错误，直接继续抛出
                        if (parseError.code) {
                            throw parseError
                        }

                        // 否则是解析失败
                        logger.error('解析 user-center 错误响应失败', {
                            userId,
                            httpStatus: response.status,
                            parseError: parseError.message,
                            traceId: ctx.state.traceId,
                        })

                        ctx.throw(response.status || 500, 'Failed to fetch user info from user-center')
                    }
                }
            } catch (error) {
                logger.warn('查询用户信息失败，使用现有信息继续', {
                    userId,
                    error: error.message,
                    errorCode: error.code,
                    traceId: ctx.state.traceId,
                })

                // 如果是连接错误（user-center不可用），使用现有信息继续
                // 这样在开发环境下不需要所有服务都运行
                if (error.message && error.message.includes('fetch failed')) {
                    logger.info('User-center不可用，使用基础用户信息继续', {
                        userId,
                        traceId: ctx.state.traceId,
                    })
                    // 继续使用基础用户信息
                } else {
                    // 如果错误包含状态码和业务错误码，保持原样抛出
                    if (error.status && error.code) {
                        const err = new Error(error.message)
                        err.status = error.status
                        err.code = error.code
                        throw err
                    }

                    // 否则抛出通用错误
                    ctx.throw(error.status || 500, error.message || 'Authentication failed')
                }
            }
        }

        ctx.state.user = userInfo

        logger.info('用户认证成功', {
            userId: userInfo.userId,
            userName: userInfo.username,
            userType: userInfo.type,
            traceId: ctx.state.traceId,
        })

        // 认证成功，执行下游处理，不要在这里捕获业务层错误
    } catch (error) {
        // 只处理认证阶段的错误
        logger.error('认证失败:', {
            error: error.message,
            stack: error.stack,
            traceId: ctx.state.traceId,
        })

        // 如果错误包含业务错误码，需要传递给上层
        if (error.code) {
            const err = new Error(error.message)
            err.status = error.status || 500
            err.code = error.code
            throw err
        } else if (error.status) {
            ctx.throw(error.status, error.message)
        } else {
            ctx.throw(500, 'Authentication failed')
        }
        return // 认证失败时直接返回，不执行下游处理
    }

    // 认证成功后，执行下游处理（业务逻辑）
    // 不要在认证中间件中捕获业务层错误
    await next()
}

// 内部服务认证中间件 - 用于k8s内网服务间调用
export const internalAuth = async (ctx, next) => {
    try {
        let userId = ctx.headers['x-user-id']

        if (!userId && config.debug.enabled && config.debug.userId) {
            userId = config.debug.userId
        }

        if (!userId) {
            ctx.throw(401, 'Missing X-User-ID header for internal service call')
        }

        // 内部服务调用，只需要userId即可
        ctx.state.user = {
            id: userId,
            type: 'internal',
            roles: [],
        }

        logger.info('内部服务认证成功', {
            userId,
            traceId: ctx.state.traceId,
        })

        await next()
    } catch (error) {
        logger.error('内部服务认证失败:', {
            error: error.message,
            stack: error.stack,
            traceId: ctx.state.traceId,
        })

        if (error.status) {
            ctx.throw(error.status, error.message)
        } else {
            ctx.throw(500, 'Internal authentication failed')
        }
    }
}
