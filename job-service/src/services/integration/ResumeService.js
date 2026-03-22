import BaseService from './base_service.js'

class ResumeService extends BaseService {
    constructor() {
        const config = {
            serviceName: 'resume',
            baseURL: process.env.RESUME_SERVICE_URL || 'http://localhost:3002',
        }
        super(config)
    }

    /**
     * 获取简历详情
     */
    async getResume(candidateId, resumeId) {
        return this.get(
            `/api/v1/resume/${resumeId}`,
            {},
            {
                headers: {
                    'x-user-id': candidateId,
                },
            },
        )
    }

    /**
     * B端场景下获取简历（传 B端用户身份，触发 resume-service 的 B端脱敏逻辑）
     */
    async getResumeForBUser(bUserId, resumeId) {
        return this.get(
            `/api/v1/resume/${resumeId}`,
            {},
            {
                headers: {
                    'x-user-id': bUserId,
                    'x-user-type': 'B',
                    'x-user-username': 'internal-job-service',
                    'x-user-email': 'internal@job-service',
                    'x-user-roles': '[]',
                },
            },
        )
    }

    /**
     * 获取候选人的所有简历
     */
    async getCandidateResumes(candidateId) {
        return this.get(
            `/api/v1/resume`,
            {},
            {
                headers: {
                    'x-user-id': candidateId,
                },
            },
        )
    }

    /**
     * 获取候选人的主简历
     */
    async getPrimaryResume(candidateId) {
        return this.get(
            `/api/v1/resume`,
            {},
            {
                headers: {
                    'x-user-id': candidateId,
                },
            },
        )
    }

    /**
     * 批量获取简历
     */
    async batchGetResumes(resumeIds) {
        return this.post('/api/v1/resume/batch', { resumeIds })
    }

    /**
     * 搜索简历
     */
    async searchResumes(searchParams) {
        return this.post('/api/v1/resume/search', searchParams)
    }

    /**
     * 获取简历技能列表
     */
    async getResumeSkills(resumeId) {
        return this.get(`/api/v1/resume/${resumeId}/skills`)
    }

    /**
     * 获取简历工作经验
     */
    async getResumeExperience(resumeId) {
        return this.get(`/api/v1/resume/${resumeId}/experience`)
    }

    /**
     * 获取简历教育背景
     */
    async getResumeEducation(resumeId) {
        return this.get(`/api/v1/resume/${resumeId}/education`)
    }

    /**
     * 更新简历查看记录
     */
    async recordResumeView(resumeId, viewerId) {
        return this.post(`/api/v1/resume/${resumeId}/view`, { viewerId })
    }

    /**
     * 获取用户最新简历
     */
    async getUserLatestResume(userId) {
        try {
            const response = await this.getPrimaryResume(userId)
            return response?.data || null
        } catch (error) {
            return null
        }
    }

}

export default new ResumeService()
