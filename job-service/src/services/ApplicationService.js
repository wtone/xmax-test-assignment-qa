/**
 * 申请管理服务
 * @module services/ApplicationService
 */

import JobApplication from '../models/JobApplication.js'
import JobPost from '../models/JobPost.js'
import InterviewAppointment from '../models/InterviewAppointment.js'
import ManualInterviewRating from '../models/ManualInterviewRating.js'
import ShadowApplication from '../models/ShadowApplication.js'
import ApplicationUserAction from '../models/ApplicationUserAction.js'
import UserCenterService from './integration/UserCenterService.js'
import ResumeService from './integration/ResumeService.js'
import EvaluationService from './integration/EvaluationService.js'
import NotificationService from './integration/NotificationService.js'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { APPLICATION_STATUS, shouldCountInStats } from '../constants/application_status.js'
import { APPOINTMENT_STATUS, isAppointmentFinished } from '../constants/appointment_status.js'
import logger from '../../utils/logger.js'
import mongoose from 'mongoose'
import { findBySmartId, updateBySmartId, findBySmartIdOrThrow, isMongoObjectId } from '../utils/dbQueryHelper.js'
import jobCollaboratorService from './JobCollaboratorService.js'
import { FOLD_DEFAULT_ENABLED, FOLD_DEFAULT_THRESHOLD } from '../constants/index.js'
import { maskName } from '../utils/desensitize.js'

class ApplicationService {
    constructor() {
        this.evaluationService = EvaluationService
    }

    /**
     * 辅助方法：转换职位ID格式并添加职位基本信息
     * @private
     */
    _formatJobInfo(jobPost) {
        if (!jobPost) return { jobId: null, job: null }

        return {
            jobId: jobPost._id.toString(), // MongoDB ObjectId格式
            job: {
                jobId: jobPost._id.toString(), // MongoDB ObjectId格式
                title: jobPost.title,
                location: jobPost.location,
                companyName: jobPost.companyName,
                companyInfo: jobPost.companyInfo,
            },
        }
    }

    /**
     * 规范化 Job AI 评估结果
     * @private
     * @param {Object} evaluation - Job AI 回调中的评估对象
     * @param {Object} [extraMetadata={}] - 额外的元数据
     * @returns {Object} 规范化后的评估数据
     */
    /**
     * 解析回调请求并查找对应的申请记录
     * @private
     * @param {Object} params
     * @param {string} params.jobId - 职位ID（MongoId或业务ID）
     * @param {string} params.candidateId - 候选人ID
     * @param {string} [params.applicationId] - 申请ID
     * @param {string} [params.resumeId] - 简历ID
     * @returns {Promise<{application: import('mongoose').Document|null, jobObjectId: import('mongoose').Types.ObjectId|null}>}
     */
    async _resolveApplicationForEvaluation({ jobId, candidateId, applicationId, resumeId }) {
        let application = null
        let jobObjectId = null

        if (applicationId) {
            application = await findBySmartId(JobApplication, applicationId)
        }

        if (!application && jobId) {
            if (isMongoObjectId(jobId)) {
                jobObjectId = new mongoose.Types.ObjectId(jobId)
            } else {
                const jobPost = await findBySmartId(JobPost, jobId)
                if (jobPost) {
                    jobObjectId = jobPost._id
                }
            }
        }

        if (!application && jobObjectId && candidateId) {
            application = await JobApplication.findOne({ jobId: jobObjectId, candidateId })
        }

        if (!application && jobObjectId && candidateId && resumeId) {
            application = await JobApplication.findOne({ jobId: jobObjectId, candidateId, resumeId })
        }

        if (!application && candidateId) {
            const query = {
                candidateId,
            }
            if (jobObjectId) query.jobId = jobObjectId
            if (resumeId) query.resumeId = resumeId

            application = await JobApplication.findOne(query)
        }

        return { application, jobObjectId }
    }

    /**
     * 处理 Job AI 服务的评估回调
     * @param {Object} payload - 回调请求体
     * @returns {Promise<Object>} 处理结果
     */
    async handleJobAiEvaluationCallback(payload = {}) {
        const jobId = payload.job_id ?? payload.jobId
        const candidateId = payload.candidate_id ?? payload.candidateId
        const applicationId = payload.application_id ?? payload.applicationId
        const resumeId = payload.resume_id ?? payload.resumeId
        const evaluationPayload = payload.evaluation
        const extraMetadata = payload.metadata
        const traceId = payload.trace_id ?? payload.traceId ?? payload.request_id ?? payload.requestId

        if (!jobId || !candidateId) {
            logger.warn('[ApplicationService.handleJobAiEvaluationCallback] Missing identifiers', {
                jobId,
                candidateId,
                applicationId,
            })
            throw new AppError('job_id and candidate_id are required', ERROR_CODES.INVALID_PARAMS)
        }

        if (!evaluationPayload || typeof evaluationPayload !== 'object') {
            logger.warn('[ApplicationService.handleJobAiEvaluationCallback] Missing evaluation payload', {
                jobId,
                candidateId,
                applicationId,
            })
            throw new AppError('evaluation payload is required', ERROR_CODES.INVALID_PARAMS)
        }

        logger.info('[ApplicationService.handleJobAiEvaluationCallback] Received evaluation callback', {
            jobId,
            candidateId,
            applicationId,
            resumeId,
            evaluationId: evaluationPayload?.id ?? evaluationPayload?.evaluation_id,
            status: evaluationPayload?.status,
            traceId,
        })

        const { application, jobObjectId } = await this._resolveApplicationForEvaluation({
            jobId,
            candidateId,
            applicationId,
            resumeId,
        })

        if (!application) {
            logger.error('[ApplicationService.handleJobAiEvaluationCallback] Application not found', {
                jobId,
                candidateId,
                applicationId,
                resumeId,
                evaluationId: evaluationPayload?.id,
                traceId,
            })
            throw new AppError('Application not found for evaluation callback', ERROR_CODES.NOT_FOUND)
        }

        const evaluation = {
            ...evaluationPayload,
        }

        if (extraMetadata && Object.keys(extraMetadata).length > 0) {
            evaluation.metadata = {
                ...(evaluation.metadata && typeof evaluation.metadata === 'object' ? evaluation.metadata : {}),
                ...extraMetadata,
            }
        }

        const matchScore =
            typeof evaluation.overall_matching_score === 'number'
                ? evaluation.overall_matching_score
                : typeof evaluation.match_score === 'number'
                ? evaluation.match_score
                : undefined

        const updatedApplication = await this.updateApplicationEvaluation(application.applicationId, evaluation, {
            matchScore,
            resumeId,
            application,
        })

        logger.info('[ApplicationService.handleJobAiEvaluationCallback] Evaluation saved to application', {
            applicationId: updatedApplication.applicationId,
            candidateId: updatedApplication.candidateId,
            jobObjectId: jobObjectId?.toString() ?? updatedApplication.jobId?.toString(),
            matchScore: updatedApplication.matchScore,
            status: evaluation.status,
            traceId,
        })

        return {
            applicationId: updatedApplication.applicationId,
            jobId: updatedApplication.jobId?.toString(),
            candidateId: updatedApplication.candidateId,
            evaluationId: evaluation.id,
            matchScore: updatedApplication.matchScore,
            evaluationStatus: evaluation.status,
            updatedAt: updatedApplication.evaluationUpdatedAt,
        }
    }

