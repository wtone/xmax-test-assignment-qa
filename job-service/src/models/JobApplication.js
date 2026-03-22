import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import { APPLICATION_STATUS, APPLICATION_STATUS_VALUES } from '../constants/application_status.js'

const { Schema } = mongoose

// AI 分析 Schema
const aiAnalysisSchema = new Schema(
    {
        skillMatch: {
            type: Number,
            min: 0,
            max: 1,
        },
        experienceMatch: {
            type: Number,
            min: 0,
            max: 1,
        },
        locationMatch: {
            type: Number,
            min: 0,
            max: 1,
        },
        educationMatch: {
            type: Number,
            min: 0,
            max: 1,
        },
        overallFit: {
            type: Number,
            min: 0,
            max: 1,
        },
        recommendations: [
            {
                type: String,
            },
        ],
    },
    { _id: false },
)

// AI 评估 Schema（旧版面试评分，保留以兼容历史数据）
const aiEvaluationSchema = new Schema(
    {
        technical: {
            type: Number,
            min: 1,
            max: 5,
        },
        communication: {
            type: Number,
            min: 1,
            max: 5,
        },
        problemSolving: {
            type: Number,
            min: 1,
            max: 5,
        },
        teamwork: {
            type: Number,
            min: 1,
            max: 5,
        },
        overall: {
            type: Number,
            min: 1,
            max: 5,
        },
    },
    { _id: false },
)

// Job AI 评估结果 Schema（字段与 job-evaluations 接口保持一致）
const jobAiEvaluationSchema = new Schema(
    {
        id: {
            type: Schema.Types.Mixed,
        },
        status: {
            type: String,
            trim: true,
        },
        overall_matching_score: {
            type: Number,
            min: 0,
            max: 100,
        },
        match_score: {
            type: Number,
            min: 0,
            max: 100,
        },
        recommendation_tier: {
            type: String,
            trim: true,
        },
        brief_summary: {
            type: String,
            maxlength: 5000,
        },
        total_interviews: {
            type: Number,
            min: 0,
        },
        completed_interviews: {
            type: Number,
            min: 0,
        },
        created_at: Date,
        completed_at: Date,
        interview_evaluation: {
            type: Schema.Types.Mixed,
        },
        metadata: {
            type: Schema.Types.Mixed,
        },
        individual_job_match_evaluations: {
            type: Schema.Types.Mixed,  // 动态 key（面试类型名），值为评估对象
        },
        evaluation_method: {
            type: String,
            trim: true,
        },
    },
    { _id: false },
)

// 面试信息 Schema
const interviewSchema = new Schema(
    {
        status: {
            type: String,
            enum: ['pending', 'in-progress', 'completed', 'skipped'],
            default: 'pending',
        },
        interviewId: {
            type: Schema.Types.ObjectId,
            ref: 'Interview',
        },
        processId: {
            type: Schema.Types.ObjectId,
            ref: 'InterviewProcess',
        },
        score: {
            type: Number,
            min: 0,
            max: 100,
        },
        aiEvaluation: aiEvaluationSchema,
        feedback: {
            type: String,
            maxlength: 2000,
        },
        startedAt: Date,
        completedAt: Date,
    },
    { _id: false },
)

// 排名信息 Schema
const rankingSchema = new Schema(
    {
        position: {
            type: Number,
            min: 1,
        },
        label: {
            type: String,
            trim: true,
        },
        percentile: {
            type: Number,
            min: 0,
            max: 100,
        },
    },
    { _id: false },
)

// 状态历史 Schema
const statusHistorySchema = new Schema(
    {
        status: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        operator: {
            type: Schema.Types.Mixed, // 可以是 ObjectId 或 'system'
        },
        note: {
            type: String,
            maxlength: 500,
        },
    },
    { _id: false },
)

// 合同信息 Schema
const contractSchema = new Schema(
    {
        status: {
            type: String,
            enum: ['pending', 'sent', 'accepted', 'rejected', 'signed', 'expired'],
            default: 'pending',
        },
        offerId: {
            type: Schema.Types.ObjectId,
            ref: 'ContractOffer',
        },
        sentAt: Date,
        respondedAt: Date,
        signedAt: Date,
    },
    { _id: false },
)

