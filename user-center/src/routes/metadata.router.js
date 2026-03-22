import Router from 'koa-router'
import { success } from '../../utils/response.js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取 package.json 获取版本信息
const packageJsonPath = join(__dirname, '../../package.json')
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))

const router = new Router({ prefix: '/api/v1' })

/**
 * 服务元数据接口
 * 为 Gateway 服务发现提供所需的配置信息
 */
router.get('/metadata', async ctx => {
    const metadata = {
        // 服务基本信息
        name: 'xmax-user-center-service',
        version: packageJson.version,
        description: 'XMAX用户中心服务 - 负责用户认证、权限管理和JWT鉴权',

        // 服务标识符 - 用于Gateway错误代码前缀
        appCode: parseInt(process.env.APP_CODE) || 3001,
        appId: process.env.APP_ID || 'xmax-user-center-service',
        appName: process.env.APP_NAME || 'xmax-user-center-service',

        // 服务配置
        config: {
            baseUrl: process.env.SERVICE_BASE_URL || 'http://localhost:3001',
            healthCheck: '/health',
            documentation: '/swagger',
            maintainer: 'XMAX Team',
            environment: process.env.NODE_ENV || 'development',
        },

        // 路由配置 - Gateway 需要代理的接口
        routes: [
            // 认证相关路由
            {
                method: 'POST',
                path: '/api/v1/auth/register',
                description: '用户注册',
                authentication: false, // 公开接口
                rateLimit: {
                    windowMs: 900000, // 15分钟
                    maxRequests: 5, // 最多5次注册请求
                },
            },
            {
                method: 'POST',
                path: '/api/v1/auth/login-with-psw',
                description: '密码登录',
                authentication: false,
                rateLimit: {
                    windowMs: 900000,
                    maxRequests: 10,
                },
            },
            {
                method: 'POST',
                path: '/api/v1/auth/send-login-code',
                description: '发送登录验证码',
                authentication: false,
                rateLimit: {
                    windowMs: 60000,
                    maxRequests: 1,
                },
            },
            {
                method: 'POST',
                path: '/api/v1/auth/login-with-code',
                description: '验证码登录',
                authentication: false,
                rateLimit: {
                    windowMs: 900000,
                    maxRequests: 5,
                },
            },
            {
                method: 'POST',
                path: '/api/v1/auth/refresh',
                description: 'Token刷新',
                authentication: false,
            },
            {
                method: 'POST',
                path: '/api/v1/auth/logout',
                description: '用户登出',
                authentication: true,
            },
            {
                method: 'POST',
                path: '/api/v1/auth/verify-token',
                description: 'Token验证',
                authentication: false,
            },
            {
                method: 'GET',
                path: '/api/v1/auth/verify-email-link',
                description: '邮箱验证链接',
                authentication: false,
            },
            {
                method: 'POST',
                path: '/api/v1/auth/forgot-password',
                description: '忘记密码',
                authentication: false,
                rateLimit: {
                    windowMs: 900000,
                    maxRequests: 3,
                },
            },
            {
                method: 'POST',
                path: '/api/v1/auth/change-password-with-code',
                description: '通过验证码重置密码',
                authentication: false,
                rateLimit: {
                    windowMs: 900000,
                    maxRequests: 3,
                },
            },

            // 用户管理路由
            {
                method: 'GET',
                path: '/api/v1/users/profile',
                description: '获取用户资料',
                authentication: true,
            },
            {
                method: 'PUT',
                path: '/api/v1/users/profile',
                description: '更新用户资料',
                authentication: true,
            },
            {
                method: 'GET',
                path: '/api/v1/users/permissions',
                description: '获取用户权限',
                authentication: true,
            },
            {
                method: 'GET',
                path: '/api/v1/users/roles',
                description: '获取用户角色',
                authentication: true,
            },

            // 公开用户信息路由（不需要认证）
            {
                method: 'GET',
                path: '/api/v1/users/public/:userId/basic',
                description: '获取用户基本信息（公开）',
                authentication: false,
            },
            {
                method: 'GET',
                path: '/api/v1/users/public/by-email/:userEmail/basic',
                description: '通过邮箱获取用户基本信息（公开）',
                authentication: false,
            },

            // 角色管理路由
            {
                method: 'GET',
                path: '/api/v1/roles',
                description: '获取角色列表',
                authentication: true,
            },
            {
                method: 'POST',
                path: '/api/v1/roles',
                description: '创建角色',
                authentication: true,
            },
            {
                method: 'GET',
                path: '/api/v1/roles/:id',
                description: '获取角色详情',
                authentication: true,
            },
            {
                method: 'PUT',
                path: '/api/v1/roles/:id',
                description: '更新角色',
                authentication: true,
            },
            {
                method: 'DELETE',
                path: '/api/v1/roles/:id',
                description: '删除角色',
                authentication: true,
            },

            // 权限管理路由
            {
                method: 'GET',
                path: '/api/v1/permissions',
                description: '获取权限列表',
                authentication: true,
            },
            {
                method: 'POST',
                path: '/api/v1/permissions',
                description: '创建权限',
                authentication: true,
            },
            {
                method: 'GET',
                path: '/api/v1/permissions/:id',
                description: '获取权限详情',
                authentication: true,
            },
            {
                method: 'PUT',
                path: '/api/v1/permissions/:id',
                description: '更新权限',
                authentication: true,
            },
            {
                method: 'DELETE',
                path: '/api/v1/permissions/:id',
                description: '删除权限',
                authentication: true,
            },
        ],

        // 权限配置 - RBAC权限要求
        permissions: [
            // 用户相关权限
            {
                method: 'GET',
                path: '/api/v1/users/profile',
                permission: 'user:read',
                description: '查看用户资料权限',
            },
            {
                method: 'PUT',
                path: '/api/v1/users/profile',
                permission: 'user:update',
                description: '更新用户资料权限',
            },
            {
                method: 'GET',
                path: '/api/v1/users/permissions',
                permission: 'user:read',
                description: '查看用户权限',
            },
            {
                method: 'GET',
                path: '/api/v1/users/roles',
                permission: 'user:read',
                description: '查看用户角色',
            },

            // 角色管理权限
            {
                method: 'GET',
                path: '/api/v1/roles',
                permission: 'role:read',
                roles: ['admin', 'super_admin'],
                description: '查看角色列表权限',
            },
            {
                method: 'POST',
                path: '/api/v1/roles',
                permission: 'role:create',
                roles: ['super_admin'],
                description: '创建角色权限',
            },
            {
                method: 'GET',
                path: '/api/v1/roles/:id',
                permission: 'role:read',
                roles: ['admin', 'super_admin'],
                description: '查看角色详情权限',
            },
            {
                method: 'PUT',
                path: '/api/v1/roles/:id',
                permission: 'role:update',
                roles: ['super_admin'],
                description: '更新角色权限',
            },
            {
                method: 'DELETE',
                path: '/api/v1/roles/:id',
                permission: 'role:delete',
                roles: ['super_admin'],
                description: '删除角色权限',
            },

            // 权限管理权限
            {
                method: 'GET',
                path: '/api/v1/permissions',
                permission: 'permission:read',
                roles: ['super_admin'],
                description: '查看权限列表权限',
            },
            {
                method: 'POST',
                path: '/api/v1/permissions',
                permission: 'permission:create',
                roles: ['super_admin'],
                description: '创建权限权限',
            },
            {
                method: 'GET',
                path: '/api/v1/permissions/:id',
                permission: 'permission:read',
                roles: ['super_admin'],
                description: '查看权限详情权限',
            },
            {
                method: 'PUT',
                path: '/api/v1/permissions/:id',
                permission: 'permission:update',
                roles: ['super_admin'],
                description: '更新权限权限',
            },
            {
                method: 'DELETE',
                path: '/api/v1/permissions/:id',
                permission: 'permission:delete',
                roles: ['super_admin'],
                description: '删除权限权限',
            },
        ],

        // 内部服务接口 - 不需要通过Gateway代理
        internalRoutes: [
            {
                method: 'POST',
                path: '/api/v1/check/permission',
                description: '权限检查接口（内部服务调用）',
            },
            {
                method: 'POST',
                path: '/api/v1/check/role',
                description: '角色检查接口（内部服务调用）',
            },
        ],

        // 服务能力声明
        capabilities: {
            authentication: true, // 提供认证服务
            authorization: true, // 提供授权服务
            userManagement: true, // 提供用户管理
            roleManagement: true, // 提供角色管理
            permissionManagement: true, // 提供权限管理
            emailVerification: true, // 提供邮箱验证
            passwordReset: true, // 提供密码重置
            multiFactorAuth: false, // 暂不支持多因子认证
            socialLogin: false, // 暂不支持社交登录
        },

        // 依赖的服务
        dependencies: {
            database: {
                type: 'MongoDB',
                required: true,
            },
            cache: {
                type: 'Redis',
                required: true,
            },
            email: {
                type: 'Mailgun',
                required: true,
            },
        },

        // 监控和健康检查
        monitoring: {
            healthCheck: '/health',
            metrics: '/metrics',
            status: '/status',
            version: '/version',
        },

        // 最后更新时间
        lastUpdated: new Date().toISOString(),

        // 元数据版本
        metadataVersion: '1.0.0',
    }

    success(ctx, metadata)
})

export default router