    /**
     * 更新申请的 Job AI 评估信息
     * @param {string} applicationId
     * @param {object} evaluationData
     * @param {object} [options]
     * @param {number} [options.matchScore]
     * @param {string} [options.resumeId]
     * @param {import('mongoose').Document} [options.application]
     * @returns {Promise<import('mongoose').Document>}
     */
    async updateApplicationEvaluation(applicationId, evaluationData, options = {}) {
        const { matchScore, resumeId, application } = options

        const targetApplication =
            application ?? (await findBySmartId(JobApplication, applicationId))

        if (!targetApplication) {
            logger.error('[ApplicationService.updateApplicationEvaluation] Application not found', {
                applicationId,
            })
            throw new AppError('Application not found', ERROR_CODES.NOT_FOUND)
        }

        const now = new Date()

        targetApplication.evaluation = evaluationData

        const resolvedMatchScore = (() => {
            if (typeof matchScore === 'number') return matchScore
            if (typeof evaluationData?.overall_matching_score === 'number') return evaluationData.overall_matching_score
            if (typeof evaluationData?.match_score === 'number') return evaluationData.match_score
            return undefined
        })()

        if (typeof resolvedMatchScore === 'number') {
            const normalizedScore = Math.round(resolvedMatchScore * 10) / 10
            targetApplication.matchScore = normalizedScore
            targetApplication.evaluation.overall_matching_score = normalizedScore
            targetApplication.evaluation.match_score = normalizedScore
        }

        targetApplication.evaluationUpdatedAt = now

        if (resumeId && !targetApplication.resumeId) {
            targetApplication.resumeId = resumeId
        }

        await targetApplication.save()

        logger.info('[ApplicationService.updateApplicationEvaluation] Evaluation updated', {
            applicationId: targetApplication.applicationId,
            evaluationId: evaluationData?.id,
            matchScore: targetApplication.matchScore,
        })

        return targetApplication
    }

    /**
     * 创建申请
     * @param {Object} applicationData - 申请数据
     * @param {string} applicationData.jobId - 职位ID
     * @param {string} applicationData.candidateId - 候选人ID
     * @param {string} applicationData.resumeId - 简历ID（可选）
     * @param {boolean} applicationData.hasResume - 是否有简历
     * @param {boolean} applicationData.hasAssessment - 是否有评估
     */
    async createApplication(applicationData) {
        const {
            jobId,
            candidateId,
            candidateEmail,
            resumeId,
            coverLetter,
            expectedSalary,
            availableStartDate,
            source = 'direct',
            metadata = {},
            hasResume = false,
            hasAssessment = true,
        } = applicationData

        // hasResume 被 Joi validator 的 stripUnknown 移除，从 resumeId 推导
        const resolvedHasResume = hasResume || !!resumeId

        // 使用智能查询，支持 MongoDB ObjectId 或自定义格式的 jobId
        const jobPost = await findBySmartId(JobPost, jobId)

        if (!jobPost) {
            throw new AppError('Job not found', ERROR_CODES.NOT_FOUND)
        }

        // 检查是否已申请
        const existingApplication = await JobApplication.findOne({
            jobId: jobPost._id, // 使用JobPost的_id
            candidateId: candidateId, // candidateId是UUID格式（外部系统ID）
            status: { $ne: APPLICATION_STATUS.WITHDRAWN },
        })

        if (existingApplication) {
            // 如果已存在申请且状态是 SUBMITTING
            if (existingApplication.status === APPLICATION_STATUS.SUBMITTING) {
                // 检查是否可以更新为 SUBMITTED（有简历且有评估）
                if (resolvedHasResume && hasAssessment) {
                    const now = new Date()
                    // 更新申请状态为 SUBMITTED
                    existingApplication.status = APPLICATION_STATUS.SUBMITTED
                    existingApplication.resumeId = resumeId
                    // 更新 metadata 中的状态标记
                    existingApplication.metadata = {
                        ...existingApplication.metadata,
                        hasResume: true,
                        hasAssessment: true,
                        ...metadata, // 合并新的 metadata
                    }
                    existingApplication.statusHistory.push({
                        status: APPLICATION_STATUS.SUBMITTED,
                        timestamp: now,
                        note: 'Application completed with resume and assessment',
                    })
                    existingApplication.updatedAt = now
                    // save() 会触发 pre-save 钩子，自动设置 submittedAt
                    await existingApplication.save()
                    
                    // SUBMITTED 状态也不计入 stats.applications，只有到 screening 才计入

                    logger.info(`Application updated from SUBMITTING to SUBMITTED: ${existingApplication._id}`, {
                        jobId,
                        candidateId,
                        statsIncremented: false,
                    })
                } else {
                    // 仍然没有完善信息，更新 metadata 但保持 SUBMITTING 状态
                    existingApplication.metadata = {
                        ...existingApplication.metadata,
                        hasResume: resolvedHasResume,
                        hasAssessment,
                        ...metadata, // 合并新的 metadata
                    }
                    if (resumeId) {
                        existingApplication.resumeId = resumeId
                    }
                    existingApplication.updatedAt = new Date()
                    await existingApplication.save()

                    logger.info(`Application remains in SUBMITTING status: ${existingApplication._id}`, {
                        jobId,
                        candidateId,
                        hasResume: resolvedHasResume,
                        hasAssessment,
                    })
                }

                return existingApplication
            } else {
                // 其他状态，不允许重复申请
                throw new AppError('Already applied for this job', ERROR_CODES.DUPLICATE_APPLICATION)
            }
        }

        // 新建申请始终为 SUBMITTING（两步提交流程：第一次"解锁"，第二次"提交"）
        const initialStatus = APPLICATION_STATUS.SUBMITTING

        const statusNote = 'Application started'

        // 创建申请
        const application = new JobApplication({
            jobId: jobPost._id, // 使用JobPost的_id
            candidateId: candidateId, // candidateId是UUID格式（外部系统ID）
            resumeId: resumeId, // resumeId是UUID格式（外部系统ID）
            coverLetter,
            expectedSalary,
            availableStartDate,
            source,
            metadata: {
                ...metadata,
                hasResume,
                hasAssessment,
            },
            status: initialStatus,
            appliedAt: new Date(),
            statusHistory: [
                {
                    status: initialStatus,
                    timestamp: new Date(),
                    note: statusNote,
                },
            ],
        })

        await application.save()

        // Link shadow application if candidate email matches (registration email OR resume email)
        if (candidateEmail) {
            try {
                const emailsToMatch = [candidateEmail.toLowerCase()]

                const resume = await ResumeService.getUserLatestResume(candidateId)
                const resumeEmail = (resume?.data?.basicInfo?.email || resume?.basicInfo?.email)?.toLowerCase()
                if (resumeEmail && !emailsToMatch.includes(resumeEmail)) {
                    emailsToMatch.push(resumeEmail)
                }

                await ShadowApplication.findOneAndUpdate(
                    { jobId: jobPost._id, candidateEmail: { $in: emailsToMatch }, status: 'active', realCandidateId: null },
                    { realCandidateId: candidateId },
                )
            } catch (err) {
                logger.warn('[ApplicationService.createApplication] Failed to link shadow application', {
                    candidateEmail,
                    jobId: jobPost._id.toString(),
                    error: err.message,
                })
            }
        }

        // 更新职位申请计数 - 使用JobPost._id
        // 只有进入 screening 及之后状态才增加 stats.applications 和 currentApplicants
        // currentApplicants 与 stats.applications 保持一致的统计逻辑
        if (shouldCountInStats(initialStatus)) {
            await JobPost.findByIdAndUpdate(jobPost._id, {
                $inc: { 
                    'stats.applications': 1,
                    currentApplicants: 1
                }
            })
        }

        logger.info(`Application created: ${application._id}`, {
            jobId,
            candidateId,
            source,
            status: initialStatus,
            statsIncremented: shouldCountInStats(initialStatus),
        })

        return application
    }

