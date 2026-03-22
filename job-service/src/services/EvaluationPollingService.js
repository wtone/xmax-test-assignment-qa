/**
 * 评估轮询服务
 * @module services/EvaluationPollingService
 * @description 定期轮询检查评估状态，自动更新申请状态
 */

import JobApplication from '../models/JobApplication.js'
import EvaluationService from './integration/EvaluationService.js'
import ApplicationService from './ApplicationService.js'
import { APPLICATION_STATUS } from '../constants/application_status.js'
import logger from '../../utils/logger.js'

// 临时设置日志级别为debug以便调试
if (process.env.DEBUG_POLLING === 'true') {
    logger.level = 'debug'
    logger.info('[EvaluationPollingService] Debug mode enabled for polling service')
}

class EvaluationPollingService {
    constructor() {
        this.isRunning = false
        this.pollingInterval = null
        this.pollingIntervalMs = parseInt(process.env.EVALUATION_POLLING_INTERVAL || '30000', 10) // 默认30秒
        this.batchSize = parseInt(process.env.EVALUATION_POLLING_BATCH_SIZE || '20', 10) // 每次处理的申请数量
        this.enabled = process.env.EVALUATION_POLLING_ENABLED !== 'false' // 默认启用

        this.backfillInterval = null
        this.backfillIntervalMs = parseInt(process.env.EVALUATION_BACKFILL_INTERVAL || '300000', 10) // 默认5分钟
        this.backfillEnabled = process.env.EVALUATION_BACKFILL_ENABLED === 'true'

        this.reEvalInterval = null
        this.reEvalIntervalMs = parseInt(process.env.EVALUATION_REEVAL_INTERVAL || '120000', 10) // 默认2分钟
        this.reEvalEnabled = process.env.EVALUATION_REEVAL_ENABLED !== 'false' // 默认启用
    }

    /**
     * 启动轮询服务
     */
    start() {
        if (!this.enabled) {
            logger.info('[EvaluationPollingService] Polling service is disabled')
            return
        }

        if (this.isRunning) {
            logger.warn('[EvaluationPollingService] Polling service is already running')
            return
        }

        logger.info('[EvaluationPollingService] Starting polling service', {
            intervalMs: this.pollingIntervalMs,
            batchSize: this.batchSize,
        })

        this.isRunning = true

        // 立即执行一次
        this.pollEvaluations().catch(error => {
            logger.error('[EvaluationPollingService] Initial poll failed', {
                error: error.message,
            })
        })

        // 设置定时任务
        this.pollingInterval = setInterval(() => {
            this.pollEvaluations().catch(error => {
                logger.error('[EvaluationPollingService] Polling failed', {
                    error: error.message,
                })
            })
        }, this.pollingIntervalMs)

        console.log('🔄 Evaluation polling service started: backfillEnabled=', this.backfillEnabled)
        if (this.backfillEnabled) {
            logger.info('[EvaluationPollingService] Starting evaluation backfill polling', {
                intervalMs: this.backfillIntervalMs,
            })

            this.pollEvaluationBackfill().catch(error => {
                logger.error('[EvaluationPollingService] Initial backfill poll failed', {
                    error: error.message,
                })
            })

            this.backfillInterval = setInterval(() => {
                this.pollEvaluationBackfill().catch(error => {
                    logger.error('[EvaluationPollingService] Backfill polling failed', {
                        error: error.message,
                    })
                })
            }, this.backfillIntervalMs)
        }

        if (this.reEvalEnabled) {
            logger.info('[EvaluationPollingService] Starting re-evaluation polling', {
                intervalMs: this.reEvalIntervalMs,
            })

            this.pollForReEvaluation().catch(error => {
                logger.error('[EvaluationPollingService] Initial re-evaluation poll failed', {
                    error: error.message,
                })
            })

            this.reEvalInterval = setInterval(() => {
                this.pollForReEvaluation().catch(error => {
                    logger.error('[EvaluationPollingService] Re-evaluation polling failed', {
                        error: error.message,
                    })
                })
            }, this.reEvalIntervalMs)
        }

        logger.info('[EvaluationPollingService] Polling service started successfully')
    }

