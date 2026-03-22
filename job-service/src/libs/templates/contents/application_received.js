/**
 * 申请已接收邮件模板（企业侧）
 * Email Type: APPLICATION_RECEIVED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'application_received',

    [LANGUAGES.CN]: {
        subject: data => `新的求职申请 - ${data.position}`,
        title: '收到新申请',
        body: '您好，<strong>{{COMPANY_NAME}}</strong>：<br><br>您发布的职位「<strong>{{POSITION}}</strong>」收到了来自 <strong>{{CANDIDATE_NAME}}</strong> 的新申请。<br><br><strong>申请时间：</strong>{{APPLIED_AT}}<br><br>请及时查看候选人简历并进行筛选。',
        text: data =>
            `您好，${data.companyName}。您发布的职位「${data.position}」收到了来自 ${data.candidateName} 的新申请。申请时间：${data.appliedAt}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看申请详情',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `New Application - ${data.position}`,
        title: 'New Application Received',
        body: 'Hello, <strong>{{COMPANY_NAME}}</strong>:<br><br>Your job posting for <strong>{{POSITION}}</strong> has received a new application from <strong>{{CANDIDATE_NAME}}</strong>.<br><br><strong>Applied At:</strong> {{APPLIED_AT}}<br><br>Please review the candidate\'s resume and proceed with screening.',
        text: data =>
            `Hello, ${data.companyName}. Your job posting for ${data.position} has received a new application from ${data.candidateName}. Applied at: ${data.appliedAt}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Application',
        actionUrlKey: 'detailUrl',
    },
}
