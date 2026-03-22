/**
 * 职位管理服务
 * @module services/job_service
 */

import { JobPost } from '../models/model_loader.js'
import ShadowApplication from '../models/ShadowApplication.js'
import JobCollaborator from '../models/JobCollaborator.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { JOB_STATUS, canEditJob } from '../constants/job_status.js'
import logger from '../../utils/logger.js'
import { findBySmartId } from '../utils/dbQueryHelper.js'
import jobCollaboratorService from './JobCollaboratorService.js'

/**
 * 职位服务类
 */
class JobService {
    /**
     * 创建职位
     * @param {Object} jobData - 职位数据
     * @param {string} companyId - 公司ID
     * @param {string} publisherId - 发布者ID
     * @returns {Promise<Object>} 创建的职位
     */
    async createJob(jobData, companyId, publisherId) {
        try {
            // 记录接收到的 companyAlias
            logger.info('[createJob] Creating job with data:', {
                hasCompanyAlias: 'companyAlias' in jobData,
                companyAlias: jobData.companyAlias,
                showCompanyName: jobData.showCompanyName,
            })

            const job = new JobPost({
                ...jobData,
                companyId,
                publisherId,
                status: JOB_STATUS.DRAFT,
            })

            // 记录保存前的 companyAlias
            logger.info('[createJob] Before save:', {
                companyAlias: job.companyAlias,
                showCompanyName: job.showCompanyName,
            })

            await job.save()

            // 记录保存后的 companyAlias
            logger.info('[createJob] After save:', {
                jobId: job.jobId,
                companyAlias: job.companyAlias,
                showCompanyName: job.showCompanyName,
            })

            logger.info(`职位创建成功: ${job.jobId}`)
            return job
        } catch (error) {
            logger.error('创建职位失败:', error)
            if (error.code === 11000) {
                throw { ...ERROR_CODES.JOB_ALREADY_EXISTS, detail: '职位ID已存在' }
            }
            throw { ...ERROR_CODES.JOB_CREATE_FAILED, detail: error.message }
        }
    }

