import bcryptjs from 'bcryptjs'
import User from '../models/User.js'
import Role from '../models/Role.js'
import JWTService from '../libs/jwt.js'
import EmailService from '../services/emailService.js'
import errors, { errorProcess } from '../errors.js'
import { USER_STATUS, USER_TYPE, LOGIN_PLATFORM } from '../libs/constants.js'
import { LANGUAGES } from '../libs/emailTemplates.js'
import { setRefreshTokenCookie, clearRefreshTokenCookie, getRefreshTokenFromCookie } from '../libs/cookie.js'
import { getEmployeeCompanyInfo } from '../clients/servers/company.js'

const jwtService = new JWTService()
const emailService = new EmailService()

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: User registration
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               userType:
 *                 type: string
 *                 enum: [C, B]
 *                 default: C
 *                 description: 用户类型 - C端用户(工程师) 或 B端用户(企业)
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android, desktop, api]
 *                 default: web
 *     responses:
 *       200:
 *         description: Registration successful. Access token is provided for immediate use.
 */
const register = async ctx => {
    ctx.logger.info('Starting user registration process', {
        operation: 'user_register_start',
        timestamp: new Date().toISOString(),
    })

    const username = ctx.validateBody('username').optional().val()
    const email = ctx.validateBody('email').optional().isEmail('Invalid email format').val()
    const password = ctx.validateBody('password').optional().defaultTo('').val()

    // 验证username和email至少填写一个
    if (!username && !email) {
        ctx.logger.warn('Registration failed - both username and email are empty', {
            operation: 'user_register_missing_credentials',
        })
        return ctx.error(errorProcess(errors.MISSING_PARAMETER, ['username or email']))
    }

    // 验证身份验证方式：如果只提供用户名而没有邮箱，必须提供密码
    if (username && !email && !password) {
        ctx.logger.warn('Registration failed - username only registration requires password', {
            operation: 'user_register_username_requires_password',
            username,
        })
        return ctx.error(errorProcess(errors.VALIDATION_ERROR, ['Username-only registration requires a password for authentication']))
    }

    // 如果提供了密码，验证密码长度
    if (password && (password.length < 6 || password.length > 50)) {
        ctx.logger.warn('Registration failed - invalid password length', {
            operation: 'user_register_invalid_password',
            passwordLength: password.length,
        })
        return ctx.error(errorProcess(errors.VALIDATION_ERROR, ['Password length should be between 6-50 characters']))
    }

    const userType = ctx.validateBody('userType').optional().isIn(Object.values(USER_TYPE)).defaultTo(USER_TYPE.C_END).val()
    const platform = ctx.validateBody('platform').optional().isIn(Object.values(LOGIN_PLATFORM)).defaultTo(LOGIN_PLATFORM.WEB).val()
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()

    ctx.logger.info('Registration parameters validated', {
        operation: 'user_register_params',
        username,
        email,
        hasPassword: !!password,
        passwordLength: password ? password.length : 0,
        userType,
        platform,
        language,
    })

    // Check if user already exists
    const existingUserQuery = []
    if (username) {
        existingUserQuery.push({ username })
    }
    if (email) {
        existingUserQuery.push({ email })
    }

    if (existingUserQuery.length > 0) {
        const existingUser = await User.findOne({
            $or: existingUserQuery,
        })

        if (existingUser) {
            const isEmailConflict = email && existingUser.email === email
            const isUsernameConflict = username && existingUser.username === username

            ctx.logger.warn('User registration failed - user already exists', {
                operation: 'user_register_user_exists',
                existingUserField: isEmailConflict ? 'email' : 'username',
                existingUserId: existingUser._id,
                conflictType: isEmailConflict ? 'email' : 'username',
            })

            if (isEmailConflict) {
                return ctx.error(errorProcess(errors.EMAIL_ALREADY_EXISTS, [email]))
            } else {
                return ctx.error(errorProcess(errors.USERNAME_ALREADY_EXISTS, [username]))
            }
        }
    }

    // Check email sending rate limit (only if email is provided)
    if (email) {
        const canSendEmail = await emailService.checkRateLimit(email, 'registration')
        if (!canSendEmail) {
            ctx.logger.warn('Registration email rate limit exceeded', {
                operation: 'user_register_rate_limit_exceeded',
                email,
            })
            return ctx.error(errorProcess(errors.RATE_LIMIT_EXCEEDED, ['email sending']))
        }
    }

    ctx.logger.info('User does not exist, creating user', {
        operation: 'user_register_create_user',
        username,
        email,
        platform,
    })

    // Create user - password will be automatically encrypted by User model pre-save middleware
    const userData = {
        password, // password 已经默认为空字符串
        type: userType,
        status: USER_STATUS.ACTIVE,
        lastLoginPlatform: platform,
        emailVerified: false, // 需要邮箱验证
    }

    // 只有当 username 存在时才设置 username 字段，避免空字符串唯一索引冲突
    if (username) {
        userData.username = username
    }

    // 只有当 email 存在时才设置 email 字段，避免 null 值唯一索引冲突
    if (email) {
        userData.email = email
    }

    const user = new User(userData)

    await user.save()

    // Assign default role based on user type
    try {
        const defaultRoles = await Role.getDefaultRoles(userType)
        if (defaultRoles && defaultRoles.length > 0) {
            user.roles = defaultRoles.map(role => role._id)
            await user.save()
            ctx.logger.info('Default role assigned to new user', {
                operation: 'user_register_role_assigned',
                userId: user._id,
                userType,
                assignedRoles: defaultRoles.map(r => r.name),
            })
        } else {
            ctx.logger.warn('No default role found for user type', {
                operation: 'user_register_no_default_role',
                userId: user._id,
                userType,
            })
        }
    } catch (roleError) {
        ctx.logger.error('Failed to assign default role to new user', {
            operation: 'user_register_role_assignment_failed',
            userId: user._id,
            userType,
            error: roleError.message,
        })
        // Don't fail registration if role assignment fails
    }

    ctx.logger.info('User created successfully, sending verification email', {
        operation: 'user_register_user_created',
        userId: user._id,
        username: user.username,
        email: user.email,
    })

    // Send registration verification email (only if email is provided)
    if (email) {
        try {
            await emailService.sendRegistrationEmail(email, username || 'User', language, userType)

            ctx.logger.info('Registration verification email sent', {
                operation: 'user_register_email_sent',
                userId: user._id,
                email,
                userType,
            })
        } catch (emailError) {
            ctx.logger.error('Failed to send registration email', {
                operation: 'user_register_email_failed',
                userId: user._id,
                email,
                error: emailError.message,
            })
            // Don't fail registration if email fails
        }
    }

    // 生成access token用于注册后直接使用
    const { accessToken, refreshToken, accessTokenExpiryAt, refreshTokenExpiryAt } = await jwtService.generateTokenPair(user, {
        platform: platform,
        deviceId: ctx.request.header['user-agent'] || 'unknown-device',
    })

    // 设置refreshToken为HTTP-only cookie
    setRefreshTokenCookie(ctx, refreshToken)

    ctx.logger.info('User registration successful with access token generated', {
        operation: 'user_register_success',
        userId: user._id,
        username: user.username,
        email: user.email,
        accessTokenGenerated: true,
    })

    ctx.success({
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            userType: user.type,
            status: user.status,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
        },
        accessToken,
        accessTokenExpiryAt,
        refreshTokenExpiryAt,
        message: '注册成功！您可以立即开始使用，建议验证邮箱地址以获得完整功能。',
    })
}

