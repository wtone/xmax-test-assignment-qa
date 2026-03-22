import Router from 'koa-router'
import JobPost from '../models/JobPost.js'
import InterviewAppointment from '../models/InterviewAppointment.js'
import companyService from '../services/integration/CompanyService.js'
import { APPOINTMENT_STATUS } from '../constants/appointment_status.js'
import logger from '../../utils/logger.js'

// 内部服务API - 不通过 Gateway 暴露，仅集群内部调用
const router = new Router({ prefix: '/internal' })

/**
 * @swagger
 * /api/v1/internal/jobs:
 *   get:
 *     summary: 获取职位列表（内部服务接口）
 *     description: |
 *       仅供集群内部服务调用，不通过 Gateway 暴露。
 *       支持分页、状态筛选、公司ID筛选、职位ID筛选等。
 *     tags: [Internal]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 页码
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: 每页条数（最大100）
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, paused, closed]
 *         description: 职位状态筛选
 *       - in: query
 *         name: companyIds
 *         schema:
 *           type: string
 *         description: 公司ID列表，逗号分隔
 *       - in: query
 *         name: jobIds
 *         schema:
 *           type: string
 *         description: 职位ID列表，逗号分隔
 *       - in: query
 *         name: publisherIds
 *         schema:
 *           type: string
 *         description: 发布者ID列表，逗号分隔
 *       - in: query
 *         name: remote
 *         schema:
 *           type: boolean
 *         description: 是否远程工作
 *       - in: query
 *         name: workMode
 *         schema:
 *           type: string
 *           enum: [onsite, remote, hybrid]
 *         description: 工作模式
 *       - in: query
 *         name: contractType
 *         schema:
 *           type: string
 *           enum: [full_time, part_time, contract, internship, freelance]
 *         description: 合同类型
 *       - in: query
 *         name: updatedFrom
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 更新时间起始（ISO 8601格式）
 *       - in: query
 *         name: updatedTo
 *         schema:
 *           type: string
 *           format: date-time
 *         description: 更新时间截止（ISO 8601格式）
 *       - in: query
 *         name: hasParsedDescription
 *         schema:
 *           type: boolean
 *         description: 是否有AI解析描述（true=有值, false=无值或为空）
 *     responses:
 *       200:
 *         description: 职位列表
 */
router.get('/jobs', async ctx => {
    const {
        page = 1,
        limit = 20,
        status,
        companyIds,
        jobIds,
        publisherIds,
        remote,
        workMode,
        contractType,
        updatedFrom,
        updatedTo,
        hasParsedDescription,
    } = ctx.query

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    logger.info('Internal API: Starting job list retrieval', {
        operation: 'internal_get_jobs_start',
        params: {
            page: pageNum,
            limit: limitNum,
            status,
            companyIds,
            jobIds,
            publisherIds,
            remote,
            workMode,
            contractType,
            hasParsedDescription,
        },
        traceId: ctx.state?.traceId,
    })

    // 构建查询条件
    const query = {}

    // 状态筛选
    if (status && ['draft', 'published', 'paused', 'closed'].includes(status)) {
        query.status = status
    }

    // 公司ID筛选
    if (companyIds) {
        const idList = companyIds
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        if (idList.length > 0) {
            query.companyId = { $in: idList }
        }
    }

    // 职位ID筛选
    if (jobIds) {
        const idList = jobIds
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        if (idList.length > 0) {
            query.jobId = { $in: idList }
        }
    }

    // 发布者ID筛选
    if (publisherIds) {
        const idList = publisherIds
            .split(',')
            .map(id => id.trim())
            .filter(Boolean)
        if (idList.length > 0) {
            query.publisherId = { $in: idList }
        }
    }

    // 远程工作筛选
    if (remote !== undefined) {
        query.remote = remote === 'true' || remote === true
    }

    // 工作模式筛选
    if (workMode && ['onsite', 'remote', 'hybrid'].includes(workMode)) {
        query.workMode = workMode
    }

    // 合同类型筛选
    if (contractType && ['full_time', 'part_time', 'contract', 'internship', 'freelance'].includes(contractType)) {
        query.contractType = contractType
    }

    // 时间范围筛选
    if (updatedFrom || updatedTo) {
        query.updatedAt = {}
        if (updatedFrom) {
            query.updatedAt.$gte = new Date(updatedFrom)
        }
        if (updatedTo) {
            query.updatedAt.$lte = new Date(updatedTo)
        }
    }

    // parsedDescription 是否有值筛选
    if (hasParsedDescription !== undefined) {
        const hasParsed = hasParsedDescription === 'true' || hasParsedDescription === true
        if (hasParsed) {
            // 有值：存在且非空且非 null
            query.parsedDescription = { $exists: true, $nin: [null, ''] }
        } else {
            // 无值：不存在 或 null 或 空字符串
            query.$or = [
                { parsedDescription: { $exists: false } },
                { parsedDescription: null },
                { parsedDescription: '' },
            ]
        }
    }

    try {
        // 执行查询
        const [jobs, total] = await Promise.all([
            JobPost.find(query).sort({ updatedAt: -1 }).skip(skip).limit(limitNum).lean(),
            JobPost.countDocuments(query),
        ])

        const totalPages = Math.ceil(total / limitNum)

        logger.info('Internal API: Job list retrieval successful', {
            operation: 'internal_get_jobs_success',
            resultCount: jobs.length,
            total,
            page: pageNum,
            totalPages,
            traceId: ctx.state?.traceId,
        })

        ctx.body = {
            code: 0,
            message: 'success',
            data: {
                jobs: jobs.map(job => sanitizeJobData(job)),
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages,
                },
            },
        }
    } catch (error) {
        logger.error('Internal API: Job list retrieval failed', {
            operation: 'internal_get_jobs_error',
            error: error.message,
            stack: error.stack,
            traceId: ctx.state?.traceId,
        })

        ctx.status = 500
        ctx.body = {
            code: 500,
            message: 'Failed to retrieve job list',
            error: error.message,
            traceId: ctx.state?.traceId,
        }
    }
})

