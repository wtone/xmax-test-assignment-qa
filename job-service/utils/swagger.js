/**
 * Swagger API 文档配置
 */

import swaggerJSDoc from 'swagger-jsdoc'
import { koaSwagger } from 'koa2-swagger-ui'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取 package.json 获取版本信息
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'))

// Swagger 定义
const swaggerDefinition = {
    openapi: '3.0.0',
    info: {
        title: 'XMAX Job Service API',
        version: packageJson.version || '1.0.0',
        description: `职位管理服务 - 提供职位发布、申请管理、合同签约等功能

## 认证方式

本服务支持两种认证方式：

### 1. JWT Bearer Token (直接访问)
使用标准的 Authorization: Bearer <token> 头部

### 2. Gateway认证（推荐）
当通过API Gateway访问时，使用Gateway提供的认证头：
- \`X-User-ID\`: 用户ID（必需）

当检测到网关头部时，服务会跳过JWT验证，提高性能。`,
        contact: {
            name: 'XMAX HR Platform Team',
            email: 'support@xmax.com',
        },
        license: {
            name: 'Private',
            url: 'https://xmax.com/license',
        },
    },
    servers: [
        {
            url: '/',
            description: '开发环境',
        },
        // {
        //   url: 'https://api.xmax.com',
        //   description: '生产环境'
        // }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT Bearer Token (直接访问时使用)',
            },
            GatewayAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'X-User-ID',
                description: '网关认证 - 用户ID（通过API Gateway访问时使用）',
            },
        },
        schemas: {
            SuccessResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        example: true,
                    },
                    message: {
                        type: 'string',
                        example: '操作成功',
                    },
                    data: {
                        type: 'object',
                        description: '响应数据',
                    },
                    timestamp: {
                        type: 'number',
                        example: 1690123456789,
                    },
                },
            },
            ErrorResponse: {
                type: 'object',
                properties: {
                    success: {
                        type: 'boolean',
                        example: false,
                    },
                    code: {
                        type: 'number',
                        example: 40001,
                    },
                    message: {
                        type: 'string',
                        example: '请求参数错误',
                    },
                    detail: {
                        type: 'string',
                        description: '详细错误信息',
                    },
                    timestamp: {
                        type: 'number',
                        example: 1690123456789,
                    },
                    traceId: {
                        type: 'string',
                        example: 'trace-123456',
                    },
                },
            },
            JobPost: {
                type: 'object',
                properties: {
                    jobId: {
                        type: 'string',
                        example: 'job_20230723_abc123',
                    },
                    companyId: {
                        type: 'string',
                        example: 'comp_123e4567-e89b-12d3-a456-426614174000',
                        description: '公司ID（系统自动设置，基于用户认证信息）',
                        readOnly: true,
                    },
                    companyName: {
                        type: 'string',
                        example: '示例科技有限公司',
                        description: '公司名称',
                    },
                    showCompanyName: {
                        type: 'boolean',
                        example: true,
                        description: '是否显示公司真实名称（false时使用companyAlias）',
                    },
                    companyAlias: {
                        type: 'string',
                        example: '某大型科技公司',
                        maxLength: 100,
                        description: '公司代称（匿名展示时使用，不填则默认为"匿名公司"）',
                    },
                    title: {
                        type: 'string',
                        example: '高级JAVA工程师',
                    },
                    description: {
                        type: 'string',
                        example:
                            '1. 负责公司核心产品的后端架构设计、技术选型，主导并实现业务模块的开发\n2. 负责系统性能优化和高并发处理\n3. 制定并完善开发规范，建立技术文档体系',
                        minLength: 50,
                        maxLength: 30000,
                        description: '职位描述（50-30000字符）',
                    },
                    otherRequirements: {
                        type: 'string',
                        maxLength: 5000,
                        description: '供模型评估使用的补充要求（不对C端展示）',
                        example: '请重点关注候选人的科研背景与团队协作能力',
                    },
                    location: {
                        type: 'string',
                        example: '上海',
                    },
                    remote: {
                        type: 'boolean',
                        example: true,
                    },
                    salaryRange: {
                        type: 'object',
                        properties: {
                            min: {
                                type: 'number',
                                example: 500,
                            },
                            max: {
                                type: 'number',
                                example: 1000,
                            },
                            currency: {
                                type: 'string',
                                example: 'CNY',
                            },
                            period: {
                                type: 'string',
                                enum: ['hour', 'day', 'month', 'year'],
                                example: 'day',
                            },
                        },
                    },
                    contractType: {
                        type: 'string',
                        enum: ['full-time', 'part-time', 'freelance', 'internship'],
                        example: 'full-time',
                    },
                    status: {
                        type: 'string',
                        enum: ['draft', 'published', 'paused', 'closed', 'archived'],
                        example: 'published',
                    },
                    skills: {
                        type: 'array',
                        items: {
                            type: 'string',
                        },
                        example: ['React', 'TypeScript', 'Node.js'],
                    },
                },
            },
            AppointmentPayment: {
                type: 'object',
                description: '面试预约支付信息（通过 payment-service 管理）',
                properties: {
                    orderId: {
                        type: 'string',
                        description: 'payment-service 订单ID',
                        example: 'o_280693668065710080',
                    },
                    amount: {
                        type: 'number',
                        description: '支付金额',
                        example: 100,
                    },
                    currency: {
                        type: 'string',
                        description: '货币类型',
                        example: 'CNY',
                    },
                    channel: {
                        type: 'string',
                        description: '支付渠道',
                        enum: ['balance_points', 'wechat', 'alipay'],
                        example: 'balance_points',
                    },
                    status: {
                        type: 'string',
                        description: '支付状态',
                        enum: ['UNPAID', 'FROZEN', 'CHARGED', 'REFUNDED', 'FAILED'],
                        example: 'FROZEN',
                    },
                    transactionId: {
                        type: 'string',
                        nullable: true,
                        description: '交易ID（扣款成功后设置）',
                    },
                    frozenAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: '冻结时间（创建预约时）',
                    },
                    chargedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: '扣款时间（C端加入面试时）',
                    },
                    refundedAt: {
                        type: 'string',
                        format: 'date-time',
                        nullable: true,
                        description: '退款时间（取消/拒绝/缺席时）',
                    },
                    refundAmount: {
                        type: 'number',
                        nullable: true,
                        description: '退款金额（全额退款）',
                    },
                    refundReason: {
                        type: 'string',
                        nullable: true,
                        description: '退款原因',
                    },
                    failReason: {
                        type: 'string',
                        nullable: true,
                        description: '支付失败原因',
                    },
                },
            },
        },
    },
    tags: [
        {
            name: '健康检查',
            description: '服务健康状态监控',
        },
        {
            name: '服务元数据',
            description: '服务配置和路由信息',
        },
        {
            name: 'B端-职位管理',
            description: '企业端职位发布和管理',
        },
        {
            name: 'B端-候选人管理',
            description: '企业端候选人申请管理',
        },
        {
            name: 'C端-职位浏览',
            description: '求职者端职位搜索和查看',
        },
        {
            name: 'C端-申请管理',
            description: '求职者端申请提交和跟踪',
        },
        {
            name: 'B端-面试预约',
            description: '企业端面试预约管理（支付通过 payment-service 处理）',
        },
        {
            name: 'C端-面试预约',
            description: '求职者端面试预约操作（C端加入面试触发扣款，取消/拒绝触发退款）',
        },
        {
            name: '通用-选项数据',
            description: '公共选项数据接口，如职位类型、学历等',
        },
        {
            name: 'B端-影子人才',
            description: '影子候选人管理 - 推荐系统推送候选人、B端邀请投递',
        },
        {
            name: 'Internal',
            description: '内部服务接口 - 仅供集群内部服务调用，不通过 Gateway 暴露',
        },
    ],
}

// Swagger 选项
const options = {
    definition: swaggerDefinition,
    apis: [join(__dirname, '../src/routes/*.js'), join(__dirname, '../src/controllers/*.js'), join(__dirname, '../app.js')],
}

// 生成 Swagger 规范
export const swaggerSpec = swaggerJSDoc(options)

// Swagger UI 配置
export const swaggerUIOptions = {
    routePrefix: '/swagger',
    specPrefix: '/swagger/json',
    exposeSpec: true,
    swaggerOptions: {
        url: '/swagger/json',
        supportedSubmitMethods: ['get', 'post', 'put', 'delete'],
        docExpansion: 'none',
        jsonEditor: true,
        defaultModelRendering: 'schema',
        showRequestHeaders: true,
        showOperationIds: true,
        showRawModels: true,
    },
}

// 导出 Swagger 中间件
export function setupSwagger(app) {
    app.use(koaSwagger(swaggerUIOptions))
}
