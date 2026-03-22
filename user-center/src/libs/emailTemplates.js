/**
 * Email Template System
 * 统一邮件模板系统 - 单一基础模板 + 内容配置
 *
 * @description 所有邮件共用同一个基础模板，通过配置定义不同邮件的内容
 * @see docs/email-template-refactor.md
 */

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 读取统一基础模板
const baseTemplate = readFileSync(join(__dirname, 'templates/email_base.html'), 'utf-8')

// ============================================================================
// 常量定义
// ============================================================================

/** 语言常量 */
export const LANGUAGES = {
    EN: 'en',
    CN: 'cn',
}

/** 邮件类型 */
export const EMAIL_TYPES = {
    REGISTRATION: 'registration',
    PASSWORD_RESET: 'password_reset',
    PASSWORD_CHANGED: 'password_changed',
    LOGIN_VERIFICATION: 'login_verification',
}

/** 用户角色（用于注册邮件） */
export const USER_ROLES = {
    ENGINEER: 'engineer',     // C端：工程师
    ENTERPRISE: 'enterprise', // B端：企业合作伙伴
}

/** 角色显示名称 */
const ROLE_LABELS = {
    [USER_ROLES.ENGINEER]: { cn: '工程师', en: 'an Engineer' },
    [USER_ROLES.ENTERPRISE]: { cn: '企业合作伙伴', en: 'an Enterprise Partner' },
}

/** 行动组件类型 */
export const ACTION_TYPES = {
    LINK_BUTTON_RIGHT: 'link_button_right', // 右对齐链接按钮（注册验证用）
    VERIFICATION_CODE: 'verification_code', // 居中验证码显示框
    LINK_BUTTON_CENTER: 'link_button_center', // 居中链接按钮
    NONE: 'none', // 无行动区域
}

// ============================================================================
// 行动组件 HTML 模板
// ============================================================================

