/**
 * 岗位协作者控制器
 * @module controllers/collaboratorController
 */

import jobCollaboratorService from '../services/JobCollaboratorService.js'
import { COLLABORATOR_PERMISSION } from '../constants/job_constants.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { AppError } from '../../utils/response.js'

class CollaboratorController {
    /**
     * 搜索同企业可分享用户
     * GET /job-b/:jobId/collaborators/search?keyword=xxx
     */
    async searchUsers(ctx) {
        try {
            const { companyId, job } = ctx.state
            const { keyword } = ctx.query

            if (!keyword || keyword.trim().length === 0) {
                ctx.success([])
                return
            }

            // 获取已有协作者，排除他们
            const collaborators = await jobCollaboratorService.getCollaborators(job._id)
            const excludeUserIds = collaborators.map(c => c.userId)

            const users = await jobCollaboratorService.searchCompanyUsers(companyId, keyword.trim(), excludeUserIds)

            ctx.success(users)
        } catch (error) {
            ctx.logger.error('[CollaboratorController.searchUsers] 搜索用户失败', {
                error: error.message,
                jobId: ctx.params.jobId,
            })
            throw error
        }
    }

    /**
     * 获取协作者列表
     * GET /job-b/:jobId/collaborators
     */
    async getCollaborators(ctx) {
        try {
            const { job } = ctx.state

            const collaborators = await jobCollaboratorService.getCollaborators(job._id)

            ctx.success(collaborators)
        } catch (error) {
            ctx.logger.error('[CollaboratorController.getCollaborators] 获取协作者列表失败', {
                error: error.message,
                jobId: ctx.params.jobId,
            })
            throw error
        }
    }

    /**
     * 添加协作者
     * POST /job-b/:jobId/collaborators
     * body: { userIds: [string], permissions?: [string] }
     */
    async addCollaborators(ctx) {
        try {
            const { job, companyId } = ctx.state
            const { userId } = ctx.state.user
            const { userIds, permissions } = ctx.request.body

            if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
                throw new AppError('userIds 不能为空', ERROR_CODES.VALIDATION_ERROR)
            }

            if (userIds.length > 20) {
                throw new AppError('单次最多添加 20 个协作者', ERROR_CODES.VALIDATION_ERROR)
            }

            // 验证权限枚举值
            const validPerms = Object.values(COLLABORATOR_PERMISSION)
            if (permissions) {
                const invalid = permissions.filter(p => !validPerms.includes(p))
                if (invalid.length) {
                    throw new AppError(`无效的权限: ${invalid.join(', ')}`, ERROR_CODES.VALIDATION_ERROR)
                }
            }

            const finalPermissions = permissions || validPerms

            const results = []
            const errors = []

            for (const targetUserId of userIds) {
                try {
                    const collab = await jobCollaboratorService.addCollaborator(
                        job._id,
                        targetUserId,
                        finalPermissions,
                        userId,
                        companyId,
                    )
                    results.push({
                        userId: targetUserId,
                        success: true,
                        collaborator: collab,
                    })
                } catch (err) {
                    errors.push({
                        userId: targetUserId,
                        success: false,
                        error: err.message || err.code,
                    })
                }
            }

            ctx.success({ results, errors })
        } catch (error) {
            ctx.logger.error('[CollaboratorController.addCollaborators] 添加协作者失败', {
                error: error.message,
                jobId: ctx.params.jobId,
            })
            throw error
        }
    }

    /**
     * 移除协作者
     * DELETE /job-b/:jobId/collaborators/:targetUserId
     */
    async removeCollaborator(ctx) {
        try {
            const { job } = ctx.state
            const { userId } = ctx.state.user
            const { targetUserId } = ctx.params

            await jobCollaboratorService.removeCollaborator(job._id, targetUserId, userId)

            ctx.success(null, '协作者已移除')
        } catch (error) {
            ctx.logger.error('[CollaboratorController.removeCollaborator] 移除协作者失败', {
                error: error.message,
                jobId: ctx.params.jobId,
                targetUserId: ctx.params.targetUserId,
            })
            throw error
        }
    }
}

export default new CollaboratorController()
