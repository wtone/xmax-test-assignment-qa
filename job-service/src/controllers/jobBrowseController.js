/**
 * C端职位浏览控制器
 * @module controllers/jobBrowseController
 */

import jobService from '../services/job_service.js'
import MatchingService from '../services/MatchingService.js'
import RecommendationService from '../services/RecommendationService.js'
import UserCenterService from '../services/integration/UserCenterService.js'
import CompanyService from '../services/integration/CompanyService.js'
import { getPaginationParams, buildPaginationResponse } from '../../utils/helpers.js'
import { createSuccessResponse } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { createApiError } from '../utils/ApiError.js'
import { formatJobResponse, formatJobListResponse } from '../utils/job_formatter.js'

// 官网展示默认邮箱（从环境变量读取）
const OFFICIAL_WEBSITE_EMAIL = process.env.OFFICIAL_WEBSITE_EMAIL || 'hr@example.com'
class JobBrowseController {
    /**
     * 搜索职位
     * @swagger
     * /api/v1/job-c/search:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 搜索职位
     *     description: 根据关键词、地点、薪资等条件搜索职位
     */
    async searchJobs(ctx) {
        try {
            ctx.logger.info('[searchJobs] 开始处理C端搜索请求', {
                query: ctx.query,
                url: ctx.url,
                method: ctx.method,
            })

            const { page, pageSize, skip } = getPaginationParams(ctx.query)
            const searchParams = {
                keyword: ctx.query.keyword,
                location: ctx.query.location,
                remote: ctx.query.remote === 'true',
                salaryMin: ctx.query.salaryMin ? parseInt(ctx.query.salaryMin) : undefined,
                salaryMax: ctx.query.salaryMax ? parseInt(ctx.query.salaryMax) : undefined,
                contractType: ctx.query.contractType,
                experience: ctx.query.experience,
                education: ctx.query.education,
                skills: ctx.query.skills ? ctx.query.skills.split(',') : undefined,
                sortBy: ctx.query.sortBy || 'publishedAt',
                sortOrder: ctx.query.sortOrder || 'desc',
            }

            ctx.logger.info('[searchJobs] 搜索参数', {
                searchParams,
                pagination: { page, pageSize, skip },
            })

            const result = await jobService.searchJobs(searchParams, { page, pageSize, skip })

            // 格式化职位列表，添加中文标签
            const formattedJobs = formatJobListResponse(result.jobs)

            ctx.logger.info('[searchJobs] 搜索结果', {
                total: result.total,
                jobsCount: formattedJobs?.length || 0,
                jobs: formattedJobs?.map(job => ({
                    jobId: job.jobId,
                    title: job.title,
                    companyName: job.companyName,
                    status: job.status,
                    isActive: job.isActive,
                })),
            })

            const response = buildPaginationResponse(formattedJobs, result.total, { page, pageSize })
            ctx.body = createSuccessResponse(response)

            ctx.logger.info('[searchJobs] 响应发送成功', {
                responseTotal: response.pagination?.total || 0,
            })
        } catch (error) {
            ctx.logger.error('[searchJobs] 搜索职位失败:', error)
            throw error
        }
    }

    /**
     * 获取职位详情（公开）
     * @swagger
     * /api/v1/job-c/{jobId}:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取职位详情
     *     description: 获取职位的公开信息（登录用户会返回是否已申请状态和候选人基本信息）
     */
    async getJobDetail(ctx) {
        try {
            const { jobId } = ctx.params
            const userId = ctx.state.user?.id

            const job = await jobService.getPublicJobDetail(jobId)

            if (!job) {
                throw createApiError(ERROR_CODES.JOB_NOT_FOUND)
            }

            // 格式化职位数据，添加中文标签
            const formattedJob = formatJobResponse(job)

            // 如果用户已登录，获取用户相关信息
            if (userId) {
                // 检查是否已申请
                formattedJob.hasApplied = await jobService.checkUserApplied(jobId, userId)

                // 获取候选人基本信息
                try {
                    const candidateProfile = await UserCenterService.getCandidateProfile(userId)

                    // 只返回候选人的基本信息，避免敏感信息泄露
                    formattedJob.candidate = {
                        id: userId,
                        name: candidateProfile?.name,
                        email: candidateProfile?.email,
                        phone: candidateProfile?.phone,
                        avatar: candidateProfile?.avatar,
                        title: candidateProfile?.title,
                        summary: candidateProfile?.summary,
                        location: candidateProfile?.location,
                        experience: candidateProfile?.experience,
                        education: candidateProfile?.education,
                        skills: candidateProfile?.skills,
                        isProfileComplete: candidateProfile?.isProfileComplete || false,
                    }
                } catch (profileError) {
                    // 如果获取候选人信息失败，记录错误但不影响主流程
                    ctx.logger.warn('获取候选人信息失败:', {
                        userId,
                        error: profileError.message,
                    })
                    // 提供基础信息
                    formattedJob.candidate = {
                        id: userId,
                        isProfileComplete: false,
                    }
                }
            }

            ctx.body = createSuccessResponse(formattedJob)
        } catch (error) {
            ctx.logger.error('获取职位详情失败:', error)
            throw error
        }
    }

