/**
 * 候选人信息获取辅助模块
 * @module services/helpers/CandidateHelper
 * @description 封装获取候选人姓名、联系方式等信息的通用逻辑，支持多数据源 fallback
 */

import ResumeService from '../integration/ResumeService.js'
import UserCenterService from '../integration/UserCenterService.js'
import logger from '../../../utils/logger.js'

/**
 * 从简历数据中提取姓名
 * @param {Object} resumeData - 简历数据对象
 * @returns {string|null} 姓名或 null
 */
export function extractNameFromResume(resumeData) {
    if (!resumeData) return null
    return resumeData.name ||
           resumeData.personalInfo?.name ||
           resumeData.basicInfo?.name ||
           resumeData.contactInfo?.name ||
           resumeData.contact?.name ||
           null
}

/**
 * 从用户中心 profile 中提取姓名
 * @param {Object} profile - 用户中心返回的 profile 对象
 * @returns {string|null} 姓名或 null
 */
export function extractNameFromProfile(profile) {
    if (!profile) return null
    return profile.name ||
           profile.nickname ||
           profile.displayName ||
           profile.realName ||
           null
}

/**
 * 获取候选人完整信息（姓名、邮箱、电话）
 *
 * 获取优先级：
 * 1. 从指定简历获取姓名（如果提供 resumeId）
 * 2. 从候选人的主简历获取姓名
 * 3. 从用户中心获取姓名
 *
 * @param {string} candidateId - 候选人ID
 * @param {Object} options - 可选参数
 * @param {string} [options.resumeId] - 指定的简历ID（优先使用）
 * @param {string} [options.applicationId] - 申请ID（用于日志）
 * @returns {Promise<Object>} 候选人信息 { name, email, phone }
 */
export async function getCandidateInfo(candidateId, options = {}) {
    const { resumeId, applicationId } = options
    let candidateName = null

    // 1. 如果提供了 resumeId，优先从该简历获取姓名
    if (resumeId) {
        try {
            const resumeResponse = await ResumeService.getResume(candidateId, resumeId)
            const resumeData = resumeResponse?.data?.data || resumeResponse?.data
            candidateName = extractNameFromResume(resumeData)
            logger.info('[CandidateHelper] Got name from specified resume', {
                candidateId,
                resumeId,
                extractedName: candidateName,
            })
        } catch (error) {
            logger.warn('[CandidateHelper] Failed to get specified resume', {
                candidateId,
                resumeId,
                error: error.message,
            })
        }
    }

    // 2. 如果没有获取到姓名，尝试获取候选人的主简历
    if (!candidateName) {
        try {
            const resumesResponse = await ResumeService.getPrimaryResume(candidateId)
            const resumes = resumesResponse?.data?.data || resumesResponse?.data
            // 可能返回单个简历或简历数组
            const primaryResume = Array.isArray(resumes) ? resumes[0] : resumes
            if (primaryResume) {
                candidateName = extractNameFromResume(primaryResume)
                logger.info('[CandidateHelper] Got name from primary resume', {
                    candidateId,
                    extractedName: candidateName,
                })
            }
        } catch (error) {
            logger.warn('[CandidateHelper] Failed to get primary resume', {
                candidateId,
                error: error.message,
            })
        }
    }

    // 3. 从用户中心获取候选人信息
    let candidateInfo = { name: candidateName || 'Unknown' }
    try {
        const profile = await UserCenterService.getCandidateProfile(candidateId)
        if (profile) {
            const profileName = extractNameFromProfile(profile)
            candidateInfo = {
                name: candidateName || profileName || 'Unknown',
                email: profile.email,
                phone: profile.phone || profile.mobile,
            }
            logger.info('[CandidateHelper] Got candidate profile', {
                candidateId,
                profileName,
                finalName: candidateInfo.name,
            })
        }
    } catch (error) {
        logger.warn('[CandidateHelper] Failed to get candidate profile', {
            candidateId,
            error: error.message,
        })
    }

    // 最终检查：如果还是 Unknown，记录警告
    if (candidateInfo.name === 'Unknown') {
        logger.warn('[CandidateHelper] Could not retrieve candidate name, using Unknown', {
            candidateId,
            resumeId,
            applicationId,
        })
    }

    return candidateInfo
}

/**
 * 仅获取候选人姓名（轻量版，不获取联系方式）
 *
 * @param {string} candidateId - 候选人ID
 * @param {Object} options - 可选参数
 * @param {string} [options.resumeId] - 指定的简历ID
 * @returns {Promise<string>} 候选人姓名
 */
export async function getCandidateName(candidateId, options = {}) {
    const info = await getCandidateInfo(candidateId, options)
    return info.name
}

export default {
    extractNameFromResume,
    extractNameFromProfile,
    getCandidateInfo,
    getCandidateName,
}
