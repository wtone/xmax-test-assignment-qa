/**
 * 职位服务错误码定义
 * @module constants/error_codes
 */

export const ERROR_CODES = {
    // 通用错误 (1000-1999)
    INVALID_PARAMS: { code: 1001, message: 'Invalid parameters' },
    UNAUTHORIZED: { code: 1002, message: 'Unauthorized access' },
    FORBIDDEN: { code: 1003, message: 'Forbidden' },
    NOT_FOUND: { code: 1004, message: 'Resource not found' },
    INTERNAL_ERROR: { code: 1005, message: 'Internal server error' },
    VALIDATION_ERROR: { code: 1006, message: 'Validation failed' },
    DUPLICATE_ERROR: { code: 1007, message: 'Data already exists' },

    // 职位相关错误 (2000-2999)
    JOB_NOT_FOUND: { code: 2001, message: 'Job not found' },
    JOB_CREATE_FAILED: { code: 2002, message: 'Failed to create job' },
    JOB_UPDATE_FAILED: { code: 2003, message: 'Failed to update job' },
    JOB_DELETE_FAILED: { code: 2004, message: 'Failed to delete job' },
    JOB_ALREADY_CLOSED: { code: 2005, message: 'Job already closed' },
    JOB_ALREADY_EXISTS: { code: 2006, message: 'Job already exists' },
    JOB_STATUS_INVALID: { code: 2007, message: 'Invalid job status' },
    JOB_QUOTA_EXCEEDED: { code: 2008, message: 'Job quota exceeded' },

    // 申请相关错误 (3000-3999)
    APPLICATION_NOT_FOUND: { code: 3001, message: 'Application not found' },
    APPLICATION_CREATE_FAILED: { code: 3002, message: 'Failed to create application' },
    APPLICATION_UPDATE_FAILED: { code: 3003, message: 'Failed to update application' },
    APPLICATION_DELETE_FAILED: { code: 3004, message: 'Failed to delete application' },
    APPLICATION_ALREADY_EXISTS: { code: 3005, message: 'Already applied for this job' },
    APPLICATION_STATUS_INVALID: { code: 3006, message: 'Invalid application status' },
    APPLICATION_NOT_ALLOWED: { code: 3007, message: 'Not allowed to apply for this job' },
    APPLICATION_EXPIRED: { code: 3008, message: 'Job application expired' },
    RESUME_NOT_FOUND: { code: 3009, message: 'Resume not found' },
    DUPLICATE_APPLICATION: { code: 3010, message: 'Duplicate application' },
    INVALID_STATUS: { code: 3011, message: 'Invalid status' },
    REMINDER_LIMIT_EXCEEDED: { code: 3012, message: 'Reminder limit exceeded' },
    REMINDER_COOLDOWN: { code: 3013, message: 'Reminder cooldown period' },
    APPLICATION_ACTION_UPDATE_FAILED: { code: 3101, message: 'Failed to update user action', httpStatus: 500 },

    // 公司相关错误 (4000-4999)
    COMPANY_NOT_FOUND: { code: 4001, message: 'Company not found' },
    COMPANY_NOT_VERIFIED: { code: 4002, message: 'Company not verified' },
    COMPANY_BLOCKED: { code: 4003, message: 'Company blocked' },
    COMPANY_INFO_INCOMPLETE: { code: 4004, message: 'Company information incomplete' },

    // 权限相关错误 (5000-5999)
    NO_PERMISSION: { code: 5001, message: 'No permission to perform this operation' },
    ROLE_NOT_ALLOWED: { code: 5002, message: 'Insufficient role permissions' },
    RESOURCE_ACCESS_DENIED: { code: 5003, message: 'Resource access denied' },
    COMPANY_ASSOCIATION_REQUIRED: { code: 5501, message: 'Company association required for B-end users' },
    COMPANY_ASSOCIATION_INVALID: { code: 5502, message: 'Invalid company association information' },

    // 协作相关错误 (7000-7099)
    COLLABORATOR_ALREADY_EXISTS: { code: 7001, message: 'User is already a collaborator' },
    COLLABORATOR_NOT_FOUND: { code: 7002, message: 'Collaborator not found' },
    CANNOT_REMOVE_OWNER: { code: 7003, message: 'Cannot remove the job owner' },
    COLLABORATOR_SELF_ADD: { code: 7004, message: 'Cannot add yourself as collaborator' },
    USER_NOT_IN_COMPANY: { code: 7005, message: 'Target user is not in the same company' },

    // 外部服务错误 (6000-6999)
    USER_SERVICE_ERROR: { code: 6001, message: 'User service call failed' },
    RESUME_SERVICE_ERROR: { code: 6002, message: 'Resume service call failed' },
    OSS_SERVICE_ERROR: { code: 6003, message: 'Storage service call failed' },
    AI_SERVICE_ERROR: { code: 6004, message: 'AI service call failed' },
    NOTIFICATION_SERVICE_ERROR: { code: 6005, message: 'Notification service call failed' },
    EXTERNAL_SERVICE_TIMEOUT: { code: 6006, message: 'External service timeout' },
    SERVICE_UNAVAILABLE: { code: 6007, message: 'Service temporarily unavailable' },
}

/**
 * 根据错误码获取错误信息
 * @param {number} code - 错误码
 * @returns {Object} 错误对象
 */
export const getErrorByCode = code => {
    const error = Object.values(ERROR_CODES).find(err => err.code === code)
    return error || ERROR_CODES.INTERNAL_ERROR
}

/**
 * 创建标准错误响应
 * @param {Object} errorCode - 错误码对象
 * @param {string} [detail] - 错误详情
 * @returns {Object} 错误响应对象
 */
export const createErrorResponse = (errorCode, detail = null) => {
    return {
        success: false,
        error: {
            code: errorCode.code,
            message: errorCode.message,
            detail: detail || undefined,
        },
    }
}

export default ERROR_CODES