    /**
     * 停止轮询服务
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('[EvaluationPollingService] Polling service is not running')
            return
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }

        if (this.backfillInterval) {
            clearInterval(this.backfillInterval)
            this.backfillInterval = null
        }

        if (this.reEvalInterval) {
            clearInterval(this.reEvalInterval)
            this.reEvalInterval = null
        }

        this.isRunning = false
        logger.info('[EvaluationPollingService] Polling service stopped')
    }

    async pollEvaluationBackfill() {
        const statuses = [
            APPLICATION_STATUS.SCREENING,
            APPLICATION_STATUS.INTERVIEW,
            APPLICATION_STATUS.OFFER,
            APPLICATION_STATUS.HIRED,
            APPLICATION_STATUS.REJECTED,
        ]

        const applications = await JobApplication.find({
            status: { $in: statuses },
            $or: [{ evaluation: { $exists: false } }, { evaluation: null }, { 'evaluation.id': { $exists: false } }],
        })
            .limit(this.batchSize)
            .sort({ updatedAt: -1 })
            .populate('jobId', 'companyId title') // 获取 job 信息，包括 companyId
            .lean()

        if (applications.length === 0) {
            logger.debug('[EvaluationPollingService] No applications need evaluation backfill')
            return
        }

        logger.info('[EvaluationPollingService] Backfill polling found applications', {
            count: applications.length,
        })

        for (const [index, application] of applications.entries()) {
            try {
                console.log(`[${index + 1}/${applications.length}] Backfilling application`, application._id)
                await this.checkAndUpdateApplication(application, { updateStatus: false })
                // if (index === 0) break // 仅处理一条以避免频率过高
            } catch (error) {
                logger.error('[EvaluationPollingService] Backfill processing failed', {
                    applicationId: application._id,
                    error: error.message,
                })
            }
        }
    }

    /**
     * 执行一次轮询
     */
    async pollEvaluations() {
        const startTime = Date.now()

        try {
            logger.info('[EvaluationPollingService] ========== Starting poll cycle ==========')

            // 1. 查找需要检查的申请（状态为SUBMITTED的申请）
            const recentThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) // 最近14天

            const applications = await JobApplication.find({
                status: APPLICATION_STATUS.SUBMITTED,
                // 只处理近期进入 SUBMITTED 的申请，优先使用 submittedAt，其次 updatedAt，最后回退 createdAt
                $or: [
                    { submittedAt: { $gte: recentThreshold } },
                    {
                        submittedAt: { $exists: false },
                        updatedAt: { $gte: recentThreshold },
                    },
                    {
                        submittedAt: { $exists: false },
                        updatedAt: { $exists: false },
                        createdAt: { $gte: recentThreshold },
                    },
                ],
            })
                .populate('jobId', 'companyId title') // 获取 job 信息，包括 companyId
                .limit(this.batchSize)
                .sort({ createdAt: 1 }) // 优先处理较早的申请
                .lean()

            if (applications.length === 0) {
                logger.info('[EvaluationPollingService] No pending applications to check')
                return
            }

            // 统计候选人和职位分布
            const candidateStats = {}
            const jobStats = {}
            applications.forEach(app => {
                // 统计候选人
                if (!candidateStats[app.candidateId]) {
                    candidateStats[app.candidateId] = {
                        count: 0,
                        jobs: [],
                    }
                }
                candidateStats[app.candidateId].count++
                candidateStats[app.candidateId].jobs.push(app.jobId?._id || app.jobId)

                // 统计职位
                const jobId = app.jobId?._id || app.jobId
                if (!jobStats[jobId]) {
                    jobStats[jobId] = {
                        count: 0,
                        candidates: [],
                    }
                }
                jobStats[jobId].count++
                jobStats[jobId].candidates.push(app.candidateId)
            })

            logger.info('[EvaluationPollingService] Found applications to check', {
                totalApplications: applications.length,
                uniqueCandidates: Object.keys(candidateStats).length,
                uniqueJobs: Object.keys(jobStats).length,
                candidateDetails: Object.entries(candidateStats).map(([candidateId, stats]) => ({
                    candidateId,
                    applicationCount: stats.count,
                    jobIds: stats.jobs,
                })),
                jobDetails: Object.entries(jobStats).map(([jobId, stats]) => ({
                    jobId,
                    applicationCount: stats.count,
                    candidateIds: stats.candidates,
                })),
            })

            // 2. 批量处理这些申请
            const results = {
                updated: 0,
                failed: 0,
                skipped: 0,
            }

            for (const application of applications) {
                try {
                    const updated = await this.checkAndUpdateApplication(application)
                    if (updated) {
                        results.updated++
                    } else {
                        results.skipped++
                    }
                } catch (error) {
                    results.failed++
                    logger.error('[EvaluationPollingService] Failed to process application', {
                        applicationId: application._id,
                        candidateId: application.candidateId,
                        jobId: application.jobId,
                        error: error.message,
                        errorStack: error.stack,
                    })
                }
            }

            const duration = Date.now() - startTime
            logger.info('[EvaluationPollingService] ========== Poll cycle completed ==========', {
                duration,
                ...results,
                totalProcessed: results.updated + results.failed + results.skipped,
            })

            return results
        } catch (error) {
            logger.error('[EvaluationPollingService] Poll cycle error', {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    async pollForReEvaluation() {
        const startTime = Date.now()

        try {
            // 时间窗口：只查最近 N 天进入 SCREENING 的申请
            const reEvalWindowDays = parseInt(process.env.EVALUATION_REEVAL_WINDOW_DAYS || '30', 10)
            const windowThreshold = new Date(Date.now() - reEvalWindowDays * 24 * 60 * 60 * 1000)

            const applications = await JobApplication.find({
                status: APPLICATION_STATUS.SCREENING,
                updatedAt: { $gte: windowThreshold },
                'evaluation.id': { $exists: true, $ne: null },
            })
                .populate(
                    'jobId',
                    'companyId title description parsedDescription requirements experience education skills location salaryRange contractType workMode interviewTypes',
                )
                .limit(this.batchSize)
                .sort({ 'evaluation.completed_at': 1 })
                .lean()

            if (applications.length === 0) {
                logger.debug('[EvaluationPollingService] No applications need re-evaluation')
                return
            }

            logger.info('[EvaluationPollingService] Re-evaluation polling found applications', {
                count: applications.length,
            })

            for (const application of applications) {
                try {
                    // Step 1: 同步已完成的重评估结果到 MongoDB
                    // 修复：重评估触发后结果未回写 MongoDB，导致列表分数不更新
                    let currentApp = application
                    try {
                        const synced = await this.checkAndUpdateApplication(application, { updateStatus: false })
                        if (synced) {
                            logger.info('[EvaluationPollingService] Re-evaluation result synced to MongoDB', {
                                applicationId: application.applicationId,
                            })
                            // 重新读取以获取最新 evaluation 数据（避免重复触发）
                            const refreshed = await JobApplication.findById(application._id)
                                .populate(
                                    'jobId',
                                    'companyId title description parsedDescription requirements experience education skills location salaryRange contractType workMode interviewTypes',
                                )
                                .lean()
                            if (refreshed) currentApp = refreshed
                        }
                    } catch (syncError) {
                        logger.warn('[EvaluationPollingService] Re-eval sync failed, continuing', {
                            applicationId: application._id,
                            error: syncError.message,
                        })
                    }

                    // Step 2: 检查是否有新面试完成，需要触发重评估
                    const hasNew = await this.checkForNewInterviews(currentApp)
                    if (!hasNew) continue

                    // 获取简历数据
                    const resumeData = await this._fetchResumeData(currentApp.candidateId, currentApp.resumeId)

                    const job = currentApp.jobId
                    if (!job || !job._id) {
                        logger.warn('[EvaluationPollingService] Job data not found for re-evaluation', {
                            applicationId: currentApp._id,
                        })
                        continue
                    }

                    await EvaluationService.createJobEvaluation({
                        jobId: job._id,
                        candidateId: currentApp.candidateId,
                        resumeId: currentApp.resumeId,
                        applicationId: currentApp.applicationId,
                        userId: currentApp.candidateId,
                        requiredInterviewTypes: job.interviewTypes || [],
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
                        resumeData,
                    })

                    logger.info('[EvaluationPollingService] Re-evaluation triggered', {
                        applicationId: currentApp.applicationId,
                        candidateId: currentApp.candidateId,
                        jobId: job._id,
                    })
                } catch (error) {
                    logger.error('[EvaluationPollingService] Re-evaluation failed for application', {
                        applicationId: application._id,
                        error: error.message,
                    })
                }
            }

            logger.info('[EvaluationPollingService] Re-evaluation poll completed', {
                duration: Date.now() - startTime,
                applicationsChecked: applications.length,
            })
        } catch (error) {
            logger.error('[EvaluationPollingService] Re-evaluation poll cycle failed', {
                error: error.message,
                duration: Date.now() - startTime,
            })
        }
    }

    async checkForNewInterviews(application) {
        const requiredTypes = application.jobId?.interviewTypes || []
        if (requiredTypes.length === 0) return false

        // 时间比较方案：检查评估完成后是否有新的面试完成
        // 避免依赖 interview_type_evaluations（该字段在 PostgreSQL→MongoDB 同步链路中不传递）
        const evaluationCompletedAt = application.evaluation?.completed_at
        if (!evaluationCompletedAt) return false // 还没有完成的评估，由 backfill 轮询负责

        const evalTime = new Date(evaluationCompletedAt).getTime()
        if (isNaN(evalTime)) return false

        // 获取近期完成的面试记录
        const history = await EvaluationService.getCandidateInterviewHistory(application.candidateId, 2)
        if (!history?.sessions?.length) return false

        // 检查是否有必需面试类型在评估完成之后完成了新的面试
        const hasNewerInterview = history.sessions.some(session => {
            if (session.status !== 'completed') return false
            if (!requiredTypes.includes(session.interview_type)) return false
            const sessionEndTime = session.end_time
            if (!sessionEndTime) return false
            return new Date(sessionEndTime).getTime() > evalTime
        })

        if (hasNewerInterview) {
            logger.info('[EvaluationPollingService] New interview found after last evaluation', {
                applicationId: application.applicationId,
                evaluationCompletedAt,
                candidateId: application.candidateId,
            })
        }

        return hasNewerInterview
    }

    async _fetchResumeData(candidateId, resumeId) {
        if (!resumeId) return null
        try {
            const ResumeService = (await import('./integration/ResumeService.js')).default
            const response = await ResumeService.getResume(candidateId, resumeId)
            return response?.data || null
        } catch (error) {
            logger.warn('[EvaluationPollingService] Failed to fetch resume for re-evaluation', {
                resumeId,
                error: error.message,
            })
            return null
        }
    }

    /**
     * 检查并更新单个申请的状态
     * @param {Object} application - 申请对象
     * @returns {Promise<boolean>} 是否更新了状态
     */
    async checkAndUpdateApplication(application, options = {}) {
        const { updateStatus = true } = options
        try {
            // 获取 job 的 companyId（如果 populate 成功的话）
            const companyId = application.jobId?.companyId || null
            const jobIdStr = application.jobId?._id?.toString() || application.jobId?.toString()

            logger.info('[EvaluationPollingService] Checking application', {
                applicationId: application._id.toString(),
                candidateId: application.candidateId,
                jobId: jobIdStr,
                companyId: companyId,
                applicationStatus: application.status,
                createdAt: application.createdAt,
            })

            // 检查是否有关联的评估记录
            // 注意：这里假设评估服务提供了通过applicationId查询的接口
            // 如果没有，可能需要通过candidateId和jobId查询

            // 方案1：如果评估服务支持通过applicationId查询
            // const evaluations = await EvaluationService.getEvaluationByApplicationId(application._id)

            // 方案2：通过候选人ID查询所有评估，然后过滤
            const candidateEvaluations = await EvaluationService.getCandidateEvaluations(application.candidateId, {
                page: 1,
                pageSize: 100,
                companyId: companyId, // 传递 companyId
            })

            logger.info('[EvaluationPollingService] Candidate evaluations response', {
                applicationId: application._id.toString(),
                hasData: !!candidateEvaluations,
                dataLength: candidateEvaluations?.data?.length || 0,
                total: candidateEvaluations?.total || 0,
            })

            if (!candidateEvaluations || !candidateEvaluations.data || candidateEvaluations.data.length === 0) {
                logger.info('[EvaluationPollingService] No evaluations found for application', {
                    applicationId: application._id,
                    candidateId: application.candidateId,
                })
                return false
            }

            // 检查是否有数据库错误
            if (candidateEvaluations.error) {
                logger.error('[EvaluationPollingService] Database service error', {
                    candidateId: application.candidateId,
                    error: candidateEvaluations.error,
                })
                return false
            }

            // 查找与当前申请相关的评估
            // 这里需要根据实际的评估数据结构进行匹配
            logger.info('[EvaluationPollingService] Searching for matching evaluation', {
                applicationId: application._id.toString(),
                jobId: jobIdStr,
                evaluationsCount: candidateEvaluations.data.length,
            })

            // 先打印所有评估数据，帮助调试
            candidateEvaluations.data.forEach((evaluation, index) => {
                logger.info('[EvaluationPollingService] Evaluation details', {
                    index,
                    evaluationId: evaluation.id,
                    evaluationJobId: evaluation.job_id,
                    evaluationStatus: evaluation.status,
                    evaluationApplicationId: evaluation.application_id,
                    targetJobId: jobIdStr,
                    targetApplicationId: application.applicationId,
                    isJobMatch: evaluation.job_id === jobIdStr,
                    isStatusComplete: evaluation.status === 'completed' || evaluation.status === 'complete',
                })
            })

            // 筛选匹配的评估，取最新的（id 最大 = 最新创建）
            // 修复：重评估后可能存在多个 evaluation，.find() 可能取到旧的
            const relevantEvaluation = candidateEvaluations.data
                .filter(evaluation => {
                    const statusComplete = evaluation.status === 'completed' || evaluation.status === 'complete'
                    const jobMatch = evaluation.job_id === jobIdStr
                    return jobMatch && statusComplete
                })
                .sort((a, b) => (b.id || 0) - (a.id || 0))[0]

            if (!relevantEvaluation) {
                logger.info('[EvaluationPollingService] No matching completed evaluation for application', {
                    applicationId: application._id,
                    jobId: jobIdStr,
                })
                return false
            }

            // 检查评估状态
            if (relevantEvaluation.status === 'completed' || relevantEvaluation.status === 'complete') {
                logger.info('[EvaluationPollingService] Found completed evaluation', {
                    applicationId: application._id,
                    evaluationId: relevantEvaluation.id,
                    matchingScore: relevantEvaluation.overall_matching_score,
                    recommendationTier: relevantEvaluation.recommendation_tier,
                })

                // 跳过无变化的写入
                const existingUpdatedAt = application.evaluation?.completed_at
                const newUpdatedAt = relevantEvaluation.completed_at
                if (existingUpdatedAt && newUpdatedAt && existingUpdatedAt === newUpdatedAt) {
                    logger.debug('[EvaluationPollingService] Evaluation unchanged, skipping update', {
                        applicationId: application._id,
                    })
                    return false
                }

                const evaluationPayload = { ...relevantEvaluation }

                const derivedMatchScore =
                    typeof evaluationPayload.overall_matching_score === 'number'
                        ? evaluationPayload.overall_matching_score
                        : typeof evaluationPayload.match_score === 'number'
                        ? evaluationPayload.match_score
                        : undefined

                const savedApplication = await ApplicationService.updateApplicationEvaluation(
                    application.applicationId || application._id.toString(),
                    evaluationPayload,
                    {
                        matchScore: derivedMatchScore,
                    },
                )

                logger.debug('[EvaluationPollingService] Calling updateApplicationStatus', {
                    applicationId: savedApplication.applicationId,
                    newStatus: APPLICATION_STATUS.SCREENING,
                })

                if (updateStatus) {
                    const updateResult = await ApplicationService.updateApplicationStatus(
                        savedApplication.applicationId,
                        APPLICATION_STATUS.SCREENING,
                        {
                            note: 'Interview evaluation completed',
                        },
                    )

                    if (updateResult) {
                        logger.info('[EvaluationPollingService] ✅ Application status successfully updated to SCREENING', {
                            applicationId: savedApplication.applicationId,
                            candidateId: savedApplication.candidateId,
                            jobId: application.jobId,
                            previousStatus: savedApplication.status,
                            newStatus: APPLICATION_STATUS.SCREENING,
                            evaluationScore: savedApplication.matchScore,
                            recommendation: relevantEvaluation.recommendation_tier,
                        })
                    } else {
                        logger.error('[EvaluationPollingService] ❌ Failed to update application status', {
                            applicationId: savedApplication.applicationId,
                            candidateId: savedApplication.candidateId,
                            jobId: application.jobId,
                        })
                    }
                }

                return true
            } else if (relevantEvaluation.status === 'failed' || relevantEvaluation.status === 'error') {
                // 评估失败的情况，可以选择记录但不更新状态
                logger.warn('[EvaluationPollingService] Evaluation failed', {
                    applicationId: application._id,
                    evaluationId: relevantEvaluation.id,
                    evaluationStatus: relevantEvaluation.status,
                })

                // 可选：添加标记表示评估失败
                await JobApplication.findByIdAndUpdate(application._id, {
                    $set: {
                        'metadata.evaluationFailed': true,
                        'metadata.evaluationFailedAt': new Date(),
                        'metadata.evaluationError': relevantEvaluation.error || 'Evaluation failed',
                    },
                })

                return false
            }

            // 评估还在进行中
            logger.debug('[EvaluationPollingService] Evaluation still in progress', {
                applicationId: application._id,
                evaluationId: relevantEvaluation.id,
                evaluationStatus: relevantEvaluation.status,
            })

            return false
        } catch (error) {
            const jobIdStr = application.jobId?._id?.toString() || application.jobId?.toString() || 'unknown'
            logger.error('[EvaluationPollingService] Error checking application', {
                applicationId: application._id,
                candidateId: application.candidateId,
                jobId: jobIdStr,
                error: error.message,
                errorStack: error.stack,
                errorResponse: error.response?.data,
                errorName: error.name,
                errorCode: error.code,
                fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
            })
            throw error
        }
    }
}

// 导出单例
export default new EvaluationPollingService()
