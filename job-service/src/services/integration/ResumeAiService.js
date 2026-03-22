import BaseService from './base_service.js'

class ResumeAiService extends BaseService {
    constructor() {
        super({
            serviceName: 'resume-ai',
            baseURL: process.env.RESUME_AI_SERVICE_URL || 'http://localhost:3003',
            timeout: 30000,
            retries: 3,
            retryInterval: 1000,
        })
    }

    /**
     * 检查候选人简历是否满足投递要求
     */
    async getJobSubmissionReadiness(candidateId) {
        return this.get(
            '/api/v1/resume-ai/job-submission-readiness',
            {},
            {
                headers: {
                    'x-user-id': candidateId,
                },
            },
        )
    }
}

export default new ResumeAiService()
