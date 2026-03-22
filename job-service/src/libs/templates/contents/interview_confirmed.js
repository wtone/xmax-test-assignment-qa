/**
 * 面试已确认邮件模板
 * Email Type: INTERVIEW_CONFIRMED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_confirmed',

    [LANGUAGES.CN]: {
        subject: data => `面试确认 - ${data.position} @ ${data.companyName}`,
        title: '面试已确认',
        body: '尊敬的 {{CANDIDATE_NAME}}：<br><br>您已成功确认参加 <strong>{{COMPANY_NAME}}</strong> <strong>{{POSITION}}</strong> 职位的面试。<br><br><strong>面试时间：</strong>{{INTERVIEW_TIME}}<br><strong>面试方式：</strong>{{INTERVIEW_TYPE}}<br><strong>面试地点：</strong>{{LOCATION}}<br><br>请准时参加面试。祝您面试顺利！',
        text: data =>
            `尊敬的 ${data.candidateName}：您已成功确认参加 ${data.companyName} ${data.position} 职位的面试。面试时间：${data.interviewTime}，面试方式：${data.interviewType || '现场面试'}，地点：${data.location || '待定'}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看面试详情',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Interview Confirmed - ${data.position} @ ${data.companyName}`,
        title: 'Interview Confirmed',
        body: 'Dear {{CANDIDATE_NAME}},<br><br>You have successfully confirmed your interview for the <strong>{{POSITION}}</strong> position at <strong>{{COMPANY_NAME}}</strong>.<br><br><strong>Interview Time:</strong> {{INTERVIEW_TIME}}<br><strong>Interview Type:</strong> {{INTERVIEW_TYPE}}<br><strong>Location:</strong> {{LOCATION}}<br><br>Please be punctual. Good luck with your interview!',
        text: data =>
            `Dear ${data.candidateName}, You have successfully confirmed your interview for ${data.position} at ${data.companyName}. Interview time: ${data.interviewTime}, Type: ${data.interviewType || 'On-site'}, Location: ${data.location || 'TBD'}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Interview Details',
        actionUrlKey: 'detailUrl',
    },
}
