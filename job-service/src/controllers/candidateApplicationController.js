/**
 * C端申请管理控制器
 * @module controllers/candidateApplicationController
 */

import ApplicationService from '../services/ApplicationService.js'
import jobService from '../services/job_service.js'
import InterviewService from '../services/integration/InterviewService.js'
import ResumeService from '../services/integration/ResumeService.js'
import ResumeAiService from '../services/integration/ResumeAiService.js'
import EvaluationService from '../services/integration/EvaluationService.js'
import { AppError, asyncHandler, sendResponse } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { APPLICATION_STATUS, canWithdrawApplication } from '../constants/application_status.js'

const EVALUATION_STATUS = Object.freeze({
    PENDING: 'pending',
    CREATED: 'created',
    SKIPPED_INCOMPLETE: 'skipped:interview-incomplete',
    SKIPPED_ERROR: 'skipped:service-error',
})

class CandidateApplicationController {
    /**
     * 提交职位申请
     */
    submitApplication = asyncHandler(async ctx => {
        ctx.logger.info('[submitApplication] ctx.state:', ctx.state)
        ctx.logger.info('[submitApplication] ctx.state.user:', ctx.state.user)

        const candidateId = ctx.state.user?.userId
        ctx.logger.info('[submitApplication] Candidate ID:', candidateId)
        ctx.logger.info('[submitApplication] Headers:', {
            'x-user-id': ctx.headers['x-user-id'],
            'x-user-type': ctx.headers['x-user-type'],
            'x-user-email': ctx.headers['x-user-email'],
        })

        const { jobId, coverLetter, expectedSalary, availableStartDate } = ctx.request.body

        const extractResponseData = payload => {
            if (!payload) {
                return null
            }

            if (typeof payload === 'object') {
                if (Object.prototype.hasOwnProperty.call(payload, 'code')) {
                    return payload.code === 0 ? payload.data ?? null : null
                }

                if (payload.data && typeof payload.data === 'object') {
                    return payload.data
                }
            }

            return payload
        }

        // 检查候选人ID
        if (!candidateId) {
            ctx.logger.error('[submitApplication] candidateId is missing! ctx.state.user:', ctx.state.user)
            throw new AppError('Candidate ID is required', ERROR_CODES.VALIDATION_ERROR)
        }

        // 检查职位是否存在且开放申请
        // 前端传来的是业务ID（如 job_20250806_e8e99862），使用 getJobById 查询
        ctx.logger.info('[submitApplication] Looking for job with ID:', jobId)
        let job
        try {
            job = await jobService.getJobById(jobId)
            ctx.logger.info('[submitApplication] Job found:', job ? `${job.jobId} - ${job.title} - status: ${job.status}` : 'null')
        } catch (error) {
            ctx.logger.error('[submitApplication] Error getting job:', error)
            // 如果是已知的错误码，直接重新抛出
            if (error.code === ERROR_CODES.JOB_NOT_FOUND.code) {
                throw error
            }
            // 否则抛出通用的职位未找到错误
            throw new AppError('Job not found or not available', ERROR_CODES.JOB_NOT_FOUND)
        }

        if (!job || job.status !== 'published') {
            ctx.logger.info('[submitApplication] Job not valid. Status:', job?.status)
            throw new AppError('Job not found or not available', ERROR_CODES.JOB_NOT_FOUND)
        }

        // 检查是否已经申请过
        // 使用业务ID进行查询，确保与 checkApplicationStatus 使用相同的查询逻辑
        ctx.logger.info('[submitApplication] Checking existing application for jobId:', jobId, 'candidateId:', candidateId)
        const existingApplication = await ApplicationService.findApplicationByJobAndCandidate(jobId, candidateId)
        ctx.logger.info(
            '[submitApplication] Existing application:',
            existingApplication ? `Found with status: ${existingApplication.status}` : 'Not found',
        )

        // 如果已存在申请，检查状态
        if (existingApplication) {
            // 如果状态不是 SUBMITTING，不允许重复申请
            if (existingApplication.status !== APPLICATION_STATUS.SUBMITTING) {
                throw new AppError('You have already applied for this job', ERROR_CODES.DUPLICATE_APPLICATION)
            }
            // 如果状态是 SUBMITTING，允许继续流程以更新申请状态
            ctx.logger.info('[submitApplication] Found existing SUBMITTING application, will attempt to update', {
                applicationId: existingApplication._id,
                status: existingApplication.status,
            })
        }

        // 自动获取主简历并检查投递准备情况
        let resumeData = null
        let resumeReady = false
        let resumeReadiness = null
        let finalResumeId = null

        try {
            const resumeResponse = await ResumeService.getPrimaryResume(candidateId)
            const payload = resumeResponse?.data ?? resumeResponse
            resumeData = extractResponseData(payload)

            if (Array.isArray(resumeData)) {
                const primaryResume = resumeData.find(item => item?.isPrimary) || resumeData[0]
                resumeData = primaryResume || null
            } else if (resumeData && typeof resumeData === 'object') {
                if (Array.isArray(resumeData.items)) {
                    const primaryResume = resumeData.items.find(item => item?.isPrimary) || resumeData.items[0]
                    resumeData = primaryResume || null
                } else if (resumeData.resume) {
                    resumeData = resumeData.resume
                }
            }

            if (resumeData && resumeData.userId && resumeData.userId !== candidateId) {
                ctx.logger.warn('[submitApplication] Primary resume belongs to a different user', {
                    candidateId,
                    resumeOwner: resumeData.userId,
                })
                resumeData = null
            }
        } catch (error) {
            const status = error?.status || error?.response?.status
            if (status === 404) {
                ctx.logger.info('[submitApplication] Candidate has no primary resume', { candidateId })
            } else {
                ctx.logger.error('[submitApplication] Failed to fetch primary resume', {
                    candidateId,
                    error: error.message,
                    status,
                })
                throw new AppError('Resume service unavailable, please try again later', ERROR_CODES.SERVICE_UNAVAILABLE)
            }
        }

        if (resumeData) {
            finalResumeId = resumeData.resumeId || resumeData._id || resumeData.id || null
        }

        try {
            const readinessResponse = await ResumeAiService.getJobSubmissionReadiness(candidateId)
            const readinessPayload = readinessResponse?.data ?? readinessResponse
            const readinessData = extractResponseData(readinessPayload)

            if (readinessData) {
                resumeReadiness = {
                    ready: readinessData.ready === true,
                    messages: readinessData.messages || [],
                    missingCriticalFields: readinessData.missing_critical_fields || [],
                }
                resumeReady = resumeReadiness.ready && !!resumeData && !!finalResumeId
            } else {
                resumeReadiness = {
                    ready: false,
                    messages: ['未获取到简历准备状态'],
                    missingCriticalFields: [],
                }
            }
        } catch (error) {
            const status = error?.status || error?.response?.status
            if (status === 404) {
                ctx.logger.info('[submitApplication] Resume readiness data not found', { candidateId })
                resumeReadiness = {
                    ready: false,
                    messages: ['系统暂未检测到简历准备状态'],
                    missingCriticalFields: [],
                }
            } else {
                ctx.logger.error('[submitApplication] Resume readiness check failed', {
                    candidateId,
                    error: error.message,
                    status,
                })
                throw new AppError('ResumeAi.getJobSubmissionReadiness service unavailable, please try again later', ERROR_CODES.SERVICE_UNAVAILABLE)
            }
        }

        if (!resumeReady) {
            finalResumeId = null
        }

        const hasResume = resumeReady

        ctx.logger.info('[submitApplication] Resume readiness summary', {
            candidateId,
            hasResume,
            resumeReady,
            missingCriticalCount: resumeReadiness?.missingCriticalFields?.length || 0,
        })

        const jobInterviewTypes = Array.isArray(job.interviewTypes)
            ? job.interviewTypes.filter(type => typeof type === 'string' && type.trim())
            : []

        if (jobInterviewTypes.length === 0) {
            ctx.logger.warn('[submitApplication] Job has no interview types configured; proceeding without interview workflow', {
                jobId: job.jobId,
                jobTitle: job.title,
            })
        }

        const interviewWorkflowRequired = jobInterviewTypes.length > 0

        // AI 面试已改为可选：hasAssessment 始终为 true，不再阻塞申请提交
        const hasAssessment = true

        ctx.logger.info('[submitApplication] AI interview is optional, hasAssessment always true', {
            candidateId,
            interviewWorkflowRequired,
            jobInterviewTypes,
        })

        // 创建申请（支持 SUBMITTING 状态）
        const applicationMetadata = {
            userAgent: ctx.headers['user-agent'],
            ip: ctx.ip,
            originalJobId: jobId, // 保存原始的业务ID
            resumeReady,
        }

        if (resumeData?.name) {
            applicationMetadata.resumeName = resumeData.name
        }

        if (resumeData?.title) {
            applicationMetadata.resumeTitle = resumeData.title
        }

        if (resumeReadiness) {
            applicationMetadata.resumeReadiness = {
                ready: resumeReadiness.ready,
                messages: resumeReadiness.messages,
                missingCriticalFields: resumeReadiness.missingCriticalFields,
            }
        }

        const application = await ApplicationService.createApplication({
            jobId: job._id.toString(), // 转换为字符串以确保兼容性
            candidateId,
            candidateEmail: ctx.state.user?.email,
            resumeId: hasResume ? finalResumeId : undefined,
            coverLetter,
            expectedSalary,
            availableStartDate,
            source: 'direct', // C端直接申请
            hasResume, // 传递是否有简历
            hasAssessment, // 传递是否有评估
            metadata: applicationMetadata,
        })

        ctx.logger.info(`Candidate ${candidateId} applied for job ${jobId}`, {
            applicationId: application._id,
            status: application.status,
            hasResume,
            resumeReady,
            missingCriticalCount: resumeReadiness?.missingCriticalFields?.length || 0,
            hasAssessment,
        })

        // 创建 job evaluation 任务（非阻塞：失败不回滚申请）
        let evaluationResult = null
        let evaluationStatus = EVALUATION_STATUS.PENDING

        if (application.status === APPLICATION_STATUS.SUBMITTED) {
            // 始终创建评估（AI面试可选，evaluation worker 基于可用数据生成匹配结果）
            try {
                ctx.logger.info('[submitApplication] Creating job evaluation (non-blocking)', {
                    applicationId: application.applicationId,
                    jobId: job._id,
                    candidateId,
                    interviewTypes: jobInterviewTypes,
                })

                evaluationResult = await EvaluationService.createJobEvaluation({
                    jobId: job._id,
                    candidateId,
                    resumeId: finalResumeId,
                    applicationId: application.applicationId,
                    userId: candidateId,
                    requiredInterviewTypes: jobInterviewTypes,
                    jobData: {
                        title: job.title,
                        description: job.description,
                        parsedDescription: job.parsedDescription,
                        requirements: job.requirements,
                        experience: job.experience,
                        education: job.education,
                        skills: job.skills || [],
                        location: job.location,
                        salaryRange: job.salaryRange,
                        contractType: job.contractType,
                        workMode: job.workMode,
                    },
                    resumeData: resumeData,
                    coverLetter,
                })

                if (evaluationResult && evaluationResult.success !== false) {
                    ctx.logger.info('[submitApplication] Job evaluation created successfully', {
                        applicationId: application.applicationId,
                        evaluationId: evaluationResult.id,
                    })
                    evaluationStatus = EVALUATION_STATUS.CREATED
                } else {
                    evaluationStatus = EVALUATION_STATUS.SKIPPED_ERROR
                    ctx.logger.warn('[submitApplication] Job evaluation creation failed, continuing without evaluation', {
                        applicationId: application.applicationId,
                        error: evaluationResult?.error,
                    })
                }
            } catch (error) {
                evaluationStatus = EVALUATION_STATUS.SKIPPED_ERROR
                ctx.logger.warn('[submitApplication] Job evaluation service error, continuing without evaluation', {
                    applicationId: application.applicationId,
                    error: error.message,
                })
            }
        } else {
            const reason = interviewWorkflowRequired ? 'non-submitted-status' : 'no-interview-types'
            ctx.logger.info('[submitApplication] Skipping evaluation creation', {
                applicationId: application._id,
                status: application.status,
                reason,
            })
        }

        sendResponse(ctx, 201, {
            message: 'Application submitted successfully',
            data: {
                ...(application.toObject ? application.toObject() : application),
                evaluationStatus, // 返回评估创建状态
                evaluationId: evaluationResult?.id || null,
            },
        })
    })

