/**
 * 面试邀请邮件模板
 * Email Type: INTERVIEW_INVITATION
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_invitation',

    [LANGUAGES.CN]: {
        subject: data => `面试邀请 - ${data.position} @ ${data.companyName}`,
        title: '面试邀请',
        body: '尊敬的 {{CANDIDATE_NAME}}：<br><br>恭喜您！您已通过 <strong>{{COMPANY_NAME}}</strong> <strong>{{POSITION}}</strong> 职位的简历筛选，诚邀您参加面试。<br><br><strong>面试时间：</strong>{{INTERVIEW_TIME}}<br><strong>面试方式：</strong>{{INTERVIEW_TYPE}}<br><strong>面试地点：</strong>{{LOCATION}}<br><br>请提前做好准备，如有问题请及时联系我们。',
        text: data =>
            `尊敬的 ${data.candidateName}：恭喜您！您已通过 ${data.companyName} ${data.position} 职位的简历筛选。面试时间：${data.interviewTime}，面试方式：${data.interviewType || '现场面试'}，地点：${data.location || '待定'}。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'detailUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Interview Invitation - ${data.position} @ ${data.companyName}`,
        title: 'Interview Invitation',
        body: 'Dear {{CANDIDATE_NAME}},<br><br>Congratulations! You have passed the resume screening for the <strong>{{POSITION}}</strong> position at <strong>{{COMPANY_NAME}}</strong>. We cordially invite you to an interview.<br><br><strong>Interview Time:</strong> {{INTERVIEW_TIME}}<br><strong>Interview Type:</strong> {{INTERVIEW_TYPE}}<br><strong>Location:</strong> {{LOCATION}}<br><br>Please prepare in advance. Contact us if you have any questions.',
        text: data =>
            `Dear ${data.candidateName}, You have passed the resume screening for ${data.position} at ${data.companyName}. Interview time: ${data.interviewTime}, Type: ${data.interviewType || 'On-site'}, Location: ${data.location || 'TBD'}.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'detailUrl',
    },
}