    /**
     * 更新职位
     * @param {string} jobId - 职位ID
     * @param {Object} updateData - 更新数据
     * @param {string} companyId - 公司ID（用于权限验证）
     * @returns {Promise<Object>} 更新后的职位
     */
    async updateJob(jobId, updateData, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离：检查所有者或协作者）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            // 检查职位状态是否允许编辑
            if (!canEditJob(job.status)) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '当前状态不允许编辑' }
            }

            // 不允许通过更新接口修改某些字段
            const protectedFields = ['jobId', 'companyId', 'publisherId', 'createdAt', 'stats']
            protectedFields.forEach(field => delete updateData[field])

            // 更新职位
            Object.assign(job, updateData)
            await job.save()

            logger.info(`职位更新成功: ${jobId}`)
            return job
        } catch (error) {
            if (error.code) throw error
            logger.error('更新职位失败:', error)
            throw { ...ERROR_CODES.JOB_UPDATE_FAILED, detail: error.message }
        }
    }

    /**
     * 发布职位
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 发布后的职位
     */
    async publishJob(jobId, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            // 检查是否可以发布
            if (job.status !== JOB_STATUS.DRAFT && job.status !== JOB_STATUS.PAUSED && job.status !== JOB_STATUS.EXPIRED) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '只有草稿、暂停或过期状态的职位可以发布' }
            }

            // 验证必填字段
            const requiredFields = ['title', 'description', 'location', 'salaryRange', 'contractType']
            for (const field of requiredFields) {
                if (!job[field]) {
                    throw { ...ERROR_CODES.VALIDATION_ERROR, detail: `缺少必填字段: ${field}` }
                }
            }

            // 更新状态
            job.status = JOB_STATUS.PUBLISHED
            if (!job.publishedAt) {
                job.publishedAt = new Date()
            }
            if (!job.startDate) {
                job.startDate = new Date()
            }

            await job.save()
            logger.info(`职位发布成功: ${jobId}`)
            return job
        } catch (error) {
            if (error.code) throw error
            logger.error('发布职位失败:', error)
            throw { ...ERROR_CODES.JOB_UPDATE_FAILED, detail: error.message }
        }
    }

    /**
     * 暂停职位
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 暂停后的职位
     */
    async pauseJob(jobId, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            if (job.status !== JOB_STATUS.PUBLISHED) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '只有已发布的职位可以暂停' }
            }

            job.status = JOB_STATUS.PAUSED
            await job.save()

            logger.info(`职位暂停成功: ${jobId}`)
            return job
        } catch (error) {
            if (error.code) throw error
            logger.error('暂停职位失败:', error)
            throw { ...ERROR_CODES.JOB_UPDATE_FAILED, detail: error.message }
        }
    }

    /**
     * 恢复职位
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 恢复后的职位
     */
    async resumeJob(jobId, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            if (job.status !== JOB_STATUS.PAUSED) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '只有暂停状态的职位可以恢复' }
            }

            // 检查是否已过期
            if (job.applicationDeadline && job.applicationDeadline < new Date()) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '职位已过期，无法恢复' }
            }

            job.status = JOB_STATUS.PUBLISHED
            await job.save()

            logger.info(`职位恢复成功: ${jobId}`)
            return job
        } catch (error) {
            if (error.code) throw error
            logger.error('恢复职位失败:', error)
            throw { ...ERROR_CODES.JOB_UPDATE_FAILED, detail: error.message }
        }
    }

    /**
     * 批量获取职位的 screening 申请数量
     * @param {Array} jobIds - 职位ID数组（MongoDB ObjectId）
     * @returns {Promise<Object>} 职位ID到screening数量的映射
     * 
     * 【暂时注释】当前实现存在性能考虑，未来优化方案：
     * 1. 使用 Redis 缓存，TTL 5分钟
     * 2. 使用 MongoDB Change Streams 实现准实时更新
     * 3. 考虑读写分离架构
     */
    // async getScreeningCounts(jobIds) {
    //     if (!jobIds || jobIds.length === 0) {
    //         return {}
    //     }

    //     try {
    //         const { JobApplication } = await import('../models/model_loader.js')
    //         const { APPLICATION_STATUS } = await import('../constants/application_status.js')
            
    //         // 批量查询所有职位的 screening 状态申请
    //         const aggregateResult = await JobApplication.aggregate([
    //             {
    //                 $match: {
    //                     jobId: { $in: jobIds },
    //                     status: APPLICATION_STATUS.SCREENING
    //                 }
    //             },
    //             {
    //                 $group: {
    //                     _id: '$jobId',
    //                     count: { $sum: 1 }
    //                 }
    //             }
    //         ])
            
    //         // 转换为映射对象
    //         const screeningMap = {}
    //         aggregateResult.forEach(item => {
    //             screeningMap[item._id.toString()] = item.count
    //         })
            
    //         // 确保所有职位都有值（没有screening申请的为0）
    //         jobIds.forEach(jobId => {
    //             const idStr = jobId.toString()
    //             if (!screeningMap[idStr]) {
    //                 screeningMap[idStr] = 0
    //             }
    //         })
            
    //         return screeningMap
    //     } catch (error) {
    //         logger.error('获取screening统计失败:', error)
    //         // 返回空映射，不影响主流程
    //         return {}
    //     }
    // }
    
    // 临时返回空对象，待实现优化方案
    async getScreeningCounts(jobIds) {
        return {}
    }

    /**
     * 获取职位列表
     * @param {Object} filters - 过滤条件
     * @param {Object} options - 查询选项
     * @param {string} companyId - 公司ID（可选，B端查询时使用）
     * @returns {Promise<Object>} 职位列表和分页信息
     */
    async getJobList(filters = {}, options = {}, companyId = null, userId = null) {
        try {
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
            } = { ...filters, ...options }

            // 构建查询条件
            const query = {}

            // B端查询：必须验证公司权限
            if (companyId !== null && companyId !== undefined) {
                query.companyId = companyId

                // 数据隔离：只返回用户可访问的岗位
                if (userId) {
                    const accessibleJobIds = await jobCollaboratorService.getAccessibleJobIds(userId, companyId)
                    query._id = { $in: accessibleJobIds }
                }
            } else {
                // 如果没有提供companyId，为了安全起见，返回空结果
                logger.warn('B端查询缺少companyId，拒绝返回职位列表')
                return {
                    items: [],
                    pagination: {
                        page,
                        pageSize,
                        total: 0,
                        totalPages: 0,
                    },
                }
            }

            // 状态过滤
            if (status) {
                if (Array.isArray(status)) {
                    query.status = { $in: status }
                } else {
                    query.status = status
                }
            }

            // 关键词搜索
            if (keyword) {
                query.$or = [{ title: { $regex: keyword, $options: 'i' } }, { description: { $regex: keyword, $options: 'i' } }]
            }

            // 其他过滤条件
            if (location) query.location = { $regex: location, $options: 'i' }
            if (workMode) query.workMode = workMode
            if (contractType) query.contractType = contractType
            if (minSalary) query['salaryRange.min'] = { $gte: minSalary }
            if (maxSalary) query['salaryRange.max'] = { $lte: maxSalary }

            // 计算总数
            const total = await JobPost.countDocuments(query)

            // 执行分页查询
            const skip = (page - 1) * pageSize
            const jobs = await JobPost.find(query)
                .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                .skip(skip)
                .limit(pageSize)
                .select('-__v')

            // 动态合并影子候选人数量到 currentApplicants
            const jobIds = jobs.map(job => job._id)
            if (jobIds.length > 0) {
                const shadowCounts = await ShadowApplication.aggregate([
                    { $match: { jobId: { $in: jobIds }, status: 'active' } },
                    { $group: { _id: '$jobId', count: { $sum: 1 } } },
                ])
                const shadowMap = new Map(shadowCounts.map(s => [s._id.toString(), s.count]))
                jobs.forEach(job => {
                    const shadowCount = shadowMap.get(job._id.toString()) || 0
                    if (shadowCount > 0) {
                        job.currentApplicants = (job.currentApplicants || 0) + shadowCount
                    }
                })
            }

            return {
                items: jobs,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize),
                },
            }
        } catch (error) {
            logger.error('获取职位列表失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    /**
     * 获取职位详情
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID（可选，B端查询时用于权限验证）
     * @param {boolean} incrementViews - 是否增加浏览次数（C端查询时为true）
     * @returns {Promise<Object>} 职位详情
     */
    async getJobById(jobId, companyId = null, incrementViews = false, userId = null) {
        try {
            // 使用智能查询，支持多种ID格式（jobId业务ID、MongoDB ObjectId等）
            logger.info(`[getJobById] Searching for job with ID: ${jobId}`)
            const job = await findBySmartId(JobPost, jobId)
            logger.info(`[getJobById] Query result: ${job ? `Found job: ${job.jobId}` : 'No job found'}`)

            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 如果提供了companyId（B端查询），必须验证权限（含数据隔离）
            if (companyId !== null && companyId !== undefined) {
                await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)
            }

            // C端查询时增加浏览次数
            if (incrementViews && job.status === JOB_STATUS.PUBLISHED) {
                await job.incrementViews()
            }

            // 【暂时禁用】动态查询该职位的 screening 数量
            // 未来优化方案：
            // 1. Redis 缓存 (TTL 5分钟)
            // 2. MongoDB Change Streams 准实时更新
            // 3. 考虑读写分离架构
            // const screeningCounts = await this.getScreeningCounts([job._id])
            // const jobIdStr = job._id.toString()
            
            // // 将 screening 数量添加到 stats
            const jobObj = job.toObject ? job.toObject() : job
            // if (!jobObj.stats) {
            //     jobObj.stats = {}
            // }
            // jobObj.stats.screening = screeningCounts[jobIdStr] || 0

            return jobObj
        } catch (error) {
            if (error.code) throw error
            logger.error('获取职位详情失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    /**
     * 删除职位
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 删除结果
     */
    async deleteJob(jobId, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            // 只能删除草稿状态的职位
            if (job.status !== JOB_STATUS.DRAFT) {
                throw { ...ERROR_CODES.JOB_STATUS_INVALID, detail: '只能删除草稿状态的职位' }
            }

            await job.deleteOne()
            logger.info(`职位删除成功: ${jobId}`)

            return { jobId, deleted: true }
        } catch (error) {
            if (error.code) throw error
            logger.error('删除职位失败:', error)
            throw { ...ERROR_CODES.JOB_DELETE_FAILED, detail: error.message }
        }
    }

    /**
     * 关闭职位
     * @param {string} jobId - 职位ID
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 关闭后的职位
     */
    async closeJob(jobId, companyId, userId = null) {
        try {
            // 使用 findBySmartId 支持多种 ID 格式
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 验证权限（数据隔离）
            await jobCollaboratorService.verifyJobAccess(job, companyId, userId || job.publisherId)

            if (job.status === JOB_STATUS.CLOSED) {
                throw { ...ERROR_CODES.JOB_ALREADY_CLOSED, detail: '职位已经关闭' }
            }

            job.status = JOB_STATUS.CLOSED
            await job.save()

            logger.info(`职位关闭成功: ${jobId}`)
            return job
        } catch (error) {
            if (error.code) throw error
            logger.error('关闭职位失败:', error)
            throw { ...ERROR_CODES.JOB_UPDATE_FAILED, detail: error.message }
        }
    }

    /**
     * 批量更新职位状态
     * @param {Array<string>} jobIds - 职位ID列表
     * @param {string} action - 操作类型（close, pause, resume, delete）
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 批量操作结果
     */
    async batchUpdateJobs(jobIds, action, companyId, userId = null) {
        const results = {
            total: jobIds.length,
            success: 0,
            failed: 0,
            errors: [],
        }

        for (const jobId of jobIds) {
            try {
                switch (action) {
                    case 'close':
                        await this.closeJob(jobId, companyId, userId)
                        break
                    case 'pause':
                        await this.pauseJob(jobId, companyId, userId)
                        break
                    case 'resume':
                        await this.resumeJob(jobId, companyId, userId)
                        break
                    case 'delete':
                        await this.deleteJob(jobId, companyId, userId)
                        break
                    default:
                        throw { ...ERROR_CODES.INVALID_PARAMS, detail: `不支持的操作: ${action}` }
                }
                results.success++
            } catch (error) {
                results.failed++
                results.errors.push({
                    jobId,
                    error: error.message || error.detail || '操作失败',
                })
            }
        }

        return results
    }

    /**
     * 获取职位统计信息
     * @param {string} companyId - 公司ID
     * @returns {Promise<Object>} 统计信息
     */
    async getJobStats(companyId, userId = null) {
        try {
            let stats
            if (userId) {
                // 数据隔离：只统计可访问的岗位
                const accessibleJobIds = await jobCollaboratorService.getAccessibleJobIds(userId, companyId)
                stats = await JobPost.aggregate([
                    { $match: { _id: { $in: accessibleJobIds } } },
                    { $group: { _id: '$status', count: { $sum: 1 } } },
                ])
            } else {
                stats = await JobPost.countByCompany(companyId)
            }

            // 转换为对象格式
            const result = {
                total: 0,
                draft: 0,
                published: 0,
                paused: 0,
                closed: 0,
            }

            stats.forEach(item => {
                result[item._id] = item.count
                result.total += item.count
            })

            return result
        } catch (error) {
            logger.error('获取职位统计失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    // ========== C端方法 ==========

    /**
     * C端 - 搜索职位
     */
    async searchJobs(searchParams, pagination) {
        try {
            // isActive是虚拟字段，需要将其逻辑条件直接写在查询中
            const query = {
                status: JOB_STATUS.PUBLISHED,
                // isActive 虚拟字段的条件：
                // 1. applicationDeadline 不存在或大于当前时间
                // 2. maxApplicants 不存在、为0，或已录用人数小于目标招聘人数
                $and: [
                    {
                        $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: { $gt: new Date() } }],
                    },
                    {
                        $or: [
                            { maxApplicants: { $exists: false } },
                            { maxApplicants: 0 },
                            { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } },
                        ],
                    },
                ],
            }

            console.log('[searchJobs] 基础查询条件', {
                baseQuery: JSON.stringify(query),
                JOB_STATUS_PUBLISHED: JOB_STATUS.PUBLISHED,
                currentDate: new Date(),
            })

            // 关键词搜索 - 需要将$or条件加入到$and数组中
            if (searchParams.keyword) {
                const keywordCondition = {
                    $or: [
                        { title: new RegExp(searchParams.keyword, 'i') },
                        { description: new RegExp(searchParams.keyword, 'i') },
                        { companyName: new RegExp(searchParams.keyword, 'i') },
                        { skills: new RegExp(searchParams.keyword, 'i') },
                    ],
                }
                query.$and.push(keywordCondition)
                console.log('[searchJobs] 添加关键词搜索', {
                    keyword: searchParams.keyword,
                    keywordCondition: keywordCondition,
                })
            }

            // 其他筛选条件 - 直接添加到查询中（不冲突）
            if (searchParams.location) {
                query.location = searchParams.location
            }

            if (searchParams.remote !== undefined) {
                query.remote = searchParams.remote
            }

            if (searchParams.salaryMin || searchParams.salaryMax) {
                if (searchParams.salaryMin) {
                    query['salaryRange.min'] = { $gte: searchParams.salaryMin }
                }
                if (searchParams.salaryMax) {
                    query['salaryRange.max'] = { $lte: searchParams.salaryMax }
                }
            }

            if (searchParams.contractType) {
                query.contractType = searchParams.contractType
            }

            if (searchParams.experience) {
                query['experience.min'] = { $lte: searchParams.experience }
                query['experience.max'] = { $gte: searchParams.experience }
            }

            if (searchParams.education) {
                query.education = searchParams.education
            }

            if (searchParams.skills && searchParams.skills.length > 0) {
                query.skills = { $in: searchParams.skills }
            }

            // 构建排序
            const sort = {}
            sort[searchParams.sortBy] = searchParams.sortOrder === 'asc' ? 1 : -1

            console.log('[searchJobs] 最终查询条件', {
                finalQuery: JSON.stringify(query),
                sort: sort,
                pagination: pagination,
            })

            const [jobs, total] = await Promise.all([
                JobPost.find(query).sort(sort).limit(pagination.pageSize).skip(pagination.skip).exec(),
                JobPost.countDocuments(query),
            ])

            console.log('[searchJobs] 数据库查询结果', {
                total: total,
                jobsFound: jobs.length,
                jobs: jobs.map(job => ({
                    jobId: job.jobId,
                    title: job.title,
                    companyName: job.companyName,
                    status: job.status,
                    isActive: job.isActive,
                })),
            })

            return { jobs, total }
        } catch (error) {
            console.error('[searchJobs] 搜索职位失败:', error)
            logger.error('搜索职位失败:', error)
            throw error
        }
    }

    /**
     * C端 - 获取职位公开详情
     */
    async getPublicJobDetail(jobId) {
        try {
            // C端获取职位详情时，只要是已发布状态就显示
            // 不再检查是否满员或过期，这些信息在前端显示时处理

            // 使用 findBySmartId 支持多种 ID 格式（MongoDB ObjectId、UUID、自定义格式）
            let job = await findBySmartId(JobPost, jobId)

            // 检查职位状态是否为已发布
            if (job && job.status !== JOB_STATUS.PUBLISHED) {
                job = null
            }

            if (job) {
                // 增加浏览次数
                await job.incrementViews()
            }

            return job
        } catch (error) {
            logger.error('获取职位详情失败:', error)
            throw error
        }
    }

    /**
     * 检查用户是否已申请
     */
    async checkUserApplied(jobId, userId) {
        const { JobApplication } = await import('../models/model_loader.js')
        const application = await JobApplication.findOne({
            jobId,
            candidateId: userId,
            status: { $ne: 'withdrawn' },
        })
        return !!application
    }

    /**
     * 获取热门职位
     */
    async getPopularJobs(filters = {}) {
        try {
            const query = {
                status: JOB_STATUS.PUBLISHED,
                // isActive 是虚拟字段，需要查询实际条件
                $and: [
                    {
                        $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: { $gt: new Date() } }],
                    },
                    {
                        $or: [
                            { maxApplicants: { $exists: false } },
                            { maxApplicants: 0 },
                            { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } },
                        ],
                    },
                ],
            }

            if (filters.category) {
                query.category = filters.category
            }

            if (filters.location) {
                query.location = filters.location
            }

            const jobs = await JobPost.find(query)
                .sort({
                    'stats.viewCount': -1,
                    'stats.applicationCount': -1,
                    publishedAt: -1,
                })
                .limit(filters.limit || 10)
                .exec()

            return jobs
        } catch (error) {
            logger.error('获取热门职位失败:', error)
            throw error
        }
    }

    /**
     * 获取职位分类统计
     */
    async getJobCategories() {
        try {
            const categories = await JobPost.aggregate([
                {
                    $match: {
                        status: JOB_STATUS.PUBLISHED,
                        // isActive 虚拟字段的条件
                        $and: [
                            {
                                $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: { $gt: new Date() } }],
                            },
                            {
                                $or: [
                                    { maxApplicants: { $exists: false } },
                                    { maxApplicants: 0 },
                                    { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } },
                                ],
                            },
                        ],
                    },
                },
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                        avgSalary: { $avg: '$salaryRange.min' },
                    },
                },
                {
                    $sort: { count: -1 },
                },
            ])

            return categories.map(cat => ({
                name: cat._id || '其他',
                count: cat.count,
                avgSalary: Math.round(cat.avgSalary || 0),
            }))
        } catch (error) {
            logger.error('获取职位分类失败:', error)
            throw error
        }
    }

    /**
     * 获取薪资分布
     */
    async getSalaryDistribution(filters = {}) {
        try {
            const match = {
                status: JOB_STATUS.PUBLISHED,
                // isActive 虚拟字段的条件
                $and: [
                    {
                        $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: { $gt: new Date() } }],
                    },
                    {
                        $or: [
                            { maxApplicants: { $exists: false } },
                            { maxApplicants: 0 },
                            { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } },
                        ],
                    },
                ],
            }

            if (filters.category) {
                match.category = filters.category
            }

            if (filters.location) {
                match.location = filters.location
            }

            if (filters.experience) {
                match['experience.min'] = { $lte: filters.experience }
                match['experience.max'] = { $gte: filters.experience }
            }

            const distribution = await JobPost.aggregate([
                { $match: match },
                {
                    $bucket: {
                        groupBy: '$salaryRange.min',
                        boundaries: [0, 200, 400, 600, 800, 1000, 1500, 2000, 3000, 5000],
                        default: 'other',
                        output: {
                            count: { $sum: 1 },
                            jobs: { $push: '$title' },
                        },
                    },
                },
            ])

            return distribution
        } catch (error) {
            logger.error('获取薪资分布失败:', error)
            throw error
        }
    }

    /**
     * 根据 ObjectId 获取职位详情
     * @param {string} id - MongoDB ObjectId
     * @returns {Promise<Object>} 职位详情
     */
    async getJobByObjectId(id) {
        try {
            const job = await JobPost.findById(id)
            return job
        } catch (error) {
            logger.error('根据ID获取职位失败:', error)
            throw error
        }
    }

    /**
     * 更新职位的AI解析描述（供job-ai-service调用）
     * @param {string} jobId - 职位ID
     * @param {string} parsedDescription - AI解析后的描述
     * @returns {Promise<Object>} 更新后的职位对象
     */
    async updateParsedDescription(jobId, { parsedDescription, parsedTagList }) {
        try {
            logger.info('[updateParsedDescription] 开始更新职位AI解析描述', { jobId })

            // 使用智能查询查找职位
            const job = await findBySmartId(JobPost, jobId)
            if (!job) {
                logger.warn('[updateParsedDescription] 职位不存在', { jobId })
                throw ERROR_CODES.JOB_NOT_FOUND
            }

            // 条件更新字段
            if (parsedDescription !== undefined) {
                job.parsedDescription = parsedDescription
            }
            if (parsedTagList !== undefined) {
                job.parsedTagList = parsedTagList
            }
            await job.save()

            logger.info('[updateParsedDescription] 职位AI解析描述更新成功', {
                jobId,
                hasParsedDescription: !!job.parsedDescription,
                parsedTagListCount: job.parsedTagList?.length ?? 0,
            })

            // 返回转换后的对象
            return job.toObject ? job.toObject() : job
        } catch (error) {
            if (error.code) throw error
            logger.error('[updateParsedDescription] 更新职位AI解析描述失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    /**
     * 获取指定公司正在招聘的职位列表（官网展示用）
     * @param {string} companyId - 公司ID
     * @param {Object} options - 查询选项
     * @param {number} [options.page=1] - 页码
     * @param {number} [options.limit=20] - 每页数量
     * @param {string} [options.sort='-publishedAt'] - 排序字段
     * @returns {Promise<Object>} 职位列表和分页信息
     */
    async getCompanyHiringJobs(companyId, options = {}) {
        try {
            const { page = 1, limit = 20, sort = '-publishedAt' } = options
            const pageNum = Math.max(1, parseInt(page))
            const limitNum = Math.min(50, Math.max(1, parseInt(limit)))
            const skip = (pageNum - 1) * limitNum

            // 解析排序参数
            const sortField = sort.startsWith('-') ? sort.slice(1) : sort
            const sortOrder = sort.startsWith('-') ? -1 : 1

            // 构建查询条件：已发布 + 未过期 + 未满员
            const query = {
                companyId: companyId,
                status: JOB_STATUS.PUBLISHED,
                $and: [
                    // 未过期
                    {
                        $or: [
                            { applicationDeadline: { $exists: false } },
                            { applicationDeadline: null },
                            { applicationDeadline: { $gt: new Date() } },
                        ],
                    },
                    // 未满员
                    {
                        $or: [
                            { maxApplicants: { $exists: false } },
                            { maxApplicants: null },
                            { maxApplicants: 0 },
                            { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } },
                        ],
                    },
                ],
            }

            logger.info('[getCompanyHiringJobs] 查询条件', {
                companyId,
                page: pageNum,
                limit: limitNum,
                sort: { [sortField]: sortOrder },
            })

            // 并行执行查询和计数
            const [jobs, total] = await Promise.all([
                JobPost.find(query)
                    .sort({ [sortField]: sortOrder })
                    .skip(skip)
                    .limit(limitNum)
                    .select('-__v')
                    .lean(),
                JobPost.countDocuments(query),
            ])

            logger.info('[getCompanyHiringJobs] 查询结果', {
                companyId,
                total,
                jobsCount: jobs.length,
            })

            return {
                jobs,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    totalPages: Math.ceil(total / limitNum),
                    hasNext: pageNum * limitNum < total,
                    hasPrev: pageNum > 1,
                },
            }
        } catch (error) {
            logger.error('[getCompanyHiringJobs] 获取公司招聘职位失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }
}

// 导出服务实例
export default new JobService()