/**
 * @swagger
 * /api/v1/auth/login-with-psw:
 *   post:
 *     summary: User login with password
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android, desktop, api]
 *                 default: web
 *     responses:
 *       200:
 *         description: Login successful. RefreshToken is set as HTTP-only cookie.
 */
const login = async ctx => {
    ctx.logger.info('Starting user login process', {
        operation: 'user_login_start',
        timestamp: new Date().toISOString(),
    })

    const email = ctx.validateBody('email').isEmail('Invalid email format').val()
    const password = ctx.validateBody('password').required('Password cannot be empty').val()
    const platform = ctx.validateBody('platform').optional().isIn(Object.values(LOGIN_PLATFORM)).defaultTo(LOGIN_PLATFORM.WEB).val()

    // const { email, password, platform } = ctx.request.body

    ctx.logger.info('Login parameters validated', {
        operation: 'user_login_params_validated',
        email,
        platform,
    })

    // Find user
    const user = await User.findOne({ email }).select('+password')
    if (!user) {
        ctx.logger.warn('Login failed - user not found', {
            operation: 'user_login_user_not_found',
            email,
        })
        return ctx.error(errorProcess(errors.INVALID_CREDENTIALS))
    }

    ctx.logger.info('User found, starting password verification', {
        operation: 'user_login_user_found',
        userId: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
    })

    // Verify password
    if (!user.password) {
        ctx.logger.warn('Login failed - user has no password, please use email verification code to login', {
            operation: 'user_login_no_password',
            userId: user._id,
            email: user.email,
        })
        return ctx.error(errorProcess(errors.AUTH_FAILED, ['用户没有设置密码，请使用邮箱验证码登录']))
    }

    const isPasswordValid = await bcryptjs.compare(password, user.password)
    if (!isPasswordValid) {
        ctx.logger.warn('Login failed - invalid password', {
            operation: 'user_login_invalid_password',
            userId: user._id,
            email: user.email,
        })
        return ctx.error(errorProcess(errors.INVALID_CREDENTIALS))
    }

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Login failed - user status abnormal', {
            operation: 'user_login_user_inactive',
            userId: user._id,
            email: user.email,
            status: user.status,
        })
        return ctx.error(errorProcess(errors.ACCOUNT_LOCKED))
    }

    ctx.logger.info('Password verified, updating last login time and platform', {
        operation: 'user_login_password_verified',
        userId: user._id,
        platform,
    })

    // Update last login time and platform (异步执行，不阻塞主流程)
    const clientIP = ctx.request.ip || ctx.request.header['x-forwarded-for'] || ctx.request.header['x-real-ip'] || 'unknown'

    // 异步更新登录信息，不等待结果
    user.updateLoginInfo(clientIP, platform)
        .then(() => {
            ctx.logger.info('Login info updated successfully', {
                operation: 'user_login_update_complete',
                userId: user._id,
            })
        })
        .catch(error => {
            ctx.logger.error('Failed to update login info', {
                operation: 'user_login_update_failed',
                userId: user._id,
                error: error.message,
            })
        })

    // Send login notification email (async, don't wait for it)
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()
    // Note: Login notification email is commented out for now as it may be too frequent
    // emailService.sendLoginNotificationEmail(user.email, user.username, {
    //     loginTime: new Date().toLocaleString(language === LANGUAGES.CN ? 'zh-CN' : 'en-US', {
    //         timeZone: 'Asia/Shanghai',
    //     }),
    //     platform,
    //     ip: clientIP,
    // }, language).catch(error => {
    //     ctx.logger.error('Failed to send login notification email', {
    //         operation: 'user_login_notification_email_failed',
    //         userId: user._id,
    //         email: user.email,
    //         error: error.message,
    //     })
    // })

    // 获取公司ID（仅B端用户）
    const companyId = await getEmployeeCompanyInfo(user, ctx, 'user_login')

    // Generate tokens with platform info - all strategy logic is handled inside generateTokenPair
    const { accessToken, refreshToken, accessTokenExpiryAt, refreshTokenExpiryAt } = await jwtService.generateTokenPair(user, {
        platform: platform,
        deviceId: ctx.request.header['user-agent'] || 'unknown-device',
        companyId: companyId,
    })

    ctx.logger.info('User login successful', {
        operation: 'user_login_success',
        userId: user._id,
        username: user.username,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        platform: user.lastLoginPlatform,
    })

    // Set refreshToken as HTTP-only cookie
    setRefreshTokenCookie(ctx, refreshToken)

    // Populate roles to get role names
    await user.populate('roles', 'name description')

    ctx.success({
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            type: user.type, // C 或 B 端用户
            status: user.status,
            profile: user.profile || {},
            emailVerified: user.emailVerified || false,
            phoneVerified: user.phoneVerified || false,
            roles: user.roles
                ? user.roles.map(role => ({
                      id: role._id,
                      name: role.name,
                      description: role.description,
                  }))
                : [],
            lastLoginAt: user.lastLoginAt,
            lastLoginPlatform: user.lastLoginPlatform,
            loginCount: user.loginCount || 0,
        },
        accessToken,
        accessTokenExpiryAt,
        refreshTokenExpiryAt,
        // refreshToken removed from response body as it's now in cookie
    })
}

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     description: RefreshToken can be provided via request body or HTTP-only cookie. When both are present, request body takes priority.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 required: false
 *                 default: ''
 *                 description: Optional - If provided in body, it will be used first. Falls back to cookie if not provided.
 *     responses:
 *       200:
 *         description: Refresh successful. New refreshToken is set as HTTP-only cookie.
 */
