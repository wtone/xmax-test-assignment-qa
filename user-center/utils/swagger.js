import swaggerJsdoc from 'swagger-jsdoc'
import { koaSwagger } from 'koa2-swagger-ui'

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'XMAX User Center Service API',
            version: '1.0.0',
            description: `User registration, authentication, and RBAC permission management service

## 微服务认证机制

本服务支持两种认证方式：

### 1. JWT Bearer Token (直接访问)
使用标准的 Authorization: Bearer <token> 头部

### 2. 网关代理认证 (推荐)
通过API网关访问时，网关会自动添加以下头部信息：
- **X-User-ID**: 用户ID （网关认证的核心标识） 
- **X-User-Username**: 用户名
- **X-User-Email**: 用户邮箱
- **X-User-Type**: 用户类型 (C=客户端用户, B=企业用户)
- **X-User-Roles**: 用户角色JSON数组字符串
- **X-User-Permissions**: 用户权限JSON数组字符串
- **X-Trace-ID**: 请求追踪ID

当检测到这些网关头部时，服务会跳过JWT验证，提高性能。`,
            contact: {
                name: 'XMAX Team',
                email: 'dev@xmax.com',
            },
        },
        servers: [
            {
                url: '/',
                description: 'Development server',
            },
            {
                url: process.env.API_BASE_URL || '/',
                description: 'Deploy server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                'X-User-ID': {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-User-ID',
                    description: '网关传递的用户ID（网关认证的核心标识）',
                },
            },
            parameters: {
                'X-User-ID': {
                    name: 'X-User-ID',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                    },
                    description: '网关传递的用户ID',
                },
                'X-User-Username': {
                    name: 'X-User-Username',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                    },
                    description: '网关传递的用户名',
                },
                'X-User-Email': {
                    name: 'X-User-Email',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                        format: 'email',
                    },
                    description: '网关传递的用户邮箱',
                },
                'X-User-Type': {
                    name: 'X-User-Type',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                        enum: ['C', 'B'],
                    },
                    description: '网关传递的用户类型: C-端用户(工程师) 或 B-端用户(企业)',
                },
                'X-User-Roles': {
                    name: 'X-User-Roles',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                    },
                    description: '网关传递的用户角色数组的JSON字符串，如: \'["user", "admin"]\'',
                },
                'X-User-Permissions': {
                    name: 'X-User-Permissions',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                    },
                    description: '网关传递的用户权限数组的JSON字符串，如: \'["user:read", "user:update"]\'',
                },
                'X-Trace-ID': {
                    name: 'X-Trace-ID',
                    in: 'header',
                    required: false,
                    schema: {
                        type: 'string',
                    },
                    description: '网关传递的追踪ID，用于请求链路追踪',
                },
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'User ID' },
                        username: { type: 'string', description: 'Username' },
                        email: { type: 'string', description: 'Email address' },
                        phone: { type: 'string', description: 'Phone number' },
                        type: { type: 'string', enum: ['C', 'B'], description: 'User type: C-end or B-end' },
                        status: { type: 'string', enum: ['active', 'inactive', 'banned'], description: 'User status' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Role: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Role ID' },
                        name: { type: 'string', description: 'Role name' },
                        description: { type: 'string', description: 'Role description' },
                        permissions: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Permission' },
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Permission: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Permission ID' },
                        name: { type: 'string', description: 'Permission name' },
                        action: { type: 'string', description: 'Action name' },
                        resource: { type: 'string', description: 'Resource name' },
                        description: { type: 'string', description: 'Permission description' },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                AuthResponse: {
                    type: 'object',
                    properties: {
                        accessToken: {
                            type: 'string',
                            description: 'JWT access token (7 days validity)',
                        },
                        refreshToken: {
                            type: 'string',
                            description: 'JWT refresh token (30 days validity)',
                        },
                        user: { $ref: '#/components/schemas/User' },
                        expiresIn: {
                            type: 'number',
                            description: 'Access token expiration time in seconds (604800 for 7 days)',
                        },
                    },
                },
                TokenVerificationResponse: {
                    type: 'object',
                    properties: {
                        valid: { type: 'boolean', description: 'Whether the token is valid' },
                        user: { $ref: '#/components/schemas/User' },
                    },
                },
                TokenManagementResponse: {
                    type: 'object',
                    properties: {
                        message: {
                            type: 'string',
                            description: 'Success message',
                        },
                    },
                },
                PasswordChangeRequest: {
                    type: 'object',
                    required: ['currentPassword', 'newPassword'],
                    properties: {
                        currentPassword: {
                            type: 'string',
                            description: 'Current password',
                        },
                        newPassword: {
                            type: 'string',
                            minLength: 6,
                            maxLength: 50,
                            description: 'New password (6-50 characters)',
                        },
                    },
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        code: { type: 'number', description: 'Response code' },
                        message: { type: 'string', description: 'Response message' },
                        data: { description: 'Response data' },
                        timestamp: { type: 'string', format: 'date-time', description: 'Response timestamp in ISO 8601 format' },
                        traceId: { type: 'string', description: 'Request trace ID' },
                    },
                },
            },
        },
        tags: [
            { name: 'Authentication', description: '用户认证相关接口（注册、登录、Token管理）' },
            { name: 'Users', description: '用户信息管理接口' },
            { name: 'Roles', description: '角色管理接口' },
            { name: 'Permissions', description: '权限管理接口' },
            { name: 'Internal', description: '内部服务接口 - 仅供集群内部服务调用，不通过 Gateway 暴露' },
        ],
    },
    apis: ['./src/controllers/*.js', './src/routes/*.js'],
}

const specs = swaggerJsdoc(options)

export const setupSwagger = app => {
    app.use(
        koaSwagger({
            routePrefix: '/swagger',
            swaggerOptions: { spec: specs },
            hideTopbar: true,
        }),
    )
}

export default specs
