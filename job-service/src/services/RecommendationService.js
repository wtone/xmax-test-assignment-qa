/**
 * 职位推荐服务
 * @module services/RecommendationService
 */

import { JobPost, JobApplication } from '../models/model_loader.js'
import UserCenterService from './integration/UserCenterService.js'
import ResumeService from './integration/ResumeService.js'
import logger from '../../utils/logger.js'

class RecommendationService {
    /**
     * 获取个性化推荐
     */
    async getPersonalizedRecommendations(userId, limit = 10) {
        try {
            // 获取用户画像
            const userProfile = await this.getUserProfile(userId)

            // 获取用户历史行为
            const userBehavior = await this.getUserBehavior(userId)

            // 构建推荐查询
            const query = this.buildRecommendationQuery(userProfile, userBehavior)

            // 获取推荐职位
            const jobs = await JobPost.find(query)
                .sort({
                    'stats.viewCount': -1,
                    publishedAt: -1,
                })
                .limit(limit)
                .exec()

            // 计算匹配分数
            const recommendations = await Promise.all(
                jobs.map(async job => {
                    const score = await this.calculateMatchScore(job, userProfile)
                    return {
                        job: job.toJSON(),
                        matchScore: score,
                        reason: this.getRecommendationReason(job, userProfile, score),
                    }
                }),
            )

            return recommendations.sort((a, b) => b.matchScore - a.matchScore)
        } catch (error) {
            logger.error('获取个性化推荐失败:', error)
            throw error
        }
    }

    /**
     * 获取热门职位
     */
    async getPopularJobs(limit = 10) {
        try {
            const jobs = await JobPost.find({
                status: 'published',
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
            })
                .sort({
                    'stats.viewCount': -1,
                    'stats.applicationCount': -1,
                    publishedAt: -1,
                })
                .limit(limit)
                .exec()

            return jobs.map(job => ({
                job: job.toJSON(),
                popularity: {
                    viewCount: job.stats.viewCount,
                    applicationCount: job.stats.applicationCount,
                    competitionRate: job.stats.applicationCount / (job.maxApplicants || 100),
                },
            }))
        } catch (error) {
            logger.error('获取热门职位失败:', error)
            throw error
        }
    }