const refreshToken = async ctx => {
    ctx.logger.info('Starting token refresh process', {
        operation: 'token_refresh_start',
        timestamp: new Date().toISOString(),
    })

    // Try to get refreshToken from request body first, fallback to cookie
    let refreshTokenValue = ctx.validateBody('refreshToken').optional().val()
    if (!refreshTokenValue) {
        refreshTokenValue = getRefreshTokenFromCookie(ctx)
    }

    if (!refreshTokenValue) {
        ctx.logger.warn('Refresh token not provided', {
            operation: 'token_refresh_missing_token',
        })
        return ctx.error(errorProcess(errors.REFRESH_TOKEN_INVALID))
    }

    const token = refreshTokenValue

    ctx.logger.info('Starting refresh token verification', {
        operation: 'token_refresh_verify_token',
    })

    // Verify refresh token
    const payload = jwtService.verifyRefreshToken(token)
    if (!payload) {
        ctx.logger.warn('Refresh token verification failed - invalid token', {
            operation: 'token_refresh_invalid_token',
        })
        return ctx.error(errorProcess(errors.REFRESH_TOKEN_INVALID))
    }

    ctx.logger.info('Refresh token verified, checking token validity', {
        operation: 'token_refresh_token_verified',
        userId: payload.userId,
    })

    // Check token validity with automatic self-healing
    const isValid = await jwtService.isRefreshTokenValid(token, payload.userId)
    if (!isValid) {
        ctx.logger.warn('Refresh token invalid or revoked', {
            operation: 'token_refresh_token_revoked',
            userId: payload.userId,
        })
        return ctx.error(errorProcess(errors.REFRESH_TOKEN_INVALID))
    }
    
    // Find user for generating new access token
    const user = await User.findById(payload.userId)
    if (!user || user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Token refresh failed - user not found or inactive', {
            operation: 'token_refresh_user_invalid',
            userId: payload.userId,
            userExists: !!user,
            userStatus: user?.status,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [payload.userId]))
    }

    ctx.logger.info('User verified, generating new access token based on provided refresh token', {
        operation: 'token_refresh_generate_access_token',
        userId: user._id,
    })

    // 🔑 Refresh接口的核心逻辑：基于用户提供的特定refresh_token生成新的access_token
    // 不应该查找数据库中的其他token，严格按照JWT标准执行

    // 获取公司ID（仅B端用户）
    const companyId = await getEmployeeCompanyInfo(user, ctx, 'token_refresh')

    // 只生成新的access_token，refresh_token保持不变
    // generateAccessToken内部已处理时间计算和Redis存储
    const { accessToken, accessTokenExpiryAt } = await jwtService.generateAccessToken(user, {
        platform: user.lastLoginPlatform || 'web',
        deviceId: ctx.request.header['user-agent'] || 'unknown-device',
        companyId: companyId,
    })

    // 直接从JWT payload中获取过期时间（无需查询MongoDB）
    const refreshTokenExpiryAt = new Date(payload.exp * 1000).toISOString()

    ctx.logger.info('Token refresh successful - new access token generated', {
        operation: 'token_refresh_success',
        userId: user._id,
        refreshTokenExpiryAt,
        providedTokenUsed: true, // 明确表示使用了用户提供的token
    })

    // 保持refresh_token不变，不需要重新设置cookie
    // 因为用户提供的refresh_token仍然有效，继续使用

    ctx.success({
        accessToken,
        accessTokenExpiryAt,
        refreshTokenExpiryAt,
        // refreshToken removed from response body as it's now in cookie and unchanged
    })
}

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: User logout
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     description: RefreshToken can be provided via HTTP-only cookie or request body
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Optional - can be provided in cookie instead
 *     responses:
 *       200:
 *         description: Logout successful. RefreshToken cookie is cleared.
 */
