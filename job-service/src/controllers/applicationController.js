import ApplicationService from '../services/ApplicationService.js'
import { getPaginationParams, buildPaginationResponse } from '../../utils/helpers.js'
import CompanyBusinessService from '../services/CompanyBusinessService.js'
import JobPost from '../models/JobPost.js'
import JobApplication from '../models/JobApplication.js'
import ShadowApplication from '../models/ShadowApplication.js'
import ApplicationUserAction from '../models/ApplicationUserAction.js'
import UserCenterService from '../services/integration/UserCenterService.js'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { AI_INTERVIEW_REMINDER_MAX, AI_INTERVIEW_REMINDER_COOLDOWN_MS, FOLD_DEFAULT_ENABLED, FOLD_DEFAULT_THRESHOLD } from '../constants/index.js'
import NotificationService from '../services/NotificationService.js'
import notificationServiceIntegration from '../services/integration/NotificationService.js'
import { getApplicationType } from '../utils/dbQueryHelper.js'
import jobCollaboratorService from '../services/JobCollaboratorService.js'

class ApplicationController {
    /**
     * 创建求职申请
     */
    async createApplication(ctx) {
        try {
            const candidateId = ctx.state.user.userId
            const candidateEmail = ctx.state.user.email
            const applicationData = ctx.request.body

            const result = await ApplicationService.createApplication({
                ...applicationData,
                candidateId,
                candidateEmail,
            })

            ctx.status = 201
            ctx.success(result, '申请提交成功')
        } catch (error) {
            ctx.logger.error('Create application failed', {
                error: error.message,
                candidateId: ctx.state.user.userId,
                body: ctx.request.body,
            })
            throw error
        }
    }

    /**
     * 获取申请列表
     */
    async getApplications(ctx) {
        let effectiveCompanyId = null // 声明在try块外，以便在catch块中也能访问

        try {
            const { userId, type } = ctx.state.user // 注意这里使用 type 而不是 userType
            const { page, pageSize } = getPaginationParams(ctx.query)
            const { status, jobId, sortBy = 'appliedAt', sortOrder = 'desc', readStatus, hideExcluded } = ctx.query

            // B端用户需要获取其关联的公司ID
            if (type === 'B') {
                effectiveCompanyId = await CompanyBusinessService.getUserCompanyId(ctx, 'getApplications')
                ctx.logger.info('[ApplicationController.getApplications] B端用户成功获取companyId', {
                    userId,
                    companyId: effectiveCompanyId,
                })
            }

            ctx.logger.info('[ApplicationController.getApplications] 开始获取申请列表', {
                userId,
                userType: type,
                companyId: effectiveCompanyId,
                page,
                pageSize,
            })

            // 构建过滤条件
            const filters = {
                status,
                jobId,
            }

            // B端用户只能看到自己公司的申请
            if (type === 'B') {
                filters.companyId = effectiveCompanyId
                filters.userId = userId
                if (readStatus) filters.readStatus = readStatus
                filters.hideExcluded = hideExcluded !== 'false' // default true

                // 获取用户列表偏好（低分折叠设置，从 user-center 获取）
                const preference = await UserCenterService.getUserPreferences(userId)
                filters.foldEnabled = preference?.foldEnabled ?? FOLD_DEFAULT_ENABLED
                filters.foldThreshold = preference?.foldThreshold ?? FOLD_DEFAULT_THRESHOLD

                ctx.logger.info('[ApplicationController.getApplications] B端用户，添加公司过滤', { companyId: effectiveCompanyId })
            }

            // C端用户只能看到自己的申请
            if (type === 'C') {
                filters.candidateId = userId
                ctx.logger.info('[ApplicationController.getApplications] C端用户，添加候选人过滤', { candidateId: userId })
            }

            // 调用服务层方法，传递正确的参数
            const result = await ApplicationService.getApplications(filters, { page, pageSize }, { sortBy, sortOrder })

            // 使用buildPaginationResponse构建响应
            const response = buildPaginationResponse(result.data, result.pagination.total, { page, pageSize })

            // 附加 foldInfo（B端启用折叠时）
            if (result.foldInfo) {
                response.foldInfo = result.foldInfo
            }

            ctx.success(response)
        } catch (error) {
            ctx.logger.error('Get applications failed', {
                error: error.message,
                userId: ctx.state.user.userId,
                userType: ctx.state.user.type,
                companyId: effectiveCompanyId,
                query: ctx.query,
            })
            throw error
        }
    }

