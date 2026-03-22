/**
 * 面试已开始通知邮件模板
 * Email Type: INTERVIEW_STARTED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_started',

    [LANGUAGES.CN]: {
        subject: '您有面试已开始，请快速进入',
        title: '面试已开始',
        body: '您与 <strong>{{COMPANY_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试已经开始，面试开始时间：<strong>{{INTERVIEW_START_TIME}}</strong>，请尽快进入面试。',
        text: data =>
            `您与${data.companyName}的${data.jobTitle}面试已经开始，面试开始时间：${data.interviewStartTime}，请尽快进入面试。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '进入面试',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Your Interview Has Started',
        title: 'Interview Started',
        body: 'Your interview for <strong>{{JOB_TITLE}}</strong> at <strong>{{COMPANY_NAME}}</strong> has started. Interview time: <strong>{{INTERVIEW_START_TIME}}</strong>. Please join now.',
        text: data =>
            `Your interview for ${data.jobTitle} at ${data.companyName} has started. Interview time: ${data.interviewStartTime}. Please join now.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Join Interview',
        actionUrlKey: 'actionUrl',
    },
}
