/**
 * 面试提醒（30分钟前）- B端（面试官）
 * Email Type: INTERVIEW_STARTING_30MIN_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_starting_30min_b',

    [LANGUAGES.CN]: {
        subject: '面试即将开始',
        title: '面试即将开始',
        body: '您与候选人 <strong>{{CANDIDATE_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试将在30分钟内开始，面试开始时间：<strong>{{INTERVIEW_START_TIME}}</strong>，请做好准备。',
        text: data => `您与候选人${data.candidateName}的${data.jobTitle}面试将在30分钟内开始，面试开始时间：${data.interviewStartTime}，请做好准备。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Starting Soon',
        title: 'Interview Starting Soon',
        body: 'Your interview with candidate <strong>{{CANDIDATE_NAME}}</strong> for <strong>{{JOB_TITLE}}</strong> will start in 30 minutes. Interview time: <strong>{{INTERVIEW_START_TIME}}</strong>. Please get ready.',
        text: data => `Your interview with candidate ${data.candidateName} for ${data.jobTitle} will start in 30 minutes. Interview time: ${data.interviewStartTime}. Please get ready.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
