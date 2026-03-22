/**
 * 邮件服务
 * 统一管理邮件发送功能
 */

import notificationClient from '../clients/NotificationClient.js'
import { getEmailTemplate, generateVerificationCode, generateVerificationToken, EMAIL_TYPES, LANGUAGES, USER_ROLES } from '../libs/emailTemplates.js'
import redisClient from '../../utils/redis.js'
import { log } from '../../utils/logger.js'

const logger = log(import.meta.url)

class EmailService {
    constructor() {
        this.notificationClient = notificationClient
        this.verificationCodeExpiry = {
            registration: 10 * 60, // 10分钟
            passwordReset: 30 * 60, // 30分钟
            twoFactor: 5 * 60, // 5分钟
            loginVerification: 5 * 60, // 5分钟
        }

        // 验证令牌有效期 (与验证码保持一致)
        this.verificationTokenExpiry = {
            registration: 30 * 60, // 30分钟
        }
    }

    /**
     * 生成验证链接
     * @param {string} email - 用户邮箱
     * @param {string} type - 验证类型
     * @returns {Promise<string>} 验证链接
     */
    async generateVerificationUrl(email, type = 'registration') {
        const token = generateVerificationToken()

        // 使用 API_BASE_URL 环境变量，如果没有则根据环境使用默认值
        let baseUrl = process.env.API_BASE_URL

        if (!baseUrl) {
            const isProduction = process.env.NODE_ENV === 'production'

            if (isProduction) {
                // 生产环境警告：应该配置 API_BASE_URL
                logger.warn('API_BASE_URL not configured in production environment', {
                    env: process.env.NODE_ENV,
                })
                baseUrl = 'https://api.example.com' // 生产环境默认值
            } else {
                baseUrl = 'http://localhost:3001' // 开发/测试环境默认值
            }
        }

        // 缓存验证令牌
        const cacheKey = `verification_token:${type}:${email}`
        await redisClient.setex(cacheKey, this.verificationTokenExpiry[type] || 30 * 60, token)

        // 生成验证链接
        const verificationUrl = `${baseUrl}/api/v1/auth/verify-email-link?token=${token}&email=${encodeURIComponent(email)}&type=${type}`

        logger.info('Generated verification URL', {
            email,
            type,
            token: token.substring(0, 8) + '...',
            baseUrl,
            expiryMinutes: (this.verificationTokenExpiry[type] || 30 * 60) / 60,
            configuredFromEnv: !!process.env.API_BASE_URL,
        })

        return verificationUrl
    }

    /**
     * 验证令牌
     * @param {string} token - 验证令牌
     * @param {string} email - 用户邮箱
     * @param {string} type - 验证类型
     * @returns {Promise<boolean>} 验证结果
     */
    async verifyToken(token, email, type = 'registration') {
        try {
            const cacheKey = `verification_token:${type}:${email}`
            const cachedToken = await redisClient.get(cacheKey)

            if (!cachedToken || cachedToken !== token) {
                logger.warn('Token verification failed', {
                    email,
                    type,
                    tokenExists: !!cachedToken,
                    tokenMatch: cachedToken === token,
                })
                return false
            }

            // 验证成功后删除令牌 (防止重复使用)
            await redisClient.del(cacheKey)

            logger.info('Token verification successful', {
                email,
                type,
                token: token.substring(0, 8) + '...',
            })

            return true
        } catch (error) {
            logger.error('Token verification error', {
                email,
                type,
                error: error.message,
            })
            return false
        }
    }