// 申请模型
const jobApplicationSchema = new Schema(
    {
        // 业务标识
        applicationId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // 关联信息
        jobId: {
            type: Schema.Types.ObjectId, // 引用JobPost的_id
            ref: 'JobPost',
            required: true,
            index: true,
        },
        candidateId: {
            type: String, // 支持UUID格式的用户ID（外部系统）
            required: true,
            index: true,
        },
        resumeId: {
            type: String, // 支持UUID格式的简历ID（外部系统）
            required: false, // SUBMITTING 状态下可能还没有简历
            index: true,
        },

        // 匹配信息
        matchScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        aiAnalysis: aiAnalysisSchema,
        evaluation: jobAiEvaluationSchema,
        evaluationUpdatedAt: Date,

        // 面试相关
        interview: interviewSchema,

        // 申请状态
        status: {
            type: String,
            required: true,
            enum: APPLICATION_STATUS_VALUES,
            default: APPLICATION_STATUS.SUBMITTED,
        },

        // 排名信息
        ranking: rankingSchema,

        // AI生成的候选人总结
        aiSummary: {
            type: String,
            maxlength: 3000,
        },

        // 状态历史
        statusHistory: [statusHistorySchema],

        // 申请内容
        coverLetter: {
            type: String,
            maxlength: 5000,
        },

        // 签约信息
        contract: contractSchema,

        // AI面试提醒记录
        aiInterviewReminders: [{
            sentAt: { type: Date, required: true },
            sentBy: { type: String, required: true },
            _id: false,
        }],

        // 时间信息
        // 状态时间戳 - 每个状态都有独立的时间记录
        submittingAt: {
            type: Date,
            // 开始申请的时间，等于createdAt
        },
        submittedAt: {
            type: Date,
            // 申请提交完成的时间（不应该是default: Date.now）
        },
        screeningAt: {
            type: Date,
            // 进入筛选阶段的时间
        },
        interviewAt: {
            type: Date,
            // 进入面试阶段的时间（兼容旧数据）
        },
        // 面试阶段细分状态时间戳
        interviewInvitingAt: {
            type: Date,
            // 进入邀约中状态的时间
        },
        interviewScheduledAt: {
            type: Date,
            // 进入待面试状态的时间
        },
        interviewCompletedAt: {
            type: Date,
            // 面试完成的时间
        },
        interviewTerminatedAt: {
            type: Date,
            // 面试终止的时间
        },
        offerAt: {
            type: Date,
            // 发放offer的时间
        },
        hiredAt: {
            type: Date,
            // 正式录用的时间
        },
        rejectedAt: {
            type: Date,
            // 拒绝的时间
        },
        withdrawnAt: {
            type: Date,
            // 撤回的时间
        },
        allInterviewsCompletedAt: {
            type: Date,
            // 所有AI面试完成的时间（在SUBMITTING状态下）
        },
        reviewedAt: Date, // 保留原有字段
    },
    {
        timestamps: true,
        collection: 'job_applications',
    },
)

// 虚拟字段：是否已完成面试
jobApplicationSchema.virtual('hasCompletedInterview').get(function () {
    return this.interview && this.interview.status === 'completed'
})

// 虚拟字段：是否已发送offer
jobApplicationSchema.virtual('hasOffer').get(function () {
    return this.contract && this.contract.offerId
})

// 虚拟字段：当前阶段
jobApplicationSchema.virtual('currentStage').get(function () {
    if (this.status === 'hired') return 'hired'
    if (this.status === 'rejected') return 'rejected'
    if (this.contract && this.contract.status === 'signed') return 'signed'
    if (this.contract && this.contract.offerId) return 'offer'
    if (this.interview && this.interview.status === 'completed') return 'interviewed'
    if (this.status === 'shortlisted') return 'shortlisted'
    if (this.status === 'under-review') return 'reviewing'
    return 'submitted'
})

// 虚拟字段：显示状态文本
jobApplicationSchema.virtual('statusText').get(function () {
    const statusMap = {
        submitted: '已提交',
        'under-review': '审核中',
        shortlisted: '已入围',
        rejected: '已拒绝',
        hired: '已录用',
    }
    return statusMap[this.status] || this.status
})

