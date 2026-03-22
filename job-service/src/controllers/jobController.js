/**
 * 职位管理控制器
 * @module controllers/job_controller
 */

import jobService from '../services/job_service.js'
import companyService from '../services/integration/CompanyService.js'
import jobAIService from '../services/integration/JobAIService.js'
import { sendSuccess, sendError, sendPagination } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { formatJobResponse, formatJobListResponse, formatCreateJobRequest } from '../utils/job_formatter.js'
import { validateJobData, buildValidationError } from '../utils/job_validator.js'
import { getUserCompanyId, getCompanyInfo } from '../services/CompanyBusinessService.js'

// 导入 getTraceId 函数
const getTraceId = ctx => {
    return ctx.state.traceId || ctx.headers['x-trace-id'] || ctx.headers['x-request-id']
}

/**
 * 职位控制器类
 */
class JobController {
    /**
     * 创建职位
     * POST /api/v1/job
     */
    async createJob(ctx) {
        try {
            const { body } = ctx.request
            const { userId: publisherId } = ctx.state.user

            ctx.logger.info('[createJob] 开始创建职位', {
                publisherId,
                requestBody: JSON.stringify(body),
                userType: ctx.state.user.type,
                permissions: ctx.state.user.permissions,
            })

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'createJob')

            // 获取公司名称：优先使用请求体中的，如果没有则尝试从Company Service获取
            let companyName = body.companyName
            let userCompanyInfo = null // 定义变量
            if (!companyName && ctx.state.user.type === 'B') {
                try {
                    const traceId = getTraceId(ctx)
                    userCompanyInfo = await companyService.getUserCompany(publisherId, traceId)
                    if (userCompanyInfo && userCompanyInfo.company && userCompanyInfo.company.name) {
                        companyName = userCompanyInfo.company.name
                        ctx.logger.info('[createJob] 自动填充公司名称', {
                            companyName: companyName,
                            source: 'company-service',
                        })
                    }
                } catch (error) {
                    ctx.logger.warn('[createJob] 获取公司名称失败', {
                        error: error.message,
                    })
                }
            }

            ctx.logger.info('[createJob] 验证公司信息', {
                companyId,
                companyName,
                userType: ctx.state.user.type,
                hasCompanyService: !!userCompanyInfo,
                isTemporaryCompanyId: !ctx.state.user.companyId && ctx.state.user.type === 'B',
            })

            // 验证B端用户必须有公司ID
            if (!companyId) {
                ctx.logger.warn('[createJob] B端用户缺少公司ID', {
                    userId: publisherId,
                    userType: ctx.state.user.type,
                    hasAuthCompanyId: !!ctx.state.user.companyId,
                    hasCompanyService: !!userCompanyInfo,
                })
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: 'B端用户必须关联公司信息，请先完善企业认证或联系管理员' }
            }
            if (!companyName) {
                ctx.logger.warn('[createJob] 缺少公司名称')
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: '请提供公司名称' }
            }

            // 格式化请求数据
            ctx.logger.info('[createJob] 格式化请求数据')

            // 特别记录 companyAlias 的传入情况
            ctx.logger.info('[createJob] Body analysis:', {
                hasCompanyAlias: 'companyAlias' in body,
                companyAlias: body.companyAlias,
                companyAliasType: typeof body.companyAlias,
                showCompanyName: body.showCompanyName,
                bodyKeys: Object.keys(body),
            })

            // 处理 requirements 字段（修复空对象问题）
            if (body.requirements && typeof body.requirements === 'object' && !Array.isArray(body.requirements)) {
                body.requirements = []
                ctx.logger.info('[createJob] Fixed requirements from object to array')
            }

            const jobData = formatCreateJobRequest({
                ...body,
                companyName: companyName, // 添加公司名称
            })

            // 确保companyId被包含在jobData中
            jobData.companyId = companyId

            // 特别记录格式化后的 companyAlias
            ctx.logger.info('[createJob] After formatting', {
                hasCompanyAlias: 'companyAlias' in jobData,
                companyAlias: jobData.companyAlias,
                showCompanyName: jobData.showCompanyName,
            })

            ctx.logger.debug('[createJob] 格式化后的数据', {
                jobData: JSON.stringify(jobData),
            })

            // 验证数据
            ctx.logger.info('[createJob] 开始验证职位数据')
            const validation = validateJobData(jobData)
            if (!validation.valid) {
                ctx.logger.warn('[createJob] 职位数据验证失败', {
                    errors: validation.errors,
                })
                const error = buildValidationError(validation.errors)
                throw error
            }
            ctx.logger.info('[createJob] 职位数据验证通过')

            ctx.logger.info('[createJob] 调用服务层创建职位')
            const job = await jobService.createJob(jobData, companyId, publisherId)
            ctx.logger.info('[createJob] 职位创建成功', {
                jobId: job.jobId,
            })

            // 格式化响应数据
            const formattedJob = formatJobResponse(job, { includeInternalFields: true })
            ctx.logger.debug('[createJob] 格式化响应数据', {
                formattedJob: JSON.stringify(formattedJob),
            })

            // 异步调用 job-ai-service 进行 JD 解析
            if (job.description) {
                ctx.logger.info('[createJob] 触发AI解析职位描述', {
                    jobId: job.jobId,
                    descriptionLength: job.description.length,
                })

                jobAIService
                    .parseJobDescription({
                        jobId: job.jobId,
                        description: job.description,
                        companyId: companyId,
                        userId: publisherId,
                    })
                    .catch(error => {
                        ctx.logger.error('[createJob] 调用job-ai-service失败，但不影响职位创建', {
                            error: error.message,
                            jobId: job.jobId,
                        })
                    })
            }

            sendSuccess(ctx, formattedJob, '职位创建成功', 201)
            ctx.logger.info('[createJob] 响应发送成功', {
                jobId: job.jobId,
                status: 201,
            })
        } catch (error) {
            ctx.logger.error('[createJob] 创建职位失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                detail: error.detail,
                publisherId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_CREATE_FAILED, error.message)
            }
        }
    }

    /**
     * 更新职位
     * PUT /api/v1/job/:jobId
     */
    async updateJob(ctx) {
        try {
            const { jobId } = ctx.params
            const { body } = ctx.request
            const { userId } = ctx.state.user

            ctx.logger.info('[updateJob] 开始更新职位', {
                jobId,
                userId,
                updateData: JSON.stringify(body),
            })

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'updateJob')

            ctx.logger.info('[updateJob] 调用服务层更新职位', { jobId, companyId })
            if (Object.prototype.hasOwnProperty.call(body, 'otherRequirements')) {
                if (typeof body.otherRequirements === 'string') {
                    const trimmed = body.otherRequirements.trim()
                    if (trimmed.length > 0) {
                        body.otherRequirements = trimmed
                    } else {
                        body.otherRequirements = ''
                    }
                } else {
                    delete body.otherRequirements
                }
            }

            const job = await jobService.updateJob(jobId, body, companyId, userId)
            ctx.logger.info('[updateJob] 职位更新成功', { jobId, updatedFields: Object.keys(body) })

            // 如果更新了描述，触发AI重新解析
            if (body.description !== undefined) {
                ctx.logger.info('[updateJob] 描述已更新，触发AI重新解析', {
                    jobId: job.jobId,
                    descriptionLength: job.description?.length,
                })

                jobAIService
                    .parseJobDescription({
                        jobId: job.jobId,
                        description: job.description,
                        companyId: companyId,
                        userId: userId,
                    })
                    .catch(error => {
                        ctx.logger.error('[updateJob] 调用job-ai-service失败，但不影响职位更新', {
                            error: error.message,
                            jobId: job.jobId,
                        })
                    })
            }

            const formattedJob = formatJobResponse(job, { includeInternalFields: true })
            sendSuccess(ctx, formattedJob, '职位更新成功')
            ctx.logger.info('[updateJob] 响应发送成功', { jobId })
        } catch (error) {
            ctx.logger.error('[updateJob] 更新职位失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobId: ctx.params.jobId,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_UPDATE_FAILED, error.message)
            }
        }
    }

    /**
     * 发布职位
     * POST /api/v1/job/:jobId/publish
     */
    async publishJob(ctx) {
        try {
            const { jobId } = ctx.params
            const { userId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'publishJob')

            ctx.logger.info('[publishJob] 开始发布职位', { jobId, companyId, userId })

            const job = await jobService.publishJob(jobId, companyId, userId)
            ctx.logger.info('[publishJob] 职位发布成功', {
                jobId,
                status: job.status,
                publishedAt: job.publishedAt,
            })

            sendSuccess(ctx, job, '职位发布成功')
            ctx.logger.info('[publishJob] 响应发送成功', { jobId })
        } catch (error) {
            ctx.logger.error('[publishJob] 发布职位失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobId: ctx.params.jobId,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_UPDATE_FAILED, error.message)
            }
        }
    }

    /**
     * 执行职位操作
     * POST /api/v1/job/:jobId/action
     * Body: { action: 'pause' | 'resume' | 'close' | 'delete' }
     */
    async executeAction(ctx) {
        try {
            const { jobId } = ctx.params
            const { action, reason } = ctx.request.body
            const { userId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'executeAction')

            ctx.logger.info('[executeAction] 开始执行职位操作', {
                jobId,
                action,
                reason,
                companyId,
                userId,
            })

            let result
            let message

            switch (action) {
                case 'pause':
                    ctx.logger.info('[executeAction] 执行暂停操作', { jobId })
                    result = await jobService.pauseJob(jobId, companyId, userId)
                    message = '职位已暂停'
                    break
                case 'resume':
                    ctx.logger.info('[executeAction] 执行恢复操作', { jobId })
                    result = await jobService.resumeJob(jobId, companyId, userId)
                    message = '职位已恢复'
                    break
                case 'close':
                    ctx.logger.info('[executeAction] 执行关闭操作', { jobId })
                    result = await jobService.closeJob(jobId, companyId, userId)
                    message = '职位已关闭'
                    break
                case 'delete':
                    ctx.logger.info('[executeAction] 执行删除操作', { jobId })
                    result = await jobService.deleteJob(jobId, companyId, userId)
                    message = '职位已删除'
                    break
                default:
                    ctx.logger.warn('[executeAction] 不支持的操作', { action })
                    throw { ...ERROR_CODES.INVALID_PARAMS, detail: `不支持的操作: ${action}` }
            }

            ctx.logger.info('[executeAction] 职位操作成功', {
                jobId,
                action,
                newStatus: result.status,
                message,
            })
            sendSuccess(ctx, result, message)
            ctx.logger.info('[executeAction] 响应发送成功', { jobId, action })
        } catch (error) {
            ctx.logger.error('[executeAction] 执行职位操作失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobId: ctx.params.jobId,
                action: ctx.request.body?.action,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_UPDATE_FAILED, error.message)
            }
        }
    }

    /**
     * 批量操作职位
     * POST /api/v1/job/batch-action
     * Body: { jobIds: string[], action: 'pause' | 'resume' | 'close' | 'delete' }
     */
    async batchAction(ctx) {
        try {
            const { jobIds, action } = ctx.request.body
            const { userId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'batchAction')

            ctx.logger.info('[batchAction] 开始批量操作', {
                jobIds,
                action,
                count: jobIds?.length,
                companyId,
                userId,
            })

            if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
                ctx.logger.warn('[batchAction] 职位ID列表无效')
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: '请提供职位ID列表' }
            }

            ctx.logger.info('[batchAction] 调用服务层执行批量操作', { jobIds, action })
            const result = await jobService.batchUpdateJobs(jobIds, action, companyId, userId)
            ctx.logger.info('[batchAction] 批量操作成功', {
                action,
                successCount: result.successCount,
                failedCount: result.failedCount,
                totalCount: jobIds.length,
            })

            sendSuccess(ctx, result, '批量操作完成')
            ctx.logger.info('[batchAction] 响应发送成功')
        } catch (error) {
            ctx.logger.error('[batchAction] 批量操作职位失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobIds: ctx.request.body?.jobIds,
                action: ctx.request.body?.action,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_UPDATE_FAILED, error.message)
            }
        }
    }

    /**
     * 获取职位列表
     * GET /api/v1/job
     */
    async getJobList(ctx) {
        try {
            const { userId } = ctx.state.user
            const {
                page = 1,
                pageSize = 20,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                status,
                keyword,
                location,
                workMode,
                contractType,
                minSalary,
                maxSalary,
            } = ctx.query

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'getJobList')

            ctx.logger.info('[getJobList] 获取职位列表', {
                companyId,
                userId,
                queryParams: ctx.query,
            })

            // 构建过滤条件
            const filters = {
                page: parseInt(page),
                pageSize: parseInt(pageSize),
                sortBy,
                sortOrder,
            }

            // 添加可选过滤条件
            if (status) {
                // 支持多状态查询，如 status=draft,published
                filters.status = status.includes(',') ? status.split(',') : status
            }
            if (keyword) filters.keyword = keyword
            if (location) filters.location = location
            if (workMode) filters.workMode = workMode
            if (contractType) filters.contractType = contractType
            if (minSalary) filters.minSalary = parseInt(minSalary)
            if (maxSalary) filters.maxSalary = parseInt(maxSalary)

            ctx.logger.info('[getJobList] 调用服务层获取列表', { filters, companyId })
            const result = await jobService.getJobList(filters, {}, companyId, userId)
            ctx.logger.info('[getJobList] 获取列表成功', {
                total: result.pagination.total,
                count: result.items.length,
                page: result.pagination.page,
                pageSize: result.pagination.pageSize,
            })

            // 格式化响应数据
            const formattedItems = formatJobListResponse(result.items, { includeInternalFields: true })

            sendPagination(ctx, formattedItems, result.pagination, '获取职位列表成功')
            ctx.logger.info('[getJobList] 响应发送成功', { count: formattedItems.length })
        } catch (error) {
            ctx.logger.error('[getJobList] 获取职位列表失败', {
                error: error.message,
                stack: error.stack,
                filters: ctx.query,
                userId: ctx.state.user?.userId,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取职位详情
     * GET /api/v1/job/:jobId
     */
    async getJobById(ctx) {
        try {
            const { jobId } = ctx.params
            const { userId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'getJobById')

            ctx.logger.info('[getJobById] 获取职位详情', { jobId, companyId, userId })

            const job = await jobService.getJobById(jobId, companyId, false, userId)
            ctx.logger.info('[getJobById] 获取职位成功', {
                jobId: job.jobId,
                title: job.title,
                status: job.status,
                publishedAt: job.publishedAt,
            })

            // 格式化响应数据
            const formattedJob = formatJobResponse(job, { includeInternalFields: true })

            sendSuccess(ctx, formattedJob, '获取职位详情成功')
            ctx.logger.info('[getJobById] 响应发送成功', { jobId })
        } catch (error) {
            ctx.logger.error('[getJobById] 获取职位详情失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobId: ctx.params.jobId,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取职位统计信息
     * GET /api/v1/job/stats
     */
    async getJobStats(ctx) {
        try {
            const { userId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'getJobStats')

            ctx.logger.info('[getJobStats] 获取职位统计', { companyId, userId })

            const stats = await jobService.getJobStats(companyId, userId)
            ctx.logger.info('[getJobStats] 获取统计成功', {
                stats: JSON.stringify(stats),
                companyId,
            })

            sendSuccess(ctx, stats, '获取职位统计成功')
            ctx.logger.info('[getJobStats] 响应发送成功')
        } catch (error) {
            ctx.logger.error('[getJobStats] 获取职位统计失败', {
                error: error.message,
                stack: error.stack,
                companyId: ctx.state.user?.companyId,
                userId: ctx.state.user?.userId,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 更新AI解析后的职位描述
     * PUT /api/v1/job/:jobId/ai-parsed
     * Body: { parsedDescription: string }
     * 此接口供 job-ai-service 调用
     */
    async updateParsedDescription(ctx) {
        try {
            const { jobId } = ctx.params
            const { parsedDescription, parsedTagList } = ctx.request.body

            ctx.logger.info('[updateParsedDescription] 开始更新AI解析的职位描述', {
                jobId,
                parsedDescriptionLength: parsedDescription?.length,
                parsedTagListCount: parsedTagList?.length ?? 0,
                source: 'job-ai-service',
            })

            // 验证输入：至少提供一个字段
            if (!parsedDescription && !parsedTagList) {
                ctx.logger.warn('[updateParsedDescription] 缺少解析后的描述和标签列表')
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: '请至少提供 parsedDescription 或 parsedTagList' }
            }

            // 调用service层方法更新
            ctx.logger.info('[updateParsedDescription] 调用service更新职位AI解析描述', { jobId })
            const job = await jobService.updateParsedDescription(jobId, { parsedDescription, parsedTagList })

            ctx.logger.info('[updateParsedDescription] 更新成功', {
                jobId,
                hasParsedDescription: !!job.parsedDescription,
                parsedTagListCount: job.parsedTagList?.length ?? 0,
            })

            sendSuccess(
                ctx,
                {
                    jobId: job.jobId,
                    parsedDescription: job.parsedDescription,
                    parsedTagList: job.parsedTagList,
                    updatedAt: job.updatedAt,
                },
                'AI解析的职位描述更新成功',
            )

            ctx.logger.info('[updateParsedDescription] 响应发送成功', { jobId })
        } catch (error) {
            ctx.logger.error('[updateParsedDescription] 更新AI解析的职位描述失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                jobId: ctx.params.jobId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_UPDATE_FAILED, error.message)
            }
        }
    }

    /**
     * 复制职位
     * POST /api/v1/job/:jobId/duplicate
     */
    async duplicateJob(ctx) {
        try {
            const { jobId } = ctx.params
            const { userId: publisherId } = ctx.state.user

            // 获取用户的公司ID（含Company Service集成逻辑）
            const companyId = await getUserCompanyId(ctx, 'duplicateJob')

            ctx.logger.info('[duplicateJob] 开始复制职位', {
                sourceJobId: jobId,
                companyId,
                publisherId,
            })

            // 获取原职位
            ctx.logger.info('[duplicateJob] 获取原职位信息', { jobId })
            const originalJob = await jobService.getJobById(jobId, companyId, false, publisherId)
            ctx.logger.info('[duplicateJob] 原职位信息获取成功', {
                originalTitle: originalJob.title,
                originalStatus: originalJob.status,
            })

            // 准备复制的数据
            const jobData = {
                title: `${originalJob.title} (复制)`,
                description: originalJob.description,
                requirements: originalJob.requirements,
                location: originalJob.location,
                remote: originalJob.remote,
                workMode: originalJob.workMode,
                salaryRange: originalJob.salaryRange,
                contractType: originalJob.contractType,
                contractDuration: originalJob.contractDuration,
                companyName: originalJob.companyName,
                showCompanyName: originalJob.showCompanyName,
                companyAlias: originalJob.companyAlias,
                experience: originalJob.experience,
                education: originalJob.education,
                interviewConfig: originalJob.interviewConfig,
                maxApplicants: originalJob.maxApplicants,
                interviewTypes: originalJob.interviewTypes || [],
            }

            // 创建新职位
            ctx.logger.info('[duplicateJob] 创建复制的职位', { newTitle: jobData.title })
            const newJob = await jobService.createJob(jobData, companyId, publisherId)
            ctx.logger.info('[duplicateJob] 职位复制成功', {
                sourceJobId: jobId,
                newJobId: newJob.jobId,
                newTitle: newJob.title,
            })

            sendSuccess(ctx, newJob, '职位复制成功', 201)
            ctx.logger.info('[duplicateJob] 响应发送成功', { newJobId: newJob.jobId })
        } catch (error) {
            ctx.logger.error('[duplicateJob] 复制职位失败', {
                error: error.message,
                stack: error.stack,
                code: error.code,
                sourceJobId: ctx.params.jobId,
                userId: ctx.state.user?.userId,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.JOB_CREATE_FAILED, error.message)
            }
        }
    }
}

// 导出控制器实例
export default new JobController()