    /**
     * 获取相似职位
     */
    async getSimilarJobs(jobId, limit = 5) {
        try {
            const targetJob = await JobPost.findOne({ jobId })
            if (!targetJob) {
                return []
            }

            // 构建相似查询条件
            const query = {
                jobId: { $ne: jobId },
                status: 'published',
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
                    {
                        $or: [
                            // 相同职位类别
                            { category: targetJob.category },
                            // 相似技能要求
                            { skills: { $in: targetJob.skills } },
                            // 相似薪资范围
                            {
                                'salaryRange.min': {
                                    $gte: targetJob.salaryRange.min * 0.8,
                                    $lte: targetJob.salaryRange.max * 1.2,
                                },
                            },
                        ],
                    },
                ],
            }

            if (targetJob.location) {
                // 添加位置条件到相似条件的$or中
                query.$and[2].$or.push({ location: targetJob.location })
            }

            const similarJobs = await JobPost.find(query)
                .limit(limit * 2) // 获取更多以便过滤
                .exec()

            // 计算相似度分数
            const scored = similarJobs.map(job => ({
                job: job.toJSON(),
                similarity: this.calculateSimilarity(targetJob, job),
            }))

            // 按相似度排序并返回
            return scored.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
        } catch (error) {
            logger.error('获取相似职位失败:', error)
            throw error
        }
    }

    /**
     * 获取用户画像
     */
    async getUserProfile(userId) {
        try {
            // 获取用户基本信息
            const userInfo = await UserCenterService.getUserInfo(userId)

            // 获取用户简历
            const resume = await ResumeService.getUserLatestResume(userId)

            // 获取用户申请历史
            const applications = await JobApplication.find({ candidateId: userId }).populate('jobId').limit(10).sort({ createdAt: -1 })

            // 构建用户画像
            return {
                basic: userInfo,
                skills: resume?.skills || [],
                experience: resume?.yearsOfExperience || 0,
                education: resume?.education || '',
                expectedSalary: resume?.expectedSalary || {},
                preferredLocations: resume?.preferredLocations || [],
                preferredJobTypes: this.extractPreferredJobTypes(applications),
                applicationHistory: applications,
            }
        } catch (error) {
            logger.error('获取用户画像失败:', error)
            return null
        }
    }

    /**
     * 获取用户行为数据
     */
    async getUserBehavior(userId) {
        // 这里可以集成用户行为追踪系统
        // 暂时返回模拟数据
        return {
            viewedJobs: [],
            savedJobs: [],
            searchKeywords: [],
            clickRate: {},
        }
    }

    /**
     * 构建推荐查询条件
     */
    buildRecommendationQuery(userProfile, userBehavior) {
        const query = {
            status: 'published',
            // isActive 是虚拟字段，需要查询实际条件
            $and: [
                {
                    $or: [{ applicationDeadline: { $exists: false } }, { applicationDeadline: { $gt: new Date() } }],
                },
                {
                    $or: [{ maxApplicants: { $exists: false } }, { maxApplicants: 0 }, { $expr: { $lt: ['$hiredCount', '$maxApplicants'] } }],
                },
            ],
        }

        if (userProfile) {
            // 基于技能匹配
            if (userProfile.skills?.length > 0) {
                query.skills = { $in: userProfile.skills }
            }

            // 基于地点偏好 - 添加到$and数组中
            if (userProfile.preferredLocations?.length > 0) {
                query.$and.push({
                    $or: [{ location: { $in: userProfile.preferredLocations } }, { remote: true }],
                })
            }

            // 基于经验要求
            if (userProfile.experience) {
                query['experience.min'] = { $lte: userProfile.experience }
                query['experience.max'] = { $gte: userProfile.experience }
            }

            // 排除已申请的职位
            if (userProfile.applicationHistory?.length > 0) {
                const appliedJobIds = userProfile.applicationHistory.map(app => app.jobId)
                query.jobId = { $nin: appliedJobIds }
            }
        }

        return query
    }

    /**
     * 计算匹配分数
     */
    async calculateMatchScore(job, userProfile) {
        if (!userProfile) return 50

        let score = 0
        let factors = 0

        // 技能匹配 (40分)
        if (job.skills?.length > 0 && userProfile.skills?.length > 0) {
            const matchedSkills = job.skills.filter(skill => userProfile.skills.includes(skill))
            score += (matchedSkills.length / job.skills.length) * 40
            factors++
        }

        // 经验匹配 (20分)
        if (job.experience && userProfile.experience) {
            if (userProfile.experience >= job.experience.min && userProfile.experience <= job.experience.max) {
                score += 20
            } else if (userProfile.experience >= job.experience.min * 0.8) {
                score += 10
            }
            factors++
        }

        // 地点匹配 (20分)
        if (userProfile.preferredLocations?.includes(job.location) || job.remote) {
            score += 20
            factors++
        }

        // 薪资匹配 (20分)
        if (userProfile.expectedSalary && job.salaryRange) {
            const expectedMin = userProfile.expectedSalary.min || 0
            const jobMin = job.salaryRange.min || 0

            if (jobMin >= expectedMin * 0.9) {
                score += 20
            } else if (jobMin >= expectedMin * 0.7) {
                score += 10
            }
            factors++
        }

        // 如果没有匹配因素，返回基础分
        if (factors === 0) return 50

        // 标准化分数
        return Math.round(score)
    }

    /**
     * 计算职位相似度
     */
    calculateSimilarity(job1, job2) {
        let similarity = 0

        // 类别相同 (30分)
        if (job1.category === job2.category) {
            similarity += 30
        }

        // 技能重合度 (30分)
        const skills1 = new Set(job1.skills || [])
        const skills2 = new Set(job2.skills || [])
        const intersection = [...skills1].filter(x => skills2.has(x))
        const union = new Set([...skills1, ...skills2])

        if (union.size > 0) {
            similarity += (intersection.length / union.size) * 30
        }

        // 薪资范围重合 (20分)
        if (job1.salaryRange && job2.salaryRange) {
            const overlap = this.calculateRangeOverlap(job1.salaryRange, job2.salaryRange)
            similarity += overlap * 20
        }

        // 地点相同 (10分)
        if (job1.location === job2.location) {
            similarity += 10
        }

        // 远程工作相同 (10分)
        if (job1.remote === job2.remote) {
            similarity += 10
        }

        return Math.round(similarity)
    }

    /**
     * 计算范围重合度
     */
    calculateRangeOverlap(range1, range2) {
        const min = Math.max(range1.min, range2.min)
        const max = Math.min(range1.max, range2.max)

        if (min > max) return 0

        const overlap = max - min
        const total = Math.max(range1.max, range2.max) - Math.min(range1.min, range2.min)

        return overlap / total
    }

    /**
     * 获取推荐理由
     */
    getRecommendationReason(job, userProfile, score) {
        const reasons = []

        if (score >= 80) {
            reasons.push('高度匹配您的背景')
        } else if (score >= 60) {
            reasons.push('较好匹配您的背景')
        }

        // 技能匹配
        if (job.skills && userProfile?.skills) {
            const matched = job.skills.filter(s => userProfile.skills.includes(s))
            if (matched.length > 0) {
                reasons.push(`匹配技能: ${matched.slice(0, 3).join('、')}`)
            }
        }

        // 地点匹配
        if (userProfile?.preferredLocations?.includes(job.location)) {
            reasons.push('符合您的地点偏好')
        } else if (job.remote) {
            reasons.push('支持远程办公')
        }

        // 热门职位
        if (job.stats?.viewCount > 1000) {
            reasons.push('热门职位')
        }

        return reasons.join('，')
    }

    /**
     * 提取用户偏好的职位类型
     */
    extractPreferredJobTypes(applications) {
        if (!applications || applications.length === 0) return []

        const typeCount = {}
        applications.forEach(app => {
            if (app.jobId?.category) {
                typeCount[app.jobId.category] = (typeCount[app.jobId.category] || 0) + 1
            }
        })

        return Object.entries(typeCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([type]) => type)
    }
}

export default new RecommendationService()
export { RecommendationService }
