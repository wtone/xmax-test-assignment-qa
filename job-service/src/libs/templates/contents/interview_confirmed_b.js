/**
 * 候选人已确认面试时间 - B端（面试官）
 * Email Type: INTERVIEW_CONFIRMED_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_confirmed_b',

    [LANGUAGES.CN]: {
        subject: '候选人已确认面试时间',
        title: '候选人已确认面试时间',
        body: '候选人 <strong>{{CANDIDATE_NAME}}</strong> 已确认 <strong>{{JOB_TITLE}}</strong> 职位的面试时间。',
        text: data =>
            `候选人${data.candidateName}已确认${data.jobTitle}职位的面试时间。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看面试详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Candidate Confirmed Interview Time',
        title: 'Interview Time Confirmed',
        body: 'Candidate <strong>{{CANDIDATE_NAME}}</strong> has confirmed the interview time for <strong>{{JOB_TITLE}}</strong> position.',
        text: data =>
            `Candidate ${data.candidateName} has confirmed the interview time for ${data.jobTitle} position.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Interview Details',
        actionUrlKey: 'actionUrl',
    },
}