    /**
     * 获取申请详情
     * 影子申请（?source=recommend）由 shadowApplicationProxy 中间件处理
     */
    async getApplicationById(ctx) {
        let effectiveCompanyId = null

        try {
            const { applicationId } = ctx.params
            const { userId, type } = ctx.state.user

            const serviceOptions = { userId, type }
            if (type === 'B') {
                effectiveCompanyId = await CompanyBusinessService.getUserCompanyId(ctx, 'getApplicationById')
                serviceOptions.companyId = effectiveCompanyId
            }

            const application = await ApplicationService.getApplicationById(applicationId, serviceOptions)

            // B端用户：自动标记已读 + 附加 userAction
            if (type === 'B') {
                try {
                    const applicationType = getApplicationType(applicationId)
                    const userAction = await ApplicationUserAction.findOneAndUpdate(
                        { userId, applicationId, applicationType },
                        {
                            $set: { isRead: true, readAt: new Date() },
                            $setOnInsert: { isExcluded: false },
                        },
                        { upsert: true, new: true },
                    ).lean()

                    application.userAction = {
                        isRead: userAction.isRead,
                        readAt: userAction.readAt,
                        isExcluded: userAction.isExcluded,
                        excludedAt: userAction.excludedAt,
                        excludedReason: userAction.excludedReason,
                    }
                } catch (err) {
                    ctx.logger.warn('Auto-mark-read failed', { err: err.message, applicationId })
                    // Optimistic: user is viewing the detail right now, so report isRead: true
                    // even though the DB write failed — next list load will re-check actual state
                    application.userAction = { isRead: true, isExcluded: false }
                }
            }

            ctx.success(application)
        } catch (error) {
            ctx.logger.error('Get application by id failed', {
                error: error.message,
                applicationId: ctx.params.applicationId,
                userId: ctx.state.user.userId,
                companyId: effectiveCompanyId,
            })
            throw error
        }
    }

    /**
     * 更新申请状态
     */
    async updateApplicationStatus(ctx) {
        try {
            const { applicationId } = ctx.params
            const { status } = ctx.request.body
            const { userId, userType } = ctx.state.user

            const application = await ApplicationService.updateApplicationStatus(applicationId, status, {
                changedBy: userId,
                note: ctx.request.body.comment || ctx.request.body.note,
            })

            ctx.success(application, '申请状态更新成功')
        } catch (error) {
            ctx.logger.error('Update application status failed', {
                error: error?.message || 'Unknown error',
                applicationId: ctx.params.applicationId,
                status: ctx.request.body.status,
                userId: ctx.state.user.userId,
            })
            throw error
        }
    }

    /**
     * 批量更新申请状态
     */
    async batchUpdateStatus(ctx) {
        try {
            const { applicationIds, status } = ctx.request.body
            const { userId, userType } = ctx.state.user

            const results = await ApplicationService.batchUpdateStatus(applicationIds, status, {
                changedBy: userId,
                note: ctx.request.body.comment || ctx.request.body.note,
            })

            ctx.success(results, '批量更新完成')
        } catch (error) {
            ctx.logger.error('Batch update status failed', {
                error: error.message,
                body: ctx.request.body,
                userId: ctx.state.user.userId,
            })
            throw error
        }
    }

    /**
     * 撤回申请
     */
    async withdrawApplication(ctx) {
        try {
            const { applicationId } = ctx.params
            const { userId, userType } = ctx.state.user

            const application = await ApplicationService.updateApplicationStatus(applicationId, 'withdrawn', {
                changedBy: userId,
                note: 'Application withdrawn by candidate',
            })

            ctx.success(application, '申请已撤回')
        } catch (error) {
            ctx.logger.error('Withdraw application failed', {
                error: error.message,
                applicationId: ctx.params.applicationId,
                userId: ctx.state.user.userId,
            })
            throw error
        }
    }