const logout = async ctx => {
    ctx.logger.info('Starting user logout process', {
        operation: 'user_logout_start',
        userId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    // Try to get refreshToken from cookie first, fallback to request body
    let refreshTokenValue = getRefreshTokenFromCookie(ctx)
    if (!refreshTokenValue) {
        refreshTokenValue = ctx.validateBody('refreshToken').required('Refresh token cannot be empty').val()
    }

    if (!refreshTokenValue) {
        ctx.logger.warn('Refresh token not provided for logout', {
            operation: 'user_logout_missing_token',
        })
        return ctx.error(errorProcess(errors.REFRESH_TOKEN_INVALID))
    }

    const userId = ctx.state.user.id

    // Extract current access token from Authorization header
    const authHeader = ctx.headers.authorization
    const currentAccessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null

    // Get user object for MongoDB operations
    const user = await User.findById(userId)

    ctx.logger.info('Starting token revocation', {
        operation: 'user_logout_revoke_tokens',
        userId,
        hasAccessToken: !!currentAccessToken,
        hasUser: !!user,
    })

    // Revoke both refresh token and current access token
    await Promise.all([
        jwtService.revokeRefreshToken(refreshTokenValue, userId, user),
        currentAccessToken ? jwtService.revokeAccessToken(currentAccessToken, userId) : Promise.resolve(),
    ])

    // Clear the refreshToken cookie
    clearRefreshTokenCookie(ctx)

    ctx.logger.info('User logout successful', {
        operation: 'user_logout_success',
        userId,
    })

    ctx.success({ message: 'Logout successful' })
}

/**
 * @swagger
 * /api/v1/auth/verify-token:
 *   post:
 *     summary: Verify access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token valid
 */
const verifyToken = async ctx => {
    ctx.logger.info('Starting token verification process', {
        operation: 'token_verify_start',
        timestamp: new Date().toISOString(),
    })

    const token = ctx.validateBody('token').required('Token cannot be empty').val()

    // const { token } = ctx.request.body

    ctx.logger.info('Starting access token verification', {
        operation: 'token_verify_validate_token',
    })

    // 使用异步验证访问令牌
    const payload = await jwtService.verifyAccessToken(token)
    if (!payload) {
        ctx.logger.warn('Access token verification failed - invalid token', {
            operation: 'token_verify_invalid_token',
        })
        return ctx.error(errorProcess(errors.TOKEN_INVALID))
    }

    ctx.logger.info('Access token verified, finding user', {
        operation: 'token_verify_token_valid',
        userId: payload.userId,
    })

    // Find user
    const user = await User.findById(payload.userId)
    if (!user || user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Token verification failed - user not found or inactive', {
            operation: 'token_verify_user_invalid',
            userId: payload.userId,
            userExists: !!user,
            userStatus: user?.status,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [payload.userId]))
    }

    ctx.logger.info('Token verification successful', {
        operation: 'token_verify_success',
        userId: user._id,
        username: user.username,
        email: user.email,
    })

    ctx.success({
        valid: true,
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            status: user.status,
        },
    })
}

/**
 * @swagger
 * /api/v1/auth/revoke-all-tokens:
 *   post:
 *     summary: Revoke all user tokens (force logout from all devices)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     responses:
 *       200:
 *         description: All tokens revoked successfully
 */
