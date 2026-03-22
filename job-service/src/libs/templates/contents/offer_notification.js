/**
 * Offer 通知邮件模板
 * Email Type: OFFER_NOTIFICATION
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'offer_notification',

    [LANGUAGES.CN]: {
        subject: data => `录用通知 - ${data.position} @ ${data.companyName}`,
        title: '恭喜！您收到了录用通知',
        body: '尊敬的 {{CANDIDATE_NAME}}：<br><br>恭喜您！<strong>{{COMPANY_NAME}}</strong> 非常高兴地向您发出 <strong>{{POSITION}}</strong> 职位的录用通知。<br><br><strong>职位名称：</strong>{{POSITION}}<br><strong>薪资待遇：</strong>{{OFFER_AMOUNT}}<br><strong>报到时间：</strong>{{START_DATE}}<br><strong>有效期至：</strong>{{EXPIRES_AT}}<br><br>请在有效期内确认是否接受此 Offer。',
        text: data =>
            `尊敬的 ${data.candidateName}：恭喜您！${data.companyName} 非常高兴地向您发出 ${data.position} 职位的录用通知。薪资待遇：${data.offerAmount}，报到时间：${data.startDate || '待定'}，有效期至：${data.expiresAt}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看 Offer 详情',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Job Offer - ${data.position} @ ${data.companyName}`,
        title: 'Congratulations! You Received a Job Offer',
        body: 'Dear {{CANDIDATE_NAME}},<br><br>Congratulations! <strong>{{COMPANY_NAME}}</strong> is pleased to offer you the <strong>{{POSITION}}</strong> position.<br><br><strong>Position:</strong> {{POSITION}}<br><strong>Compensation:</strong> {{OFFER_AMOUNT}}<br><strong>Start Date:</strong> {{START_DATE}}<br><strong>Offer Valid Until:</strong> {{EXPIRES_AT}}<br><br>Please confirm whether you accept this offer within the validity period.',
        text: data =>
            `Dear ${data.candidateName}, Congratulations! ${data.companyName} is pleased to offer you the ${data.position} position. Compensation: ${data.offerAmount}, Start Date: ${data.startDate || 'TBD'}, Offer Valid Until: ${data.expiresAt}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Offer Details',
        actionUrlKey: 'detailUrl',
    },
}
