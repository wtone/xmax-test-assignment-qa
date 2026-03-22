/**
 * 错误定义规约
 *
 * 错误码使用 http code + 三位序号 组合
 * 最终输出的错误码为 ${APPID}${code}
 *
 * 格式：
 * ERROR_NAME: {
 *   code: ${http_code}${序号},
 *   message: 'description'
 * }
 */

export const errorProcess = (codeInfo, argsList = []) => {
    let message = codeInfo?.message
    // 使用 replace 按顺序替换每个 $$ 占位符
    argsList?.forEach((arg = '') => (message = message?.replace('$$', arg)))
    return {
        ...codeInfo,
        message,
    }
}

const errors = {
    // 400 - 客户端错误
    PARAMETER_ERROR: {
        code: 400001,
        message: 'Parameter error: $$',
    },
    MISSING_PARAMETER: {
        code: 400002,
        message: 'Missing required parameter: $$',
    },
    INVALID_PARAMETER_TYPE: {
        code: 400003,
        message: 'Invalid parameter type: $$',
    },
    INVALID_EMAIL_FORMAT: {
        code: 400004,
        message: 'Invalid email format. email: $$',
    },
    INVALID_PASSWORD_FORMAT: {
        code: 400005,
        message: 'Invalid password format, at least 6 characters required',
    },
    WEAK_PASSWORD: {
        code: 400006,
        message: 'Password too weak, should contain uppercase, lowercase, numbers and special characters',
    },
    TUTORIAL_INVALID_ACTION_TYPE: {
        code: 400007,
        message: 'Tutorial action type is required and must be a non-empty string',
    },
    TUTORIAL_ACTION_TYPE_TOO_LONG: {
        code: 400008,
        message: 'Tutorial action type must be 50 characters or less',
    },

    // 401 - 身份验证错误
    UNAUTHORIZED: {
        code: 401001,
        message: 'Unauthorized access',
    },
    INVALID_CREDENTIALS: {
        code: 401002,
        message: 'Invalid username or password',
    },
    TOKEN_EXPIRED: {
        code: 401003,
        message: 'Token expired',
    },
    TOKEN_INVALID: {
        code: 401004,
        message: 'Invalid token',
    },
    TOKEN_MISSING: {
        code: 401005,
        message: 'Missing authentication token',
    },
    MISSING_AUTH_BEARER_HEADER: {
        code: 401012,
        message: 'Missing Authorization Bearer header',
    },
    INVALID_ACCESS_TOKEN: {
        code: 401006,
        message: 'Invalid access token',
    },
    REFRESH_TOKEN_INVALID: {
        code: 401007,
        message: 'Invalid refresh token',
    },
    REFRESH_TOKEN_EXPIRED: {
        code: 401008,
        message: 'Refresh token expired',
    },
    ACCOUNT_LOCKED: {
        code: 401009,
        message: 'Account locked, please try again later',
    },
    TOO_MANY_LOGIN_ATTEMPTS: {
        code: 401010,
        message: 'Too many login attempts, account temporarily locked',
    },
    AUTH_FAILED: {
        code: 401011,
        message: 'Authentication failed: $$',
    },

    // 403 - 权限错误
    FORBIDDEN: {
        code: 403001,
        message: 'Access forbidden',
    },
    INSUFFICIENT_PERMISSIONS: {
        code: 403002,
        message: 'Insufficient permissions: $$',
    },
    ROLE_REQUIRED: {
        code: 403003,
        message: 'Role required: $$',
    },
    SYSTEM_ROLE_OPERATION_DENIED: {
        code: 403004,
        message: 'Cannot operate system roles',
    },
    SYSTEM_PERMISSION_OPERATION_DENIED: {
        code: 403005,
        message: 'Cannot operate system permissions',
    },
    USER_INACTIVE: {
        code: 403006,
        message: 'User status abnormal, unable to login',
    },
    FEATURE_NOT_AVAILABLE: {
        code: 403007,
        message: 'This feature is not currently available',
    },

    // 404 - 资源未找到
    USER_NOT_FOUND: {
        code: 404001,
        message: 'User not found: $$',
    },
    ROLE_NOT_FOUND: {
        code: 404002,
        message: 'Role not found: $$',
    },
    PERMISSION_NOT_FOUND: {
        code: 404003,
        message: 'Permission not found: $$',
    },
    RESOURCE_NOT_FOUND: {
        code: 404004,
        message: 'Resource not found: $$',
    },

    // 409 - 冲突错误
    USER_ALREADY_EXISTS: {
        code: 409001,
        message: 'User already exists: $$',
    },
    EMAIL_ALREADY_EXISTS: {
        code: 409002,
        message: 'Email already registered: $$',
    },
    USERNAME_ALREADY_EXISTS: {
        code: 409003,
        message: 'Username already taken: $$',
    },
    ROLE_ALREADY_EXISTS: {
        code: 409004,
        message: 'Role already exists: $$',
    },
    PERMISSION_ALREADY_EXISTS: {
        code: 409005,
        message: 'Permission already exists: $$',
    },
    TUTORIAL_ACTION_ALREADY_COMPLETED: {
        code: 409006,
        message: 'Tutorial action already completed: $$',
    },

    // 422 - 请求格式错误
    VALIDATION_ERROR: {
        code: 422001,
        message: 'Data validation failed: $$',
    },
    DUPLICATE_ENTRY: {
        code: 422002,
        message: 'Duplicate data entry: $$',
    },
    VERIFICATION_CODE_INVALID: {
        code: 422003,
        message: 'Verification code invalid or expired',
    },
    VERIFICATION_CODE_EXPIRED: {
        code: 422004,
        message: 'Verification code expired',
    },

    // 429 - 请求过多
    TOO_MANY_REQUESTS: {
        code: 429001,
        message: 'Too many requests, please try again later',
    },
    RATE_LIMIT_EXCEEDED: {
        code: 429002,
        message: 'Rate limit exceeded: $$',
    },
    EMAIL_RATE_LIMIT_EXCEEDED: {
        code: 429003,
        message: 'Email sending too frequent, please try again later',
    },

    // 500 - 服务器错误
    INTERNAL_SERVER_ERROR: {
        code: 500001,
        message: 'Internal server error',
    },
    DATABASE_ERROR: {
        code: 500002,
        message: 'Database operation failed',
    },
    REDIS_ERROR: {
        code: 500003,
        message: 'Redis operation failed',
    },
    JWT_GENERATION_ERROR: {
        code: 500004,
        message: 'JWT generation failed',
    },
    EMAIL_SEND_ERROR: {
        code: 500005,
        message: 'Email sending failed',
    },
    EMAIL_SEND_FAILED: {
        code: 500010,
        message: 'Email sending failed: $$',
    },
    HASH_ERROR: {
        code: 500006,
        message: 'Password hashing failed',
    },
    UNKNOWN_ERROR: {
        code: 500007,
        message: 'Unknown error',
    },
    REGISTER_FAILED: {
        code: 500008,
        message: 'User registration failed: $$',
    },
    LOGIN_FAILED: {
        code: 500009,
        message: 'User login failed: $$',
    },
    TUTORIAL_DATABASE_ERROR: {
        code: 500011,
        message: 'Tutorial database operation failed: $$',
    },
    TUTORIAL_INTERNAL_ERROR: {
        code: 500012,
        message: 'Tutorial operation failed unexpectedly: $$',
    },
    INVALID_REFRESH_TOKEN: {
        code: 401010,
        message: 'Refresh token invalid or expired',
    },

    // 503 - 服务不可用
    SERVICE_UNAVAILABLE: {
        code: 503001,
        message: 'Service temporarily unavailable',
    },
    DATABASE_UNAVAILABLE: {
        code: 503002,
        message: 'Database connection unavailable',
    },
    REDIS_UNAVAILABLE: {
        code: 503003,
        message: 'Redis connection unavailable',
    },

    // 504 - 网关超时
    TIMEOUT: {
        code: 504001,
        message: 'Request timeout: $$',
    },
}

// 导出错误对象和处理函数
export default {
    ...errors,
    errorProcess,
}
