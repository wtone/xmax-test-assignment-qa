/**
 * 通用常量定义
 */

export { ERROR_CODES } from '../src/constants/error_codes.js'
export { JOB_STATUS } from '../src/constants/job_status.js'
export { APPLICATION_STATUS } from '../src/constants/application_status.js'

// 其他常量
export const ROLES = {
    CANDIDATE: 'C_USER',
    ENTERPRISE: 'B_USER',
    ADMIN: 'ADMIN',
}

export const PERMISSIONS = {
    // 职位权限
    JOB_CREATE: 'job:create',
    JOB_READ: 'job:read',
    JOB_UPDATE: 'job:update',
    JOB_DELETE: 'job:delete',
    JOB_PUBLISH: 'job:publish',
    JOB_MANAGE: 'job:manage',

    // 申请权限
    APPLICATION_CREATE: 'application:create',
    APPLICATION_READ: 'application:read',
    APPLICATION_UPDATE: 'application:update',
    APPLICATION_READ_OWN: 'application:read:own',
    APPLICATION_UPDATE_OWN: 'application:update:own',

    // 合同权限
    CONTRACT_CREATE: 'contract:create',
    CONTRACT_READ: 'contract:read',
    CONTRACT_UPDATE: 'contract:update',
    CONTRACT_READ_OWN: 'contract:read:own',
    CONTRACT_UPDATE_OWN: 'contract:update:own',
}

export const CONTRACT_STATUS = {
    DRAFT: 'draft',
    SENT: 'sent',
    VIEWED: 'viewed',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    EXPIRED: 'expired',
    WITHDRAWN: 'withdrawn',
}

export const QUEUE_NAMES = {
    EMAIL: 'email_queue',
    SMS: 'sms_queue',
    NOTIFICATION: 'notification_queue',
    INTERVIEW_REMINDER: 'interview_reminder_queue',
    APPLICATION_UPDATE: 'application_update_queue',
}
