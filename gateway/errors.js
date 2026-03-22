// 网关服务错误码定义
const errorCodes = {
    // JWT相关错误 (401xxx)
    TOKEN_MISSING: {
        code: 401001,
        message: 'Access token is required'
    },
    TOKEN_INVALID: {
        code: 401002,
        message: 'Invalid access token'
    },
    TOKEN_EXPIRED: {
        code: 401003,
        message: 'Access token has expired'
    },
    TOKEN_NOT_ACTIVE: {
        code: 401004,
        message: 'Token not active yet'
    },

    // 权限相关错误 (403xxx)
    PERMISSION_DENIED: {
        code: 403001,
        message: 'Permission denied'
    },
    ROLE_REQUIRED: {
        code: 403002,
        message: 'Required role not found'
    },
    RESOURCE_FORBIDDEN: {
        code: 403003,
        message: 'Access to this resource is forbidden'
    },

    // 代理相关错误 (502xxx)
    SERVICE_UNAVAILABLE: {
        code: 502001,
        message: 'Backend service is unavailable'
    },
    SERVICE_TIMEOUT: {
        code: 502002,
        message: 'Backend service timeout'
    },
    PROXY_ERROR: {
        code: 502003,
        message: 'Proxy request failed'
    },

    // 限流相关错误 (429xxx)
    RATE_LIMIT_EXCEEDED: {
        code: 429001,
        message: 'Rate limit exceeded'
    },

    // 通用错误 (500xxx)
    INTERNAL_ERROR: {
        code: 500001,
        message: 'Internal server error'
    },
    VALIDATION_ERROR: {
        code: 500002,
        message: 'Request validation failed'
    }
}

export default errorCodes
