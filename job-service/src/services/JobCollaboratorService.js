/**
 * 岗位协作者服务
 * 负责数据隔离、权限检查、协作者 CRUD、用户搜索
 */

import mongoose from 'mongoose'
import JobCollaborator from '../models/JobCollaborator.js'
import JobPost from '../models/JobPost.js'
import { COLLABORATOR_PERMISSION, COLLABORATOR_ROLE } from '../constants/job_constants.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { findBySmartId } from '../utils/dbQueryHelper.js'
import JobApplication from '../models/JobApplication.js'
import ShadowApplication from '../models/ShadowApplication.js'
import ApplicationUserAction from '../models/ApplicationUserAction.js'
import companyService from './integration/CompanyService.js'
import userCenterService from './integration/UserCenterService.js'
import { log } from '../../utils/logger.js'

const logger = log('JobCollaboratorService')

class JobCollaboratorService {
    /**
     * 获取用户可访问的岗位 ID 列表（自己发布的 + 被分享的）
     * @param {string} userId
     * @param {string} companyId
     * @returns {Promise<mongoose.Types.ObjectId[]>}
     */
    async getAccessibleJobIds(userId, companyId) {
        // 1. 自己发布的岗位
        const ownedJobs = await JobPost.find({ publisherId: userId, companyId })
            .select('_id')
            .lean()

        // 2. 被分享的岗位
        const collaborations = await JobCollaborator.find({ userId })
            .select('jobId')
            .lean()

        // 合并去重
        const idSet = new Set()
        ownedJobs.forEach(j => idSet.add(j._id.toString()))
        collaborations.forEach(c => idSet.add(c.jobId.toString()))

        return Array.from(idSet).map(id => new mongoose.Types.ObjectId(id))
    }

    /**
     * 检查用户是否有权访问某岗位
     * @param {string} userId
     * @param {string|mongoose.Types.ObjectId} jobId - 支持 ObjectId 或业务 ID
     * @returns {Promise<{hasAccess: boolean, isOwner: boolean, job: Object|null}>}
     */
    async hasJobAccess(userId, jobId) {
        const job = typeof jobId === 'string' ? await findBySmartId(JobPost, jobId) : await JobPost.findById(jobId)
        if (!job) return { hasAccess: false, isOwner: false, job: null }

        const isOwner = job.publisherId === userId
        if (isOwner) return { hasAccess: true, isOwner: true, job }

        const collab = await JobCollaborator.findOne({
            jobId: job._id,
            userId,
        }).lean()

        return { hasAccess: !!collab, isOwner: false, job }
    }

    /**
     * 获取岗位所有有权用户（所有者 + 协作者）
     * @param {mongoose.Types.ObjectId} jobId
     * @returns {Promise<string[]>} userId 列表
     */
    async getAllJobUsers(jobId) {
        const job = await JobPost.findById(jobId).select('publisherId').lean()
        if (!job) return []

        const collaborators = await JobCollaborator.find({ jobId })
            .select('userId')
            .lean()

        const userIds = new Set([job.publisherId])
        collaborators.forEach(c => userIds.add(c.userId))
        return Array.from(userIds)
    }

    /**
     * 验证用户对岗位的访问权限（不通过则抛异常）
     * @param {Object} job - JobPost document
     * @param {string} companyId
     * @param {string} userId
     * @throws {Object} JOB_NOT_FOUND
     */
    async verifyJobAccess(job, companyId, userId) {
        if (job.companyId.toString() !== companyId.toString()) {
            throw ERROR_CODES.JOB_NOT_FOUND
        }
        if (job.publisherId === userId) return

        const collab = await JobCollaborator.findOne({
            jobId: job._id,
            userId,
        }).lean()
        if (!collab) {
            throw ERROR_CODES.JOB_NOT_FOUND
        }
    }