/**
 * @swagger
 * /api/v1/internal/jobs/{jobId}:
 *   get:
 *     summary: 获取职位详情（内部服务接口）
 *     description: |
 *       仅供集群内部服务调用，不通过 Gateway 暴露。
 *       可指定返回字段。
 *     tags: [Internal]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *         description: 职位ID
 *       - in: query
 *         name: fields
 *         schema:
 *           type: string
 *         description: 需要返回的字段，逗号分隔（例如：jobId,title,status,companyId）
 *     responses:
 *       200:
 *         description: 职位详情
 *       404:
 *         description: 职位不存在
 */
router.get('/jobs/:jobId', async ctx => {
    const { jobId } = ctx.params
    const { fields } = ctx.query

    logger.info('Internal API: Starting job detail retrieval', {
        operation: 'internal_get_job_by_id_start',
        jobId,
        fields,
        traceId: ctx.state?.traceId,
    })

    try {
        const job = await JobPost.findOne({ jobId }).lean()

        if (!job) {
            logger.warn('Internal API: Job not found', {
                operation: 'internal_get_job_by_id_not_found',
                jobId,
                traceId: ctx.state?.traceId,
            })
            ctx.status = 404
            ctx.body = {
                code: 404,
                message: `Job not found: ${jobId}`,
                traceId: ctx.state?.traceId,
            }
            return
        }

        // 字段过滤
        let responseData = sanitizeJobData(job)
        if (fields) {
            const requestedFields = fields.split(',').map(f => f.trim())
            const filtered = {}
            requestedFields.forEach(field => {
                if (responseData[field] !== undefined) {
                    filtered[field] = responseData[field]
                }
            })
            // 始终包含关键标识字段
            filtered.jobId = responseData.jobId
            filtered.companyId = responseData.companyId
            responseData = filtered
        }

        logger.info('Internal API: Job detail retrieval successful', {
            operation: 'internal_get_job_by_id_success',
            jobId,
            companyId: job.companyId,
            traceId: ctx.state?.traceId,
        })

        ctx.body = {
            code: 0,
            message: 'success',
            data: responseData,
        }
    } catch (error) {
        logger.error('Internal API: Job detail retrieval failed', {
            operation: 'internal_get_job_by_id_error',
            jobId,
            error: error.message,
            stack: error.stack,
            traceId: ctx.state?.traceId,
        })

        ctx.status = 500
        ctx.body = {
            code: 500,
            message: 'Failed to retrieve job details',
            error: error.message,
            traceId: ctx.state?.traceId,
        }
    }
})

/**
 * 清理职位数据，移除敏感字段
 * @param {Object} job - 职位对象
 * @returns {Object} 清理后的职位数据
 */
function sanitizeJobData(job) {
    const { _id, __v, ...cleanJob } = job
    return cleanJob
}

/**
 * POST /api/v1/internal/appointments/check-completed
 *
 * 批量检查 B端用户所在公司与多个候选人之间是否存在已完成的人工面试。
 * 供 resume-service 调用，用于决定是否脱敏联系方式。
 *
 * Body: { bUserId: string, candidateUserIds: string[] }
 * Response: { code: 0, data: { completedCandidateIds: string[] } }
 */
router.post('/appointments/check-completed', async ctx => {
    const { bUserId, candidateUserIds } = ctx.request.body

    if (!bUserId || !Array.isArray(candidateUserIds) || candidateUserIds.length === 0) {
        ctx.status = 400
        ctx.body = {
            code: 400,
            message: 'bUserId and candidateUserIds (non-empty array) are required',
        }
        return
    }

    if (candidateUserIds.length > 200) {
        ctx.status = 400
        ctx.body = { code: 400, message: 'candidateUserIds cannot exceed 200 items' }
        return
    }

    try {
        // 解析 B端用户的 companyId
        let companyId = null
        try {
            const userCompanyInfo = await companyService.getUserCompany(bUserId)
            if (userCompanyInfo?.company) {
                companyId = userCompanyInfo.company.companyId || userCompanyInfo.company._id
            }
        } catch (err) {
            logger.warn('Internal API: Failed to resolve companyId for bUserId', {
                bUserId,
                error: err.message,
            })
        }

        // companyId 解析失败 → 安全优先，返回空（全部脱敏）
        if (!companyId) {
            ctx.body = { code: 0, message: 'success', data: { completedCandidateIds: [] } }
            return
        }

        const completedAppointments = await InterviewAppointment.find({
            companyId,
            candidateId: { $in: candidateUserIds },
            status: APPOINTMENT_STATUS.COMPLETED,
        })
            .select('candidateId')
            .lean()

        const completedCandidateIds = [...new Set(completedAppointments.map(a => a.candidateId))]

        logger.info('Internal API: check-completed success', {
            bUserId,
            companyId,
            candidateCount: candidateUserIds.length,
            completedCount: completedCandidateIds.length,
        })

        ctx.body = { code: 0, message: 'success', data: { completedCandidateIds } }
    } catch (error) {
        logger.error('Internal API: check-completed failed', {
            bUserId,
            candidateCount: candidateUserIds.length,
            error: error.message,
            stack: error.stack,
        })
        ctx.status = 500
        ctx.body = { code: 500, message: 'Failed to check completed appointments' }
    }
})

export default router
