/**
 * 常量定义模块入口
 * @module constants
 */

export * from './error_codes.js'
export * from './job_status.js'
export * from './application_status.js'

// 其他通用常量
export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_PAGE_SIZE: 20,
    MAX_PAGE_SIZE: 100,
}

export const SORT_ORDER = {
    ASC: 'asc',
    DESC: 'desc',
}

export const DEFAULT_SORT = {
    FIELD: 'createdAt',
    ORDER: SORT_ORDER.DESC,
}

export const CACHE_TTL = {
    SHORT: 300, // 5分钟
    MEDIUM: 1800, // 30分钟
    LONG: 3600, // 1小时
    EXTRA_LONG: 86400, // 24小时
}

export const FILE_SIZE_LIMIT = {
    RESUME: 10 * 1024 * 1024, // 10MB
    COMPANY_LOGO: 2 * 1024 * 1024, // 2MB
    ATTACHMENT: 5 * 1024 * 1024, // 5MB
}

export const ALLOWED_FILE_TYPES = {
    RESUME: ['pdf', 'doc', 'docx', 'txt'],
    IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    ATTACHMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'],
}

export const API_VERSION = 'v1'
export const APP_NAME = 'xmax-job-service'

export const PLATFORMS = {
    WEB: 'web',
    MOBILE: 'mobile',
    ADMIN: 'admin',
    API: 'api',
}

export const USER_ROLES = {
    ADMIN: 'admin',
    RECRUITER: 'recruiter',
    EMPLOYER: 'employer',
    CANDIDATE: 'candidate',
    GUEST: 'guest',
}

export const NOTIFICATION_TYPES = {
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
    IN_APP: 'in_app',
}

export const SEARCH_FIELDS = {
    JOB: ['title', 'description', 'requirements', 'company_name', 'location'],
    APPLICATION: ['applicant_name', 'applicant_email', 'resume_content'],
}

export const DATE_FORMAT = {
    DISPLAY: 'YYYY-MM-DD HH:mm:ss',
    API: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
    DATE_ONLY: 'YYYY-MM-DD',
    TIME_ONLY: 'HH:mm:ss',
}

// AI 面试提醒频控
export const AI_INTERVIEW_REMINDER_MAX = 2
export const AI_INTERVIEW_REMINDER_COOLDOWN_MS = 24 * 60 * 60 * 1000

// 低分候选人折叠默认值
export const FOLD_DEFAULT_ENABLED = true
export const FOLD_DEFAULT_THRESHOLD = 50
