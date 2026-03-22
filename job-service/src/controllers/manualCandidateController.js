/**
 * 手动录入候选人控制器
 */

import { ManualCandidate, JobPost } from '../models/model_loader.js'
import { formatResponse } from '../../utils/response.js'
import logger from '../../utils/logger.js'

/**
 * 创建手动录入候选人记录
 */
export const createManualCandidate = async (ctx) => {
    try {
        const {
            email,
            name,
            jobPosition,
            jobId,
            resumeSource,
            linkSentAt,
            linkType,
            linkUrl,
            notes
        } = ctx.request.body

        // 验证必填字段
        if (!email || !name || !jobPosition || !resumeSource) {
            ctx.status = 400
            ctx.body = formatResponse(null, '缺少必填字段', 400)
            return
        }

        // 如果提供了jobId，验证职位是否存在
        if (jobId) {
            const jobExists = await JobPost.findOne({ jobId })
            if (!jobExists) {
                ctx.status = 400
                ctx.body = formatResponse(null, '指定的职位不存在', 400)
                return
            }
        }

        // 创建候选人记录
        const candidate = await ManualCandidate.create({
            email,
            name,
            jobPosition,
            jobId,
            resumeSource,
            linkSentAt: linkSentAt || new Date(),
            linkType: linkType || 'application',
            linkUrl,
            notes,
            companyId: ctx.state?.company?.companyId,
            createdBy: ctx.state?.user?.userId || ctx.state?.user?.id
        })

        logger.info(`Manual candidate created: ${candidate.candidateId}`)
        ctx.status = 201
        ctx.body = formatResponse(candidate, '候选人记录创建成功')
    } catch (error) {
        logger.error(`Create manual candidate error: ${error?.message || error || 'Unknown error'}`)
        logger.error(`Error stack: ${error?.stack || 'No stack trace'}`)
        ctx.status = 500
        ctx.body = formatResponse(null, error?.message || '创建候选人记录失败', 500)
    }
}

/**
 * 获取手动录入候选人列表
 */
export const getManualCandidates = async (ctx) => {
    try {
        const {
            page = 1,
            pageSize = 20,
            resumeSource,
            status,
            startDate,
            endDate,
            keyword
        } = ctx.query

        // 构建查询条件
        const query = {}

        // 如果有公司上下文，限制查询范围
        if (ctx.state?.company?.companyId) {
            query.companyId = ctx.state.company.companyId
        }

        // 简历来源过滤
        if (resumeSource) {
            query.resumeSource = resumeSource
        }

        // 状态过滤
        if (status) {
            query.status = status
        }

        // 时间范围过滤
        if (startDate || endDate) {
            query.linkSentAt = {}
            if (startDate) {
                query.linkSentAt.$gte = new Date(startDate)
            }
            if (endDate) {
                query.linkSentAt.$lte = new Date(endDate)
            }
        }

        // 关键词搜索（姓名、邮箱、职位）
        if (keyword) {
            query.$or = [
                { name: { $regex: keyword, $options: 'i' } },
                { email: { $regex: keyword, $options: 'i' } },
                { jobPosition: { $regex: keyword, $options: 'i' } }
            ]
        }

        // 分页查询
        const skip = (page - 1) * pageSize
        const limit = parseInt(pageSize)

        const [candidates, total] = await Promise.all([
            ManualCandidate.find(query)
                .sort({ linkSentAt: -1 })
                .skip(skip)
                .limit(limit),
            ManualCandidate.countDocuments(query)
        ])

        ctx.body = formatResponse({
            items: candidates,
            total,
            page: parseInt(page),
            pageSize: limit,
            totalPages: Math.ceil(total / limit)
        })
    } catch (error) {
        logger.error('Get manual candidates error:', error)
        ctx.status = 500
        ctx.body = formatResponse(null, '获取候选人列表失败', 500)
    }
}

/**
 * 获取单个候选人详情
 */
export const getManualCandidateDetail = async (ctx) => {
    try {
        const { candidateId } = ctx.params

        const candidate = await ManualCandidate.findOne({ candidateId })

        if (!candidate) {
            ctx.status = 404
            ctx.body = formatResponse(null, '候选人记录不存在', 404)
            return
        }

        // 如果有公司上下文，验证权限
        if (ctx.state?.company?.companyId && candidate.companyId !== ctx.state.company.companyId) {
            ctx.status = 403
            ctx.body = formatResponse(null, '无权访问该候选人记录', 403)
            return
        }

        ctx.body = formatResponse(candidate)
    } catch (error) {
        logger.error('Get manual candidate detail error:', error)
        ctx.status = 500
        ctx.body = formatResponse(null, '获取候选人详情失败', 500)
    }
}

/**
 * 删除候选人记录
 */
export const deleteManualCandidate = async (ctx) => {
    try {
        const { candidateId } = ctx.params

        const candidate = await ManualCandidate.findOne({ candidateId })

        if (!candidate) {
            ctx.status = 404
            ctx.body = formatResponse(null, '候选人记录不存在', 404)
            return
        }

        // 如果有公司上下文，验证权限
        if (ctx.state?.company?.companyId && candidate.companyId !== ctx.state.company.companyId) {
            ctx.status = 403
            ctx.body = formatResponse(null, '无权删除该候选人记录', 403)
            return
        }

        await ManualCandidate.deleteOne({ candidateId })

        logger.info(`Manual candidate deleted: ${candidateId}`)
        ctx.body = formatResponse(null, '候选人记录删除成功')
    } catch (error) {
        logger.error('Delete manual candidate error:', error)
        ctx.status = 500
        ctx.body = formatResponse(null, '删除候选人记录失败', 500)
    }
}

export default {
    createManualCandidate,
    getManualCandidates,
    getManualCandidateDetail,
    deleteManualCandidate
}