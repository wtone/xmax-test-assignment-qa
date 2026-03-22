/**
 * 加载候选人信息中间件
 * @module middlewares/load-candidate-profile
 * @description 从 user-center 获取候选人 profile，挂载到 ctx.state.candidateProfile
 * @requires loadApplication → ctx.state.application.candidateId
 * @provides ctx.state.candidateProfile
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import UserCenterService from '../services/integration/UserCenterService.js'
import ResumeService from '../services/integration/ResumeService.js'

const isValidName = name => name && name.trim() && name !== 'Unknown'

export const loadCandidateProfile = () => {
    return async (ctx, next) => {
        const { candidateId } = ctx.state.application
        try {
            const profile = await UserCenterService.getUserProfile(candidateId)
            if (!profile?.email) {
                return sendError(ctx, ERROR_CODES.USER_SERVICE_ERROR, '候选人邮箱不可用', 422)
            }
            // user-center 可能返回 name 为空或 "Unknown"，从 resume-service 补充
            if (!isValidName(profile.name)) {
                try {
                    const resume = await ResumeService.getUserLatestResume(candidateId)
                    const resumeName = resume?.basicInfo?.name || resume?.data?.basicInfo?.name
                    if (isValidName(resumeName)) {
                        profile.name = resumeName
                    }
                } catch (_) { /* 静默，不阻断主流程 */ }
            }
            ctx.state.candidateProfile = profile
            await next()
        } catch (error) {
            ctx.logger.error('[loadCandidateProfile] Failed to load candidate profile', {
                candidateId,
                error: error.message,
            })
            return sendError(ctx, ERROR_CODES.USER_SERVICE_ERROR, '获取候选人信息失败', 500)
        }
    }
}
