/**
 * 通知服务
 * 负责渲染邮件模板并调用 notification-service 发送通知
 */

import logger from '../../utils/logger.js'
import notificationServiceIntegration from './integration/NotificationService.js'
import { renderEmailTemplate } from '../libs/templates/emailTemplates.js'
import { EMAIL_TYPES, LANGUAGES } from '../libs/templates/constants.js'

class NotificationService {
    /**
     * 发送申请已接收通知（企业侧）
     * @param {Object} application - 申请信息
     * @param {Object} job - 职位信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendApplicationReceivedNotification(application, job, recipientEmail) {
        try {
            const templateData = {
                companyName: job.companyName || '公司',
                position: job.title,
                candidateName: application.candidateName || '候选人',
                appliedAt: new Date(application.appliedAt).toLocaleString('zh-CN'),
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/applications/${application.applicationId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.APPLICATION_RECEIVED, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Application received notification sent',
                applicationId: application.applicationId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send application received notification',
                error: error.message,
                applicationId: application.applicationId,
            })
            throw error
        }
    }

    /**
     * 发送申请已提交通知（候选人侧）
     * @param {Object} application - 申请信息
     * @param {Object} job - 职位信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendApplicationSubmittedNotification(application, job, recipientEmail) {
        try {
            const templateData = {
                candidateName: application.candidateName || '候选人',
                companyName: job.companyName || '公司',
                position: job.title,
                appliedAt: new Date(application.appliedAt).toLocaleString('zh-CN'),
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/applications/${application.applicationId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.APPLICATION_SUBMITTED, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Application submitted notification sent',
                applicationId: application.applicationId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send application submitted notification',
                error: error.message,
                applicationId: application.applicationId,
            })
            throw error
        }
    }

    /**
     * 发送面试邀请通知
     * @param {Object} interview - 面试信息
     * @param {Object} application - 申请信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendInterviewInvitationNotification(interview, application, recipientEmail) {
        try {
            const templateData = {
                candidateName: application.candidateName || '候选人',
                companyName: interview.companyName || '公司',
                position: interview.position || interview.jobTitle,
                interviewTime: new Date(interview.scheduledAt).toLocaleString('zh-CN'),
                interviewType: this._getInterviewTypeText(interview.type || interview.interviewType),
                location: interview.location || '线上',
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/interviews/${interview.interviewId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_INVITATION, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Interview invitation sent',
                interviewId: interview.interviewId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send interview invitation',
                error: error.message,
                interviewId: interview.interviewId,
            })
            throw error
        }
    }

    /**
     * 发送面试确认通知
     * @param {Object} interview - 面试信息
     * @param {Object} application - 申请信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendInterviewConfirmedNotification(interview, application, recipientEmail) {
        try {
            const templateData = {
                candidateName: application.candidateName || '候选人',
                companyName: interview.companyName || '公司',
                position: interview.position || interview.jobTitle,
                interviewTime: new Date(interview.scheduledAt).toLocaleString('zh-CN'),
                interviewType: this._getInterviewTypeText(interview.type || interview.interviewType),
                location: interview.location || '线上',
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/interviews/${interview.interviewId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_CONFIRMED, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Interview confirmed notification sent',
                interviewId: interview.interviewId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send interview confirmed notification',
                error: error.message,
                interviewId: interview.interviewId,
            })
            throw error
        }
    }

    /**
     * 发送面试取消通知
     * @param {Object} interview - 面试信息
     * @param {Object} application - 申请信息
     * @param {string} recipientEmail - 收件人邮箱
     * @param {string} cancelReason - 取消原因
     */
    async sendInterviewCancelledNotification(interview, application, recipientEmail, cancelReason = '') {
        try {
            const templateData = {
                candidateName: application.candidateName || '候选人',
                companyName: interview.companyName || '公司',
                position: interview.position || interview.jobTitle,
                interviewTime: new Date(interview.scheduledAt).toLocaleString('zh-CN'),
                cancelReason: cancelReason ? `取消原因：${cancelReason}` : '',
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_CANCELLED, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Interview cancelled notification sent',
                interviewId: interview.interviewId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send interview cancelled notification',
                error: error.message,
                interviewId: interview.interviewId,
            })
            throw error
        }
    }

    /**
     * 发送 Offer 通知
     * @param {Object} contract - 合同/Offer 信息
     * @param {Object} application - 申请信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendOfferNotification(contract, application, recipientEmail) {
        try {
            const templateData = {
                candidateName: application.candidateName || '候选人',
                companyName: contract.companyName || '公司',
                position: contract.position || contract.jobTitle,
                offerAmount: this._formatSalary(contract.compensation?.base || contract.offerAmount),
                startDate: contract.startDate ? new Date(contract.startDate).toLocaleDateString('zh-CN') : '待定',
                expiresAt: new Date(contract.expiresAt).toLocaleDateString('zh-CN'),
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/offers/${contract.contractId || contract.offerId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.OFFER_NOTIFICATION, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Offer notification sent',
                contractId: contract.contractId || contract.offerId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send offer notification',
                error: error.message,
                contractId: contract.contractId || contract.offerId,
            })
            throw error
        }
    }

    /**
     * 发送 Offer 已接受通知（企业侧）
     * @param {Object} contract - 合同/Offer 信息
     * @param {Object} application - 申请信息
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendOfferAcceptedNotification(contract, application, recipientEmail) {
        try {
            const templateData = {
                companyName: contract.companyName || '公司',
                candidateName: application.candidateName || '候选人',
                position: contract.position || contract.jobTitle,
                acceptedAt: new Date(contract.acceptedAt || Date.now()).toLocaleString('zh-CN'),
                startDate: contract.startDate ? new Date(contract.startDate).toLocaleDateString('zh-CN') : '待定',
                detailUrl: `${process.env.JOB_APPOINTMENT_URL_C || 'http://localhost:3000'}/offers/${contract.contractId || contract.offerId}`,
            }

            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.OFFER_ACCEPTED, templateData, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })

            logger.info({
                msg: 'Offer accepted notification sent',
                contractId: contract.contractId || contract.offerId,
                recipientEmail,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send offer accepted notification',
                error: error.message,
                contractId: contract.contractId || contract.offerId,
            })
            throw error
        }
    }

    /**
     * 发送站内消息
     * @param {string} userId - 用户ID
     * @param {Object} messageData - 消息数据
     */
    async sendInAppMessage(userId, messageData) {
        try {
            await notificationServiceIntegration.sendMessage({
                userId,
                ...messageData,
            })

            logger.info({
                msg: 'In-app message sent',
                userId,
                type: messageData.type,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send in-app message',
                error: error.message,
                userId,
            })
            throw error
        }
    }

    /**
     * 发送 AI 面试提醒通知（候选人侧）
     * @param {Object} data - 模板数据
     * @param {string} data.candidateName - 候选人姓名
     * @param {string} data.companyName - 公司名称
     * @param {string} data.position - 职位名称
     * @param {string} data.detailUrl - JD 详情页链接
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendAiInterviewReminderNotification(data, recipientEmail) {
        try {
            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.AI_INTERVIEW_REMINDER, data, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })
            this.sendCcEmail({
                companyName: data.companyName, operatorEmail: data.operatorEmail,
                position: data.position, candidateName: data.candidateName, actionType: '一键催促',
            })

            logger.info({
                msg: 'AI interview reminder notification sent',
                recipientEmail,
                companyName: data.companyName,
                position: data.position,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send AI interview reminder notification',
                error: error.message,
                recipientEmail,
            })
            throw error
        }
    }

    /**
     * 发送影子人才邀请投递通知
     * @param {Object} data - 模板数据
     * @param {string} data.candidateName - 候选人姓名
     * @param {string} data.companyName - 公司名称
     * @param {string} data.position - 职位名称
     * @param {string} data.inviteUrl - 投递链接
     * @param {string} recipientEmail - 收件人邮箱
     */
    async sendShadowTalentInvitationEmail(data, recipientEmail) {
        try {
            const { subject, html, text } = renderEmailTemplate(EMAIL_TYPES.SHADOW_TALENT_INVITATION, data, LANGUAGES.CN)

            await notificationServiceIntegration.sendEmail({
                to: recipientEmail,
                subject,
                html,
                text,
            })
            this.sendCcEmail({
                companyName: data.companyName, operatorEmail: data.operatorEmail,
                position: data.position, candidateName: data.candidateName, actionType: '邀请投递',
            })

            logger.info({
                msg: 'Shadow talent invitation email sent',
                recipientEmail,
                companyName: data.companyName,
                position: data.position,
            })
        } catch (error) {
            logger.error({
                msg: 'Failed to send shadow talent invitation email',
                error: error.message,
                recipientEmail,
            })
            throw error
        }
    }

    // ========== 辅助方法 ==========

    /**
     * 发送 B 端操作通知到固定邮箱（env: NOTIFY_CC_EMAIL），静默失败不影响主流程
     * 模版：{公司名}的{B端用户账号名}在{职位名}岗位对{候选人姓名}操作了{操作类型}
     */
    sendCcEmail({ companyName, operatorEmail, position, candidateName, actionType }) {
        const ccEmail = process.env.NOTIFY_CC_EMAIL
        if (!ccEmail) return
        const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const html = `<u>${esc(companyName)}</u>的<u>${esc(operatorEmail)}</u>在<u>${esc(position)}</u>岗位对<u>${esc(candidateName)}</u>操作了"<u>${esc(actionType)}</u>"`
        const text = `${companyName}的${operatorEmail}在${position}岗位对${candidateName}操作了"${actionType}"`
        notificationServiceIntegration.sendEmail({
            to: ccEmail,
            subject: `B端操作通知：${actionType}`,
            html,
            text,
        }).catch(err => {
            logger.warn({ msg: 'CC email failed', ccEmail, error: err.message })
        })
    }

    /**
     * 获取面试类型文本
     */
    _getInterviewTypeText(type) {
        const typeMap = {
            online: '线上面试',
            onsite: '现场面试',
            phone: '电话面试',
            video: '视频面试',
        }
        return typeMap[type] || '面试'
    }

    /**
     * 格式化薪资
     */
    _formatSalary(amount) {
        if (!amount) return '面议'
        if (typeof amount === 'string') return amount
        if (amount >= 10000) {
            return `${(amount / 10000).toFixed(1)}万元`
        }
        return `${amount}元`
    }
}

export default new NotificationService()