    /**
     * Job AI 评估回调入口
     */
    async handleJobAiEvaluationCallback(ctx) {
        try {
            const result = await ApplicationService.handleJobAiEvaluationCallback(ctx.request.body || {})

            ctx.success(result, 'Job AI evaluation callback processed')
        } catch (error) {
            ctx.logger.error('Job AI evaluation callback failed', {
                error: error.message,
                requestBody: ctx.request.body,
            })
            throw error
        }
    }

    /**
     * 获取申请统计
     */
    async getApplicationStats(ctx) {
        try {
            const { jobId } = ctx.params
            const { userId } = ctx.state.user

            const stats = await ApplicationService.getApplicationStats(jobId, userId)

            ctx.success(stats)
        } catch (error) {
            ctx.logger.error('Get application stats failed', {
                error: error.message,
                jobId: ctx.params.jobId,
                userId: ctx.state.user.userId,
            })
            throw error
        }
    }

    /**
     * 获取公司申请统计（用于 Tab 角标）
     * @description 返回公司下所有职位的各状态申请数量，用于面试列表页 Tab 显示
     */
    async getCompanyApplicationStats(ctx) {
        try {
            const { userId, type } = ctx.state.user
            const { jobId: queryJobId, hideExcluded, readStatus } = ctx.query
            const shouldHideExcluded = hideExcluded !== 'false' // default true, 与列表一致
            const filterUnread = readStatus === 'unread'

            // 仅 B 端用户可访问
            if (type !== 'B') {
                throw new AppError('仅 B 端用户可访问', ERROR_CODES.FORBIDDEN)
            }

            // 获取用户关联的公司 ID
            const companyId = await CompanyBusinessService.getUserCompanyId(ctx, 'getCompanyApplicationStats')

            ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 开始获取公司申请统计', {
                userId,
                companyId,
                queryJobId,
                shouldHideExcluded,
                filterUnread,
            })

            // 构建 jobId 过滤条件
            let jobIdFilter