    /**
     * 获取申请列表
     */
    async getApplications(filters = {}, pagination = {}, sort = {}) {
        const { candidateId, jobId, jobIds, companyId, status, dateFrom, dateTo, userId, readStatus, hideExcluded, foldEnabled = FOLD_DEFAULT_ENABLED, foldThreshold = FOLD_DEFAULT_THRESHOLD } = filters

        logger.info('[ApplicationService.getApplications] 开始查询', {
            filters,
            pagination,
            sort,
        })

        const query = {}

        if (candidateId) {
            query.candidateId = candidateId // UUID格式（外部系统ID）
        }

        if (jobId) {
            // 使用 findBySmartId 支持多种 ID 格式
            const jobPost = await findBySmartId(JobPost, jobId)
            if (jobPost) {
                query.jobId = jobPost._id // 使用JobPost的_id（ObjectId格式）
            } else {
                // 如果找不到对应的职位，返回空结果
                logger.warn('[ApplicationService.getApplications] 未找到对应的职位', { jobId })
                return {
                    data: [],
                    pagination: { total: 0, page, pageSize, totalPages: 0 },
                    ...(companyId && foldEnabled ? { foldInfo: { enabled: true, threshold: foldThreshold, foldedCount: 0 } } : {}),
                }
            }
        }

        // 支持多个jobId过滤（用于B端用户没有companyId时）
        if (jobIds && jobIds.length > 0) {
            query.jobId = { $in: jobIds } // jobIds应该已经是ObjectId数组
            logger.info('[ApplicationService.getApplications] 使用多个职位ID查询', {
                jobCount: jobIds.length,
            })
        }

        // 保存公司职位信息，避免重复查询
        let companyJobsMap = null

        if (companyId && !jobId) {
            // 数据隔离：只获取用户可访问的岗位（自己发布的 + 被分享的）
            const accessibleJobIds = userId
                ? await jobCollaboratorService.getAccessibleJobIds(userId, companyId)
                : []
            const companyJobs = await JobPost.find(
                userId ? { _id: { $in: accessibleJobIds } } : { companyId },
            ).select('_id jobId title location companyName companyInfo').lean()

            query.jobId = { $in: companyJobs.map(job => job._id) }

            // 保存职位信息供后续使用
            companyJobsMap = companyJobs.reduce((map, job) => {
                map[job._id.toString()] = job
                return map
            }, {})

            logger.info('[ApplicationService.getApplications] 公司职位查询', {
                companyId,
                jobCount: companyJobs.length,
            })
        }

        if (status) {
            // 支持多个状态值（从验证器传递过来的可能是数组或单个值）
            if (Array.isArray(status)) {
                query.status = { $in: status }
                logger.info('[ApplicationService.getApplications] 使用多个状态查询', {
                    statuses: status,
                })
            } else {
                query.status = status
            }
        }

        if (dateFrom || dateTo) {
            query.appliedAt = {}
            if (dateFrom) query.appliedAt.$gte = new Date(dateFrom)
            if (dateTo) query.appliedAt.$lte = new Date(dateTo)
        }

        // Pre-fetch user actions for B-side filtering (read/unread, excluded)
        let prefetchedUserActions = []
        let excludedAppIds = []
        let readAppIds = []

        if (userId) {
            try {
                prefetchedUserActions = await ApplicationUserAction.find({ userId })
                    .select('applicationId isRead isExcluded')
                    .lean()
                excludedAppIds = prefetchedUserActions.filter(a => a.isExcluded).map(a => a.applicationId)
                readAppIds = prefetchedUserActions.filter(a => a.isRead).map(a => a.applicationId)
            } catch (err) {
                logger.warn('[ApplicationService.getApplications] Pre-fetch user actions failed', {
                    error: err.message,
                    userId,
                })
            }
        }

        const { page = 1, pageSize = 20 } = pagination

        // Apply user action filters to query (non-shadow path)
        if (userId) {
            const andConditions = []

            if (hideExcluded && excludedAppIds.length > 0) {
                andConditions.push({ applicationId: { $nin: excludedAppIds } })
            }

            if (readStatus === 'read' && readAppIds.length > 0) {
                andConditions.push({ applicationId: { $in: readAppIds } })
            } else if (readStatus === 'read' && readAppIds.length === 0) {
                // No read apps → return empty for "read" filter
                return {
                    data: [],
                    pagination: { total: 0, page, pageSize, totalPages: 0 },
                    ...(companyId && foldEnabled ? { foldInfo: { enabled: true, threshold: foldThreshold, foldedCount: 0 } } : {}),
                }
            } else if (readStatus === 'unread' && readAppIds.length > 0) {
                andConditions.push({ applicationId: { $nin: readAppIds } })
            }

            if (andConditions.length > 0) {
                query.$and = [...(query.$and || []), ...andConditions]
            }
        }

        logger.info('[ApplicationService.getApplications] MongoDB查询条件', {
            query,
            queryKeys: Object.keys(query),
        })
        const skip = (page - 1) * pageSize

        const { sortBy = 'appliedAt', sortOrder = 'desc' } = sort
        const sortOption = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

        let data
        let total
        let foldedCount = 0

        // Determine if shadow applications should be merged (B端 only, screening-compatible status)
        const includeShadows = !!companyId && !candidateId && this._shouldIncludeShadows(status)
        const shadowJobIdMatch = query.jobId // could be ObjectId or { $in: [...] }

        const sortDirection = sortOrder === 'desc' ? -1 : 1
        const fallbackValue = sortOrder === 'desc' ? -1 : 200

        // Build unified aggregation pipeline
        const pipeline = [
            { $match: query },
            { $addFields: { _isShadow: false } },
        ]

        if (includeShadows && shadowJobIdMatch) {
            // --- Shadow path: two queries + JS merge (compatible with MongoDB 4.2) ---
            // TODO: 升级 MongoDB 4.4+ 后可改回 $unionWith pipeline

            // 1) Get real applications (base pipeline only)
            const realApps = await JobApplication.aggregate(pipeline).allowDiskUse(true)

            // 2) Get shadow applications
            const shadowMatch = { status: 'active' }
            if (shadowJobIdMatch.$in) {
                shadowMatch.jobId = { $in: shadowJobIdMatch.$in }
            } else {
                shadowMatch.jobId = shadowJobIdMatch
            }
            const shadowDocs = await ShadowApplication.find(shadowMatch).lean()
            const mappedShadows = shadowDocs.map(s => ({
                ...s,
                appliedAt: s.invitedAt || s.createdAt,
                screeningAt: s.invitedAt || s.createdAt,
                applicationId: s.shadowApplicationId,
                candidateId: s.pseudoCandidateId,
                resumeId: s.shadowResumeId,
                status: 'screening',
                source: 'recommend',
                invitedAt: s.invitedAt,
                _isShadow: true,
                _embeddedCandidateInfo: s.candidateInfo,
            }))

            // 2.5) Filter shadows by user actions (read/unread, excluded)
            let filteredShadows = mappedShadows
            if (userId) {
                if (hideExcluded && excludedAppIds.length > 0) {
                    const excludeSet = new Set(excludedAppIds)
                    filteredShadows = filteredShadows.filter(s => !excludeSet.has(s.applicationId))
                }
                if (readStatus === 'read') {
                    const readSet = new Set(readAppIds)
                    filteredShadows = filteredShadows.filter(s => readSet.has(s.applicationId))
                } else if (readStatus === 'unread') {
                    const readSet = new Set(readAppIds)
                    filteredShadows = filteredShadows.filter(s => !readSet.has(s.applicationId))
                }
            }

            // 3) Merge + sort
            const merged = [...realApps, ...filteredShadows]
            if (sortBy === 'matchScore') {
                merged.forEach(item => {
                    item.matchScore = item.matchScore ?? item.evaluation?.overall_matching_score ?? null
                })
                merged.sort((a, b) => {
                    const sa = a.matchScore ?? fallbackValue
                    const sb = b.matchScore ?? fallbackValue
                    return sa !== sb ? sortDirection * (sa - sb) : (String(a._id) > String(b._id) ? 1 : -1)
                })
            } else {
                const sortKey = Object.keys(sortOption)[0]
                const sortDir = sortOption[sortKey]
                merged.sort((a, b) => {
                    const av = a[sortKey], bv = b[sortKey]
                    if (av == null && bv == null) return String(a._id) > String(b._id) ? 1 : -1
                    if (av == null) return sortDir   // nulls last in desc, first in asc
                    if (bv == null) return -sortDir
                    if (av < bv) return -sortDir
                    if (av > bv) return sortDir
                    return String(a._id) > String(b._id) ? 1 : -1
                })
            }

            // 4) Fold partition (B端低分折叠)
            if (companyId && foldEnabled) {
                const { normal, folded } = this._partitionByScore(merged, foldThreshold)
                foldedCount = folded.length
                merged.length = 0
                merged.push(...normal, ...folded)
            }

            // 5) JS pagination
            total = merged.length
            data = merged.slice(skip, skip + pageSize)
        } else {
            // --- Non-shadow path: original pipeline (no $unionWith) ---

            // Sort
            if (sortBy === 'matchScore') {
                pipeline.push({
                    $addFields: {
                        matchScore: { $ifNull: ['$matchScore', '$evaluation.overall_matching_score'] },
                        __sortScore: {
                            $ifNull: ['$matchScore', { $ifNull: ['$evaluation.overall_matching_score', fallbackValue] }],
                        },
                    },
                })
                pipeline.push({ $sort: { __sortScore: sortDirection, _id: 1 } })
            } else {
                pipeline.push({ $sort: { ...sortOption, _id: 1 } })
            }

            if (companyId && foldEnabled) {
                // B端启用折叠：全量拉取 + JS 分区分页
                pipeline.push({ $unset: '__sortScore' })
                const allData = await JobApplication.aggregate(pipeline).allowDiskUse(true)

                if (sortBy === 'matchScore') {
                    allData.forEach(item => {
                        item.matchScore = item.matchScore ?? item.evaluation?.overall_matching_score ?? null
                    })
                }

                const { normal, folded } = this._partitionByScore(allData, foldThreshold)
                foldedCount = folded.length
                const partitioned = [...normal, ...folded]

                total = partitioned.length
                data = partitioned.slice(skip, skip + pageSize)
            } else {
                // C端或未启用折叠：保持原有 $facet 分页逻辑
                pipeline.push({
                    $facet: {
                        data: [{ $skip: skip }, { $limit: pageSize }, { $unset: '__sortScore' }],
                        totalCount: [{ $count: 'count' }],
                    },
                })

                const [facetResult] = await JobApplication.aggregate(pipeline).allowDiskUse(true)
                data = facetResult.data || []
                total = facetResult.totalCount[0]?.count || 0
            }
        }

        logger.info('[ApplicationService.getApplications] 查询完成', {
            total,
            dataCount: data.length,
            page,
            pageSize,
            sortBy,
            sortOrder,
        })

        // 批量获取职位信息（将MongoDB ObjectId转换为业务标识符）
        if (data.length > 0) {
            try {
                let jobMap = companyJobsMap || {} // 如果已经查询过公司职位，直接使用

                // 只有在没有companyJobsMap或需要额外职位信息时才查询
                if (!companyJobsMap) {
                    // 获取所有唯一的职位ID（MongoDB ObjectId）
                    const jobObjectIds = [...new Set(data.map(app => app.jobId.toString()))]

                    logger.info('[ApplicationService.getApplications] 开始获取职位信息', {
                        jobCount: jobObjectIds.length,
                    })

                    // 批量查询职位信息
                    const jobPosts = await JobPost.find({
                        _id: { $in: jobObjectIds },
                    })
                        .select('_id jobId title location companyName companyInfo')
                        .lean()

                    // 创建职位映射（_id -> jobPost）
                    jobMap = jobPosts.reduce((map, job) => {
                        map[job._id.toString()] = job
                        return map
                    }, {})
                } else {
                    logger.info('[ApplicationService.getApplications] 使用已缓存的公司职位信息', {
                        cachedJobCount: Object.keys(companyJobsMap).length,
                    })
                }

                // 替换jobId为业务标识符，并添加job字段
                data.forEach(application => {
                    const jobPost = jobMap[application.jobId.toString()]
                    const jobInfo = this._formatJobInfo(jobPost)

                    if (!jobPost) {
                        logger.warn('[ApplicationService.getApplications] 职位不存在', {
                            jobObjectId: application.jobId,
                            applicationId: application._id,
                        })
                    }

                    application.jobId = jobInfo.jobId
                    application.job = jobInfo.job
                })

                logger.info('[ApplicationService.getApplications] 职位信息获取完成', {
                    successCount: data.filter(app => app.job).length,
                    totalCount: data.length,
                })
            } catch (error) {
                logger.error('[ApplicationService.getApplications] 批量获取职位信息失败', {
                    error: error.message,
                })
                // 即使获取职位信息失败，也返回申请数据，但jobId设为null
                data.forEach(application => {
                    application.jobId = null
                    application.job = null
                })
            }
        }

        // 批量获取候选人信息
        if (data.length > 0) {
            try {
                // Split shadow vs real applications
                const realApplications = data.filter(app => !app._isShadow)
                const shadowApplications = data.filter(app => app._isShadow)

                // Shadow applications: use embedded candidate info directly
                shadowApplications.forEach(application => {
                    const info = application._embeddedCandidateInfo || {}
                    application.candidate = {
                        id: application.candidateId,
                        name: maskName(info.name) || 'Unknown',
                        email: info.email,
                        phone: info.phone,
                        title: info.title,
                        location: info.location,
                        summary: info.summary,
                        skills: info.skills,
                        experience: info.experience,
                        education: info.education,
                        isProfileComplete: false,
                        resumeId: application.resumeId,
                    }
                })

                // Real applications: fetch from UserCenter + Resume services
                if (realApplications.length > 0) {
                    const candidateIds = [...new Set(realApplications.map(app => app.candidateId))]

                    logger.info('[ApplicationService.getApplications] 开始获取候选人信息', {
                        candidateCount: candidateIds.length,
                        shadowCount: shadowApplications.length,
                    })

                    const candidatePromises = realApplications.map(async application => {
                        const candidateId = application.candidateId
                        const resumeId = application.resumeId

                        try {
                            const resumeCall = resumeId
                                ? (companyId && userId ? ResumeService.getResumeForBUser(userId, resumeId) : ResumeService.getResume(candidateId, resumeId))
                                : Promise.resolve(null)

                            const [profile, resumeInfo] = await Promise.allSettled([
                                UserCenterService.getCandidateProfile(candidateId),
                                resumeCall,
                            ])

                            const userProfile = profile.status === 'fulfilled' ? profile.value : null

                            let resumeData = null
                            if (resumeInfo.status === 'fulfilled' && resumeInfo.value) {
                                const response = resumeInfo.value
                                resumeData = response?.data
                                if (resumeData && resumeData.code === 0 && resumeData.data) {
                                    resumeData = resumeData.data
                                }
                            }

                            const name =
                                resumeData?.name || resumeData?.personalInfo?.name || resumeData?.basicInfo?.name || userProfile?.name || 'Unknown'
                            const email = userProfile?.email || resumeData?.email || resumeData?.personalInfo?.email
                            const phone = resumeData?.phone || resumeData?.personalInfo?.phone || userProfile?.phone
                            const title = resumeData?.title || resumeData?.personalInfo?.title || userProfile?.title
                            const location = resumeData?.location || resumeData?.personalInfo?.location || userProfile?.location

                            return {
                                id: candidateId,
                                name,
                                email,
                                phone,
                                avatar: userProfile?.avatar,
                                title,
                                summary: userProfile?.summary || resumeData?.summary,
                                location,
                                experience: userProfile?.experience || resumeData?.experience,
                                education: userProfile?.education || resumeData?.education,
                                skills: userProfile?.skills || resumeData?.skills,
                                isProfileComplete: userProfile?.isProfileComplete || false,
                                resumeId,
                            }
                        } catch (error) {
                            logger.warn('[ApplicationService.getApplications] 获取候选人信息失败', {
                                candidateId,
                                resumeId,
                                error: error.message,
                            })
                            return {
                                id: candidateId,
                                name: 'Unknown',
                                email: null,
                                isProfileComplete: false,
                            }
                        }
                    })

                    const candidateProfiles = await Promise.all(candidatePromises)

                    const candidateMap = candidateProfiles.reduce((map, candidate) => {
                        map[candidate.id] = candidate
                        return map
                    }, {})

                    realApplications.forEach(application => {
                        application.candidate = candidateMap[application.candidateId] || {
                            id: application.candidateId,
                            name: 'Unknown',
                            email: null,
                            isProfileComplete: false,
                        }
                    })

                    logger.info('[ApplicationService.getApplications] 候选人信息获取完成', {
                        realSuccess: candidateProfiles.filter(p => p.name && p.name !== 'Unknown').length,
                        realTotal: candidateProfiles.length,
                        shadowCount: shadowApplications.length,
                    })
                }
            } catch (error) {
                logger.error('[ApplicationService.getApplications] 批量获取候选人信息失败', {
                    error: error.message,
                })
            }
        }

        // 批量获取评估信息（仅补充缺失的评估）
        const applicationsNeedingEvaluation = data.filter(application => !application.evaluation && !application._isShadow)

        if (applicationsNeedingEvaluation.length > 0) {
            try {
                logger.info('[ApplicationService.getApplications] 开始补充缺失的评估信息', {
                    applicationCount: applicationsNeedingEvaluation.length,
                })

                // 为每个申请获取评估信息
                const evaluationPromises = applicationsNeedingEvaluation.map(async application => {
                    try {
                        // 获取该候选人的评估列表
                        const evaluations = await this.evaluationService.getCandidateEvaluations(application.candidateId, {
                            pageSize: 100,
                            companyId: companyId, // 使用filters中的companyId
                        })

                        // 查找匹配当前申请的评估
                        if (evaluations.data && evaluations.data.length > 0) {
                            // 查找与当前jobId和applicationId匹配的评估
                            const matchingEvaluation = evaluations.data.find(evalItem => {
                                const evalJobId = evalItem.job_id || evalItem.jobId
                                const evalApplicationId = evalItem.application_id || evalItem.applicationId
                                return (
                                    evalApplicationId === application.applicationId ||
                                    (evalJobId && evalJobId.toString() === application.jobId?.toString())
                                )
                            })

                            if (matchingEvaluation) {
                                const evaluationPayload = { ...matchingEvaluation }

                                const derivedMatchScore =
                                    typeof evaluationPayload.overall_matching_score === 'number'
                                        ? evaluationPayload.overall_matching_score
                                        : typeof evaluationPayload.match_score === 'number'
                                        ? evaluationPayload.match_score
                                        : undefined

                                return {
                                    applicationId: application.applicationId,
                                    evaluation: evaluationPayload,
                                    matchScore: derivedMatchScore,
                                }
                            }
                        }
                        return null
                    } catch (error) {
                        logger.warn('[ApplicationService.getApplications] 获取单个申请的评估信息失败', {
                            applicationId: application.applicationId,
                            candidateId: application.candidateId,
                            error: error.message,
                        })
                        return null
                    }
                })

                const evaluationResults = await Promise.all(evaluationPromises)

                // 创建评估信息映射
                const evaluationMap = evaluationResults.reduce((map, result) => {
                    if (result) {
                        map[result.applicationId] = {
                            evaluation: result.evaluation,
                            matchScore: result.matchScore,
                        }
                    }
                    return map
                }, {})

                // 将评估信息附加到申请数据，并保存到数据库以确保下次查询排序正确
                const updatePromises = applicationsNeedingEvaluation.map(async application => {
                    const evaluationEntry = evaluationMap[application.applicationId]
                    if (evaluationEntry) {
                        // 更新内存中的数据（用于返回给前端）
                        application.evaluation = evaluationEntry.evaluation
                        if (typeof evaluationEntry.matchScore === 'number') {
                            application.matchScore = evaluationEntry.matchScore
                        }

                        // 保存到数据库，确保下次查询时排序正确
                        try {
                            await this.updateApplicationEvaluation(
                                application.applicationId,
                                evaluationEntry.evaluation,
                                { matchScore: evaluationEntry.matchScore }
                            )
                        } catch (error) {
                            logger.warn('[ApplicationService.getApplications] 保存评估信息到数据库失败', {
                                applicationId: application.applicationId,
                                error: error.message,
                            })
                        }
                    }
                })

                await Promise.allSettled(updatePromises)

                logger.info('[ApplicationService.getApplications] 缺失评估信息补充并保存完成', {
                    successCount: Object.keys(evaluationMap).length,
                    totalCount: applicationsNeedingEvaluation.length,
                })
            } catch (error) {
                logger.error('[ApplicationService.getApplications] 批量获取评估信息失败', {
                    error: error.message,
                })
                // 即使获取评估信息失败，也返回申请数据
            }
        } else {
            logger.info('[ApplicationService.getApplications] 所有申请已包含存储的评估信息，跳过远程查询')
        }

        // 注意：不要在这里再次排序！
        // 排序已在数据库层完成（使用 aggregation pipeline），并且已经分页
        // 如果在获取外部评估信息后再次排序，会导致排序结果不一致
        // 因为分页是在数据库层完成的，内存排序只会影响当前页的数据
        // 如果需要使用最新的评估信息排序，应该通过 Job AI 回调将 matchScore 保存到数据库

        // 批量获取面试预约状态
        await this._attachAppointmentInfo(data)

        // 批量获取人工面试评分
        await this._attachManualRatingInfo(data, companyId)

        // 批量获取 AI 面试进度（仅 B 端）
        if (companyId && data.length > 0) {
            await this._attachInterviewProgress(data, companyId)
        }

        // 批量附加用户操作标记（仅 B 端，复用 pre-fetch 数据）
        if (userId) {
            this._attachUserActions(data, prefetchedUserActions)
        }

        const result = {
            data,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        }

        if (companyId && foldEnabled) {
            result.foldInfo = {
                enabled: true,
                threshold: foldThreshold,
                foldedCount,
            }
        }

        return result
    }