    /**
     * 获取推荐职位
     * @swagger
     * /api/v1/job-c/recommendations:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取推荐职位
     *     description: 基于用户画像和行为获取推荐职位
     */
    async getRecommendations(ctx) {
        try {
            const userId = ctx.state.user?.id
            const { limit = 10 } = ctx.query

            let recommendations

            if (userId) {
                // 登录用户的个性化推荐
                recommendations = await RecommendationService.getPersonalizedRecommendations(userId, limit)
            } else {
                // 未登录用户的热门推荐
                recommendations = await RecommendationService.getPopularJobs(limit)
            }

            // 格式化推荐职位列表，添加中文标签
            const formattedRecommendations = formatJobListResponse(recommendations)

            ctx.body = createSuccessResponse({
                recommendations: formattedRecommendations,
                type: userId ? 'personalized' : 'popular',
            })
        } catch (error) {
            ctx.logger.error('获取推荐职位失败:', error)
            throw error
        }
    }

    /**
     * 获取相似职位
     * @swagger
     * /api/v1/job-c/{jobId}/similar:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取相似职位
     *     description: 基于当前职位获取相似的其他职位
     */
    async getSimilarJobs(ctx) {
        try {
            const { jobId } = ctx.params
            const { limit = 5 } = ctx.query

            const similarJobs = await RecommendationService.getSimilarJobs(jobId, limit)

            // 格式化相似职位列表，添加中文标签
            const formattedJobs = formatJobListResponse(similarJobs)

            ctx.body = createSuccessResponse(formattedJobs)
        } catch (error) {
            ctx.logger.error('获取相似职位失败:', error)
            throw error
        }
    }

    /**
     * 获取热门职位
     * @swagger
     * /api/v1/job-c/popular:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取热门职位
     *     description: 获取当前热门的职位列表
     */
    async getPopularJobs(ctx) {
        try {
            const { category, location, limit = 10 } = ctx.query

            const popularJobs = await jobService.getPopularJobs({
                category,
                location,
                limit: parseInt(limit),
            })

            // 格式化职位列表，添加中文标签
            const formattedJobs = formatJobListResponse(popularJobs)

            ctx.body = createSuccessResponse(formattedJobs)
        } catch (error) {
            ctx.logger.error('获取热门职位失败:', error)
            throw error
        }
    }

    /**
     * 获取职位分类统计
     * @swagger
     * /api/v1/job-c/categories:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取职位分类
     *     description: 获取所有职位分类及数量统计
     */
    async getJobCategories(ctx) {
        try {
            const categories = await jobService.getJobCategories()

            ctx.body = createSuccessResponse(categories)
        } catch (error) {
            ctx.logger.error('获取职位分类失败:', error)
            throw error
        }
    }

    /**
     * 获取薪资分布
     * @swagger
     * /api/v1/job-c/salary-distribution:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取薪资分布
     *     description: 获取指定条件下的薪资分布统计
     */
    async getSalaryDistribution(ctx) {
        try {
            const { category, location, experience } = ctx.query

            const distribution = await jobService.getSalaryDistribution({
                category,
                location,
                experience,
            })

            ctx.body = createSuccessResponse(distribution)
        } catch (error) {
            ctx.logger.error('获取薪资分布失败:', error)
            throw error
        }
    }