    /**
     * 发送注册验证邮件
     * @param {string} email - 收件人邮箱
     * @param {string} username - 用户名
     * @param {string} language - 语言
     * @param {string} userType - 用户类型 (C/B)，C=工程师，B=企业
     * @returns {Promise<Object>} 发送结果
     */
    async sendRegistrationEmail(email, username, language = LANGUAGES.CN, userType = 'C') {
        try {
            const code = generateVerificationCode()
            const verificationUrl = await this.generateVerificationUrl(email, 'registration')
            const cacheKey = `registration_code:${email}`

            // 根据用户类型映射到 userRole（必填）
            const userRole = userType === 'B' ? USER_ROLES.ENTERPRISE : USER_ROLES.ENGINEER

            // 生成邮件模板
            const template = getEmailTemplate(EMAIL_TYPES.REGISTRATION, language, {
                username,
                code,
                verificationUrl,
                userRole,  // 必填：工程师或企业
            })

            // 先缓存验证码，避免邮件发送成功但验证码未缓存的情况
            await redisClient.setex(cacheKey, this.verificationCodeExpiry.registration, code)

            // 发送邮件
            const result = await this.notificationClient.sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            })

            if (result.success) {
                logger.info('Registration email sent successfully', {
                    email,
                    username,
                    messageId: result.messageId,
                    hasVerificationUrl: !!verificationUrl,
                })
            } else {
                // 如果邮件发送失败，删除缓存的验证码
                await redisClient.del(cacheKey)
                throw new Error('Failed to send email')
            }

