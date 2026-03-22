/**
 * 面试已开始通知邮件模板 - B端（面试官）
 * Email Type: INTERVIEW_STARTED_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_started_b',

    [LANGUAGES.CN]: {
        subject: '面试已开始',
        title: '面试已开始',
        body: '您与候选人 <strong>{{CANDIDATE_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试已经开始，面试开始时间：<strong>{{INTERVIEW_START_TIME}}</strong>，请尽快进入面试。',
        text: data =>
            `您与候选人${data.candidateName}的${data.jobTitle}面试已经开始，面试开始时间：${data.interviewStartTime}，请尽快进入面试。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '进入面试',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Started',
        title: 'Interview Started',
        body: 'Your interview with candidate <strong>{{CANDIDATE_NAME}}</strong> for <strong>{{JOB_TITLE}}</strong> has started. Interview time: <strong>{{INTERVIEW_START_TIME}}</strong>. Please join now.',
        text: data =>
            `Your interview with candidate ${data.candidateName} for ${data.jobTitle} has started. Interview time: ${data.interviewStartTime}. Please join now.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Join Interview',
        actionUrlKey: 'actionUrl',
    },
}