    /**
     * 获取申请详情
     */
    async getApplicationById(applicationId, { companyId: detailCompanyId = null, userId = null, type = null } = {}) {
        // 使用智能查询辅助函数，自动识别ID格式
        const application = await findBySmartIdOrThrow(JobApplication, applicationId, {
            lean: true,
            errorMessage: 'Application not found',
        })

        // 获取候选人详细信息
        if (application && application.candidateId) {
            try {
                // 并行获取用户中心和简历信息
                const isBUser = type === 'B' && !!userId
                const getResumeCall = isBUser
                    ? ResumeService.getResumeForBUser(userId, application.resumeId)
                    : ResumeService.getResume(application.candidateId, application.resumeId)

                const [profileResult, resumeResult] = await Promise.allSettled([
                    UserCenterService.getCandidateProfile(application.candidateId),
                    application.resumeId ? getResumeCall : Promise.resolve(null),
                ])

                // 获取用户中心的数据
                const candidateProfile = profileResult.status === 'fulfilled' ? profileResult.value : null

                // 获取简历数据
                let resumeData = null
                if (resumeResult.status === 'fulfilled' && resumeResult.value) {
                    const response = resumeResult.value
                    resumeData = response?.data
                    // 如果响应是标准格式 { code: 0, data: {...} }
                    if (resumeData && resumeData.code === 0 && resumeData.data) {
                        resumeData = resumeData.data
                    }
                }

                // 优先使用简历中的姓名和其他信息
                const name = resumeData?.name || resumeData?.personalInfo?.name || resumeData?.basicInfo?.name || candidateProfile?.name || 'Unknown'

                const email = candidateProfile?.email || resumeData?.email || resumeData?.personalInfo?.email
                const phone = resumeData?.phone || resumeData?.personalInfo?.phone || candidateProfile?.phone
                const title = resumeData?.title || resumeData?.personalInfo?.title || candidateProfile?.title
                const location = resumeData?.location || resumeData?.personalInfo?.location || candidateProfile?.location

                application.candidate = {
                    id: application.candidateId,
                    name: name,
                    email: email,
                    phone: phone,
                    avatar: candidateProfile?.avatar,
                    title: title,
                    summary: candidateProfile?.summary || resumeData?.summary,
                    location: location,
                    experience: candidateProfile?.experience || resumeData?.experience,
                    education: candidateProfile?.education || resumeData?.education,
                    skills: candidateProfile?.skills || resumeData?.skills,
                    isProfileComplete: candidateProfile?.isProfileComplete || false,
                    resumeId: application.resumeId, // 保留resumeId信息
                }

                logger.info('[ApplicationService.getApplicationById] 候选人信息获取成功', {
                    applicationId,
                    candidateId: application.candidateId,
                })
            } catch (error) {
                logger.warn('[ApplicationService.getApplicationById] 获取候选人信息失败', {
                    applicationId,
                    candidateId: application.candidateId,
                    error: error.message,
                })
                // 提供基础信息
                application.candidate = {
                    id: application.candidateId,
                    name: 'Unknown',
                    email: null,
                    isProfileComplete: false,
                }
            }
        }

        // 获取职位信息（将MongoDB ObjectId转换为业务标识符）
        let jobPost = null // 保存jobPost以便后续使用
        if (application && application.jobId) {
            try {
                jobPost = await JobPost.findById(application.jobId).select('_id jobId title location companyName companyInfo companyId').lean()

                const jobInfo = this._formatJobInfo(jobPost)

                if (!jobPost) {
                    logger.warn('[ApplicationService.getApplicationById] 职位不存在', {
                        jobObjectId: application.jobId,
                        applicationId: application._id,
                    })
                }

                application.jobId = jobInfo.jobId
                application.job = jobInfo.job
            } catch (error) {
                logger.error('[ApplicationService.getApplicationById] 获取职位信息失败', {
                    applicationId,
                    jobId: application.jobId,
                    error: error.message,
                })
                // 即使获取职位信息失败，也返回申请数据，但jobId设为null
                const jobInfo = this._formatJobInfo(null)
                application.jobId = jobInfo.jobId
                application.job = jobInfo.job
            }
        }

        // 获取单个申请的评估信息
        if (application && application.candidateId) {
            try {
                logger.info('[ApplicationService.getApplicationById] 开始获取评估信息', {
                    applicationId,
                    candidateId: application.candidateId,
                })

                // 获取该候选人的评估列表
                const evaluations = await this.evaluationService.getCandidateEvaluations(application.candidateId, {
                    pageSize: 100,
                    companyId: jobPost?.companyId, // 使用jobPost中的companyId
                })

                // 查找匹配当前申请的评估
                if (evaluations.data && evaluations.data.length > 0) {
                    // 查找与当前applicationId或jobId匹配的评估
                    const matchingEvaluation = evaluations.data.find(
                        evalItem =>
                            evalItem.application_id === application.applicationId ||
                            (evalItem.job_id && evalItem.job_id.toString() === application.jobId?.toString()),
                    )

                    if (!application.evaluation && matchingEvaluation) {
                        application.evaluation = { ...matchingEvaluation }

                        const derivedMatchScore =
                            typeof application.evaluation.overall_matching_score === 'number'
                                ? application.evaluation.overall_matching_score
                                : typeof application.evaluation.match_score === 'number'
                                ? application.evaluation.match_score
                                : undefined

                        if (typeof derivedMatchScore === 'number') {
                            application.matchScore = Math.round(derivedMatchScore * 10) / 10
                            application.evaluation.overall_matching_score = application.matchScore
                            application.evaluation.match_score = application.matchScore
                        }

                        logger.info('[ApplicationService.getApplicationById] 评估信息补充成功', {
                            applicationId,
                            evaluationId: application.evaluation.id,
                            matchScore: application.matchScore,
                        })
                    } else {
                        logger.info('[ApplicationService.getApplicationById] 未找到匹配的评估信息', {
                            applicationId,
                            candidateId: application.candidateId,
                            evaluationCount: evaluations.data.length,
                        })
                    }
                }
            } catch (error) {
                logger.error('[ApplicationService.getApplicationById] 获取评估信息失败', {
                    applicationId,
                    candidateId: application.candidateId,
                    error: error.message,
                })
                // 即使获取评估信息失败，也返回申请数据
            }
        }

        if (application && detailCompanyId) {
            await this._attachInterviewProgress([application], detailCompanyId)
        }

        return application
    }

