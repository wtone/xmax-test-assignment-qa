import BaseService from './base_service.js'

class AIService extends BaseService {
    constructor() {
        super({
            serviceName: 'resume-ai',
            baseURL: process.env.AI_SERVICE_URL || 'http://localhost:3003',
            timeout: 60000, // AI 服务可能需要较长处理时间
            retries: 2,
            retryInterval: 2000,
        })
    }

    /**
     * 解析简历
     */
    async parseResume(fileUrl, options = {}) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/parse-resume',
            data: {
                fileUrl,
                ...options,
            },
        })
    }

    /**
     * 获取解析任务状态
     */
    async getTaskStatus(taskId) {
        return this.request({
            method: 'GET',
            url: `/api/v1/resume-ai/task-status/${taskId}`,
        })
    }

    /**
     * 获取解析结果
     */
    async getParseResult(taskId) {
        return this.request({
            method: 'GET',
            url: `/api/v1/resume-ai/result/${taskId}`,
        })
    }

    /**
     * 解析求职偏好
     */
    async parseJobPreference(resumeData) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/parse-job-preference',
            data: resumeData,
        })
    }

    /**
     * 简历与职位匹配分析
     */
    async analyzeJobMatch(resumeId, jobId) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/analyze-match',
            data: {
                resumeId,
                jobId,
            },
        })
    }

    /**
     * 批量分析简历匹配度
     */
    async batchAnalyzeMatch(jobId, resumeIds) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/batch-analyze-match',
            data: {
                jobId,
                resumeIds,
            },
        })
    }

    /**
     * 生成职位描述
     */
    async generateJobDescription(jobData) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/generate-job-description',
            data: jobData,
        })
    }

    /**
     * 优化职位描述
     */
    async optimizeJobDescription(description) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/optimize-job-description',
            data: { description },
        })
    }

    /**
     * 提取技能关键词
     */
    async extractSkills(text) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/extract-skills',
            data: { text },
        })
    }

    /**
     * 智能推荐候选人
     */
    async recommendCandidates(jobId, filters = {}) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/recommend-candidates',
            data: {
                jobId,
                filters,
            },
        })
    }

    /**
     * 智能推荐职位
     */
    async recommendJobs(candidateId, preferences = {}) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/recommend-jobs',
            data: {
                candidateId,
                preferences,
            },
        })
    }

    /**
     * 分析面试表现
     */
    async analyzeInterviewPerformance(interviewData) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/analyze-interview',
            data: interviewData,
        })
    }

    /**
     * 生成面试问题
     */
    async generateInterviewQuestions(jobId, resumeId) {
        return this.request({
            method: 'POST',
            url: '/api/v1/resume-ai/generate-interview-questions',
            data: {
                jobId,
                resumeId,
            },
        })
    }
}

export default new AIService()
