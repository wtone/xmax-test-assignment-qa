import BaseService from './base_service.js'

class JobAIService extends BaseService {
    constructor() {
        const config = {
            serviceName: 'job-ai',
            baseURL: process.env.JOB_AI_SERVICE_URL || 'http://localhost:3005',
        }
        super(config)
    }

    /**
     * 解析职位描述
     * 注意: job-ai-service 需要 X-Company-Id 和 X-User-Id headers
     * @param {Object} data - 包含职位信息的对象
     * @returns {Promise} 解析任务响应
     */
    async parseJobDescription(data) {
        // 验证必需参数
        if (!data.companyId) {
            const error = new Error('companyId is required for job-ai-service')
            error.code = 'MISSING_COMPANY_ID'
            return Promise.reject(error)
        }
        if (!data.userId) {
            const error = new Error('userId is required for job-ai-service')
            error.code = 'MISSING_USER_ID'
            return Promise.reject(error)
        }

        const requestData = {
            job_id: data.jobId,
            job_description: data.description,
        }

        const config = {
            headers: {
                'x-user-company-id': data.companyId,
                'x-user-id': data.userId,
            },
        }

        return this.post('/api/v1/job-ai/parse', requestData, config)
    }

    /**
     * 健康检查
     * @returns {Promise} 服务健康状态
     */
    async healthCheck() {
        return this.get('/api/v1/job-ai/health')
    }
}

export default new JobAIService()
