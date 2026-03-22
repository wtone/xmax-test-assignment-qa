/**
 * 模型加载器
 * 根据环境决定使用真实模型还是模拟模型
 */

// 检查是否在测试模式
const isTestMode = process.env.USE_MOCK_DB === 'true'

// 动态加载模型
let JobPost, JobApplication, InterviewProcess, ContractOffer, ManualCandidate

if (isTestMode) {
    // 使用模拟模型
    console.log('🧪 Using mock models for testing')

    // 导入模拟模型
    const { JobPostMock } = await import('./mock/job_post_mock.js')

    // 创建简单的模拟模型
    JobPost = JobPostMock

    // 其他模型的简单模拟
    JobApplication = class {
        static async find() {
            return { exec: async () => [] }
        }
        static async findOne() {
            return null
        }
        static async create(data) {
            return data
        }
        static async countDocuments() {
            return 0
        }
    }

    InterviewProcess = class {
        static async find() {
            return { exec: async () => [] }
        }
        static async findOne() {
            return null
        }
        static async create(data) {
            return data
        }
    }

    ContractOffer = class {
        static async find() {
            return { exec: async () => [] }
        }
        static async findOne() {
            return null
        }
        static async create(data) {
            return data
        }
    }

    ManualCandidate = class {
        static async find() {
            return { exec: async () => [] }
        }
        static async findOne() {
            return null
        }
        static async create(data) {
            return data
        }
        static async countDocuments() {
            return 0
        }
    }
} else {
    // 使用真实模型
    console.log('📊 Using real MongoDB models')

    const models = await import('./index.js')
    JobPost = models.JobPost
    JobApplication = models.JobApplication
    InterviewProcess = models.InterviewProcess
    ContractOffer = models.ContractOffer
    ManualCandidate = models.ManualCandidate
}

// 导出模型
export { JobPost, JobApplication, InterviewProcess, ContractOffer, ManualCandidate }