    /**
     * 更新申请状态
     */
    async updateApplicationStatus(applicationId, status, additionalData = {}) {
        // 使用智能查询辅助函数
        const application = await findBySmartId(JobApplication, applicationId)

        if (!application) {
            logger.error('[ApplicationService] Application not found for status update', {
                applicationId,
                attemptedStatus: status,
            })
            throw new AppError('Application not found', ERROR_CODES.NOT_FOUND)
        }

        // 记录更新前的状态
        const previousStatus = application.status
        logger.info('[ApplicationService] Starting status update', {
            applicationId: application.applicationId,
            currentStatus: previousStatus,
            targetStatus: status,
            candidateId: application.candidateId,
            jobId: application.jobId,
            additionalData,
        })

        try {
            // 使用模型的updateStatus方法，它包含了验证、日志记录和时间戳设置
            // updateStatus内部会调用save()并触发pre-save钩子来设置时间戳
            await application.updateStatus(
                status,
                additionalData.changedBy || 'system',
                additionalData.note || `Status changed from ${previousStatus} to ${status}`,
            )

            // 合并额外数据（排除note和changedBy，它们已经被处理）
            const { note, changedBy, ...otherData } = additionalData
            if (Object.keys(otherData).length > 0) {
                Object.assign(application, otherData)
                await application.save()
            }

            logger.info('[ApplicationService] Application status updated successfully', {
                applicationId: application.applicationId,
                previousStatus,
                newStatus: status,
                changedBy: additionalData.changedBy || 'system',
                note: additionalData.note,
                timestamp: new Date().toISOString(),
            })
        } catch (error) {
            logger.error('[ApplicationService] Failed to update application status', {
                applicationId: application.applicationId,
                previousStatus,
                attemptedStatus: status,
                error: error.message,
                stack: error.stack,
            })

            // 如果是验证错误，重新抛出原始错误
            if (error.message.includes('Invalid status transition')) {
                throw new AppError(error.message, ERROR_CODES.INVALID_STATUS)
            }
            throw error
        }
        
        // 更新职位的 stats.applications、currentApplicants 和 hiredCount 统计
        // currentApplicants 与 stats.applications 保持一致的统计逻辑
        const wasCountedBefore = shouldCountInStats(previousStatus)
        const shouldCountNow = shouldCountInStats(status)
        
        const updateData = {}
        
        // 处理 stats.applications 和 currentApplicants
        if (!wasCountedBefore && shouldCountNow) {
            // 从不计入到计入（如 SUBMITTED -> SCREENING）
            updateData['stats.applications'] = 1
            updateData.currentApplicants = 1
        } else if (wasCountedBefore && !shouldCountNow) {
            // 从计入到不计入（如 INTERVIEW -> WITHDRAWN）
            updateData['stats.applications'] = -1
            updateData.currentApplicants = -1
        }
        
        // 处理 hiredCount
        if (previousStatus !== APPLICATION_STATUS.HIRED && status === APPLICATION_STATUS.HIRED) {
            // 变为 HIRED 状态
            updateData.hiredCount = 1
        } else if (previousStatus === APPLICATION_STATUS.HIRED && status !== APPLICATION_STATUS.HIRED) {
            // 从 HIRED 状态变为其他状态（虽然不太可能）
            updateData.hiredCount = -1
        }
        
        // 如果有需要更新的数据，执行更新
        if (Object.keys(updateData).length > 0) {
            const $inc = {}
            for (const [key, value] of Object.entries(updateData)) {
                $inc[key] = value
            }
            
            await JobPost.findByIdAndUpdate(application.jobId, { $inc })
            
            logger.info('Job stats updated due to status change', {
                applicationId,
                from: previousStatus,
                to: status,
                updates: updateData,
            })
        }

        // Hide shadow applications when transitioning to SCREENING
        if (previousStatus !== APPLICATION_STATUS.SCREENING && status === APPLICATION_STATUS.SCREENING) {
            try {
                const result = await ShadowApplication.updateMany(
                    { realCandidateId: application.candidateId, jobId: application.jobId, status: 'active' },
                    { status: 'hidden', hiddenAt: new Date() },
                )
                if (result.modifiedCount > 0) {
                    logger.info('[ApplicationService] Shadow applications hidden after SCREENING transition', {
                        applicationId,
                        candidateId: application.candidateId,
                        jobId: application.jobId?.toString(),
                        hiddenCount: result.modifiedCount,
                    })
                }
            } catch (err) {
                logger.warn('[ApplicationService] Failed to hide shadow applications', {
                    applicationId,
                    error: err.message,
                })
            }
        }

        logger.info(`Application status updated: ${applicationId}`, {
            from: previousStatus,
            to: status,
            statsChanged: wasCountedBefore !== shouldCountNow,
        })

        return application
    }