// 索引定义
// 复合索引 - 按职位查看申请
jobApplicationSchema.index({ jobId: 1, status: 1, matchScore: -1 })

// 复合索引 - 候选人查看自己的申请
jobApplicationSchema.index({ candidateId: 1, status: 1, submittedAt: -1 })

// 其他索引
jobApplicationSchema.index({ 'interview.interviewId': 1 })

// 中间件：生成 applicationId
jobApplicationSchema.pre('validate', async function (next) {
    if (!this.applicationId && this.isNew) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const sequence = uuidv4().slice(0, 8)
        this.applicationId = `app_${date}_${sequence}`
    }
    next()
})

// 中间件：记录状态变更和时间戳
jobApplicationSchema.pre('save', function (next) {
    const now = new Date()

    // 如果是新创建的申请，设置submittingAt
    if (this.isNew && this.status === APPLICATION_STATUS.SUBMITTING) {
        this.submittingAt = now
    }

    if (this.isModified('status')) {
        // 不要重复记录相同状态
        const lastStatus = this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1].status : null

        if (lastStatus !== this.status) {
            this.statusHistory.push({
                status: this.status,
                timestamp: now,
                operator: 'system', // 需要在应用层设置实际操作者
                note: `状态变更为: ${lastStatus} --> ${this.status}`,
            })
        }

        // 根据状态设置对应的时间戳（移出if条件，确保总是设置）
        switch (this.status) {
            case APPLICATION_STATUS.SUBMITTING:
                if (!this.submittingAt) this.submittingAt = now
                break
            case APPLICATION_STATUS.SUBMITTED:
                if (!this.submittedAt) this.submittedAt = now
                break
            case APPLICATION_STATUS.SCREENING:
                if (!this.screeningAt) this.screeningAt = now
                break
            case APPLICATION_STATUS.INTERVIEW:
                if (!this.interviewAt) this.interviewAt = now
                break
            // 面试阶段细分状态
            case APPLICATION_STATUS.INTERVIEW_INVITING:
                if (!this.interviewInvitingAt) this.interviewInvitingAt = now
                break
            case APPLICATION_STATUS.INTERVIEW_SCHEDULED:
                if (!this.interviewScheduledAt) this.interviewScheduledAt = now
                break
            case APPLICATION_STATUS.INTERVIEW_COMPLETED:
                if (!this.interviewCompletedAt) this.interviewCompletedAt = now
                break
            case APPLICATION_STATUS.INTERVIEW_TERMINATED:
                if (!this.interviewTerminatedAt) this.interviewTerminatedAt = now
                break
            case APPLICATION_STATUS.OFFER:
                if (!this.offerAt) this.offerAt = now
                break
            case APPLICATION_STATUS.HIRED:
                if (!this.hiredAt) this.hiredAt = now
                break
            case APPLICATION_STATUS.REJECTED:
                if (!this.rejectedAt) this.rejectedAt = now
                break
            case APPLICATION_STATUS.WITHDRAWN:
                if (!this.withdrawnAt) this.withdrawnAt = now
                break
        }

        // 设置审核时间
        if (this.status === 'under-review' && !this.reviewedAt) {
            this.reviewedAt = now
        }
    }
    next()
})

// 实例方法：更新匹配分数
jobApplicationSchema.methods.updateMatchScore = async function (score, analysis) {
    this.matchScore = Math.round(score * 100) // 转换为百分制
    if (analysis) {
        this.aiAnalysis = analysis
    }
    return this.save()
}

