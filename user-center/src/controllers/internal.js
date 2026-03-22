import User from '../models/User.js'
import { USER_STATUS, USER_TYPE } from '../libs/constants.js'
import JWTService from '../libs/jwt.js'
import { getEmployeeCompanyInfo } from '../clients/servers/company.js'

const jwtService = new JWTService()

/**
 * @swagger
 * /api/v1/internal/users:
 *   get:
 *     summary: 获取用户列表（内部服务接口）
 *     description: |
 *       仅供集群内部服务调用，不通过 Gateway 暴露。
 *       支持分页、状态筛选、类型筛选、关键词搜索、批量ID查询、时间范围筛选。
 *     tags: [Internal]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每页条数（最大100）
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive, banned]
 *         description: 用户状态筛选
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [C, B]
 *         description: 用户类型筛选（C=客户端用户, B=企业用户）
 *       - in: query
 *         name: keyword
 *         schema:
 *           type: string
 *         description: 关键词搜索（匹配用户名、邮箱）
 *       - in: query
 *         name: ids
 *         schema:
 *           type: string
 *         description: 用户ID列表，逗号分隔
 *       - in: query
 *         name: createdFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 创建时间起始（ISO 8601格式）
 *       - in: query
 *         name: createdTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 创建时间截止（ISO 8601格式）
 *     responses:
 *       200:
 *         description: 用户列表
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       username:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phone:
 *                         type: string
 *                       type:
 *                         type: string
 *                       status:
 *                         type: string
 *                       profile:
 *                         type: object
 *                       emailVerified:
 *                         type: boolean
 *                       phoneVerified:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastLoginAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
const getUsers = async ctx => {
    const { page = 1, limit = 20, status, type, keyword, ids, createdFrom, createdTo } = ctx.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    ctx.logger.info('Internal API: Starting user list retrieval', {
        operation: 'internal_get_users_start',
        params: { page: pageNum, limit: limitNum, status, type, keyword, ids },
    })

    // 构建查询条件
    const query = {}

    // 状态筛选
    if (status && Object.values(USER_STATUS).includes(status.toLowerCase())) {
        query.status = status.toLowerCase()
    }

    // 类型筛选
    if (type && Object.values(USER_TYPE).includes(type)) {
        query.type = type
    }

    // 关键词搜索（用户名或邮箱）
    if (keyword) {
        query.$or = [{ username: { $regex: keyword, $options: 'i' } }, { email: { $regex: keyword, $options: 'i' } }]
    }

    // 批量ID查询
    if (ids) {
        const idList = ids
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        if (idList.length > 0) {
            query._id = { $in: idList }
        }
    }

    // 时间范围筛选
    if (createdFrom || createdTo) {
        query.createdAt = {}
        if (createdFrom) {
            query.createdAt.$gte = new Date(createdFrom)
        }
        if (createdTo) {
            query.createdAt.$lte = new Date(createdTo)
        }
    }

    // 执行查询
    const [users, total] = await Promise.all([
        User.find(query).select('-password -refreshTokens').sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        User.countDocuments(query),
    ])

    const totalPages = Math.ceil(total / limitNum)

    ctx.logger.info('Internal API: User list retrieval successful', {
        operation: 'internal_get_users_success',
        resultCount: users.length,
        total,
        page: pageNum,
        totalPages,
    })

    ctx.success({
        users: users.map(user => ({
            id: user._id,
            username: user.username,
            email: user.email,
            phone: user.phone,
            type: user.type,
            status: user.status,
            profile: user.profile,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
        })),
        pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages,
        },
    })
}

/**
 * @swagger
 * /api/v1/internal/users/{userId}:
 *   get:
 *     summary: 获取用户详情（内部服务接口）
 *     description: |
 *       仅供集群内部服务调用，不通过 Gateway 暴露。
 *       可选包含角色和权限信息。
 *     tags: [Internal]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户UUID
 *       - in: query
 *         name: includeRoles
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: 是否包含角色信息
 *       - in: query
 *         name: includePermissions
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *         description: 是否包含权限信息
 *     responses:
 *       200:
 *         description: 用户详情
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 username:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 type:
 *                   type: string
 *                 status:
 *                   type: string
 *                 profile:
 *                   type: object
 *                 emailVerified:
 *                   type: boolean
 *                 phoneVerified:
 *                   type: boolean
 *                 twoFactorEnabled:
 *                   type: boolean
 *                 loginCount:
 *                   type: integer
 *                 lastLoginAt:
 *                   type: string
 *                   format: date-time
 *                 lastLoginPlatform:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *                 roles:
 *                   type: array
 *                   description: 仅当 includeRoles=true 时返回
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                 permissions:
 *                   type: array
 *                   description: 仅当 includePermissions=true 时返回
 *                   items:
 *                     type: string
 *       404:
 *         description: 用户不存在
 */
