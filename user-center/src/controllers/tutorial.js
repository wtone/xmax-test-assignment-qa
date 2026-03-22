import TutorialProgress from '../models/TutorialProgress.js'
import errors, { errorProcess } from '../errors.js'

/**
 * @swagger
 * /api/v1/users/tutorial/actions/{actionType}:
 *   post:
 *     summary: Record completion of a tutorial action
 *     tags: [Tutorial]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     parameters:
 *       - in: path
 *         name: actionType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type of tutorial action completed
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               metadata:
 *                 type: object
 *                 description: Optional metadata for the action
 *     responses:
 *       200:
 *         description: Action recorded successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     actionType:
 *                       type: string
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid action type
 *       409:
 *         description: Action already completed
 */
const recordAction = async ctx => {
    const userId = ctx.state.user.id
    const { actionType } = ctx.params
    const { metadata = {} } = ctx.request.body || {}

    ctx.logger.info('Starting tutorial action recording', {
        operation: 'tutorial_record_action_start',
        userId,
        actionType,
        timestamp: new Date().toISOString(),
    })

    // 验证actionType参数
    if (!actionType || typeof actionType !== 'string' || actionType.trim().length === 0) {
        ctx.logger.warn('Tutorial action recording failed - invalid action type', {
            operation: 'tutorial_record_action_invalid_type',
            userId,
            actionType,
        })
        return ctx.error(errorProcess(errors.TUTORIAL_INVALID_ACTION_TYPE))
    }

    // 验证actionType长度
    const trimmedActionType = actionType.trim()
    if (trimmedActionType.length > 50) {
        ctx.logger.warn('Tutorial action recording failed - action type too long', {
            operation: 'tutorial_record_action_type_too_long',
            userId,
            actionType: trimmedActionType,
            length: trimmedActionType.length,
        })
        return ctx.error(errorProcess(errors.TUTORIAL_ACTION_TYPE_TOO_LONG))
    }

    try {
        ctx.logger.info('Recording tutorial action', {
            operation: 'tutorial_record_action_processing',
            userId,
            actionType: trimmedActionType,
            hasMetadata: Object.keys(metadata).length > 0,
        })

        const result = await TutorialProgress.recordAction(userId, trimmedActionType, metadata)

        if (!result.success) {
            if (result.error?.code === 409006) {
                ctx.logger.warn('Tutorial action recording failed - action already completed', {
                    operation: 'tutorial_record_action_already_completed',
                    userId,
                    actionType: trimmedActionType,
                })
                return ctx.error(errorProcess(result.error, [trimmedActionType]))
            }

            ctx.logger.error('Tutorial action recording failed - database error', {
                operation: 'tutorial_record_action_db_error',
                userId,
                actionType: trimmedActionType,
                error: result.error,
            })
            return ctx.error(errorProcess(errors.TUTORIAL_DATABASE_ERROR, [result.error]))
        }

        ctx.logger.info('Tutorial action recorded successfully', {
            operation: 'tutorial_record_action_success',
            userId,
            actionType: trimmedActionType,
            completedAt: result.data.completedAt,
        })

        ctx.success({
            actionType: result.data.actionType,
            completedAt: result.data.completedAt,
        })

    } catch (error) {
        ctx.logger.error('Tutorial action recording failed - unexpected error', {
            operation: 'tutorial_record_action_error',
            userId,
            actionType: trimmedActionType,
            error: error.message,
            stack: error.stack,
        })

        ctx.error(errorProcess(errors.TUTORIAL_INTERNAL_ERROR, [error.message]))
    }
}

/**
 * @swagger
 * /api/v1/users/tutorial/status/{actionType}:
 *   get:
 *     summary: Get tutorial action status
 *     tags: [Tutorial]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     parameters:
 *       - in: path
 *         name: actionType
 *         required: true
 *         schema:
 *           type: string
 *         description: Type of tutorial action to query
 *     responses:
 *       200:
 *         description: Tutorial status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     actionType:
 *                       type: string
 *                     completed:
 *                       type: boolean
 *                     completedAt:
 *                       type: string
 *                       format: date-time
 *                     metadata:
 *                       type: object
 *       400:
 *         description: Invalid action type
 */
const getStatus = async ctx => {
    const userId = ctx.state.user.id
    const { actionType } = ctx.params

    ctx.logger.info('Starting tutorial status retrieval', {
        operation: 'tutorial_get_status_start',
        userId,
        actionType,
        timestamp: new Date().toISOString(),
    })

    // 验证actionType参数
    if (!actionType || typeof actionType !== 'string' || actionType.trim().length === 0) {
        ctx.logger.warn('Tutorial status retrieval failed - invalid action type', {
            operation: 'tutorial_get_status_invalid_type',
            userId,
            actionType,
        })
        return ctx.error(errorProcess(errors.TUTORIAL_INVALID_ACTION_TYPE))
    }

    const trimmedActionType = actionType.trim()

    try {
        const result = await TutorialProgress.getUserActionStatus(userId, trimmedActionType)

        if (!result.success) {
            ctx.logger.error('Tutorial status retrieval failed - database error', {
                operation: 'tutorial_get_status_db_error',
                userId,
                actionType: trimmedActionType,
                error: result.error,
            })
            return ctx.error(errorProcess(errors.TUTORIAL_DATABASE_ERROR, [result.error]))
        }

        ctx.logger.info('Tutorial status retrieval successful', {
            operation: 'tutorial_get_status_success',
            userId,
            actionType: trimmedActionType,
            completed: result.completed,
            completedAt: result.data?.completedAt || null,
        })

        ctx.success({
            actionType: trimmedActionType,
            completed: result.completed,
            ...(result.data && {
                completedAt: result.data.completedAt,
                metadata: result.data.metadata || {}
            })
        })

    } catch (error) {
        ctx.logger.error('Tutorial status retrieval failed - unexpected error', {
            operation: 'tutorial_get_status_error',
            userId,
            actionType: trimmedActionType,
            error: error.message,
            stack: error.stack,
        })

        ctx.error(errorProcess(errors.TUTORIAL_INTERNAL_ERROR, [error.message]))
    }
}

export default {
    recordAction,
    getStatus,
}