/**
 * 候选人取消面试 - B端（面试官）
 * Email Type: INTERVIEW_CANCELLED_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_cancelled_b',

    [LANGUAGES.CN]: {
        subject: '候选人已取消面试',
        title: '候选人已取消面试',
        body: '候选人 <strong>{{CANDIDATE_NAME}}</strong> 已取消 <strong>{{JOB_TITLE}}</strong> 职位的面试{{REASON}}。',
        text: data =>
            `候选人${data.candidateName}已取消${data.jobTitle}职位的面试${data.reason || ''}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Candidate Cancelled Interview',
        title: 'Interview Cancelled',
        body: 'Candidate <strong>{{CANDIDATE_NAME}}</strong> has cancelled the <strong>{{JOB_TITLE}}</strong> interview{{REASON}}.',
        text: data =>
            `Candidate ${data.candidateName} has cancelled the ${data.jobTitle} interview${data.reason || ''}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
