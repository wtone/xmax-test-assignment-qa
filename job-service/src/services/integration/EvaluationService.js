/**
 * 评估服务
 * @module services/integration/EvaluationService
 * @description 集成database-js服务的conversation API进行job evaluation
 */

import { BaseService } from './base_service.js'
import logger from '../../../utils/logger.js'

/**
 * 评估服务类
 * 用于调用database-js服务的job-evaluations API
 */
class EvaluationService extends BaseService {
    constructor() {
        // 使用database-js服务的地址
        const baseURL = process.env.DATABASE_SERVICE_JS_URL || 'http://localhost:3007'

        super({
            baseURL,
            serviceName: 'database-service-js',
            timeout: 30000,
            retries: 3,
            retryInterval: 1000,
        })
    }

    /**
     * 创建职位评估任务
     * @param {Object} evaluationData - 评估数据
     * @param {string} evaluationData.jobId - 职位ID (MongoDB ObjectId)
     * @param {string} evaluationData.candidateId - 候选人ID (UUID)
     * @param {string} evaluationData.resumeId - 简历ID (UUID)
     * @param {string} evaluationData.applicationId - 申请ID
     * @param {string} evaluationData.userId - 用户ID (用于X-user-id头部)
     * @param {Object} evaluationData.jobData - 职位信息
     * @param {Object} evaluationData.resumeData - 简历信息
     * @param {string} [evaluationData.coverLetter] - 求职信
     * @returns {Promise<Object>} 评估任务创建结果
     */
    async createJobEvaluation(evaluationData) {
        try {
            logger.info('[EvaluationService] Creating job evaluation', {
                jobId: evaluationData.jobId,
                candidateId: evaluationData.candidateId,
                applicationId: evaluationData.applicationId,
                userId: evaluationData.userId,
                hasParsedDescription: !!evaluationData.jobData?.parsedDescription,
                parsedDescriptionLength: evaluationData.jobData?.parsedDescription?.length || 0,
            })

            // 验证必需的面试类型字段
            if (
                !evaluationData.requiredInterviewTypes ||
                !Array.isArray(evaluationData.requiredInterviewTypes)
            ) {
                const error = new Error('requiredInterviewTypes is required and must be an array')
                logger.error('[EvaluationService] Validation failed', {
                    requiredInterviewTypes: evaluationData.requiredInterviewTypes,
                    error: error.message,
                })
                throw error
            }

            // 设置用户ID头部，database-service-js需要这个头部进行用户验证
            this.setGatewayHeaders({
                'x-user-id': evaluationData.userId || evaluationData.candidateId,
            })

            // 构建请求数据 - 注意database-service-js要求下划线格式的字段名
            const requestData = {
                job_id: evaluationData.jobId.toString(), // 转换ObjectId为字符串，使用下划线格式
                candidate_id: evaluationData.candidateId, // 使用下划线格式
                required_interview_types: evaluationData.requiredInterviewTypes, // 必需字段，不提供默认值，必须有效
                job_description: evaluationData.jobData.parsedDescription || `${evaluationData.jobData.title}\n${evaluationData.jobData.description}`, // 优先使用parsedDescription，否则使用title+description

                // 以下是额外的元数据，不是必需的但有助于追踪
                application_id: evaluationData.applicationId,
                resume_id: evaluationData.resumeId,
                job_data: evaluationData.jobData, // 保留详细的职位数据
                resume_data: evaluationData.resumeData, // 保留简历数据
                cover_letter: evaluationData.coverLetter,
                metadata: {
                    source: 'job-application',
                    timestamp: new Date().toISOString(),
                },
            }

            // 调用conversation API创建评估任务
            const response = await this.post('/api/v1/conversation/job-evaluations', requestData)

            logger.info('[EvaluationService] Job evaluation created successfully', {
                evaluationId: response.data?.id,
                applicationId: evaluationData.applicationId,
            })

            return response.data
        } catch (error) {
            logger.error('[EvaluationService] Failed to create job evaluation', {
                error: error.message,
                applicationId: evaluationData.applicationId,
                jobId: evaluationData.jobId,
            })

            // 重新抛出错误，让调用方决定如何处理
            // 根据记忆中的需求，评估创建失败应该阻止申请提交
            throw error
        }
    }

    /**
     * 获取评估结果
     * @param {string} evaluationId - 评估ID
     * @returns {Promise<Object>} 评估结果
     */
    async getEvaluationResult(evaluationId) {
        try {
            logger.info('[EvaluationService] Getting evaluation result', {
                evaluationId,
            })

            const response = await this.get(`/api/v1/conversation/job-evaluations/${evaluationId}`)

            logger.info('[EvaluationService] Evaluation result retrieved', {
                evaluationId,
                status: response.data?.status,
            })

            return response.data
        } catch (error) {
            logger.error('[EvaluationService] Failed to get evaluation result', {
                error: error.message,
                evaluationId,
            })
            throw error
        }
    }

