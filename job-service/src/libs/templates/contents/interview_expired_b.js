/**
 * C 超时未响应（7天）- B端（面试官）
 * Email Type: INTERVIEW_EXPIRED_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_expired_b',

    [LANGUAGES.CN]: {
        subject: '面试邀约已过期',
        title: '面试邀约已过期',
        body: '您向候选人 <strong>{{CANDIDATE_NAME}}</strong> 发起的 <strong>{{JOB_TITLE}}</strong> 面试邀约因超过7天未确认，已自动取消。',
        text: data =>
            `您向候选人${data.candidateName}发起的${data.jobTitle}面试邀约因超过7天未确认，已自动取消。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Invitation Expired',
        title: 'Interview Invitation Expired',
        body: 'Your interview invitation for <strong>{{JOB_TITLE}}</strong> to candidate <strong>{{CANDIDATE_NAME}}</strong> has expired due to no response within 7 days.',
        text: data =>
            `Your interview invitation for ${data.jobTitle} to candidate ${data.candidateName} has expired due to no response within 7 days.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