    /**
     * 获取官网招聘职位列表（免登录）
     * @swagger
     * /api/v1/job-c/official/hiring:
     *   get:
     *     tags:
     *       - C端-职位浏览
     *     summary: 获取官网招聘职位
     *     description: 获取指定B端用户（默认为官方账号）所属公司的正在招聘职位列表，用于官网展示
     *     parameters:
     *       - in: query
     *         name: email
     *         schema:
     *           type: string
     *         description: B端用户邮箱（可选，默认使用环境变量配置）
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
     *         description: 每页数量
     *       - in: query
     *         name: sort
     *         schema:
     *           type: string
     *           default: -publishedAt
     *         description: 排序字段（默认按发布时间倒序）
     *     responses:
     *       200:
     *         description: 成功
     *         content:
     *           application/json:
     *             schema:
     *               type: object
     *               properties:
     *                 code:
     *                   type: integer
     *                   example: 0
     *                 message:
     *                   type: string
     *                   example: Success
     *                 data:
     *                   type: object
     *                   properties:
     *                     company:
     *                       type: object
     *                       description: 公司信息
     *                       properties:
     *                         companyId:
     *                           type: string
     *                           description: 公司ID
     *                         name:
     *                           type: string
     *                           description: 公司名称
     *                         displayName:
     *                           type: string
     *                           description: 展示名称
     *                         logo:
     *                           type: string
     *                           description: 公司Logo URL
     *                         shortDescription:
     *                           type: string
     *                           description: 简短介绍
     *                     jobs:
     *                       type: array
     *                       description: 职位列表
     *                       items:
     *                         type: object
     *                     pagination:
     *                       type: object
     *                       description: 分页信息
     *                       properties:
     *                         page:
     *                           type: integer
     *                         limit:
     *                           type: integer
     *                         total:
     *                           type: integer
     *                         totalPages:
     *                           type: integer
     *                         hasNext:
     *                           type: boolean
     *                         hasPrev:
     *                           type: boolean
     */
    async getOfficialHiringJobs(ctx) {
        try {
            // 获取 email 参数，默认使用环境变量配置
            const email = ctx.query.email || OFFICIAL_WEBSITE_EMAIL
            const { page = 1, limit = 20, sort = '-publishedAt' } = ctx.query

            ctx.logger.info('[getOfficialHiringJobs] 开始处理请求', {
                email,
                page,
                limit,
                sort,
                defaultEmail: OFFICIAL_WEBSITE_EMAIL,
            })

            // 1. 通过 email 获取用户信息
            const user = await UserCenterService.getUserByEmail(email)
            if (!user) {
                ctx.logger.warn('[getOfficialHiringJobs] 用户不存在', { email })
                throw createApiError({
                    code: 1002,
                    message: 'User not found',
                    detail: `邮箱 ${email} 对应的用户不存在`,
                })
            }

            ctx.logger.info('[getOfficialHiringJobs] 获取到用户信息', {
                userId: user.id,
                userType: user.type,
                email: user.email,
            })

            // 2. 验证是 B 端用户
            if (user.type !== 'B') {
                ctx.logger.warn('[getOfficialHiringJobs] 非B端用户', {
                    email,
                    userType: user.type,
                })
                throw createApiError({
                    code: 1003,
                    message: 'User is not a business user',
                    detail: `邮箱 ${email} 对应的用户不是企业用户`,
                })
            }

            // 3. 获取用户关联的公司信息
            const companyInfo = await CompanyService.getUserCompany(user.id)
            if (!companyInfo) {
                ctx.logger.warn('[getOfficialHiringJobs] 用户无关联公司', {
                    userId: user.id,
                    email,
                })
                throw createApiError({
                    code: 1004,
                    message: 'User has no associated company',
                    detail: `用户 ${email} 暂未关联公司`,
                })
            }

            // companyInfo 结构: { company: {...}, employee: {...}, companyStatusValid: bool }
            const company = companyInfo.company
            // 注意：JobPost 中存储的 companyId 使用 comp_xxx 格式（业务ID）
            const companyId = company.companyId

            ctx.logger.info('[getOfficialHiringJobs] 获取到公司信息', {
                companyId,
                companyName: company.name,
            })

            // 4. 查询该公司正在招聘的职位
            const result = await jobService.getCompanyHiringJobs(companyId, {
                page: parseInt(page),
                limit: parseInt(limit),
                sort,
            })

            // 5. 格式化职位列表，添加中文标签
            const formattedJobs = formatJobListResponse(result.jobs)

            ctx.logger.info('[getOfficialHiringJobs] 查询成功', {
                companyId,
                total: result.pagination.total,
                jobsCount: formattedJobs.length,
            })

            // 6. 返回响应
            ctx.body = createSuccessResponse({
                company: {
                    companyId: companyId,
                    name: company.name,
                    displayName: company.displayName || null,
                    logo: company.logo || null,
                    shortDescription: company.shortDescription || null,
                },
                jobs: formattedJobs,
                pagination: result.pagination,
            })
        } catch (error) {
            ctx.logger.error('[getOfficialHiringJobs] 获取官网招聘职位失败:', {
                error: error.message,
                code: error.code,
                stack: error.stack,
            })
            throw error
        }
    }
}

export default new JobBrowseController()