const ACTION_COMPONENTS = {
    /** 右对齐链接按钮（带箭头图标） */
    [ACTION_TYPES.LINK_BUTTON_RIGHT]: `
          <tr>
            <td align="right" style="padding-top: 30px; padding-right: 0px; padding-bottom: 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="button" style="background-color: #7B8A60; border-radius: 999px 0 0 999px;">
                    <a href="{{ACTION_URL}}" target="_blank"
                    style="display: block;
                    padding: 14px 70px; color: white; text-decoration: none;
                    font-weight: 700; font-size: 16px;
                    line-height: 1;">
                      <span style="display: inline-block; vertical-align: middle;">{{ACTION_TEXT}}</span>
                      <img src="https://cdn.example.com/images/placeholder.png" alt="arrow"
                      width="16" height="16"
                      style="margin-left: 8px; display: inline-block; vertical-align: middle;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,

    /** 居中验证码显示框 */
    [ACTION_TYPES.VERIFICATION_CODE]: `
          <tr>
            <td align="center" style="padding-top: 10px; padding-bottom: 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="button" style="background-color: #7B8A60; border-radius: 999px; text-align: center;">
                    <span style="display: block;
                      padding: 14px 60px; color: white;
                      font-weight: 700; font-size: 28px;
                      line-height: 1;
                      letter-spacing: 6px;">
                      {{CODE}}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,

    /** 居中链接按钮 */
    [ACTION_TYPES.LINK_BUTTON_CENTER]: `
          <tr>
            <td align="center" style="padding-top: 10px; padding-bottom: 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="button" style="background-color: #7B8A60; border-radius: 999px; text-align: center;">
                    <a href="{{ACTION_URL}}" style="display: block; padding: 14px 40px; color: white; font-weight: 400; font-size: 20px; line-height: 1; letter-spacing: 0px; text-decoration: none;">
                      {{ACTION_TEXT}}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,

    /** 无行动区域 */
    [ACTION_TYPES.NONE]: `
          <tr>
            <td style="padding-bottom: 48px;"></td>
          </tr>`,
}

// ============================================================================
// 邮件内容配置
// ============================================================================

const EMAIL_CONTENTS = {
    /**
     * 注册验证邮件
     * 必须指定 userRole 参数：engineer（工程师）或 enterprise（企业）
     */
    [EMAIL_TYPES.REGISTRATION]: {
        [LANGUAGES.CN]: {
            subject: '欢迎注册xMatrix',
            title: '欢迎使用 XMATRiX',
            body: '您好 {{USERNAME}}，感谢您以{{ROLE_LABEL}}身份加入。<br>请点击下面的按钮以验证您的邮箱地址并完成注册流程。<br>此验证链接将在 <strong style="font-weight: 700;">30 分钟</strong> 后失效。',
            text: data => {
                const roleLabel = ROLE_LABELS[data.userRole]?.cn || '用户'
                return `欢迎来到xMatrix！您好 ${data.username || '用户'}，感谢您以${roleLabel}身份加入。请使用验证码验证邮箱：${data.code} 或访问：${data.verificationUrl}。此验证30分钟后过期。`
            },
            actionType: ACTION_TYPES.LINK_BUTTON_RIGHT,
            actionText: '确认',
            actionUrlKey: 'verificationUrl',
        },
        [LANGUAGES.EN]: {
            subject: 'Welcome to xMatrix',
            title: 'Welcome to XMATRiX',
            body: 'Hi {{USERNAME}}, thanks for joining as {{ROLE_LABEL}}.<br>Please click the button below to verify your email address and complete the registration process.<br>This verification link will expire in <strong style="font-weight: 700;">30 minutes</strong>.',
            text: data => {
                const roleLabel = ROLE_LABELS[data.userRole]?.en || 'a User'
                return `Welcome to xMatrix! Hi ${data.username || 'User'}, thanks for joining as ${roleLabel}. Please verify your email with code: ${data.code} or visit: ${data.verificationUrl}. This expires in 30 minutes.`
            },
            actionType: ACTION_TYPES.LINK_BUTTON_RIGHT,
            actionText: 'Confirm',
            actionUrlKey: 'verificationUrl',
        },
    },

    /** 密码重置 */
    [EMAIL_TYPES.PASSWORD_RESET]: {
        [LANGUAGES.CN]: {
            subject: 'xMatrix - 密码重置请求',
            title: '密码重置',
            body: '您正在重置您的 XMATRiX 平台账户密码。请使用以下验证码完成重置：<br>验证码将在 <strong style="font-weight: 700;">{{EXPIRY_TIME}}</strong> 后失效。',
            text: data =>
                `${data.username || '用户'} 的密码重置请求。使用验证码：${data.code} 重置密码。验证码30分钟后过期。`,
            actionType: ACTION_TYPES.VERIFICATION_CODE,
            defaultExpiryTime: '30 分钟',
        },
        [LANGUAGES.EN]: {
            subject: 'xMatrix - Password Reset Request',
            title: 'Password Reset',
            body: 'You are resetting your XMATRiX account password. Please use the following verification code to complete the reset:<br>The code will expire in <strong style="font-weight: 700;">{{EXPIRY_TIME}}</strong>.',
            text: data =>
                `Password reset request for ${data.username || 'user'}. Use code: ${data.code} to reset your password. Code expires in 30 minutes.`,
            actionType: ACTION_TYPES.VERIFICATION_CODE,
            defaultExpiryTime: '30 minutes',
        },
    },

    /** 密码修改成功 */
    [EMAIL_TYPES.PASSWORD_CHANGED]: {
        [LANGUAGES.CN]: {
            subject: 'xMatrix - 密码设置成功',
            title: '密码设置成功！',
            body: '您的密码已成功设置。<br>请重新登录以继续使用我们的服务。',
            text: () => `您的密码已成功设置。请重新登录以继续使用我们的服务。`,
            actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
            actionText: '返回登录页',
            actionUrlKey: 'loginUrl',
            defaultActionUrl: 'https://www.example.com/login',
        },
        [LANGUAGES.EN]: {
            subject: 'xMatrix - Password Changed Successfully',
            title: 'Password Changed Successfully!',
            body: 'Your password has been successfully changed.<br>Please log in again to continue using our services.',
            text: () => `Your password has been successfully changed. Please log in again to continue using our services.`,
            actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
            actionText: 'Back to Login',
            actionUrlKey: 'loginUrl',
            defaultActionUrl: 'https://www.example.com/login',
        },
    },

    /** 登录验证码 */
    [EMAIL_TYPES.LOGIN_VERIFICATION]: {
        [LANGUAGES.CN]: {
            subject: '欢迎回到xMatrix - 登录验证码',
            title: '欢迎登录 XMATRiX',
            body: '您正在尝试登录您的 XMATRiX 平台账户。请使用以下验证码完成登录：<br>验证码将在 <strong style="font-weight: 700;">{{EXPIRY_TIME}}</strong> 后失效。',
            text: data => `xMatrix登录验证码：${data.code}。此验证码5分钟后过期。`,
            actionType: ACTION_TYPES.VERIFICATION_CODE,
            defaultExpiryTime: '5 分钟',
        },
        [LANGUAGES.EN]: {
            subject: 'Welcome to xMatrix - Login Verification Code',
            title: 'Welcome to XMATRiX',
            body: 'You are attempting to log in to your XMATRiX account. Please use the following verification code to complete login:<br>The code will expire in <strong style="font-weight: 700;">{{EXPIRY_TIME}}</strong>.',
            text: data => `xMatrix login verification code: ${data.code}. This code expires in 5 minutes.`,
            actionType: ACTION_TYPES.VERIFICATION_CODE,
            defaultExpiryTime: '5 minutes',
        },
    },
}

// ============================================================================
// 工具函数
// ============================================================================

/** 生成6位数字验证码 */
export const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

/** 生成验证令牌 (用于邮件链接) */
export const generateVerificationToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 32; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
}

// ============================================================================
// 模板渲染
// ============================================================================

/**
 * 替换模板中的变量
 * @param {string} template - 模板字符串
 * @param {Object} data - 数据对象
 * @returns {string} 替换后的字符串
 */
const replaceVariables = (template, data) => {
    let result = template

    // 替换所有 {{KEY}} 格式的占位符
    Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            // 支持 camelCase 和 UPPER_CASE 两种格式
            const upperKey = key.replace(/([A-Z])/g, '_$1').toUpperCase()
            result = result.replace(new RegExp(`{{${key}}}`, 'gi'), value)
            result = result.replace(new RegExp(`{{${upperKey}}}`, 'gi'), value)
        }
    })

    return result
}

/**
 * 渲染行动组件
 * @param {string} actionType - 行动组件类型
 * @param {Object} options - 组件选项
 * @returns {string} 渲染后的 HTML
 */
const renderActionComponent = (actionType, options = {}) => {
    const componentTemplate = ACTION_COMPONENTS[actionType] || ACTION_COMPONENTS[ACTION_TYPES.NONE]

    let html = componentTemplate
    html = html.replace(/{{ACTION_URL}}/g, options.url || '#')
    html = html.replace(/{{ACTION_TEXT}}/g, options.text || '')
    html = html.replace(/{{CODE}}/g, options.code || '')

    return html
}

/**
 * 渲染邮件 HTML
 * @param {string} emailType - 邮件类型
 * @param {string} language - 语言
 * @param {Object} data - 数据
 * @returns {string} 渲染后的 HTML
 */
const renderEmailHtml = (emailType, language, data) => {
    const content = EMAIL_CONTENTS[emailType]?.[language]
    if (!content) {
        throw new Error(`Email content not found: ${emailType} - ${language}`)
    }

    const langKey = language === LANGUAGES.CN ? 'cn' : 'en'

    // 准备数据（设置默认值）
    const preparedData = {
        ...data,
        username: data.username || '',
        expiryTime: data.expiryTime || content.defaultExpiryTime || '',
        // 角色标签（注册邮件用）
        roleLabel: data.userRole ? (ROLE_LABELS[data.userRole]?.[langKey] || '') : '',
    }

    // 1. 替换标题（使用正则全局替换）
    let html = baseTemplate.replace(/{{EMAIL_TITLE}}/g, content.title)

    // 2. 替换正文
    let body = content.body
    body = body.replace(/{{USERNAME}}/g, preparedData.username)
    body = body.replace(/{{ROLE_LABEL}}/g, preparedData.roleLabel)
    body = replaceVariables(body, preparedData)
    html = html.replace(/{{EMAIL_BODY}}/g, body)

    // 3. 渲染行动组件
    const actionUrl = data[content.actionUrlKey] || content.defaultActionUrl || '#'
    const actionHtml = renderActionComponent(content.actionType, {
        url: actionUrl,
        text: content.actionText,
        code: data.code,
    })
    html = html.replace(/{{EMAIL_ACTION}}/g, actionHtml)

    return html
}

// ============================================================================
// 公开 API
// ============================================================================

/**
 * 获取邮件模板
 * @param {string} type - 邮件类型
 * @param {string} language - 语言
 * @param {Object} data - 模板数据
 * @returns {Object} 模板对象 { subject, html, text }
 */
export const getEmailTemplate = (type, language = LANGUAGES.CN, data = {}) => {
    const content = EMAIL_CONTENTS[type]?.[language]
    if (!content) {
        throw new Error(`Email template not found: ${type} - ${language}`)
    }

    return {
        subject: content.subject,
        html: renderEmailHtml(type, language, data),
        text: content.text(data),
    }
}

// ============================================================================
// 兼容性导出（保持与旧代码兼容）
// ============================================================================

// 旧代码可能直接调用这些函数，保持兼容
export const getWelcomeTemplate = data =>
    renderEmailHtml(EMAIL_TYPES.REGISTRATION, LANGUAGES.CN, data)
export const getVerificationTemplate = data =>
    renderEmailHtml(EMAIL_TYPES.LOGIN_VERIFICATION, LANGUAGES.CN, data)
export const getPasswordChangedTemplate = data =>
    renderEmailHtml(EMAIL_TYPES.PASSWORD_CHANGED, LANGUAGES.CN, data)

// 旧的邮件类型兼容（映射到新的统一类型）
export const EMAIL_TYPES_LEGACY = {
    REGISTRATION_C_END: 'registration', // 已废弃，使用 REGISTRATION + userRole: 'engineer'
    REGISTRATION_B_END: 'registration', // 已废弃，使用 REGISTRATION + userRole: 'enterprise'
}