    /**
     * 添加协作者
     * @param {mongoose.Types.ObjectId} jobId - 岗位 ObjectId
     * @param {string} targetUserId
     * @param {string[]} permissions
     * @param {string} grantedBy - 操作人 userId
     * @returns {Promise<Object>} 创建的协作者记录
     */
    async addCollaborator(jobId, targetUserId, permissions, grantedBy, companyId) {
        const job = await JobPost.findById(jobId).lean()
        if (!job) throw ERROR_CODES.JOB_NOT_FOUND

        // 不能添加自己
        if (targetUserId === grantedBy) throw ERROR_CODES.COLLABORATOR_SELF_ADD

        // 不能添加所有者（已有隐式权限）
        if (targetUserId === job.publisherId) throw ERROR_CODES.COLLABORATOR_ALREADY_EXISTS

        // 验证目标用户属于同一企业
        if (companyId) {
            const employees = await companyService.getCompanyEmployees(companyId)
            const employeeIds = new Set(employees.map(e => e.userId))
            if (!employeeIds.has(targetUserId)) throw ERROR_CODES.USER_NOT_IN_COMPANY
        }

        // 检查是否已存在
        const existing = await JobCollaborator.findOne({ jobId, userId: targetUserId }).lean()
        if (existing) throw ERROR_CODES.COLLABORATOR_ALREADY_EXISTS

        let collab
        try {
            collab = await JobCollaborator.create({
                jobId,
                userId: targetUserId,
                permissions: permissions || Object.values(COLLABORATOR_PERMISSION),
                grantedBy,
            })
        } catch (err) {
            if (err.code === 11000) throw ERROR_CODES.COLLABORATOR_ALREADY_EXISTS
            throw err
        }

        logger.info('[addCollaborator] 添加协作者成功', {
            jobId: jobId.toString(),
            targetUserId,
            grantedBy,
            permissions: collab.permissions,
        })

        // 回填已有的 exclude 状态给新协作者
        await this._backfillExcludeForNewCollaborator(jobId, job.publisherId, targetUserId)

        return collab
    }

    /**
     * 回填岗位已有的 exclude 状态给新协作者
     * @private
     */
    async _backfillExcludeForNewCollaborator(jobId, ownerId, newUserId) {
        try {
            // 1. 获取该岗位所有申请 ID（普通 + 影子）
            const [applications, shadowApplications] = await Promise.all([
                JobApplication.find({ jobId }).select('applicationId').lean(),
                ShadowApplication.find({ jobId }).select('shadowApplicationId').lean(),
            ])

            const allAppIds = [
                ...applications.map(a => a.applicationId),
                ...shadowApplications.map(s => s.shadowApplicationId),
            ]

            if (allAppIds.length === 0) return

            // 2. 以岗位所有者为基准，获取已有的 exclude 记录
            const ownerExcludes = await ApplicationUserAction.find({
                userId: ownerId,
                applicationId: { $in: allAppIds },
                isExcluded: true,
            }).select('applicationId applicationType excludedAt excludedReason').lean()

            if (ownerExcludes.length === 0) return

            // 3. 为新协作者批量创建 exclude 记录（只同步 exclude 字段，不覆盖 isRead）
            const bulkOps = ownerExcludes.map(action => ({
                updateOne: {
                    filter: {
                        userId: newUserId,
                        applicationId: action.applicationId,
                        applicationType: action.applicationType,
                    },
                    update: {
                        $set: {
                            isExcluded: true,
                            excludedAt: action.excludedAt,
                            excludedReason: action.excludedReason,
                        },
                    },
                    upsert: true,
                },
            }))

            const result = await ApplicationUserAction.bulkWrite(bulkOps, { ordered: false })

            logger.info('[_backfillExcludeForNewCollaborator] 回填完成', {
                jobId: jobId.toString(),
                newUserId,
                excludeCount: ownerExcludes.length,
                upserted: result.upsertedCount,
                modified: result.modifiedCount,
            })
        } catch (error) {
            // 回填失败不阻塞添加协作者操作
            logger.error('[_backfillExcludeForNewCollaborator] 回填失败', {
                jobId: jobId.toString(),
                newUserId,
                error: error.message,
            })
        }
    }

    /**
     * 移除协作者
     * @param {mongoose.Types.ObjectId} jobId
     * @param {string} targetUserId - 要移除的 userId
     * @param {string} requesterId - 操作人 userId
     */
    async removeCollaborator(jobId, targetUserId, requesterId) {
        const job = await JobPost.findById(jobId).lean()
        if (!job) throw ERROR_CODES.JOB_NOT_FOUND

        // 不可移除所有者
        if (targetUserId === job.publisherId) throw ERROR_CODES.CANNOT_REMOVE_OWNER

        const result = await JobCollaborator.findOneAndDelete({ jobId, userId: targetUserId })
        if (!result) throw ERROR_CODES.COLLABORATOR_NOT_FOUND

        logger.info('[removeCollaborator] 移除协作者成功', {
            jobId: jobId.toString(),
            targetUserId,
            requesterId,
        })
    }