    /**
     * 获取候选人的所有评估
     * @param {string} candidateId - 候选人ID
     * @param {Object} [options] - 查询选项
     * @param {number} [options.page] - 页码
     * @param {number} [options.pageSize] - 每页数量
     * @param {string} [options.companyId] - 公司ID（B端操作需要）
     * @returns {Promise<Object>} 评估列表
     */
    async getCandidateEvaluations(candidateId, options = {}) {
        try {
            logger.info('[EvaluationService] Getting candidate evaluations', {
                candidateId,
                options,
                endpoint: `/api/v1/conversation/job-evaluations/candidate/${candidateId}`,
            })

            // 设置必要的 headers
            const headers = {}

            // 设置 x-user-id header
            // 优先使用提供的 userId，否则使用 candidateId（因为我们在查询候选人的数据）
            if (options.userId) {
                headers['x-user-id'] = options.userId
            } else {
                // 对于轮询服务，使用 candidateId 作为 x-user-id
                // 因为我们在查询该候选人的评估数据
                headers['x-user-id'] = candidateId
                logger.info('[EvaluationService] Using candidateId as x-user-id for polling', {
                    candidateId,
                })
            }

            // 如果提供了 companyId，设置 x-user-company-id header (使用小写以保持一致性)
            if (options.companyId) {
                headers['x-user-company-id'] = options.companyId
                logger.info('[EvaluationService] Setting x-user-company-id header', {
                    companyId: options.companyId,
                })
            }

            // 使用正确的 GET 端点
            // 参考 database-service-js/src/routes/jobEvaluations.js:595
            const response = await this.get(
                `/api/v1/conversation/job-evaluations/candidate/${candidateId}`,
                {
                    limit: options.pageSize || 100,
                    offset: ((options.page || 1) - 1) * (options.pageSize || 100),
                },
                {
                    headers: headers,
                },
            )

            logger.info('[EvaluationService] Candidate evaluations retrieved', {
                candidateId,
                evaluations: response.data?.evaluations?.length || 0,
                total: response.data?.total || 0,
            })

            // 转换响应格式以匹配预期结构
            return {
                data: response.data?.evaluations || [],
                total: response.data?.total || 0,
                page: options.page || 1,
                pageSize: options.pageSize || 100,
            }
        } catch (error) {
            // 详细记录错误信息，包括响应体
            const errorDetails = {
                message: error.message,
                status: error.response?.status,
                statusText: error.response?.statusText,
                responseBody: error.response?.data,
                candidateId,
                endpoint: `/api/v1/conversation/job-evaluations/candidate/${candidateId}`,
                headers: error.config?.headers,
            }

            logger.error('[EvaluationService] Failed to get candidate evaluations - DETAILED ERROR:', errorDetails)

            // 特别处理 400 错误 - 通常是缺少必需参数
            if (error.response?.status === 400) {
                logger.error('[EvaluationService] 400 Bad Request - Likely missing X-user-id header', {
                    responseError: error.response?.data?.error || 'Unknown',
                    responseMessage: error.response?.data?.message || 'No message',
                })
            }

            // 如果是连接错误（数据库服务未运行），返回空结果
            // 没有 response 对象通常意味着连接失败
            if (!error.response) {
                logger.error('[EvaluationService] Database service not available', {
                    candidateId,
                    errorCode: error.code,
                    errorMessage: error.message,
                })

                // 不使用 mock 数据，返回空结果
                return {
                    data: [],
                    total: 0,
                    page: options.page || 1,
                    pageSize: options.pageSize || 100,
                    error: 'Database service not available',
                }
            }

            // 返回空结果而不是抛出错误，让轮询继续
            return {
                data: [],
                total: 0,
                page: options.page || 1,
                pageSize: options.pageSize || 100,
                error: error.response?.data?.error || error.message,
            }
        }
    }

