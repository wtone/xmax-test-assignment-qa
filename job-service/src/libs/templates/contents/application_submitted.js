/**
 * 申请已提交邮件模板（候选人侧）
 * Email Type: APPLICATION_SUBMITTED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'application_submitted',

    [LANGUAGES.CN]: {
        subject: data => `申请已提交 - ${data.position} @ ${data.companyName}`,
        title: '申请已提交成功',
        body: '尊敬的 {{CANDIDATE_NAME}}：<br><br>您已成功申请 <strong>{{COMPANY_NAME}}</strong> 的「<strong>{{POSITION}}</strong>」职位。<br><br><strong>申请时间：</strong>{{APPLIED_AT}}<br><br>我们将尽快审核您的申请，请耐心等待。如有进展，我们会及时通知您。',
        text: data =>
            `尊敬的 ${data.candidateName}：您已成功申请 ${data.companyName} 的「${data.position}」职位。申请时间：${data.appliedAt}。我们将尽快审核您的申请。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看申请状态',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Application Submitted - ${data.position} @ ${data.companyName}`,
        title: 'Application Submitted Successfully',
        body: 'Dear {{CANDIDATE_NAME}},<br><br>You have successfully applied for the <strong>{{POSITION}}</strong> position at <strong>{{COMPANY_NAME}}</strong>.<br><br><strong>Applied At:</strong> {{APPLIED_AT}}<br><br>We will review your application shortly. If there are any updates, we will notify you promptly.',
        text: data =>
            `Dear ${data.candidateName}, You have successfully applied for the ${data.position} position at ${data.companyName}. Applied at: ${data.appliedAt}. We will review your application shortly.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Application Status',
        actionUrlKey: 'detailUrl',
    },
}