const getUserById = async ctx => {
    const { userId } = ctx.params
    const { includeRoles, includePermissions } = ctx.query

    ctx.logger.info('Internal API: Starting user detail retrieval', {
        operation: 'internal_get_user_by_id_start',
        userId,
        includeRoles,
        includePermissions,
    })

    // 构建查询
    let userQuery = User.findById(userId).select('-password -refreshTokens')

    // 是否包含角色信息
    if (includeRoles === 'true' || includePermissions === 'true') {
        userQuery = userQuery.populate({
            path: 'roles',
            populate: includePermissions === 'true' ? { path: 'permissions' } : undefined,
        })
    }

    const user = await userQuery.lean()

    if (!user) {
        ctx.logger.warn('Internal API: User not found', {
            operation: 'internal_get_user_by_id_not_found',
            userId,
        })
        return ctx.error({ code: 404, message: `User not found: ${userId}` })
    }

    // 构建响应数据
    const responseData = {
        id: user._id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        type: user.type,
        status: user.status,
        profile: user.profile,
        emailVerified: user.emailVerified,
        phoneVerified: user.phoneVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        loginCount: user.loginCount,
        lastLoginAt: user.lastLoginAt,
        lastLoginPlatform: user.lastLoginPlatform,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    }

    // 添加角色信息
    if (includeRoles === 'true' && user.roles) {
        responseData.roles = user.roles.map(role => ({
            id: role._id,
            name: role.name,
            description: role.description,
        }))
    }

    // 添加权限信息
    if (includePermissions === 'true' && user.roles) {
        const permissions = new Set()
        user.roles.forEach(role => {
            if (role.permissions) {
                role.permissions.forEach(permission => {
                    permissions.add(permission.name || `${permission.resource}:${permission.action}`)
                })
            }
        })
        responseData.permissions = Array.from(permissions)
    }

    ctx.logger.info('Internal API: User detail retrieval successful', {
        operation: 'internal_get_user_by_id_success',
        userId: user._id,
        username: user.username,
    })

    ctx.success(responseData)
}

/**
 * @swagger
 * /api/v1/internal/users/{userId}/token:
 *   post:
 *     summary: 为用户生成新的 JWT Token（内部服务接口）
 *     description: |
 *       仅供集群内部服务调用，不通过 Gateway 暴露。
 *       根据用户ID生成新的 access token，用于内部服务代表用户进行操作。
 *       B端用户的 companyId 会自动从 company-service 获取。
 *     tags: [Internal]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android, desktop, api]
 *                 default: api
 *                 description: 登录平台
 *     responses:
 *       200:
 *         description: Token 生成成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT access token
 *                 accessTokenExpiryAt:
 *                   type: string
 *                   format: date-time
 *                   description: Token 过期时间
 *                 user:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     username:
 *                       type: string
 *                     email:
 *                       type: string
 *                     type:
 *                       type: string
 *       404:
 *         description: 用户不存在
 *       403:
 *         description: 用户状态异常（非活跃状态）
 */
const generateUserToken = async ctx => {
    const { userId } = ctx.params
    const { platform = 'api' } = ctx.request.body || {}

    ctx.logger.info('Internal API: Starting user token generation', {
        operation: 'internal_generate_user_token_start',
        userId,
        platform,
    })

    // 查找用户
    const user = await User.findById(userId)

    if (!user) {
        ctx.logger.warn('Internal API: User not found for token generation', {
            operation: 'internal_generate_user_token_not_found',
            userId,
        })
        return ctx.error({ code: 404, message: `User not found: ${userId}` })
    }

    // 检查用户状态
    if (user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Internal API: User not active for token generation', {
            operation: 'internal_generate_user_token_inactive',
            userId,
            status: user.status,
        })
        return ctx.error({ code: 403, message: `User is not active: ${userId}, status: ${user.status}` })
    }

    // 获取公司ID（仅B端用户）
    const companyId = await getEmployeeCompanyInfo(user, ctx, 'internal_generate_user_token')

    // 生成新的 access token
    const { accessToken, accessTokenExpiryAt } = await jwtService.generateAccessToken(user, {
        platform,
        companyId,
    })

    ctx.logger.info('Internal API: User token generated successfully', {
        operation: 'internal_generate_user_token_success',
        userId: user._id,
        username: user.username,
        userType: user.type,
        companyId,
        platform,
        accessTokenExpiryAt,
    })

    ctx.success({
        accessToken,
        accessTokenExpiryAt,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            type: user.type,
        },
    })
}

export default {
    getUsers,
    getUserById,
    generateUserToken,
}
