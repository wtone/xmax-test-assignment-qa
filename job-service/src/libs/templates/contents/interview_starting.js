/**
 * 面试提醒（24小时前）- C端（候选人）
 * Email Type: INTERVIEW_STARTING
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_starting',

    [LANGUAGES.CN]: {
        subject: '面试提醒',
        title: '面试提醒',
        body: '您与 <strong>{{COMPANY_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试将在24小时内开始，面试开始时间：<strong>{{INTERVIEW_START_TIME}}</strong>，请做好准备。',
        text: data => `您与${data.companyName}的${data.jobTitle}面试将在24小时内开始，面试开始时间：${data.interviewStartTime}，请做好准备。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Reminder',
        title: 'Interview Reminder',
        body: 'Your interview for <strong>{{JOB_TITLE}}</strong> at <strong>{{COMPANY_NAME}}</strong> will start in 24 hours. Interview time: <strong>{{INTERVIEW_START_TIME}}</strong>. Please get ready.',
        text: data => `Your interview for ${data.jobTitle} at ${data.companyName} will start in 24 hours. Interview time: ${data.interviewStartTime}. Please get ready.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