    /**
     * 批量更新申请状态
     */
    async batchUpdateStatus(applicationIds, status, additionalData = {}) {
        const results = {
            success: [],
            failed: [],
        }

        for (const applicationId of applicationIds) {
            try {
                await this.updateApplicationStatus(applicationId, status, additionalData)
                results.success.push(applicationId)
            } catch (error) {
                results.failed.push({
                    applicationId,
                    error: error.message,
                })
            }
        }

        return results
    }

    /**
     * 获取申请统计
     */
    async getApplicationStats(candidateId = null, filters = {}) {
        const matchFilters = { ...filters }
        if (candidateId) {
            matchFilters.candidateId = candidateId // UUID格式（外部系统ID）
        }

        const pipeline = [
            { $match: matchFilters },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]

        const stats = await JobApplication.aggregate(pipeline)
        const result = stats.reduce((acc, curr) => {
            acc[curr._id] = curr.count
            acc.total = (acc.total || 0) + curr.count
            return acc
        }, {})

        return result
    }

    /**
     * 根据职位和候选人查找申请
     */
    async findApplicationByJobAndCandidate(jobId, candidateId) {
        // 使用智能查询获取职位
        const jobPost = await findBySmartId(JobPost, jobId)
        if (!jobPost) {
            return null
        }

        return JobApplication.findOne({
            jobId: jobPost._id, // 使用JobPost的_id
            candidateId: candidateId, // candidateId是UUID格式（外部系统ID）
            status: { $ne: APPLICATION_STATUS.WITHDRAWN },
        })
    }

