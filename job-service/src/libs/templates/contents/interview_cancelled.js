/**
 * 面试已取消 - C端（候选人收到企业取消）
 * Email Type: INTERVIEW_CANCELLED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_cancelled',

    [LANGUAGES.CN]: {
        subject: '面试已取消',
        title: '面试已取消',
        body: '您和 <strong>{{COMPANY_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 的面试已被取消{{REASON}}，没关系，再去看看其他岗位吧。',
        text: data =>
            `您和${data.companyName}的${data.jobTitle}的面试已被取消${data.reason || ''}，没关系，再去看看其他岗位吧。`,
        actionType: ACTION_TYPES.NONE,
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Cancelled',
        title: 'Interview Cancelled',
        body: 'Your interview for <strong>{{JOB_TITLE}}</strong> at <strong>{{COMPANY_NAME}}</strong> has been cancelled{{REASON}}. No worries, check out other positions.',
        text: data =>
            `Your interview for ${data.jobTitle} at ${data.companyName} has been cancelled${data.reason || ''}. No worries, check out other positions.`,
        actionType: ACTION_TYPES.NONE,
    },
}
