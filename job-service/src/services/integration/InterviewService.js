import BaseService from './base_service.js'

class InterviewService extends BaseService {
    constructor() {
        const config = {
            serviceName: 'interview',
            baseURL: process.env.INTERVIEW_SERVICE_URL || 'http://localhost:3006',
        }
        super(config)
    }

    /**
     * 创建面试
     */
    async createInterview(interviewData) {
        return this.post('/api/v1/interview', interviewData)
    }

    /**
     * 获取面试详情
     */
    async getInterview(interviewId) {
        return this.get(`/api/v1/interview/${interviewId}`)
    }

    /**
     * 更新面试信息
     */
    async updateInterview(interviewId, updates) {
        return this.put(`/api/v1/interview/${interviewId}`, updates)
    }

    /**
     * 取消面试
     */
    async cancelInterview(interviewId, reason) {
        return this.post(`/api/v1/interview/${interviewId}/cancel`, { reason })
    }

    /**
     * 重新安排面试
     */
    async rescheduleInterview(interviewId, newSchedule) {
        return this.post(`/api/v1/interview/${interviewId}/reschedule`, newSchedule)
    }

    /**
     * 获取面试日程
     */
    async getInterviewSchedule(params) {
        return this.get('/api/v1/interview/schedule', params)
    }

    /**
     * 批量创建面试
     */
    async batchCreateInterviews(interviews) {
        return this.post('/api/v1/interview/batch', { interviews })
    }

    /**
     * 获取面试反馈
     */
    async getInterviewFeedback(interviewId) {
        return this.get(`/api/v1/interview/${interviewId}/feedback`)
    }

    /**
     * 提交面试反馈
     */
    async submitInterviewFeedback(interviewId, feedback) {
        return this.post(`/api/v1/interview/${interviewId}/feedback`, feedback)
    }

    /**
     * 获取面试统计
     */
    async getInterviewStats(params) {
        return this.get('/api/v1/interview/stats', params)
    }

    /**
     * 检查面试时间冲突
     */
    async checkScheduleConflict(scheduleData) {
        return this.post('/api/v1/interview/check-conflict', scheduleData)
    }

    /**
     * 获取候选人的面试列表
     */
    async getCandidateInterviews(candidateId, params = {}) {
        return this.get('/api/v1/interview/candidate', { candidateId, ...params })
    }

    /**
     * 获取申请的所有面试
     */
    async getApplicationInterviews(applicationId) {
        return this.get('/api/v1/interview/application', { applicationId })
    }

    /**
     * 候选人响应面试邀请
     */
    async respondToInterview(interviewId, response) {
        return this.put(`/api/v1/interview/${interviewId}/response`, response)
    }

    /**
     * 提交候选人反馈
     */
    async submitCandidateFeedback(interviewId, feedback) {
        return this.post(`/api/v1/interview/${interviewId}/candidate-feedback`, feedback)
    }
}

export default new InterviewService()