    /**
     * 获取候选人的申请
     */
    async getCandidateApplications(candidateId, filters = {}) {
        const query = {
            candidateId: candidateId, // UUID格式（外部系统ID）
            ...filters,
        }

        return JobApplication.find(query).sort({ appliedAt: -1 }).populate('jobId', 'title location companyName').lean()
    }

    /**
     * 批量获取候选人信息
     */
    async enrichApplicationsWithCandidateInfo(applications) {
        const candidateIds = [...new Set(applications.map(app => app.candidateId.toString()))]

        try {
            const candidatesResponse = await UserCenterService.batchGetUsers(candidateIds)
            const candidatesMap = candidatesResponse.data.reduce((map, candidate) => {
                map[candidate._id] = candidate
                return map
            }, {})

            return applications.map(app => ({
                ...app,
                candidateInfo: candidatesMap[app.candidateId.toString()] || null,
            }))
        } catch (error) {
            logger.error('Failed to fetch candidate info', error)
            return applications
        }
    }

    /**
     * 获取申请的简历信息
     */
    async getApplicationResume(applicationId, userId) {
        const application = await this.getApplicationById(applicationId)

        // 权限检查：只有候选人本人或相关企业可以查看
        if (application.candidateId !== userId) {
            // 检查是否是企业用户查看 - 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, application.jobId)
            if (!job || job.companyId !== userId) {
                throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
            }
        }

        try {
            const resume = await ResumeService.getResume(application.candidateId, application.resumeId)
            return resume.data
        } catch (error) {
            logger.error('Failed to fetch resume', error)
            throw new AppError('Resume not found', ERROR_CODES.NOT_FOUND)
        }
    }

    /**
     * 删除申请（用于事务回滚）
     * @param {string} applicationId - 申请ID（MongoDB ObjectId）
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteApplication(applicationId) {
        try {
            // 查找申请
            const application = await JobApplication.findById(applicationId)
            if (!application) {
                logger.warn('[ApplicationService.deleteApplication] Application not found', { applicationId })
                return false
            }

            // 更新职位申请计数
            // currentApplicants 与 stats.applications 保持一致的统计逻辑
            const updateData = {}
            
            // 只有当状态在统计范围内时才减少 stats.applications 和 currentApplicants
            if (shouldCountInStats(application.status)) {
                updateData['stats.applications'] = -1
                updateData.currentApplicants = -1
            }
            
            // 如果是 HIRED 状态，需要减少 hiredCount
            if (application.status === APPLICATION_STATUS.HIRED) {
                updateData.hiredCount = -1
            }
            
            // 执行更新
            if (Object.keys(updateData).length > 0) {
                const $inc = {}
                for (const [key, value] of Object.entries(updateData)) {
                    $inc[key] = value
                }
                await JobPost.findByIdAndUpdate(application.jobId, { $inc })
            }

            // 删除申请
            await JobApplication.deleteOne({ _id: applicationId })

            logger.info('[ApplicationService.deleteApplication] Application deleted', {
                applicationId,
                jobId: application.jobId,
                candidateId: application.candidateId,
            })

            return true
        } catch (error) {
            logger.error('[ApplicationService.deleteApplication] Failed to delete application', {
                applicationId,
                error: error.message,
            })
            return false
        }
    }

    /**
     * Determine if shadow applications should be included based on status filter
     * @private
     */
    _shouldIncludeShadows(status) {
        if (!status) return true
        const statuses = Array.isArray(status) ? status : [status]
        return statuses.includes('screening')
    }

    /**
     * 将申请列表按分数线分区（高分在前，低分在后）
     * @private
     * @param {Array} applications - 已排序的申请列表
     * @param {number} threshold - 折叠分数线
     * @returns {{ normal: Array, folded: Array }}
     */
    _partitionByScore(applications, threshold) {
        const normal = []
        const folded = []

        for (const app of applications) {
            const score = app.matchScore ?? app.evaluation?.overall_matching_score ?? null

            if (score === null || score < threshold) {
                app.isFolded = true
                folded.push(app)
            } else {
                app.isFolded = false
                normal.push(app)
            }
        }

        return { normal, folded }
    }