    /**
     * 获取岗位协作者列表（含所有者）
     * @param {mongoose.Types.ObjectId} jobId
     * @returns {Promise<Object[]>} 协作者列表
     */
    async getCollaborators(jobId) {
        const job = await JobPost.findById(jobId).select('publisherId').lean()
        if (!job) throw ERROR_CODES.JOB_NOT_FOUND

        // 查询所有协作者
        const collaborators = await JobCollaborator.find({ jobId })
            .sort({ grantedAt: 1 })
            .lean()

        // 收集所有 userId（含所有者）
        const allUserIds = [job.publisherId, ...collaborators.map(c => c.userId)]

        // 批量获取用户信息
        const userInfoMap = await this._batchGetUserInfo(allUserIds)

        // 组装结果：所有者在前
        const ownerInfo = userInfoMap.get(job.publisherId) || {}
        const result = [
            {
                userId: job.publisherId,
                role: COLLABORATOR_ROLE.OWNER,
                permissions: Object.values(COLLABORATOR_PERMISSION),
                username: ownerInfo.username || ownerInfo.name || '',
                email: ownerInfo.email || '',
                avatar: ownerInfo.profile?.avatar || ownerInfo.avatar || '',
                grantedAt: null,
                grantedBy: null,
            },
        ]

        for (const collab of collaborators) {
            const info = userInfoMap.get(collab.userId) || {}
            result.push({
                userId: collab.userId,
                role: COLLABORATOR_ROLE.COLLABORATOR,
                permissions: collab.permissions,
                username: info.username || info.name || '',
                email: info.email || '',
                avatar: info.profile?.avatar || info.avatar || '',
                grantedAt: collab.grantedAt,
                grantedBy: collab.grantedBy,
            })
        }

        return result
    }

    /**
     * 搜索同企业可分享用户
     * @param {string} companyId
     * @param {string} keyword - 搜索关键词（名称/邮箱）
     * @param {string[]} excludeUserIds - 排除的用户（已有协作者 + 所有者）
     * @returns {Promise<Object[]>}
     */
    async searchCompanyUsers(companyId, keyword, excludeUserIds = []) {
        try {
            // 1. 从 user-center 内部 API 模糊搜索 B端用户
            const searchResult = await userCenterService.searchInternalUsers(keyword, 'B')
            if (!searchResult || !searchResult.length) return []

            // 2. 从 company-service 获取该企业的活跃员工
            const employeesResult = await companyService.getCompanyEmployees(companyId)
            if (!employeesResult || !employeesResult.length) return []

            // 建立企业员工 userId 集合
            const employeeUserIds = new Set(employeesResult.map(e => e.userId))

            // 3. 交叉过滤：搜索结果中属于该企业的用户
            const excludeSet = new Set(excludeUserIds)
            const filtered = searchResult.filter(
                user => employeeUserIds.has(user.id || user.userId) && !excludeSet.has(user.id || user.userId),
            )

            // 4. 组装返回
            const employeeMap = new Map(employeesResult.map(e => [e.userId, e]))
            return filtered.map(user => {
                const userId = user.id || user.userId
                const employee = employeeMap.get(userId)
                return {
                    userId,
                    username: user.username || user.name || '',
                    email: user.email || '',
                    avatar: user.profile?.avatar || user.avatar || '',
                    position: employee?.position || '',
                }
            })
        } catch (error) {
            logger.error('[searchCompanyUsers] 搜索用户失败', {
                companyId,
                keyword,
                error: error.message,
            })
            return []
        }
    }

    /**
     * 批量获取用户信息
     * @private
     */
    async _batchGetUserInfo(userIds) {
        const map = new Map()
        if (!userIds.length) return map

        try {
            const results = await Promise.allSettled(
                userIds.map(id => userCenterService.getUserProfile(id)),
            )
            results.forEach((result, index) => {
                if (result.status === 'fulfilled' && result.value) {
                    const user = result.value
                    const id = user.id || user.userId || user._id || userIds[index]
                    if (id) map.set(id, user)
                }
            })
        } catch (error) {
            logger.warn('[_batchGetUserInfo] 批量获取用户信息失败', { error: error.message })
        }

        return map
    }
}

export default new JobCollaboratorService()
