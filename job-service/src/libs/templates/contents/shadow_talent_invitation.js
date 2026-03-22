import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'shadow_talent_invitation',

    [LANGUAGES.CN]: {
        subject: data => `${data.companyName}招聘负责人诚邀您投递${data.position}`,
        title: '岗位投递邀请',
        body: '<strong>{{CANDIDATE_NAME}}</strong>您好，<strong>{{COMPANY_NAME}}</strong>招聘负责人看到您的简历和正在热招的<strong>{{POSITION}}</strong>非常匹配，邀请您使用专属招聘系统投递。建议您使用该收件邮箱地址注册。',
        text: data =>
            `${data.candidateName}您好，${data.companyName}招聘负责人看到您的简历和正在热招的${data.position}非常匹配，邀请您使用专属招聘系统投递。建议您使用该收件邮箱地址注册。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '立即投递',
        actionUrlKey: 'inviteUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `${data.companyName} invites you to apply for ${data.position}`,
        title: 'Job Application Invitation',
        body: 'Hi <strong>{{CANDIDATE_NAME}}</strong>, the hiring manager at <strong>{{COMPANY_NAME}}</strong> found your resume to be a great match for <strong>{{POSITION}}</strong> and invites you to apply. We recommend registering with this email address.',
        text: data =>
            `Hi ${data.candidateName}, the hiring manager at ${data.companyName} found your resume to be a great match for ${data.position} and invites you to apply. We recommend registering with this email address.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Apply Now',
        actionUrlKey: 'inviteUrl',
    },
}