// 实例方法：更新状态
jobApplicationSchema.methods.updateStatus = async function (newStatus, operator, note) {
    const { getNextPossibleStatuses, APPLICATION_STATUS_NAMES } = await import('../constants/application_status.js')
    const { default: logger } = await import('../../utils/logger.js')

    const oldStatus = this.status
    const possibleStatuses = getNextPossibleStatuses(oldStatus)

    // 验证状态转换是否合法
    if (!possibleStatuses.includes(newStatus)) {
        const error = new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`)
        logger.error('[JobApplication] Invalid status transition attempted', {
            applicationId: this.applicationId,
            candidateId: this.candidateId,
            jobId: this.jobId,
            currentStatus: oldStatus,
            attemptedStatus: newStatus,
            validStatuses: possibleStatuses,
            operator,
            note,
        })
        throw error
    }

    // 记录状态转换日志
    logger.info('[JobApplication] Status transition', {
        applicationId: this.applicationId,
        candidateId: this.candidateId,
        jobId: this.jobId,
        from: oldStatus,
        fromName: APPLICATION_STATUS_NAMES[oldStatus],
        to: newStatus,
        toName: APPLICATION_STATUS_NAMES[newStatus],
        operator: operator || 'system',
        note,
        timestamp: new Date().toISOString(),
    })

    this.status = newStatus
    if (operator || note) {
        // 找到刚刚添加的状态历史记录
        const lastHistory = this.statusHistory[this.statusHistory.length - 1]
        if (lastHistory && lastHistory.status === newStatus) {
            if (operator) lastHistory.operator = operator
            if (note) lastHistory.note = note
        }
    }

    const result = await this.save()

    // 记录成功的状态转换
    logger.info('[JobApplication] Status transition successful', {
        applicationId: this.applicationId,
        newStatus,
        statusName: APPLICATION_STATUS_NAMES[newStatus],
        updatedAt: result.updatedAt,
    })

    return result
}

// 实例方法：更新面试信息
jobApplicationSchema.methods.updateInterview = async function (interviewData) {
    this.interview = { ...this.interview, ...interviewData }
    return this.save()
}

// 实例方法：更新排名
jobApplicationSchema.methods.updateRanking = async function (position, totalApplications) {
    const percentile = ((totalApplications - position + 1) / totalApplications) * 100
    this.ranking = {
        position,
        label: position === 1 ? 'TOP 1' : `TOP ${position}`,
        percentile: Math.round(percentile * 10) / 10,
    }
    return this.save()
}

// 实例方法：发送offer
jobApplicationSchema.methods.sendOffer = async function (offerId) {
    this.contract = {
        status: 'sent',
        offerId,
        sentAt: new Date(),
    }
    return this.save()
}

// 实例方法：检查是否可以进入下一步
jobApplicationSchema.methods.canProceedToNextStage = function () {
    const stageFlow = {
        submitted: ['under-review', 'rejected'],
        'under-review': ['shortlisted', 'rejected'],
        shortlisted: ['hired', 'rejected'],
    }

    return stageFlow[this.status] || []
}

// 静态方法：按职位统计申请
jobApplicationSchema.statics.countByJob = async function (jobId) {
    return this.aggregate([
        { $match: { jobId: new mongoose.Types.ObjectId(jobId) } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgMatchScore: { $avg: '$matchScore' },
            },
        },
    ])
}

// 静态方法：获取排名列表
jobApplicationSchema.statics.getRankingList = async function (jobId, limit = 10) {
    return this.find({
        jobId: new mongoose.Types.ObjectId(jobId),
        status: { $in: ['under-review', 'shortlisted', 'hired'] },
    })
        .sort({ matchScore: -1 })
        .limit(limit)
        .select('applicationId candidateId matchScore ranking interview.score')
        .exec()
}

// 静态方法：更新排名
jobApplicationSchema.statics.updateRankings = async function (jobId) {
    const applications = await this.find({
        jobId: new mongoose.Types.ObjectId(jobId),
        status: { $in: ['under-review', 'shortlisted', 'hired'] },
    })
        .sort({ matchScore: -1 })
        .select('_id matchScore')

    const total = applications.length

    // 批量更新排名
    const bulkOps = applications.map((app, index) => ({
        updateOne: {
            filter: { _id: app._id },
            update: {
                $set: {
                    ranking: {
                        position: index + 1,
                        label: index === 0 ? 'TOP 1' : `TOP ${index + 1}`,
                        percentile: Math.round(((total - index) / total) * 1000) / 10,
                    },
                },
            },
        },
    }))

    if (bulkOps.length > 0) {
        await this.bulkWrite(bulkOps)
    }
}

// toJSON 转换
jobApplicationSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema)

export default JobApplication