            return {
                success: result.success,
                messageId: result.messageId,
                expiryMinutes: this.verificationCodeExpiry.registration / 60,
            }
        } catch (error) {
            logger.error('Failed to send registration email', { email, username, error: error.message })
            throw error
        }
    }

    /**
     * 发送密码重置邮件
     * @param {string} email - 收件人邮箱
     * @param {string} username - 用户名
     * @param {string} language - 语言
     * @returns {Promise<Object>} 发送结果
     */
    async sendPasswordResetEmail(email, username, language = LANGUAGES.CN) {
        try {
            const code = generateVerificationCode()
            const cacheKey = `password_reset_code:${email}`

            const template = getEmailTemplate(EMAIL_TYPES.PASSWORD_RESET, language, {
                username,
                code,
            })

            // 先缓存验证码
            await redisClient.setex(cacheKey, this.verificationCodeExpiry.passwordReset, code)

            const result = await this.notificationClient.sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            })

            if (result.success) {
                logger.info('Password reset email sent successfully', {
                    email,
                    username,
                    messageId: result.messageId,
                })
            } else {
                // 如果邮件发送失败，删除缓存的验证码
                await redisClient.del(cacheKey)
                throw new Error('Failed to send email')
            }

            return {
                success: result.success,
                messageId: result.messageId,
                expiryMinutes: this.verificationCodeExpiry.passwordReset / 60,
            }
        } catch (error) {
            logger.error('Failed to send password reset email', { email, username, error: error.message })
            throw error
        }
    }

    /**
     * 验证验证码
     * @param {string} email - 邮箱
     * @param {string} code - 验证码
     * @param {string} type - 验证类型
     * @returns {Promise<boolean>} 验证结果
     */
    async verifyCode(email, code, type) {
        try {
            const cacheKey = `${type}_code:${email}`
            const cachedCode = await redisClient.get(cacheKey)

            if (!cachedCode) {
                logger.warn('Verification code not found or expired', { email, type })
                return false
            }

            if (cachedCode !== code) {
                logger.warn('Verification code mismatch', { email, type })
                return false
            }

            // 验证成功后删除验证码
            await redisClient.del(cacheKey)

            logger.info('Verification code verified successfully', { email, type })
            return true
        } catch (error) {
            logger.error('Failed to verify code', { email, type, error: error.message })
            return false
        }
    }

    /**
     * 检查邮件发送频率限制
     * @param {string} email - 邮箱
     * @param {string} type - 邮件类型
     * @returns {Promise<boolean>} 是否可以发送
     */
    async checkRateLimit(email, type) {
        try {
            const rateLimitKey = `email_rate_limit:${type}:${email}`
            const count = await redisClient.get(rateLimitKey)

            const limits = {
                registration: { maxCount: 3, window: 60 * 60 }, // 1小时内最多3次
                passwordReset: { maxCount: 5, window: 60 * 60 }, // 1小时内最多5次
                loginVerification: { maxCount: 10, window: 60 * 60 }, // 1小时内最多10次
            }

            const limit = limits[type] || { maxCount: 5, window: 60 * 60 }

            if (count && parseInt(count) >= limit.maxCount) {
                logger.warn('Email rate limit exceeded', { email, type, count })
                return false
            }

            // 增加计数
            if (count) {
                await redisClient.incr(rateLimitKey)
            } else {
                await redisClient.setex(rateLimitKey, limit.window, 1)
            }

            return true
        } catch (error) {
            logger.error('Failed to check rate limit', { email, type, error: error.message })
            return true // 如果检查失败，允许发送
        }
    }

    /**
     * 发送登录验证码邮件
     * @param {string} email - 收件人邮箱
     * @param {string} username - 用户名
     * @param {Object} loginInfo - 登录信息
     * @param {string} language - 语言
     * @returns {Promise<Object>} 发送结果
     */
    async sendLoginVerificationEmail(email, username, loginInfo = {}, language = LANGUAGES.CN) {
        try {
            const code = generateVerificationCode()
            const cacheKey = `login_verification_code:${email}`

            const template = getEmailTemplate(EMAIL_TYPES.LOGIN_VERIFICATION, language, {
                username,
                code,
                loginTime:
                    loginInfo.loginTime ||
                    new Date().toLocaleString(language === LANGUAGES.CN ? 'zh-CN' : 'en-US', {
                        timeZone: 'Asia/Shanghai',
                    }),
                platform: loginInfo.platform || 'web',
                ip: loginInfo.ip || '',
            })

            // 先缓存验证码
            await redisClient.setex(cacheKey, this.verificationCodeExpiry.loginVerification, code)

            const result = await this.notificationClient.sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            })

            if (result.success) {
                logger.info('Login verification email sent successfully', {
                    email,
                    username,
                    messageId: result.messageId,
                })
            } else {
                // 如果邮件发送失败，删除缓存的验证码
                await redisClient.del(cacheKey)
                throw new Error('Failed to send email')
            }

            return {
                success: result.success,
                messageId: result.messageId,
                expiryMinutes: this.verificationCodeExpiry.loginVerification / 60,
            }
        } catch (error) {
            logger.error('Failed to send login verification email', { email, username, error: error.message })
            throw error
        }
    }

    /**
     * 发送密码修改成功通知邮件
     * @param {string} email - 收件人邮箱
     * @param {string} username - 用户名
     * @param {string} language - 语言
     * @returns {Promise<Object>} 发送结果
     */
    async sendPasswordChangedEmail(email, username, language = LANGUAGES.CN) {
        try {
            const template = getEmailTemplate(EMAIL_TYPES.PASSWORD_CHANGED, language, {
                username,
            })

            // 发送邮件
            const result = await this.notificationClient.sendEmail({
                to: email,
                subject: template.subject,
                html: template.html,
                text: template.text,
            })

            if (result.success) {
                logger.info('Password changed notification email sent successfully', {
                    email,
                    username,
                    messageId: result.messageId,
                })
            }

            return {
                success: result.success,
                messageId: result.messageId,
            }
        } catch (error) {
            logger.error('Failed to send password changed email', { email, username, error: error.message })
            throw error
        }
    }

    /**
     * 发送测试邮件
     * @param {string} email - 测试邮箱
     * @returns {Promise<Object>} 发送结果
     */
    async sendTestEmail(email) {
        const subject = '测试邮件 - xMatrix用户中心'
        const html = `
            <h2>测试邮件</h2>
            <p>这是一封来自 xMatrix 用户中心的测试邮件。</p>
            <p>如果您收到了这封邮件，说明邮件发送功能正常。</p>
            <p>发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
        `
        const text = `
            测试邮件
            这是一封来自 xMatrix 用户中心的测试邮件。
            如果您收到了这封邮件，说明邮件发送功能正常。
            发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}
        `

        return this.notificationClient.sendEmail({
            to: email,
            subject,
            html,
            text,
        })
    }
}

export default EmailService
