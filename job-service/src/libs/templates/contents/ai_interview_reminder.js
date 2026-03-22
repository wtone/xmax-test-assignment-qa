/**
 * AI面试提醒邮件模板
 * Email Type: AI_INTERVIEW_REMINDER
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'ai_interview_reminder',

    [LANGUAGES.CN]: {
        subject: data => `邀请您完成${data.companyName}的AI面试`,
        title: 'AI面试提醒',
        body: '您在<strong>{{COMPANY_NAME}}</strong>投递的<strong>{{POSITION}}</strong>仍有AI面试尚未完成，面试官对您很感兴趣，邀请您尽快完成。',
        text: data =>
            `您在${data.companyName}投递的${data.position}仍有AI面试尚未完成，面试官对您很感兴趣，邀请您尽快完成。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '现在去',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Complete your AI Interview for ${data.companyName}`,
        title: 'AI Interview Reminder',
        body: 'Your application for <strong>{{POSITION}}</strong> at <strong>{{COMPANY_NAME}}</strong> still has an incomplete AI interview. The hiring manager is interested in you. Please complete it as soon as possible.',
        text: data =>
            `Your application for ${data.position} at ${data.companyName} has an incomplete AI interview. Please complete it soon.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Go Now',
        actionUrlKey: 'detailUrl',
    },
}
