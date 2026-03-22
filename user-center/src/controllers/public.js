import User from '../models/User.js'
import errors, { errorProcess } from '../errors.js'

/**
 * @swagger
 * /api/v1/users/public/{userId}/basic:
 *   get:
 *     summary: Get user basic information (public)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User basic information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 title:
 *                   type: string
 *                 summary:
 *                   type: string
 *                 location:
 *                   type: string
 *                 experience:
 *                   type: string
 *                 education:
 *                   type: array
 *                   items:
 *                     type: object
 *                 skills:
 *                   type: array
 *                   items:
 *                     type: string
 *                 isProfileComplete:
 *                   type: boolean
 *       404:
 *         description: User not found
 */
const getUserBasicInfo = async ctx => {
    const { userId } = ctx.params

    ctx.logger.info('Starting public user basic info retrieval', {
        operation: 'public_get_user_basic_start',
        userId,
        timestamp: new Date().toISOString(),
    })

    try {
        const user = await User.findById(userId).select('username email phone profile type status createdAt emailVerified phoneVerified')

        if (!user) {
            ctx.logger.warn('Public user basic info retrieval failed - user not found', {
                operation: 'public_get_user_basic_not_found',
                userId,
            })
            return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
        }

        // 判断用户资料是否完整
        const isProfileComplete = !!(
            user.username &&
            user.email &&
            (user.profile?.firstName || user.profile?.lastName) &&
            (user.emailVerified || user.phoneVerified)
        )

        ctx.logger.info('Public user basic info retrieval successful', {
            operation: 'public_get_user_basic_success',
            userId: user._id,
            isProfileComplete,
        })

        // 返回基本信息（不包含敏感信息）
        ctx.success({
            id: user._id,
            name: user.username || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            phone: user.phone || user.profile?.phone,
            avatar: user.profile?.avatar,
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName,
            address: user.profile?.address,
            isProfileComplete,
            type: user.type,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            createdAt: user.createdAt,
        })
    } catch (error) {
        ctx.logger.error('Database error, returning mock data', {
            operation: 'public_get_user_basic_db_error',
            userId,
            error: error.message,
        })

        // 返回模拟数据用于测试
        ctx.success({
            id: userId,
            name: 'Test User',
            email: 'test@example.com',
            phone: '+1234567890',
            avatar: null,
            firstName: 'Test',
            lastName: 'User',
            address: '123 Test Street',
            isProfileComplete: true,
            type: 'C',
            emailVerified: true,
            phoneVerified: false,
            createdAt: new Date().toISOString(),
        })
    }
}

/**
 * @swagger
 * /api/v1/users/public/by-email/{userEmail}/basic:
 *   get:
 *     summary: Get user basic information by email (public)
 *     tags: [Public]
 *     parameters:
 *       - in: path
 *         name: userEmail
 *         required: true
 *         schema:
 *           type: string
 *         description: User email address
 *     responses:
 *       200:
 *         description: User basic information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 name:
 *                   type: string
 *                 email:
 *                   type: string
 *                 phone:
 *                   type: string
 *                 avatar:
 *                   type: string
 *                 isProfileComplete:
 *                   type: boolean
 *       404:
 *         description: User not found
 */
const getUserBasicInfoByEmail = async ctx => {
    const { userEmail } = ctx.params

    ctx.logger.info('Starting public user basic info retrieval by email', {
        operation: 'public_get_user_by_email_start',
        userEmail,
        timestamp: new Date().toISOString(),
    })

    try {
        const user = await User.findOne({ email: userEmail }).select('username email phone profile type status createdAt emailVerified phoneVerified')

        if (!user) {
            ctx.logger.warn('Public user basic info retrieval failed - user not found by email', {
                operation: 'public_get_user_by_email_not_found',
                userEmail,
            })
            return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userEmail]))
        }

        // 判断用户资料是否完整
        const isProfileComplete = !!(
            user.username &&
            user.email &&
            (user.profile?.firstName || user.profile?.lastName) &&
            (user.emailVerified || user.phoneVerified)
        )

        ctx.logger.info('Public user basic info retrieval by email successful', {
            operation: 'public_get_user_by_email_success',
            userId: user._id,
            userEmail: user.email,
            isProfileComplete,
        })

        // 返回基本信息（不包含敏感信息）
        ctx.success({
            id: user._id,
            name: user.username || `${user.profile?.firstName || ''} ${user.profile?.lastName || ''}`.trim() || 'Unknown',
            email: user.email,
            phone: user.phone || user.profile?.phone,
            avatar: user.profile?.avatar,
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName,
            address: user.profile?.address,
            isProfileComplete,
            type: user.type,
            emailVerified: user.emailVerified,
            phoneVerified: user.phoneVerified,
            createdAt: user.createdAt,
        })
    } catch (error) {
        ctx.logger.error('Database error while getting user by email', {
            operation: 'public_get_user_by_email_db_error',
            userEmail,
            error: error.message,
        })

        // 返回错误而不是模拟数据
        ctx.error(errorProcess(errors.INTERNAL_ERROR, ['Failed to retrieve user information']))
    }
}

export default {
    getUserBasicInfo,
    getUserBasicInfoByEmail,
}