            if (queryJobId) {
                // 如果指定了 jobId，使用智能查询找到对应的职位
                const { findBySmartId } = await import('../utils/dbQueryHelper.js')
                const jobPost = await findBySmartId(JobPost, queryJobId)

                if (!jobPost) {
                    throw new AppError('职位不存在', ERROR_CODES.NOT_FOUND)
                }

                // 验证用户有权访问该职位（数据隔离）
                if (jobPost.companyId !== companyId) {
                    throw new AppError('无权访问该职位', ERROR_CODES.FORBIDDEN)
                }
                const { hasAccess } = await jobCollaboratorService.hasJobAccess(userId, jobPost._id)
                if (!hasAccess) {
                    throw new AppError('无权访问该职位', ERROR_CODES.FORBIDDEN)
                }

                jobIdFilter = jobPost._id
                ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 按指定职位筛选', {
                    queryJobId,
                    jobObjectId: jobPost._id.toString(),
                })
            } else {
                // 数据隔离：只获取用户可访问的岗位（自己发布的 + 被分享的）
                const accessibleJobIds = await jobCollaboratorService.getAccessibleJobIds(userId, companyId)
                const companyJobs = await JobPost.find({ _id: { $in: accessibleJobIds } }).select('_id').lean()
                const jobIds = companyJobs.map(job => job._id)

                if (jobIds.length === 0) {
                    ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 公司无职位', { companyId })
                    ctx.success({
                        total: 0,
                        screening: 0,
                        interview_inviting: 0,
                        interview_scheduled: 0,
                        interview_completed: 0,
                        interview_terminated: 0,
                        foldInfo: { enabled: false },
                    })
                    return
                }

                jobIdFilter = { $in: jobIds }
            }

            // 获取用户操作记录（一次查询同时获取 excluded 和 read 状态）
            const statsFilter = { jobId: jobIdFilter }
            const andConditions = []

            let excludedShadowIds = []
            let readAppIds = []

            if (shouldHideExcluded || filterUnread) {
                const userActions = await ApplicationUserAction.find({ userId })
                    .select('applicationId applicationType isExcluded isRead')
                    .lean()

                if (shouldHideExcluded) {
                    const excludedActions = userActions.filter(a => a.isExcluded)
                    const excludedAppIds = excludedActions.filter(a => a.applicationType === 'application').map(a => a.applicationId)
                    excludedShadowIds = excludedActions.filter(a => a.applicationType === 'shadow').map(a => a.applicationId)

                    if (excludedAppIds.length > 0) {
                        andConditions.push({ applicationId: { $nin: excludedAppIds } })
                    }
                    if (excludedActions.length > 0) {
                        ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 排除已标记暂不考虑的申请', {
                            excludedAppCount: excludedAppIds.length,
                            excludedShadowCount: excludedShadowIds.length,
                        })
                    }
                }

                if (filterUnread) {
                    readAppIds = userActions.filter(a => a.isRead).map(a => a.applicationId)
                    if (readAppIds.length > 0) {
                        andConditions.push({ applicationId: { $nin: readAppIds } })
                    }
                    ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 只统计未读申请', {
                        readAppCount: readAppIds.length,
                    })
                }
            }

            if (andConditions.length > 0) {
                statsFilter.$and = andConditions
            }

            // 使用现有的 getApplicationStats 方法，传入过滤条件
            const stats = await ApplicationService.getApplicationStats(null, statsFilter)

            // 合并影子候选人数量到 screening 统计
            const shadowFilter = { jobId: jobIdFilter, status: 'active' }
            const shadowCount = await this._countFilteredShadows(shadowFilter, { shouldHideExcluded, excludedShadowIds, filterUnread, readAppIds })
            if (shadowCount > 0) {
                stats.screening = (stats.screening || 0) + shadowCount
            }

            // 构建返回结构，确保所有 Tab 状态都有值
            // total 只计算五个 Tab 状态的总和（不含 submitting、submitted 等其他状态）
            const screening = stats.screening || 0
            const interview_inviting = stats.interview_inviting || 0
            const interview_scheduled = stats.interview_scheduled || 0
            const interview_completed = stats.interview_completed || 0
            const interview_terminated = stats.interview_terminated || 0

            const result = {
                total: screening + interview_inviting + interview_scheduled + interview_completed + interview_terminated,
                screening,
                interview_inviting,
                interview_scheduled,
                interview_completed,
                interview_terminated,
            }

            // 计算折叠信息（从 user-center 获取偏好）
            const preference = await UserCenterService.getUserPreferences(userId)
            const foldEnabled = preference?.foldEnabled ?? FOLD_DEFAULT_ENABLED
            const foldThreshold = preference?.foldThreshold ?? FOLD_DEFAULT_THRESHOLD

            if (foldEnabled) {
                // JobApplication: matchScore 有 default: 0，不会为 null
                const tabStatuses = ['screening', 'interview_inviting', 'interview_scheduled', 'interview_completed', 'interview_terminated']
                const jobFoldFilter = {
                    jobId: jobIdFilter,
                    status: { $in: tabStatuses },
                    matchScore: { $lt: foldThreshold },
                }
                if (andConditions.length > 0) {
                    jobFoldFilter.$and = andConditions
                }
                let foldedCount = await JobApplication.countDocuments(jobFoldFilter)

                // ShadowApplication 折叠数（matchScore 可能为 null）
                const shadowFoldFilter = {
                    jobId: jobIdFilter,
                    status: 'active',
                    $or: [{ matchScore: { $lt: foldThreshold } }, { matchScore: null }],
                }
                foldedCount += await this._countFilteredShadows(shadowFoldFilter, { shouldHideExcluded, excludedShadowIds, filterUnread, readAppIds })

                result.foldInfo = {
                    enabled: true,
                    threshold: foldThreshold,
                    foldedCount,
                }
            } else {
                result.foldInfo = { enabled: false }
            }

            ctx.logger.info('[ApplicationController.getCompanyApplicationStats] 统计完成', {
                userId,
                companyId,
                jobIdFilter: Array.isArray(jobIdFilter?.$in) ? `${jobIdFilter.$in.length} jobs` : String(jobIdFilter),
                stats: result,
            })

            ctx.success(result)
        } catch (error) {
            ctx.logger.error('Get company application stats failed', {
                error: error.message,
                userId: ctx.state.user.userId,
            })
            throw error
        }
    }
    /**
     * 更新用户操作标记（已读/暂不考虑）
     */
    async updateUserAction(ctx) {
        try {
            const { applicationId } = ctx.params
            const { userId } = ctx.state.user
            const { isRead, isExcluded, excludedReason } = ctx.request.body

            const applicationType = getApplicationType(applicationId)
            const now = new Date()

            const updateFields = {}
            if (typeof isRead === 'boolean') {
                updateFields.isRead = isRead
                updateFields.readAt = isRead ? now : null
            }
            if (typeof isExcluded === 'boolean') {
                updateFields.isExcluded = isExcluded
                updateFields.excludedAt = isExcluded ? now : null
                updateFields.excludedReason = isExcluded ? (excludedReason || null) : null
            }

            const userAction = await ApplicationUserAction.findOneAndUpdate(
                { userId, applicationId, applicationType },
                { $set: updateFields },
                { upsert: true, new: true },
            ).lean()

            // exclude/restore 操作同步给同岗位的所有协作者
            if (typeof isExcluded === 'boolean') {
                await this._syncExcludeToCollaborators(
                    ctx, applicationId, applicationType, userId, isExcluded, excludedReason, now,
                )
            }

            ctx.success({
                isRead: userAction.isRead,
                readAt: userAction.readAt,
                isExcluded: userAction.isExcluded,
                excludedAt: userAction.excludedAt,
                excludedReason: userAction.excludedReason,
            })
        } catch (error) {
            ctx.logger.error('Update user action failed', {
                error: error.message,
                applicationId: ctx.params.applicationId,
                userId: ctx.state.user.userId,
            })
            throw new AppError(
                ERROR_CODES.APPLICATION_ACTION_UPDATE_FAILED.message,
                ERROR_CODES.APPLICATION_ACTION_UPDATE_FAILED,
            )
        }
    }

    /**
     * 同步 exclude/restore 操作给同岗位的所有协作者
     * @private
     */
    async _syncExcludeToCollaborators(ctx, applicationId, applicationType, triggerUserId, isExcluded, excludedReason, now) {
        try {
            // 1. 从 applicationId 反查 jobId
            let jobId
            if (applicationType === 'shadow') {
                const shadow = await ShadowApplication.findOne({ shadowApplicationId: applicationId })
                    .select('jobId')
                    .lean()
                jobId = shadow?.jobId
            } else {
                const app = await JobApplication.findOne({ applicationId })
                    .select('jobId')
                    .lean()
                jobId = app?.jobId
            }

            if (!jobId) {
                ctx.logger.warn('[_syncExcludeToCollaborators] 未找到申请对应的岗位', { applicationId })
                return
            }

            // 2. 获取该岗位所有有权用户
            const allUserIds = await jobCollaboratorService.getAllJobUsers(jobId)

            // 3. 排除触发者自己（已在上层更新）
            const otherUserIds = allUserIds.filter(uid => uid !== triggerUserId)

            if (otherUserIds.length === 0) {
                return // 无其他协作者，无需同步
            }

            // 4. 构建 bulkWrite 操作（只同步 exclude 字段，不覆盖 isRead/readAt）
            const excludeFields = {
                isExcluded,
                excludedAt: isExcluded ? now : null,
                excludedReason: isExcluded ? (excludedReason || null) : null,
            }

            const bulkOps = otherUserIds.map(uid => ({
                updateOne: {
                    filter: { userId: uid, applicationId, applicationType },
                    update: { $set: excludeFields },
                    upsert: true,
                },
            }))

            const result = await ApplicationUserAction.bulkWrite(bulkOps, { ordered: false })

            ctx.logger.info('[_syncExcludeToCollaborators] 同步完成', {
                applicationId,
                triggerUserId,
                isExcluded,
                syncedUsers: otherUserIds.length,
                matched: result.matchedCount,
                upserted: result.upsertedCount,
                modified: result.modifiedCount,
            })
        } catch (error) {
            // 同步失败不阻塞主操作，降级为仅当前用户生效
            ctx.logger.error('[_syncExcludeToCollaborators] 同步失败（降级为仅当前用户生效）', {
                applicationId,
                triggerUserId,
                error: error.message,
            })
        }
    }

    /**
     * B端提醒候选人完成AI面试
     * 前置中间件已完成：鉴权、B端类型校验、公司关联、申请加载、归属验证、频控、候选人信息加载
     */
    async remindAiInterview(ctx) {
        const { userId, email: operatorEmail } = ctx.state.user
        const { application, job, candidateProfile, reminders } = ctx.state

        const detailUrl = `${process.env.JOB_APPOINTMENT_URL_C || ''}/#/jobDetail?id=${job.jobId}&type=refer`

        // 1. 原子写入提醒记录（作为分布式锁，防并发竞态）
        //    必须先写入再发通知，避免并发场景下候选人收到重复通知
        const updated = await JobApplication.findOneAndUpdate(
            {
                applicationId: application.applicationId,
                $expr: { $lt: [{ $size: { $ifNull: ['$aiInterviewReminders', []] } }, AI_INTERVIEW_REMINDER_MAX] },
            },
            { $push: { aiInterviewReminders: { sentAt: new Date(), sentBy: userId } } },
            { new: true },
        )
        if (!updated) {
            ctx.logger.warn('[remindAiInterview] Concurrent conflict, reminder not recorded')
            return ctx.success({ remindersSent: reminders.length, remainingReminders: 0 }, '提醒可能已由其他操作者发送')
        }

        // 2. 发送邮件（独立 try-catch，不阻断站内信）
        try {
            await NotificationService.sendAiInterviewReminderNotification(
                { candidateName: candidateProfile.name, companyName: job.companyName, position: job.title, detailUrl, operatorEmail },
                candidateProfile.email,
            )
        } catch (e) {
            ctx.logger.warn('[remindAiInterview] Email notification failed', { error: e.message })
        }

        // 3. 发送站内信（独立 try-catch，不阻断主流程）
        try {
            await notificationServiceIntegration.sendInAppMessage({
                userId: application.candidateId,
                title: 'AI面试提醒',
                content: `您在${job.companyName}投递的${job.title}仍有AI面试尚未完成。为确保您的招聘流程顺利推进，请您尽快提交！`,
                type: 'REMINDER',
                priority: 'HIGH',
                referenceId: application.applicationId,
                referenceType: 'application',
                actionUrl: detailUrl,
            })
        } catch (e) {
            ctx.logger.warn('[remindAiInterview] In-app message failed', { error: e.message })
        }

        // 4. 返回
        ctx.success({
            remindersSent: reminders.length + 1,
            remainingReminders: AI_INTERVIEW_REMINDER_MAX - (reminders.length + 1),
            nextAvailableAt: new Date(Date.now() + AI_INTERVIEW_REMINDER_COOLDOWN_MS),
        }, '提醒已发送')
    }

    /**
     * 统计符合过滤条件的影子申请数量（复用 exclude + unread 过滤逻辑）
     * @private
     */
    async _countFilteredShadows(baseFilter, { shouldHideExcluded, excludedShadowIds, filterUnread, readAppIds }) {
        if (shouldHideExcluded && excludedShadowIds.length > 0) {
            baseFilter.shadowApplicationId = { $nin: excludedShadowIds }
        }
        if (filterUnread && readAppIds.length > 0) {
            const docs = await ShadowApplication.find(baseFilter).select('shadowApplicationId').lean()
            const readSet = new Set(readAppIds)
            return docs.filter(s => !readSet.has(s.shadowApplicationId)).length
        }
        return ShadowApplication.countDocuments(baseFilter)
    }
}

export default new ApplicationController()
