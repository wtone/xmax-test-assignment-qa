/**
 * Offer 已接受邮件模板（企业侧）
 * Email Type: OFFER_ACCEPTED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'offer_accepted',

    [LANGUAGES.CN]: {
        subject: data => `候选人已接受 Offer - ${data.position}`,
        title: 'Offer 已被接受',
        body: '您好，<strong>{{COMPANY_NAME}}</strong>：<br><br><strong>{{CANDIDATE_NAME}}</strong> 已接受您发出的 <strong>{{POSITION}}</strong> 职位的录用通知。<br><br><strong>接受时间：</strong>{{ACCEPTED_AT}}<br><strong>报到时间：</strong>{{START_DATE}}<br><br>请及时安排后续入职事宜。',
        text: data =>
            `您好，${data.companyName}：${data.candidateName} 已接受您发出的 ${data.position} 职位的录用通知。接受时间：${data.acceptedAt}，报到时间：${data.startDate || '待定'}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Candidate Accepted Offer - ${data.position}`,
        title: 'Offer Accepted',
        body: 'Hello, <strong>{{COMPANY_NAME}}</strong>:<br><br><strong>{{CANDIDATE_NAME}}</strong> has accepted your job offer for the <strong>{{POSITION}}</strong> position.<br><br><strong>Accepted At:</strong> {{ACCEPTED_AT}}<br><strong>Start Date:</strong> {{START_DATE}}<br><br>Please arrange the onboarding process accordingly.',
        text: data =>
            `Hello, ${data.companyName}: ${data.candidateName} has accepted your job offer for the ${data.position} position. Accepted at: ${data.acceptedAt}, Start Date: ${data.startDate || 'TBD'}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'detailUrl',
    },
}