    /**
     * 获取我的申请列表
     */
    getMyApplications = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { status, sortBy = 'appliedAt', sortOrder = 'desc', page = 1, pageSize = 20 } = ctx.query

        ctx.logger.info('[getMyApplications] 开始获取申请列表', {
            candidateId,
            status,
            sortBy,
            sortOrder,
            page,
            pageSize,
        })

        const filters = { candidateId }
        if (status) {
            filters.status = status
        }

        ctx.logger.info('[getMyApplications] 查询条件', { filters })

        const result = await ApplicationService.getApplications(
            filters,
            { page: parseInt(page), pageSize: parseInt(pageSize) },
            { sortBy, sortOrder },
        )

        ctx.logger.info('[getMyApplications] 查询结果', {
            total: result.pagination?.total,
            dataCount: result.data?.length,
            hasData: result.data && result.data.length > 0,
        })

        // 补充职位和公司信息
        ctx.logger.info('[getMyApplications] 开始补充职位信息', {
            applicationCount: result.data.length,
        })

        const enrichedApplications = await Promise.all(
            result.data.map(async (app, index) => {
                try {
                    ctx.logger.info(`[getMyApplications] 处理申请 ${index + 1}/${result.data.length}`, {
                        applicationId: app._id,
                        jobId: app.jobId,
                        status: app.status,
                    })

                    const job = await jobService.getJobByObjectId(app.jobId)

                    if (!job) {
                        ctx.logger.warn('[getMyApplications] 职位不存在', {
                            jobId: app.jobId,
                            applicationId: app._id,
                        })
                    }

                    return {
                        ...app, // app 已经是普通对象（lean查询返回的），不需要 toObject()
                        // 将jobId替换为业务标识符（如job_20250806_e8e99862）
                        // 如果职位不存在（被删除等），返回null而不是MongoDB ObjectId
                        jobId: job ? job.jobId : null, // 使用JobPost中的业务jobId，职位不存在时返回null
                        job: job
                            ? {
                                  // 业务标识符
                                  jobId: job.jobId, // 添加业务标识符到job对象中

                                  // 基本信息
                                  title: job.title,
                                  description: job.description,
                                  location: job.location,

                                  // 薪资和合同信息
                                  salaryRange: job.salaryRange,
                                  contractType: job.contractType,
                                  contractDuration: job.contractDuration,
                                  workMode: job.workMode,
                                  remote: job.remote,

                                  // 公司信息
                                  companyInfo: job.companyInfo,
                                  companyName: job.companyName,
                                  showCompanyName: job.showCompanyName,

                                  // 要求条件
                                  experience: job.experience,
                                  education: job.education,
                                  requirements: job.requirements,

                                  // 申请信息
                                  applicationDeadline: job.applicationDeadline,
                                  publishedAt: job.publishedAt,
                                  currentApplicants: job.currentApplicants,
                                  maxApplicants: job.maxApplicants,
                                  hiredCount: job.hiredCount || 0,

                                  // 面试信息
                                  interviewTypes: job.interviewTypes,
                                  interviewConfig: job.interviewConfig,

                                  // 状态
                                  status: job.status,

                                  // 计算字段（如果存在）
                                  isActive: job.isActive,
                                  canApply: job.canApply,
                                  applicationProgress: job.applicationProgress,
                              }
                            : null,
                    }
                } catch (error) {
                    ctx.logger.error('[getMyApplications] 处理申请数据失败', {
                        applicationId: app._id,
                        error: error.message,
                    })
                    return {
                        ...app,
                        jobId: null, // 出错时也返回null，不返回MongoDB ObjectId
                        job: null,
                    }
                }
            }),
        )