    /**
     * 批量附加面试预约信息到申请数据
     * @private
     * @param {Array} applications - 申请数据数组
     * @returns {Promise<void>}
     */
    async _attachAppointmentInfo(applications) {
        if (!applications || applications.length === 0) {
            return
        }

        try {
            // 获取所有申请的 applicationId
            const applicationIds = applications.map(app => app.applicationId).filter(Boolean)

            if (applicationIds.length === 0) {
                return
            }

            // 查询关联的面试预约（查询最新的预约记录）
            const selectFields = [
                'appointmentId',
                'applicationId',
                'candidateId',
                'jobId',
                'interviewerId',
                'status',
                'proposedTimeSlots',
                'selectedTimeSlot',
                'duration',
                'timezone',
                'inviteExpireAt',
                'interviewerInfo',
                'meeting.roomId',
                'meeting.scheduledStartTime',
                'meeting.scheduledEndTime',
                'rescheduleHistory',
                'createdAt',
                'updatedAt',
                // 终止状态相关字段
                'cancelledBy',
                'rejectedBy',
                'expiredBy',
                'cancellationReason',
                'rejectionReason',
                // 付费信息
                'payment',
            ].join(' ')

            const appointments = await InterviewAppointment.find({
                applicationId: { $in: applicationIds },
            })
                .select(selectFields)
                .sort({ createdAt: -1 })
                .lean()

            // 如果通过 applicationId 没找到，尝试通过 candidateId + jobId 查找
            const foundAppIds = new Set(appointments.map(a => a.applicationId))
            const notFoundApps = applications.filter(app => app.applicationId && !foundAppIds.has(app.applicationId))

            if (notFoundApps.length > 0) {
                // 构建 candidateId + jobId 的查询条件
                const orConditions = notFoundApps.map(app => ({
                    candidateId: app.candidateId,
                    jobId: app.jobId,
                }))

                const additionalAppointments = await InterviewAppointment.find({
                    $or: orConditions,
                })
                    .select(selectFields)
                    .sort({ createdAt: -1 })
                    .lean()

                appointments.push(...additionalAppointments)
            }

            // 创建映射（支持通过 applicationId 或 candidateId+jobId 查找）
            // 每个 application 只保留最新的一条预约记录
            const appointmentByAppId = {}
            const appointmentByCandidateJob = {}

            appointments.forEach(apt => {
                if (apt.applicationId) {
                    const existing = appointmentByAppId[apt.applicationId]
                    // 优先选择活跃预约：如果已有记录是终态且当前是活跃态，则替换
                    if (!existing || (isAppointmentFinished(existing.status) && !isAppointmentFinished(apt.status))) {
                        appointmentByAppId[apt.applicationId] = apt
                    }
                }
                const key = `${apt.candidateId}_${apt.jobId}`
                const existingCJ = appointmentByCandidateJob[key]
                if (!existingCJ || (isAppointmentFinished(existingCJ.status) && !isAppointmentFinished(apt.status))) {
                    appointmentByCandidateJob[key] = apt
                }
            })

            // 将预约信息附加到申请数据
            applications.forEach(application => {
                let apt = appointmentByAppId[application.applicationId]
                if (!apt) {
                    const key = `${application.candidateId}_${application.jobId}`
                    apt = appointmentByCandidateJob[key]
                }

                if (apt) {
                    // 获取待处理的改期申请
                    const pendingReschedule = apt.rescheduleHistory?.find(r => r.status === 'pending') || null

                    application.appointment = {
                        appointmentId: apt.appointmentId,
                        status: apt.status,
                        // 面试官/创建者
                        interviewerId: apt.interviewerId,
                        createdBy: apt.interviewerId,
                        // 时间相关
                        proposedTimeSlots: apt.proposedTimeSlots,
                        selectedTimeSlot: apt.selectedTimeSlot || null,
                        duration: apt.duration,
                        timezone: apt.timezone,
                        // 会议信息（只返回必要字段）
                        meeting: apt.meeting?.roomId
                            ? {
                                  roomId: apt.meeting.roomId,
                                  scheduledStartTime: apt.meeting.scheduledStartTime,
                                  scheduledEndTime: apt.meeting.scheduledEndTime,
                              }
                            : null,
                        // 面试官信息（不暴露 email）
                        interviewerInfo: apt.interviewerInfo ? { name: apt.interviewerInfo.name } : null,
                        // 改期相关
                        pendingReschedule: pendingReschedule
                            ? {
                                  requestedBy: pendingReschedule.requestedBy,
                                  requestedAt: pendingReschedule.requestedAt,
                                  proposedSlots: pendingReschedule.proposedSlots,
                                  reason: pendingReschedule.reason,
                              }
                            : null,
                        // 过期时间
                        inviteExpireAt: apt.inviteExpireAt,
                        // 终止状态相关
                        cancelledBy: apt.cancelledBy || null,
                        rejectedBy: apt.rejectedBy || null,
                        expiredBy: apt.expiredBy || null,
                        cancellationReason: apt.cancellationReason || null,
                        rejectionReason: apt.rejectionReason || null,
                        // 时间戳
                        createdAt: apt.createdAt,
                        updatedAt: apt.updatedAt,
                        // 付费信息
                        payment: apt.payment || null,
                    }
                }
            })

            logger.info('[ApplicationService._attachAppointmentInfo] 面试预约信息获取完成', {
                appointmentCount: appointments.length,
                applicationCount: applications.length,
            })
        } catch (error) {
            logger.error('[ApplicationService._attachAppointmentInfo] 批量获取面试预约信息失败', {
                error: error.message,
            })
            // 即使获取预约信息失败，也不影响返回申请数据
        }
    }

    /**
     * 批量附加人工面试评分到申请数据
     * @private
     * @param {Array} applications - 申请数据数组
     * @param {string} companyId - 企业ID（用于权限验证）
     * @returns {Promise<void>}
     */
    async _attachManualRatingInfo(applications, companyId) {
        if (!applications || applications.length === 0 || !companyId) {
            return
        }

        try {
            // 收集所有需要查询的 jobId + candidateId 对
            const queryConditions = applications
                .filter(app => app.jobId && app.candidateId)
                .map(app => ({
                    jobId: app.jobId.toString(),
                    candidateId: app.candidateId,
                }))

            if (queryConditions.length === 0) {
                return
            }

            // 批量查询人工评分
            const ratings = await ManualInterviewRating.find({
                companyId,
                $or: queryConditions,
            }).lean()

            // 创建映射：jobId_candidateId -> rating
            const ratingMap = ratings.reduce((map, rating) => {
                const key = `${rating.jobId}_${rating.candidateId}`
                map[key] = {
                    rating: rating.rating,
                    tagRatings: rating.tagRatings || [],
                    comment: rating.comment,
                    ratedBy: rating.ratedBy,
                    updatedAt: rating.updatedAt,
                }
                return map
            }, {})

            // 将评分信息附加到申请数据
            applications.forEach(application => {
                if (application.jobId && application.candidateId) {
                    const key = `${application.jobId}_${application.candidateId}`
                    application.manualRating = ratingMap[key] || null
                }
            })

            logger.info('[ApplicationService._attachManualRatingInfo] 人工评分信息获取完成', {
                ratingCount: ratings.length,
                applicationCount: applications.length,
            })
        } catch (error) {
            logger.error('[ApplicationService._attachManualRatingInfo] 批量获取人工评分信息失败', {
                error: error.message,
            })
            // 即使获取评分信息失败，也不影响返回申请数据
        }
    }

    /**
     * 批量附加 AI 面试进度信息（仅依赖 database-service batch API）
     * 同一 JD 下 total 应一致；当某个候选人缺少 batch 结果时，允许复用同 JD 已返回结果中的 total。
     * @param {Array} applications - 分页后的申请列表
     * @param {string} companyId - 公司ID
     */
    async _attachInterviewProgress(applications, companyId) {
        try {
            const pairs = applications.map(app => ({
                jobId: app.jobId?.toString() || app.job?.id,
                candidateId: app.candidateId,
            }))

            const progressMap = companyId ? await this.evaluationService.batchGetInterviewProgress(pairs, companyId) : new Map()

            const fallbackTotalByJob = new Map()
            for (const [key, val] of progressMap) {
                const jobId = key.split(':')[0]
                if (!fallbackTotalByJob.has(jobId)) {
                    fallbackTotalByJob.set(jobId, val.total)
                }
            }

            for (const app of applications) {
                const jobId = app.jobId?.toString() || app.job?.id
                const key = `${jobId}:${app.candidateId}`
                const total = fallbackTotalByJob.get(jobId) ?? 0
                app.interviewProgress = progressMap.get(key) || { total, completed: 0 }
            }
        } catch (error) {
            logger.warn('[ApplicationService] Failed to attach interview progress', {
                error: error.message,
            })
        }
    }

    /**
     * 附加用户操作标记到申请数据（复用 pre-fetch 数据，不再查询 DB）
     * @private
     * @param {Array} applications - 申请数据数组
     * @param {Array} prefetchedActions - 预取的用户操作记录
     */
    _attachUserActions(applications, prefetchedActions) {
        if (!applications || applications.length === 0) {
            return
        }

        try {
            const actionMap = {}
            for (const action of prefetchedActions) {
                actionMap[action.applicationId] = {
                    isRead: action.isRead || false,
                    isExcluded: action.isExcluded || false,
                }
            }

            applications.forEach(application => {
                const appId = application.applicationId
                application.userAction = actionMap[appId] || { isRead: false, isExcluded: false }
            })
        } catch (error) {
            logger.warn('[ApplicationService._attachUserActions] Failed to attach user actions', {
                error: error.message,
            })
        }
    }
}

export default new ApplicationService()
