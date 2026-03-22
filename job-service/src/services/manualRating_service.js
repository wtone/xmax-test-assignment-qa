/**
 * 人工面试评分服务
 * @module services/manualRating_service
 */

import ManualInterviewRating from '../models/ManualInterviewRating.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import logger from '../../utils/logger.js'

/**
 * 人工评分服务类
 */
class ManualRatingService {
    /**
     * 提交或更新评分
     * @param {Object} data - 评分数据
     * @param {string} data.jobId - 职位ID
     * @param {string} data.candidateId - 候选人ID
     * @param {number} data.rating - 评分 (1-10)
     * @param {string} companyId - 企业ID
     * @param {string} ratedBy - 评分人ID
     * @returns {Promise<Object>} 评分记录
     */
    async upsertRating({ jobId, candidateId, rating, tagRatings, comment }, companyId, ratedBy) {
        try {
            const result = await ManualInterviewRating.findOneAndUpdate(
                { jobId, candidateId },
                {
                    $set: {
                        companyId,
                        rating,
                        tagRatings,
                        comment,
                        ratedBy,
                    },
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true,
                },
            )

            logger.info('人工评分提交成功', {
                jobId,
                candidateId,
                rating,
                ratedBy,
            })

            return this.formatRatingResponse(result)
        } catch (error) {
            logger.error('提交人工评分失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    /**
     * 查询评分
     * @param {string} jobId - 职位ID
     * @param {string} candidateId - 候选人ID
     * @param {string} companyId - 企业ID（用于权限验证）
     * @returns {Promise<Object|null>} 评分记录或 null
     */
    async getRating(jobId, candidateId, companyId) {
        try {
            const rating = await ManualInterviewRating.findOne({
                jobId,
                candidateId,
                companyId,
            })

            if (!rating) {
                return null
            }

            return this.formatRatingResponse(rating)
        } catch (error) {
            logger.error('查询人工评分失败:', error)
            throw { ...ERROR_CODES.INTERNAL_ERROR, detail: error.message }
        }
    }

    /**
     * 格式化评分响应
     * @param {Object} rating - 评分记录
     * @returns {Object} 格式化后的响应
     */
    formatRatingResponse(rating) {
        return {
            jobId: rating.jobId,
            candidateId: rating.candidateId,
            rating: rating.rating,
            tagRatings: rating.tagRatings || [],
            comment: rating.comment,
            ratedBy: rating.ratedBy,
            updatedAt: rating.updatedAt,
        }
    }
}

export default new ManualRatingService()