const revokeAllTokens = async ctx => {
    ctx.logger.info('Starting revoke all tokens process', {
        operation: 'revoke_all_tokens_start',
        userId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    const userId = ctx.state.user.id

    // Get user object for MongoDB operations
    const user = await User.findById(userId)

    ctx.logger.info('Revoking all user tokens', {
        operation: 'revoke_all_tokens_process',
        userId,
        hasUser: !!user,
    })

    // 撤销用户所有令牌
    const success = await jwtService.revokeAllTokens(userId, user)

    if (!success) {
        ctx.logger.error('Failed to revoke all tokens', {
            operation: 'revoke_all_tokens_failed',
            userId,
        })
        return ctx.error(errorProcess(errors.INTERNAL_ERROR))
    }

    ctx.logger.info('All tokens revoked successfully', {
        operation: 'revoke_all_tokens_success',
        userId,
    })

    ctx.success({ message: 'All tokens revoked successfully. Please login again.' })
}

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   post:
 *     summary: Change user password and revoke all tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 */
const changePassword = async ctx => {
    ctx.logger.info('Starting change password process', {
        operation: 'change_password_start',
        userId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    const currentPassword = ctx.validateBody('currentPassword').required('Current password cannot be empty').val()
    const newPassword = ctx.validateBody('newPassword').isLength(6, 50, 'New password length should be between 6-50 characters').val()

    // const { currentPassword, newPassword } = ctx.request.body
    const userId = ctx.state.user.id

    // 查找用户并包含密码字段
    const user = await User.findById(userId).select('+password')
    if (!user) {
        ctx.logger.warn('Change password failed - user not found', {
            operation: 'change_password_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    // 验证当前密码
    let isCurrentPasswordValid = false

    // 处理用户没有设置密码的情况（注册时只提供了email）
    if (!user.password || user.password === '') {
        // 如果用户没有密码，则当前密码应该是空字符串
        isCurrentPasswordValid = currentPassword === ''
    } else {
        // 如果用户有密码，则正常进行密码比较
        isCurrentPasswordValid = await bcryptjs.compare(currentPassword, user.password)
    }

    if (!isCurrentPasswordValid) {
        ctx.logger.warn('Change password failed - invalid current password', {
            operation: 'change_password_invalid_current',
            userId,
            hasPassword: !!(user.password && user.password !== ''),
        })
        return ctx.error(errorProcess(errors.INVALID_CREDENTIALS))
    }

    // 更新密码 - User模型的pre('save')中间件会自动加密
    user.password = newPassword
    await user.save()

    // 撤销所有现有令牌，强制重新登录
    await jwtService.revokeAllTokens(userId)

    // Password change success notification is not needed per requirements
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()
    ctx.logger.info('Password changed successfully (no notification email)', {
        operation: 'change_password_no_notification',
        userId,
        email: user.email,
    })

    ctx.logger.info('Password changed successfully', {
        operation: 'change_password_success',
        userId,
    })

    ctx.success({ message: 'Password changed successfully. Please login again.' })
}

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               language:
 *                 type: string
 *                 enum: [en, cn]
 *                 default: en
 *     responses:
 *       200:
 *         description: Password reset email sent
 */
const forgotPassword = async ctx => {
    ctx.logger.info('Starting forgot password process', {
        operation: 'forgot_password_start',
        timestamp: new Date().toISOString(),
    })

    const email = ctx.validateBody('email').isEmail('Invalid email format').val()
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
        ctx.logger.warn('Forgot password failed - user not found', {
            operation: 'forgot_password_user_not_found',
            email,
        })
        // Don't reveal if user exists or not for security
        return ctx.success({ message: '如果该邮箱存在，我们将发送密码重置邮件。' })
    }

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Forgot password failed - user inactive', {
            operation: 'forgot_password_user_inactive',
            userId: user._id,
            status: user.status,
        })
        return ctx.error(errorProcess(errors.ACCOUNT_LOCKED))
    }

    // Check email sending rate limit
    const canSendEmail = await emailService.checkRateLimit(email, 'passwordReset')
    if (!canSendEmail) {
        ctx.logger.warn('Password reset email rate limit exceeded', {
            operation: 'forgot_password_rate_limit_exceeded',
            email,
        })
        return ctx.error(errorProcess(errors.RATE_LIMIT_EXCEEDED))
    }

    try {
        // Send password reset email
        await emailService.sendPasswordResetEmail(email, user.username, language)

        ctx.logger.info('Password reset email sent successfully', {
            operation: 'forgot_password_email_sent',
            userId: user._id,
            email,
        })
    } catch (emailError) {
        ctx.logger.error('Failed to send password reset email', {
            operation: 'forgot_password_email_failed',
            userId: user._id,
            email,
            error: emailError.message,
        })
        return ctx.error(errorProcess(errors.EMAIL_SEND_FAILED, [emailError.message]))
    }

    ctx.success({ message: '密码重置邮件已发送，请检查您的邮箱。' })
}

/**
 * @swagger
 * /api/v1/auth/change-password-with-code:
 *   post:
 *     summary: Change password with verification code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *               - newPassword
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
const resetPassword = async ctx => {
    ctx.logger.info('Starting reset password process', {
        operation: 'reset_password_start',
        timestamp: new Date().toISOString(),
    })

    const email = ctx.validateBody('email').isEmail('Invalid email format').val()
    const code = ctx.validateBody('code').required('Verification code cannot be empty').val()
    const newPassword = ctx.validateBody('newPassword').isLength(6, 50, 'New password length should be between 6-50 characters').val()

    // Verify verification code
    const isCodeValid = await emailService.verifyCode(email, code, 'password_reset')
    if (!isCodeValid) {
        ctx.logger.warn('Reset password failed - invalid verification code', {
            operation: 'reset_password_invalid_code',
            email,
        })
        return ctx.error(errorProcess(errors.VERIFICATION_CODE_INVALID))
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user || user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Reset password failed - user not found or inactive', {
            operation: 'reset_password_user_invalid',
            email,
            userExists: !!user,
            userStatus: user?.status,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [payload.userId]))
    }

    // Update password
    user.password = newPassword
    await user.save()

    // Revoke all existing tokens
    await jwtService.revokeAllTokens(user._id.toString())

    // Password change success notification is not needed per requirements
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()
    ctx.logger.info('Password reset completed (no notification email)', {
        operation: 'reset_password_no_notification',
        userId: user._id,
        email: user.email,
    })

    ctx.logger.info('Password reset successfully', {
        operation: 'reset_password_success',
        userId: user._id,
        email,
    })

    ctx.success({ message: 'Password reset successfully. Please login with your new password.' })
}

/**
 * @swagger
 * /api/v1/auth/verify-email:
 *   post:
 *     summary: Verify email with verification code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - code
 *             properties:
 *               code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 */
const verifyEmail = async ctx => {
    ctx.logger.info('Starting email verification process', {
        operation: 'verify_email_start',
        userId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    const code = ctx.validateBody('code').required('Verification code cannot be empty').val()
    const userId = ctx.state.user.id

    // Find user
    const user = await User.findById(userId)
    if (!user) {
        ctx.logger.warn('Email verification failed - user not found', {
            operation: 'verify_email_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    if (user.emailVerified) {
        ctx.logger.warn('Email verification failed - already verified', {
            operation: 'verify_email_already_verified',
            userId,
            email: user.email,
        })
        return ctx.success({ message: 'Email is already verified.' })
    }

    // Verify registration code (both initial registration and resend use the same type)
    // 验证注册验证码（初始注册和重新发送都使用相同的类型）
    const isCodeValid = await emailService.verifyCode(user.email, code, 'registration')

    if (!isCodeValid) {
        ctx.logger.warn('Email verification failed - invalid code', {
            operation: 'verify_email_invalid_code',
            userId,
            email: user.email,
        })
        return ctx.error(errorProcess(errors.VERIFICATION_CODE_INVALID))
    }

    ctx.logger.info('Email verification code verified', {
        operation: 'verify_email_code_verified',
        userId,
        email: user.email,
    })

    // Update email verification status
    user.emailVerified = true
    await user.save()

    // TODO: Welcome email has been removed per requirements
    // Email verification success is confirmed without sending additional welcome email
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()
    ctx.logger.info('Email verification completed (welcome email disabled)', {
        operation: 'verify_email_no_welcome',
        userId,
        email: user.email,
    })

    ctx.logger.info('Email verified successfully', {
        operation: 'verify_email_success',
        userId,
        email: user.email,
    })

    ctx.success({
        message: 'Email verified successfully.',
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            emailVerified: user.emailVerified,
        },
    })
}

/**
 * @swagger
 * /api/v1/auth/resend-verification:
 *   post:
 *     summary: Resend email verification code
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               language:
 *                 type: string
 *                 enum: [en, cn]
 *                 default: en
 *     responses:
 *       200:
 *         description: Verification email sent
 */
const resendVerification = async ctx => {
    ctx.logger.info('Starting resend verification process', {
        operation: 'resend_verification_start',
        userId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    const userId = ctx.state.user.id
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()

    // Find user
    const user = await User.findById(userId)
    if (!user) {
        ctx.logger.warn('Resend verification failed - user not found', {
            operation: 'resend_verification_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    if (user.emailVerified) {
        ctx.logger.warn('Resend verification failed - already verified', {
            operation: 'resend_verification_already_verified',
            userId,
            email: user.email,
        })
        return ctx.success({ message: 'Email is already verified.' })
    }

    // Check email sending rate limit (use 'registration' type for resend)
    const canSendEmail = await emailService.checkRateLimit(user.email, 'registration')
    if (!canSendEmail) {
        ctx.logger.warn('Email verification rate limit exceeded', {
            operation: 'resend_verification_rate_limit_exceeded',
            userId,
            email: user.email,
        })
        return ctx.error(errorProcess(errors.RATE_LIMIT_EXCEEDED))
    }

    try {
        // Send registration verification email (using REGISTRATION type)
        await emailService.sendRegistrationEmail(user.email, user.username, language, user.userType)

        ctx.logger.info('Verification email resent successfully', {
            operation: 'resend_verification_email_sent',
            userId,
            email: user.email,
        })
    } catch (emailError) {
        ctx.logger.error('Failed to resend verification email', {
            operation: 'resend_verification_email_failed',
            userId,
            email: user.email,
            error: emailError.message,
        })
        return ctx.error(errorProcess(errors.EMAIL_SEND_FAILED, [emailError.message]))
    }

    ctx.success({ message: '验证邮件已重新发送，请检查您的邮箱。' })
}

/**
 * @swagger
 * /api/v1/auth/send-login-code:
 *   post:
 *     summary: Send login verification code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android, desktop, api]
 *                 default: web
 *               language:
 *                 type: string
 *                 enum: [en, cn]
 *                 default: en
 *     responses:
 *       200:
 *         description: Login verification code sent successfully
 */
const sendLoginCode = async ctx => {
    ctx.logger.info('Starting send login code process', {
        operation: 'send_login_code_start',
        timestamp: new Date().toISOString(),
    })

    const email = ctx.validateBody('email').isEmail('Invalid email format').val()
    const platform = ctx.validateBody('platform').optional().isIn(Object.values(LOGIN_PLATFORM)).defaultTo(LOGIN_PLATFORM.WEB).val()
    const language = ctx.validateBody('language').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
        ctx.logger.warn('Send login code failed - user not found', {
            operation: 'send_login_code_user_not_found',
            email,
        })
        // Don't reveal if user exists or not for security
        return ctx.success({ message: '如果该邮箱存在，我们将发送登录验证码。' })
    }

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Send login code failed - user inactive', {
            operation: 'send_login_code_user_inactive',
            userId: user._id,
            status: user.status,
        })
        return ctx.error(errorProcess(errors.ACCOUNT_LOCKED))
    }

    // Check email sending rate limit
    const canSendEmail = await emailService.checkRateLimit(email, 'loginVerification')
    if (!canSendEmail) {
        ctx.logger.warn('Login verification email rate limit exceeded', {
            operation: 'send_login_code_rate_limit_exceeded',
            email,
        })
        return ctx.error(errorProcess(errors.RATE_LIMIT_EXCEEDED))
    }

    const clientIP = ctx.request.ip || ctx.request.header['x-forwarded-for'] || ctx.request.header['x-real-ip'] || 'unknown'
    const loginInfo = {
        loginTime: new Date().toLocaleString(language === LANGUAGES.CN ? 'zh-CN' : 'en-US', {
            timeZone: 'Asia/Shanghai',
        }),
        platform,
        ip: clientIP,
    }

    try {
        // Send login verification email
        await emailService.sendLoginVerificationEmail(email, user.username, loginInfo, language)

        ctx.logger.info('Login verification code sent successfully', {
            operation: 'send_login_code_email_sent',
            userId: user._id,
            email,
        })
    } catch (emailError) {
        ctx.logger.error('Failed to send login verification email', {
            operation: 'send_login_code_email_failed',
            userId: user._id,
            email,
            error: emailError.message,
        })
        return ctx.error(errorProcess(errors.EMAIL_SEND_FAILED, [emailError.message]))
    }

    ctx.success({ message: '登录验证码已发送，请检查您的邮箱。验证码有效期为5分钟。' })
}

/**
 * @swagger
 * /api/v1/auth/login-with-code:
 *   post:
 *     summary: Login with verification code
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - code
 *             properties:
 *               email:
 *                 type: string
 *               code:
 *                 type: string
 *               platform:
 *                 type: string
 *                 enum: [web, ios, android, desktop, api]
 *                 default: web
 *     responses:
 *       200:
 *         description: Login successful. RefreshToken is set as HTTP-only cookie.
 */
const loginWithCode = async ctx => {
    ctx.logger.info('Starting login with code process', {
        operation: 'login_with_code_start',
        timestamp: new Date().toISOString(),
    })

    const email = ctx.validateBody('email').isEmail('Invalid email format').val()
    const code = ctx.validateBody('code').required('Verification code cannot be empty').val()
    const platform = ctx.validateBody('platform').optional().isIn(Object.values(LOGIN_PLATFORM)).defaultTo(LOGIN_PLATFORM.WEB).val()

    ctx.logger.info('Login with code parameters validated', {
        operation: 'login_with_code_params_validated',
        email,
        platform,
    })

    // Verify verification code
    const isCodeValid = await emailService.verifyCode(email, code, 'login_verification')
    if (!isCodeValid) {
        ctx.logger.warn('Login with code failed - invalid verification code', {
            operation: 'login_with_code_invalid_code',
            email,
        })
        return ctx.error(errorProcess(errors.VERIFICATION_CODE_INVALID))
    }

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
        ctx.logger.warn('Login with code failed - user not found', {
            operation: 'login_with_code_user_not_found',
            email,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [email]))
    }

    ctx.logger.info('User found, starting code verification', {
        operation: 'login_with_code_user_found',
        userId: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
    })

    // Check user status
    if (user.status !== USER_STATUS.ACTIVE) {
        ctx.logger.warn('Login with code failed - user status abnormal', {
            operation: 'login_with_code_user_inactive',
            userId: user._id,
            email: user.email,
            status: user.status,
        })
        return ctx.error(errorProcess(errors.ACCOUNT_LOCKED))
    }

    ctx.logger.info('Code verified, updating last login time and platform', {
        operation: 'login_with_code_verified',
        userId: user._id,
        platform,
    })

    // Update last login time and platform (异步执行，不阻塞主流程)
    const clientIP = ctx.request.ip || ctx.request.header['x-forwarded-for'] || ctx.request.header['x-real-ip'] || 'unknown'

    // 异步更新登录信息，不等待结果
    user.updateLoginInfo(clientIP, platform)
        .then(() => {
            ctx.logger.info('Login info updated successfully', {
                operation: 'login_with_code_update_complete',
                userId: user._id,
            })
        })
        .catch(error => {
            ctx.logger.error('Failed to update login info', {
                operation: 'login_with_code_update_failed',
                userId: user._id,
                error: error.message,
            })
        })

    // 获取公司ID（仅B端用户）
    const companyId = await getEmployeeCompanyInfo(user, ctx, 'login_with_code')

    // Generate tokens with platform info
    const { accessToken, refreshToken, accessTokenExpiryAt, refreshTokenExpiryAt } = await jwtService.generateTokenPair(user, {
        platform: platform,
        deviceId: ctx.request.header['user-agent'] || 'unknown-device',
        companyId: companyId,
    })

    ctx.logger.info('User login with code successful', {
        operation: 'login_with_code_success',
        userId: user._id,
        username: user.username,
        email: user.email,
        lastLoginAt: user.lastLoginAt,
        platform: user.lastLoginPlatform,
    })

    // Set refreshToken as HTTP-only cookie
    setRefreshTokenCookie(ctx, refreshToken)

    ctx.success({
        user: {
            id: user._id,
            username: user.username,
            email: user.email,
            status: user.status,
            emailVerified: user.emailVerified,
            lastLoginAt: user.lastLoginAt,
            lastLoginPlatform: user.lastLoginPlatform,
        },
        accessToken,
        accessTokenExpiryAt,
        refreshTokenExpiryAt,
        // refreshToken removed from response body as it's now in cookie
    })
}

/**
 * @swagger
 * /api/v1/auth/verify-email-link:
 *   get:
 *     summary: 通过链接验证邮箱
 *     description: 用户点击邮件中的验证链接自动完成邮箱验证
 *     tags: [Authentication]
 *     parameters:
 *       - name: token
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: 验证令牌
 *       - name: email
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *         description: 用户邮箱
 *       - name: type
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           default: registration
 *         description: 验证类型
 *     responses:
 *       200:
 *         description: 邮箱验证成功，返回HTML页面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: 参数错误或验证令牌无效
 *       404:
 *         description: 用户不存在
 */
const verifyEmailByLink = async ctx => {
    ctx.logger.info('Starting email verification by link', {
        operation: 'verify_email_by_link_start',
        timestamp: new Date().toISOString(),
    })

    const token = ctx.validateQuery('token').required('Token cannot be empty').val()
    const email = ctx.validateQuery('email').isEmail('Invalid email format').val()
    const type = ctx.validateQuery('type').optional().defaultTo('registration').val()

    ctx.logger.info('Email link verification parameters validated', {
        operation: 'verify_email_link_params_validated',
        email,
        type,
        token: token.substring(0, 8) + '...',
    })

    try {
        // 验证令牌
        const isTokenValid = await emailService.verifyToken(token, email, type)
        if (!isTokenValid) {
            ctx.logger.warn('Email link verification failed - invalid or expired token', {
                operation: 'verify_email_link_invalid_token',
                email,
                type,
            })

            // 返回失败页面
            ctx.type = 'text/html'
            ctx.body = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>验证失败 - xMatrix</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .error { color: #e74c3c; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1 class="error">验证链接无效或已过期</h1>
                        <p>很抱歉，此验证链接无效、已过期或已被使用。</p>
                        <p>请重新请求发送验证邮件，或使用邮件中的验证码进行验证。</p>
                        <hr>
                        <p><small>xMatrix</small></p>
                    </div>
                </body>
                </html>
            `
            return
        }

        // 查找用户
        const user = await User.findOne({ email })
        if (!user) {
            ctx.logger.warn('Email link verification failed - user not found', {
                operation: 'verify_email_link_user_not_found',
                email,
            })

            ctx.type = 'text/html'
            ctx.body = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>用户不存在 - xMatrix</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .error { color: #e74c3c; }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">❓</div>
                        <h1 class="error">用户不存在</h1>
                        <p>未找到与此邮箱对应的用户账户。</p>
                        <p>请确认邮箱地址是否正确，或重新注册账户。</p>
                        <hr>
                        <p><small>xMatrix</small></p>
                    </div>
                </body>
                </html>
            `
            return
        }

        // 检查是否已验证
        if (user.emailVerified) {
            ctx.logger.info('Email already verified', {
                operation: 'verify_email_link_already_verified',
                userId: user._id,
                email,
            })

            ctx.type = 'text/html'
            ctx.body = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>邮箱已验证 - xMatrix</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                        .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                        .success { color: #27ae60; }
                        .icon { font-size: 64px; margin-bottom: 20px; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✅</div>
                        <h1 class="success">邮箱已验证</h1>
                        <p>您好 ${user.username || '用户'}，您的邮箱已经验证过了！</p>
                        <p>您可以正常使用xMatrix平台的所有功能。</p>
                        <hr>
                        <p><small>xMatrix</small></p>
                    </div>
                </body>
                </html>
            `
            return
        }

        // 更新邮箱验证状态
        user.emailVerified = true
        await user.save()

        // TODO: Welcome email has been removed per requirements
        // Email verification success is confirmed without sending additional welcome email
        const language = ctx.validateQuery('lang').optional().isIn([LANGUAGES.EN, LANGUAGES.CN]).defaultTo(LANGUAGES.CN).val()
        ctx.logger.info('Email link verification completed (welcome email disabled)', {
            operation: 'verify_email_link_no_welcome',
            userId: user._id,
            email: user.email,
        })

        ctx.logger.info('Email verified successfully by link', {
            operation: 'verify_email_link_success',
            userId: user._id,
            email: user.email,
        })

        // 重定向到前端页面的toast页面
        // 根据环境配置不同的前端URL
        const frontendBaseUrl = process.env.FRONTEND_BASE_URL
        const redirectUrl = `${frontendBaseUrl}/#/toast?email=${encodeURIComponent(user.email)}`
        ctx.redirect(redirectUrl)
    } catch (error) {
        ctx.logger.error('Email link verification error', {
            operation: 'verify_email_link_error',
            email,
            error: error.message,
        })

        ctx.type = 'text/html'
        ctx.body = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>系统错误 - xMatrix</title>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
                    .container { max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                    .error { color: #e74c3c; }
                    .icon { font-size: 64px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="icon">⚠️</div>
                    <h1 class="error">系统错误</h1>
                    <p>处理验证请求时发生错误，请稍后重试。</p>
                    <p>如果问题持续存在，请联系技术支持。</p>
                    <hr>
                    <p><small>xMatrix</small></p>
                </div>
            </body>
            </html>
        `
    }
}

export default {
    register,
    login,
    refreshToken,
    logout,
    verifyToken,
    revokeAllTokens,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    verifyEmailByLink,
    resendVerification,
    sendLoginCode,
    loginWithCode,
}
