/**
 * C 拒绝面试 - B端（面试官）
 * Email Type: INTERVIEW_REJECTED_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_rejected_b',

    [LANGUAGES.CN]: {
        subject: '面试被拒绝',
        title: '面试被拒绝',
        body: '您向候选人 <strong>{{CANDIDATE_NAME}}</strong> 发起的 <strong>{{JOB_TITLE}}</strong> 面试邀约已被拒绝{{REASON}}。',
        text: data =>
            `您向候选人${data.candidateName}发起的${data.jobTitle}面试邀约已被拒绝${data.reason || ''}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Rejected',
        title: 'Interview Rejected',
        body: 'Your interview invitation for <strong>{{JOB_TITLE}}</strong> to candidate <strong>{{CANDIDATE_NAME}}</strong> has been rejected{{REASON}}.',
        text: data =>
            `Your interview invitation for ${data.jobTitle} to candidate ${data.candidateName} has been rejected${data.reason || ''}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
