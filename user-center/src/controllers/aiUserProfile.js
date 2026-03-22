import AiUserProfile from '../models/AiUserProfile.js'

// UUID v4 格式校验
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const isValidUUID = id => UUID_REGEX.test(id)

/**
 * @swagger
 * /api/v1/users/ai-profile:
 *   get:
 *     summary: 获取用户 AI 画像
 *     description: |
 *       根据 userId 获取用户的 AI 解析画像数据。
 *       仅供集群内部服务调用，使用 internal 认证。
 *     tags: [AI Profile]
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 用户 UUID
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: 需要返回的字段，逗号分隔
 *     responses:
 *       200:
 *         description: 获取成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 profileData:
 *                   type: object
 *                 metadata:
 *                   type: object
 *                   properties:
 *                     source:
 *                       type: string
 *                       enum: [ai, manual, mixed]
 *                     aiConfidence:
 *                       type: number
 *                     aiParsedFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                     aiParsedAt:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: integer
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 updatedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: userId 参数缺失
 *       404:
 *         description: 用户画像不存在
 */
const getAiProfile = async ctx => {
    const { userId, fields } = ctx.query

    if (!userId) {
        return ctx.error({ code: 400, message: 'userId is required' })
    }

    if (!isValidUUID(userId)) {
        return ctx.error({ code: 400, message: 'userId must be a valid UUID' })
    }

    ctx.logger.info('AI Profile API: Starting profile retrieval', {
        operation: 'get_ai_profile_start',
        userId,
        fields,
    })

    const profile = await AiUserProfile.findByUserId(userId)

    if (!profile) {
        ctx.logger.warn('AI Profile API: Profile not found', {
            operation: 'get_ai_profile_not_found',
            userId,
        })
        return ctx.error({ code: 404, message: `AI profile not found for userId: ${userId}` })
    }

    // 构建响应数据
    let responseData = {
        userId: profile.userId,
        profileData: profile.profileData,
        metadata: profile.metadata,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,
    }

    // 字段过滤
    if (fields) {
        const requestedFields = fields.split(',').map(f => f.trim())
        const filtered = { userId: profile.userId }
        requestedFields.forEach(field => {
            if (responseData[field] !== undefined) {
                filtered[field] = responseData[field]
            }
        })
        responseData = filtered
    }

    ctx.logger.info('AI Profile API: Profile retrieval successful', {
        operation: 'get_ai_profile_success',
        userId,
        version: profile.metadata?.version,
    })

    ctx.success(responseData)
}

/**
 * @swagger
 * /api/v1/users/ai-profile:
 *   put:
 *     summary: 创建或更新用户 AI 画像
 *     description: |
 *       接收 AI 服务解析的用户画像数据，创建或更新用户画像。
 *       仅供集群内部服务调用，使用 internal 认证。
 *     tags: [AI Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - profileData
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 用户 UUID
 *               profileData:
 *                 type: object
 *                 description: AI 解析的画像数据（灵活结构）
 *               confidence:
 *                 type: number
 *                 description: AI 解析置信度（0-1）
 *               parsedFields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 本次解析的字段列表
 *     responses:
 *       200:
 *         description: 操作成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 operation:
 *                   type: string
 *                   enum: [created, updated]
 *                 version:
 *                   type: integer
 *       400:
 *         description: 参数错误
 */
const upsertAiProfile = async ctx => {
    const { userId, profileData, confidence, parsedFields } = ctx.request.body

    if (!userId) {
        return ctx.error({ code: 400, message: 'userId is required' })
    }

    if (!isValidUUID(userId)) {
        return ctx.error({ code: 400, message: 'userId must be a valid UUID' })
    }

    if (!profileData || typeof profileData !== 'object') {
        return ctx.error({ code: 400, message: 'profileData is required and must be an object' })
    }

    ctx.logger.info('AI Profile API: Starting profile upsert', {
        operation: 'upsert_ai_profile_start',
        userId,
        confidence,
        parsedFieldsCount: parsedFields?.length || 0,
    })

    const result = await AiUserProfile.upsertByUserId(userId, profileData, {
        confidence,
        parsedFields,
        source: 'ai',
    })

    ctx.logger.info('AI Profile API: Profile upsert successful', {
        operation: 'upsert_ai_profile_success',
        userId,
        resultOperation: result.operation,
        version: result.version,
    })

    ctx.success(result)
}

export default {
    getAiProfile,
    upsertAiProfile,
}
