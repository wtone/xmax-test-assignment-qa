import { calculateMatchScore } from '../../utils/helpers.js'

class MatchingService {
    /**
     * 计算职位与简历的匹配度
     */
    static async calculateJobMatch(job, resume) {
        const scores = {
            skills: 0,
            experience: 0,
            education: 0,
            location: 0,
            salary: 0,
        }

        // 技能匹配（权重40%）
        if (job.skills && resume.skills) {
            scores.skills = calculateMatchScore(job.skills, resume.skills) * 0.4
        }

        // 经验匹配（权重25%）
        if (job.experienceYears && resume.totalExperience) {
            const experienceMatch = this.calculateExperienceMatch(job.experienceYears, resume.totalExperience)
            scores.experience = experienceMatch * 0.25
        }

        // 教育匹配（权重15%）
        if (job.education && resume.education) {
            scores.education = this.calculateEducationMatch(job.education, resume.education) * 0.15
        }

        // 地点匹配（权重10%）
        if (job.location && resume.preferredLocations) {
            scores.location = this.calculateLocationMatch(job.location, resume.preferredLocations, job.remote) * 0.1
        }

        // 薪资匹配（权重10%）
        if (job.salaryRange && resume.expectedSalary) {
            scores.salary = this.calculateSalaryMatch(job.salaryRange, resume.expectedSalary) * 0.1
        }

        // 计算总分
        const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0)

        return Math.round(totalScore)
    }

    /**
     * 计算经验匹配度
     */
    static calculateExperienceMatch(required, actual) {
        if (!required || !actual) return 0

        const { min = 0, max = Infinity } = required

        if (actual >= min && actual <= max) {
            return 100
        } else if (actual < min) {
            // 经验不足，每少一年扣10分
            const shortage = min - actual
            return Math.max(0, 100 - shortage * 10)
        } else {
            // 经验过多，每多一年扣5分
            const excess = actual - max
            return Math.max(50, 100 - excess * 5)
        }
    }

    /**
     * 计算教育匹配度
     */
    static calculateEducationMatch(required, actual) {
        const educationLevels = {
            high_school: 1,
            associate: 2,
            bachelor: 3,
            master: 4,
            phd: 5,
        }

        const requiredLevel = educationLevels[required] || 0
        const actualLevel = educationLevels[actual] || 0

        if (actualLevel >= requiredLevel) {
            return 100
        } else {
            // 每差一个等级扣20分
            return Math.max(0, 100 - (requiredLevel - actualLevel) * 20)
        }
    }

    /**
     * 计算地点匹配度
     */
    static calculateLocationMatch(jobLocation, preferredLocations, isRemote) {
        // 如果是远程职位，完全匹配
        if (isRemote) return 100

        // 检查偏好地点
        if (!preferredLocations || preferredLocations.length === 0) return 50

        if (preferredLocations.includes(jobLocation)) {
            return 100
        }

        // TODO: 可以增加城市距离计算
        return 0
    }

    /**
     * 计算薪资匹配度
     */
    static calculateSalaryMatch(jobSalary, expectedSalary) {
        if (!jobSalary || !expectedSalary) return 50

        const { min: jobMin, max: jobMax } = jobSalary
        const { min: expectedMin, max: expectedMax } = expectedSalary

        // 期望薪资在职位薪资范围内
        if (expectedMin >= jobMin && expectedMax <= jobMax) {
            return 100
        }

        // 有重叠
        if (expectedMin <= jobMax && expectedMax >= jobMin) {
            const overlap = Math.min(jobMax, expectedMax) - Math.max(jobMin, expectedMin)
            const jobRange = jobMax - jobMin
            const expectedRange = expectedMax - expectedMin
            const overlapRatio = overlap / Math.max(jobRange, expectedRange)
            return Math.round(overlapRatio * 100)
        }

        // 完全不匹配
        return 0
    }

    /**
     * 批量计算匹配度
     */
    static async batchCalculateMatches(job, resumes) {
        const matches = []

        for (const resume of resumes) {
            const matchScore = await this.calculateJobMatch(job, resume)
            matches.push({
                resumeId: resume.resumeId,
                candidateId: resume.candidateId,
                matchScore,
            })
        }

        // 按匹配度排序
        return matches.sort((a, b) => b.matchScore - a.matchScore)
    }

    /**
     * 推荐候选人
     */
    static async recommendCandidates(jobId, limit = 10) {
        // TODO: 实现基于职位的候选人推荐
        // 1. 获取职位信息
        // 2. 搜索相关简历
        // 3. 计算匹配度
        // 4. 返回推荐结果

        return []
    }

    /**
     * 推荐职位
     */
    static async recommendJobs(candidateId, limit = 10) {
        // TODO: 实现基于候选人的职位推荐
        // 1. 获取候选人简历
        // 2. 搜索相关职位
        // 3. 计算匹配度
        // 4. 返回推荐结果

        return []
    }
}

export default MatchingService