        ctx.logger.info('[getMyApplications] 数据处理完成', {
            enrichedCount: enrichedApplications.length,
            hasJobInfo: enrichedApplications.filter(a => a.job).length,
        })

        sendResponse(ctx, 200, {
            data: enrichedApplications,
            pagination: result.pagination,
        })
    })

    /**
     * 获取申请详情
     */
    getApplicationDetail = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { applicationId } = ctx.params

        ctx.logger.info('[getApplicationDetail] 开始获取申请详情', {
            candidateId,
            applicationId,
        })

        const application = await ApplicationService.getApplicationById(applicationId)
        if (!application || application.candidateId.toString() !== candidateId) {
            throw new AppError('Application not found', ERROR_CODES.NOT_FOUND)
        }

        // 获取职位详情
        const job = await jobService.getJobByObjectId(application.jobId)

        // 获取面试信息
        let interviews = []
        if (application.status === 'interview') {
            try {
                interviews = await InterviewService.getApplicationInterviews(applicationId)
                ctx.logger.info('[getApplicationDetail] 获取面试信息', {
                    applicationId,
                    interviewCount: interviews.length,
                })
            } catch (error) {
                ctx.logger.error('[getApplicationDetail] 获取面试信息失败', error)
            }
        }

        // 构造job字段，保持与列表接口一致的字段结构
        const jobInfo = job
            ? {
                  // 业务标识符
                  jobId: job.jobId, // 添加业务标识符到job对象中

                  // 基本信息
                  title: job.title,
                  description: job.description,
                  location: job.location,

                  // 薪资和合同信息
                  salaryRange: job.salaryRange,
                  contractType: job.contractType,
                  contractDuration: job.contractDuration,
                  workMode: job.workMode,
                  remote: job.remote,

                  // 公司信息
                  companyInfo: job.companyInfo,
                  companyName: job.companyName,
                  showCompanyName: job.showCompanyName,

                  // 要求条件
                  experience: job.experience,
                  education: job.education,
                  requirements: job.requirements,

                  // 申请信息
                  applicationDeadline: job.applicationDeadline,
                  publishedAt: job.publishedAt,
                  currentApplicants: job.currentApplicants,
                  maxApplicants: job.maxApplicants,

                  // 面试信息
                  interviewTypes: job.interviewTypes,
                  interviewConfig: job.interviewConfig,

                  // 状态
                  status: job.status,

                  // 计算字段（如果存在）
                  isActive: job.isActive,
                  canApply: job.canApply,
                  applicationProgress: job.applicationProgress,
              }
            : null

        // 直接返回数据，不再包装一层 data
        sendResponse(ctx, 200, {
            code: 0,
            message: 'success',
            data: {
                ...application,
                // 将jobId替换为业务标识符
                // 如果职位不存在（被删除等），返回null而不是MongoDB ObjectId
                jobId: job ? job.jobId : null, // 使用JobPost中的业务jobId，职位不存在时返回null
                job: jobInfo,
                interviews,
            },
        })
    })

    /**
     * 撤回申请
     */
    withdrawApplication = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { applicationId } = ctx.params
        const { reason } = ctx.request.body

        const application = await ApplicationService.getApplicationById(applicationId)
        if (!application || application.candidateId.toString() !== candidateId) {
            throw new AppError('Application not found', ERROR_CODES.NOT_FOUND)
        }

        // 只有在特定状态下才能撤回（使用 canWithdrawApplication 工具函数）
        if (!canWithdrawApplication(application.status)) {
            throw new AppError('Cannot withdraw application in current status', ERROR_CODES.INVALID_STATUS)
        }

        // 更新状态为撤回
        const updatedApplication = await ApplicationService.updateApplicationStatus(applicationId, 'withdrawn', { reason, withdrawnAt: new Date() })

        ctx.logger.info(`Candidate ${candidateId} withdrew application ${applicationId}`)

        sendResponse(ctx, 200, {
            message: 'Application withdrawn successfully',
            data: updatedApplication,
        })
    })

    /**
     * 获取面试安排
     */
    getMyInterviews = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { status, upcoming, page = 1, pageSize = 20 } = ctx.query

        // 获取候选人的所有申请
        const applications = await ApplicationService.getApplications({ candidateId, status: 'interview' }, { page: 1, pageSize: 1000 })

        const applicationIds = applications.data.map(app => app._id.toString())

        if (applicationIds.length === 0) {
            return sendResponse(ctx, 200, {
                data: [],
                pagination: { total: 0, page: 1, pageSize: parseInt(pageSize), totalPages: 0 },
            })
        }

        // 从面试服务获取面试信息
        const interviews = await InterviewService.getCandidateInterviews(candidateId, {
            applicationIds,
            status,
            upcoming: upcoming === 'true',
            page: parseInt(page),
            pageSize: parseInt(pageSize),
        })

        // 补充申请和职位信息
        const enrichedInterviews = await Promise.all(
            (interviews.data || []).map(async interview => {
                const application = applications.data.find(app => app._id.toString() === interview.applicationId)

                let job = null
                if (application) {
                    job = await jobService.getJobByObjectId(application.jobId)
                }

                return {
                    ...interview,
                    application: application
                        ? {
                              id: application._id,
                              jobId: application.jobId,
                              appliedAt: application.appliedAt,
                          }
                        : null,
                    job: job
                        ? {
                              title: job.title,
                              location: job.location,
                              companyInfo: job.companyInfo,
                          }
                        : null,
                }
            }),
        )

        sendResponse(ctx, 200, {
            data: enrichedInterviews,
            pagination: interviews.pagination || {
                total: enrichedInterviews.length,
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                totalPages: Math.ceil(enrichedInterviews.length / parseInt(pageSize)),
            },
        })
    })

    /**
     * 获取面试详情
     */
    getInterviewDetail = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { interviewId } = ctx.params

        const interview = await InterviewService.getInterview(interviewId)
        if (!interview || interview.data.candidateId !== candidateId) {
            throw new AppError('Interview not found', ERROR_CODES.NOT_FOUND)
        }

        // 获取申请和职位信息
        const application = await ApplicationService.getApplicationById(interview.data.applicationId)
        const job = application ? await jobService.getJobByObjectId(application.jobId) : null

        sendResponse(ctx, 200, {
            data: {
                ...interview.data,
                application: application
                    ? {
                          id: application._id,
                          jobId: application.jobId,
                          appliedAt: application.appliedAt,
                      }
                    : null,
                job: job
                    ? {
                          title: job.title,
                          location: job.location,
                          companyInfo: job.companyInfo,
                      }
                    : null,
            },
        })
    })

    /**
     * 响应面试邀请
     */
    respondToInterview = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { interviewId } = ctx.params
        const { response, reason, proposedTimes } = ctx.request.body

        // 验证面试归属
        const interview = await InterviewService.getInterview(interviewId)
        if (!interview || interview.data.candidateId !== candidateId) {
            throw new AppError('Interview not found', ERROR_CODES.NOT_FOUND)
        }

        // 调用面试服务响应
        const result = await InterviewService.respondToInterview(interviewId, {
            response,
            reason,
            proposedTimes,
            respondedBy: candidateId,
        })

        ctx.logger.info(`Candidate ${candidateId} responded to interview ${interviewId}: ${response}`)

        sendResponse(ctx, 200, {
            message: `Interview ${response}ed successfully`,
            data: result.data,
        })
    })

    /**
     * 提交面试反馈
     */
    submitInterviewFeedback = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { interviewId } = ctx.params
        const { rating, feedback, interviewerRating } = ctx.request.body

        // 验证面试归属和状态
        const interview = await InterviewService.getInterview(interviewId)
        if (!interview || interview.data.candidateId !== candidateId) {
            throw new AppError('Interview not found', ERROR_CODES.NOT_FOUND)
        }

        if (interview.data.status !== 'completed') {
            throw new AppError('Interview not completed yet', ERROR_CODES.INVALID_STATUS)
        }

        // 提交反馈
        const result = await InterviewService.submitCandidateFeedback(interviewId, {
            rating,
            feedback,
            interviewerRating,
            submittedAt: new Date(),
        })

        ctx.logger.info(`Candidate ${candidateId} submitted feedback for interview ${interviewId}`)

        sendResponse(ctx, 201, {
            message: 'Feedback submitted successfully',
            data: result.data,
        })
    })

    /**
     * 获取申请统计
     */
    getApplicationStats = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId

        // 获取各状态申请数量
        const statusCounts = await ApplicationService.getApplicationStats(candidateId)

        // 获取最近活动
        const recentApplications = await ApplicationService.getApplications(
            { candidateId },
            { page: 1, pageSize: 5 },
            { sortBy: 'updatedAt', sortOrder: 'desc' },
        )

        // 构建最近活动列表
        const recentActivity = await Promise.all(
            recentApplications.data.map(async app => {
                const job = await jobService.getJobByObjectId(app.jobId)
                return {
                    applicationId: app._id,
                    jobTitle: job?.title || 'Unknown',
                    company: job?.companyInfo?.name || 'Unknown',
                    status: app.status,
                    updatedAt: app.updatedAt,
                    action: app.statusHistory[app.statusHistory.length - 1]?.status || app.status,
                }
            }),
        )

        sendResponse(ctx, 200, {
            data: {
                totalApplications: statusCounts.total || 0,
                activeApplications: (statusCounts.pending || 0) + (statusCounts.screening || 0) + (statusCounts.interview || 0),
                interviewsScheduled: statusCounts.interview || 0,
                offersReceived: statusCounts.offer || 0,
                applicationsByStatus: statusCounts,
                recentActivity,
            },
        })
    })

    /**
     * 获取候选人申请统计（用于 Tab 角标）
     * @description 返回当前候选人所有申请的各状态数量，用于面试列表页 Tab 显示
     */
    getCandidateApplicationStats = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId

        ctx.logger.info('[CandidateApplicationController.getCandidateApplicationStats] 开始获取候选人申请统计', {
            candidateId,
        })

        const stats = await ApplicationService.getApplicationStats(candidateId)

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

        ctx.logger.info('[CandidateApplicationController.getCandidateApplicationStats] 统计完成', {
            candidateId,
            stats: result,
        })

        sendResponse(ctx, 200, { data: result })
    })

    /**
     * 检查是否已申请过某个职位
     * 用户根据 jobId 查询是否申请过这个 job 的状态
     */
    checkApplicationStatus = asyncHandler(async ctx => {
        const candidateId = ctx.state.user.userId
        const { jobId } = ctx.params

        ctx.logger.info('[checkApplicationStatus] Checking application for:', {
            candidateId,
            jobId,
        })

        // 使用 ApplicationService 的方法查询申请状态
        const application = await ApplicationService.findApplicationByJobAndCandidate(jobId, candidateId)

        if (!application) {
            // 未申请过
            sendResponse(ctx, 200, {
                data: {
                    hasApplied: false,
                    applicationStatus: null,
                    applicationId: null,
                    appliedAt: null,
                },
            })
            return
        }

        // 获取职位信息
        let jobInfo = null
        try {
            const job = await jobService.getJobByObjectId(application.jobId)
            if (job) {
                jobInfo = {
                    jobId: job.jobId,
                    title: job.title,
                    companyName: job.companyInfo?.name || job.companyName,
                    location: job.location,
                }
            }
        } catch (error) {
            ctx.logger.error('[checkApplicationStatus] Error fetching job info:', error)
            // 即使获取职位信息失败，也继续返回申请状态
        }

        // 已申请过，返回申请信息
        sendResponse(ctx, 200, {
            data: {
                hasApplied: true,
                applicationStatus: application.status,
                applicationId: application.applicationId,
                appliedAt: application.submittedAt || application.appliedAt,
                updatedAt: application.updatedAt,
                matchScore: application.matchScore,
                job: jobInfo,
                // 如果状态是 SUBMITTING，返回是否可以继续完成申请的信息
                canComplete: application.status === APPLICATION_STATUS.SUBMITTING,
                missingInfo:
                    application.status === APPLICATION_STATUS.SUBMITTING
                        ? {
                              // 如果有 resumeId 或 metadata 中标记有简历，则不需要简历
                              needResume: !application.resumeId && !application.metadata?.hasResume,
                              // 检查 metadata 中的评估标记
                              needAssessment: !application.metadata?.hasAssessment,
                          }
                        : null,
                // 如果有面试安排，也返回面试信息
                interview: application.interview?.status
                    ? {
                          status: application.interview.status,
                          startedAt: application.interview.startedAt,
                          completedAt: application.interview.completedAt,
                      }
                    : null,
                // 如果有合同信息，也返回合同状态
                contract: application.contract?.status
                    ? {
                          status: application.contract.status,
                          sentAt: application.contract.sentAt,
                          respondedAt: application.contract.respondedAt,
                          signedAt: application.contract.signedAt,
                      }
                    : null,
            },
        })
    })
    // [2026-02-28] AI 面试已改为可选，此方法暂无调用者，注释保留以备未来复用
    // async _checkAllInterviewsCompleted(ctx, candidateId, interviewTypes) {
    //     if (!interviewTypes.length) return true
    //     for (const interviewType of interviewTypes) {
    //         try {
    //             const completionCheck = await EvaluationService.checkCandidateHasCompleted(candidateId, interviewType)
    //             if (!completionCheck || !completionCheck.has_completed) {
    //                 ctx.logger.info('[_checkAllInterviewsCompleted] Interview not completed', { candidateId, interviewType })
    //                 return false
    //             }
    //         } catch (error) {
    //             ctx.logger.warn('[_checkAllInterviewsCompleted] Failed to check interview completion', { candidateId, interviewType, error: error.message })
    //             return false
    //         }
    //     }
    //     return true
    // }
}

export default new CandidateApplicationController()
