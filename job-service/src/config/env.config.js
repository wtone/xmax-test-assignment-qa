/**
 * 环境变量配置（支持向后兼容）
 * @module config/env
 */

/**
 * 获取环境变量值，支持多个候选键名（向后兼容）
 * @param {string[]} keys - 候选键名数组，按优先级排序
 * @param {string} defaultValue - 默认值
 * @returns {string} 环境变量值
 */
const getEnvValue = (keys, defaultValue = '') => {
    for (const key of keys) {
        if (process.env[key]) {
            return process.env[key]
        }
    }
    return defaultValue
}

/**
 * 环境变量配置
 */
export const ENV_CONFIG = {
    // 服务基础配置
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || 3000,
    APP_NAME: getEnvValue(['APP_NAME', 'SERVICE_NAME'], 'xmax-job-service'),

    // MongoDB配置
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/xmax-job',
    MONGODB_OPTIONS_MAX_POOL_SIZE: process.env.MONGODB_OPTIONS_MAX_POOL_SIZE || 10,
    MONGODB_OPTIONS_TIMEOUT: process.env.MONGODB_OPTIONS_TIMEOUT || 5000,
    MONGODB_OPTIONS_RETRIES: process.env.MONGODB_OPTIONS_RETRIES || 3,

    // Redis配置
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    REDIS_PORT: process.env.REDIS_PORT || 6379,
    REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
    REDIS_PREFIX: process.env.REDIS_PREFIX || 'job:',
    REDIS_DB: process.env.REDIS_DB || 0,

    // JWT配置
    JWT_SECRET: process.env.JWT_SECRET || 'your-jwt-secret-key-here',

    // 外部服务URL配置（向后兼容）
    USER_CENTER_URL: process.env.USER_CENTER_URL || 'http://localhost:3001',
    RESUME_SERVICE_URL: process.env.RESUME_SERVICE_URL || 'http://localhost:3002',

    // AI服务URL（支持新旧变量名）
    RESUME_AI_SERVICE_URL: getEnvValue(['RESUME_AI_SERVICE_URL', 'AI_SERVICE_URL'], 'http://localhost:3003'),
    JOB_AI_SERVICE_URL: getEnvValue(['JOB_AI_SERVICE_URL'], 'http://localhost:3006'),

    // 保留旧的AI_SERVICE_URL以确保向后兼容
    AI_SERVICE_URL: getEnvValue(['AI_SERVICE_URL', 'RESUME_AI_SERVICE_URL'], 'http://localhost:3003'),

    OSS_SERVICE_URL: process.env.OSS_SERVICE_URL || 'http://localhost:3004',
    COMPANY_SERVICE_URL: process.env.COMPANY_SERVICE_URL || 'http://localhost:3005',
    INTERVIEW_SERVICE_URL: process.env.INTERVIEW_SERVICE_URL || 'http://localhost:3007',

    // 日志配置
    LOG_LEVEL: process.env.LOG_LEVEL || 'info',
    LOG_DIR: process.env.LOG_DIR || './logs',

    // 分页配置
    DEFAULT_PAGE_SIZE: process.env.DEFAULT_PAGE_SIZE || 20,
    MAX_PAGE_SIZE: process.env.MAX_PAGE_SIZE || 100,

    // 缓存配置
    CACHE_TTL: process.env.CACHE_TTL || 300,
    CACHE_PREFIX: process.env.CACHE_PREFIX || 'job-cache:',

    // 队列配置
    QUEUE_PREFIX: process.env.QUEUE_PREFIX || 'job-queue:',
    QUEUE_RETRY_ATTEMPTS: process.env.QUEUE_RETRY_ATTEMPTS || 3,
    QUEUE_RETRY_DELAY: process.env.QUEUE_RETRY_DELAY || 1000,

    // API路径配置
    API_VERSION: process.env.API_VERSION || 'v1',
    B_SIDE_PATH_PREFIX: process.env.B_SIDE_PATH_PREFIX || 'job-b',
    C_SIDE_PATH_PREFIX: process.env.C_SIDE_PATH_PREFIX || 'job-c',

    // 业务配置
    MAX_APPLICATIONS_PER_JOB: process.env.MAX_APPLICATIONS_PER_JOB || 100,
    OFFER_EXPIRY_DAYS: process.env.OFFER_EXPIRY_DAYS || 7,
    INTERVIEW_TIME_LIMIT: process.env.INTERVIEW_TIME_LIMIT || 3600,

    // API文档
    ENABLE_SWAGGER: process.env.ENABLE_SWAGGER === 'true',

    // 打印配置信息（仅在开发环境）
    printConfig() {
        if (this.NODE_ENV === 'development') {
            console.log('=== Environment Configuration ===')
            console.log('App Name:', this.APP_NAME)
            console.log('Environment:', this.NODE_ENV)
            console.log('Port:', this.PORT)
            console.log('AI Service URLs:')
            console.log('  - Resume AI:', this.RESUME_AI_SERVICE_URL)
            console.log('  - Job AI:', this.JOB_AI_SERVICE_URL)
            console.log('  - Legacy AI (backward compat):', this.AI_SERVICE_URL)
            console.log('================================')
        }
    },

    // 验证必要的环境变量
    validate() {
        const required = ['JWT_SECRET', 'MONGODB_URI']
        const missing = required.filter(key => !process.env[key])

        if (missing.length > 0) {
            console.warn('⚠️  Missing required environment variables:', missing.join(', '))
            console.warn('⚠️  Using default values. Please set these in production!')
        }

        // 提醒使用新的环境变量名
        if (process.env.AI_SERVICE_URL && !process.env.RESUME_AI_SERVICE_URL) {
            console.info('ℹ️  Please consider migrating from AI_SERVICE_URL to RESUME_AI_SERVICE_URL')
        }
    },
}

// 导出辅助函数
export const getEnv = getEnvValue

export default ENV_CONFIG
