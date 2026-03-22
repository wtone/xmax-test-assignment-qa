/**
 * B 超时未审批（7天）- C端（候选人）
 * Email Type: INTERVIEW_EXPIRED_C
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_expired_c',

    [LANGUAGES.CN]: {
        subject: '面试邀约已过期',
        title: '面试邀约已过期',
        body: '您与 <strong>{{COMPANY_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试邀约因超过7天未确认，已自动取消。',
        text: data =>
            `您与${data.companyName}的${data.jobTitle}面试邀约因超过7天未确认，已自动取消。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '浏览更多职位',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Invitation Expired',
        title: 'Interview Invitation Expired',
        body: 'Your interview invitation for <strong>{{JOB_TITLE}}</strong> at <strong>{{COMPANY_NAME}}</strong> has expired due to no response within 7 days.',
        text: data =>
            `Your interview invitation for ${data.jobTitle} at ${data.companyName} has expired due to no response within 7 days.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Browse More Jobs',
        actionUrlKey: 'actionUrl',
    },
}