    /**
     * 更新评估状态
     * @param {string} evaluationId - 评估ID
     * @param {string} status - 新状态
     * @param {Object} [metadata] - 额外元数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateEvaluationStatus(evaluationId, status, metadata = {}) {
        try {
            logger.info('[EvaluationService] Updating evaluation status', {
                evaluationId,
                status,
                metadata,
            })

            const response = await this.patch(`/api/v1/conversation/job-evaluations/${evaluationId}`, {
                status,
                metadata,
                updatedAt: new Date().toISOString(),
            })

            logger.info('[EvaluationService] Evaluation status updated', {
                evaluationId,
                status,
            })

            return response.data
        } catch (error) {
            logger.error('[EvaluationService] Failed to update evaluation status', {
                error: error.message,
                evaluationId,
                status,
            })
            throw error
        }
    }

    /**
     * 获取候选人近期的面试历史记录
     * @param {string} candidateId - 候选人ID
     * @param {number} [days=2] - 查询天数范围
     * @returns {Promise<Object|null>} 面试历史数据，失败时返回 null
     */
    async getCandidateInterviewHistory(candidateId, days = 2) {
        try {
            const response = await this.get(
                `/api/v1/conversation/sessions/candidate/history`,
                {
                    candidate_id: candidateId,
                    days: days,
                },
                {
                    headers: { 'x-user-id': candidateId },
                },
            )
            return response?.data
        } catch (error) {
            logger.error('[EvaluationService] getCandidateInterviewHistory failed:', {
                candidateId,
                days,
                error: error.message,
            })
            return null
        }
    }

    /**
     * 检查候选人是否已完成面试评估
     * @param {string} candidateId - 候选人ID
     * @param {string} interviewType - 面试类型（sessions.id）
     * @returns {Promise<Object>} 包含 has_completed 等信息的对象
     */
    async checkCandidateHasCompleted(candidateId, interviewType) {
        // 如果没有提供面试类型，返回未完成
        if (!interviewType) {
            logger.warn('[EvaluationService] No interview type provided for completion check', {
                candidateId,
            })
            return {
                has_completed: false,
                candidate_id: candidateId,
                interview_type: null,
                error: 'No interview type provided',
            }
        }
        try {
            logger.info('[EvaluationService] Checking if candidate has completed interview', {
                candidateId,
                interviewType,
            })

            // 设置必要的 headers
            const headers = {
                'x-user-id': candidateId, // 使用候选人ID作为用户ID
            }

            // 调用新的 API
            const response = await this.get(
                `/api/v1/conversation/sessions/candidate/has-completed`,
                {
                    interview_type: interviewType,
                    candidate_id: candidateId,
                },
                {
                    headers: headers,
                },
            )

            logger.info('[EvaluationService] Candidate interview completion check result', {
                candidateId,
                hasCompleted: response.data?.has_completed,
                qualifyingCount: response.data?.qualifying_count,
                lastCompletedAt: response.data?.last_completed_at,
            })

            return response.data
        } catch (error) {
            logger.error('[EvaluationService] Failed to check candidate interview completion', {
                error: error.message,
                candidateId,
                interviewType,
            })

            // 如果服务不可用，返回未完成状态
            if (!error.response) {
                logger.warn('[EvaluationService] Interview service not available, assuming not completed', {
                    candidateId,
                })
                return {
                    has_completed: false,
                    candidate_id: candidateId,
                    interview_type: interviewType,
                    error: 'Service not available',
                }
            }

            // 返回默认未完成状态
            return {
                has_completed: false,
                candidate_id: candidateId,
                interview_type: interviewType,
                error: error.message,
            }
        }
    }

    /**
     * 批量获取面试进度（total + completed 均来自 database-service）
     * @param {Array<{jobId: string, candidateId: string}>} pairs - job-candidate 对
     * @param {string} companyId - 公司ID（batch API 需要 x-user-company-id）
     * @returns {Promise<Map<string, {total: number, completed: number}>>}
     */
    async batchGetInterviewProgress(pairs, companyId) {
        if (!pairs || pairs.length === 0) return new Map()

        const resultMap = new Map()

        try {
            const response = await this.post(
                '/api/v1/conversation/job-evaluations/batch',
                {
                    evaluations: pairs.map(p => ({
                        job_id: p.jobId,
                        candidate_id: p.candidateId,
                    })),
                },
                {
                    headers: {
                        'x-user-id': 'system',
                        'x-user-company-id': companyId,
                    },
                }
            )

            if (response.data?.results) {
                for (const item of response.data.results) {
                    const key = `${item.job_id}:${item.candidate_id}`
                    const eval_ = item.evaluation
                    if (eval_ && eval_.total_interviews > 0) {
                        resultMap.set(key, {
                            total: eval_.total_interviews,
                            completed: eval_.completed_interviews ?? 0,
                        })
                    }
                }
            }
        } catch (error) {
            logger.warn('[EvaluationService] batchGetInterviewProgress failed', {
                pairsCount: pairs.length,
                error: error.message,
            })
        }

        return resultMap
    }

    /**
     * 健康检查
     * @returns {Promise<boolean>} 服务是否健康
     */
    async healthCheck() {
        try {
            const response = await this.get('/health', {}, { timeout: 5000 })
            return response.status === 200
        } catch (error) {
            logger.warn('[EvaluationService] Health check failed', {
                error: error.message,
            })
            return false
        }
    }
}

// 导出单例
export default new EvaluationService()
