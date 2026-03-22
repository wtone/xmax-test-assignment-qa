import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const { Schema } = mongoose

// 手动录入候选人模型
const manualCandidateSchema = new Schema(
    {
        // 业务标识
        candidateId: {
            type: String,
            required: true,
            unique: true,
            index: true,
            default: () => `mc_${uuidv4()}`
        },

        // 候选人基本信息
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true
        },

        // 投递信息
        jobPosition: {
            type: String,
            required: true,
            trim: true
        },
        jobId: {
            type: String,
            index: true,
            sparse: true // 允许为空，但如果有值则必须唯一组合
        },

        // 简历来源
        resumeSource: {
            type: String,
            required: true,
            enum: ['boss直聘', '智联招聘', '前程无忧', '小红书', '猎聘', 'LinkedIn', '内推', '官网', '其他'],
            default: 'boss直聘'
        },

        // 链接信息
        linkSentAt: {
            type: Date,
            required: true,
            default: Date.now
        },
        linkType: {
            type: String,
            enum: ['application', 'interview', 'assessment', 'other'],
            default: 'application'
        },
        linkUrl: {
            type: String,
            trim: true
        },

        // 状态跟踪
        status: {
            type: String,
            enum: ['sent', 'viewed', 'completed', 'expired'],
            default: 'sent'
        },
        viewedAt: {
            type: Date
        },
        completedAt: {
            type: Date
        },

        // 关联信息
        companyId: {
            type: String,
            index: true
        },
        createdBy: {
            type: String,
            required: false,  // 改为可选，因为管理员界面可能没有用户认证
            index: true
        },

        // 备注
        notes: {
            type: String,
            maxlength: 500
        },

        // 附加数据
        metadata: {
            type: Schema.Types.Mixed
        }
    },
    {
        timestamps: true,
        collection: 'manual_candidates'
    }
)

// 复合索引
manualCandidateSchema.index({ email: 1, jobPosition: 1 })
manualCandidateSchema.index({ companyId: 1, createdAt: -1 })
manualCandidateSchema.index({ resumeSource: 1, createdAt: -1 })
manualCandidateSchema.index({ status: 1, linkSentAt: -1 })

// 虚拟字段：是否过期（超过7天未完成）
manualCandidateSchema.virtual('isExpired').get(function () {
    if (this.status === 'completed') return false
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    return this.linkSentAt < sevenDaysAgo
})

// 虚拟字段：响应时间（从发送到完成的时间）
manualCandidateSchema.virtual('responseTime').get(function () {
    if (!this.completedAt) return null
    return Math.round((this.completedAt - this.linkSentAt) / (1000 * 60 * 60)) // 返回小时数
})

// 实例方法：标记为已查看
manualCandidateSchema.methods.markAsViewed = async function () {
    if (this.status === 'sent') {
        this.status = 'viewed'
        this.viewedAt = new Date()
        return this.save()
    }
    return this
}

// 实例方法：标记为已完成
manualCandidateSchema.methods.markAsCompleted = async function () {
    if (this.status !== 'completed') {
        this.status = 'completed'
        this.completedAt = new Date()
        return this.save()
    }
    return this
}

// 静态方法：按来源统计
manualCandidateSchema.statics.countBySource = async function (companyId) {
    const query = companyId ? { companyId } : {}
    return this.aggregate([
        { $match: query },
        {
            $group: {
                _id: '$resumeSource',
                count: { $sum: 1 },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                }
            }
        },
        { $sort: { count: -1 } }
    ])
}

// 静态方法：获取转化率统计
manualCandidateSchema.statics.getConversionStats = async function (days = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    
    return this.aggregate([
        {
            $match: {
                linkSentAt: { $gte: startDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                viewed: {
                    $sum: { $cond: [{ $in: ['$status', ['viewed', 'completed']] }, 1, 0] }
                },
                completed: {
                    $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                },
                avgResponseTime: {
                    $avg: {
                        $cond: [
                            { $ne: ['$completedAt', null] },
                            { $divide: [{ $subtract: ['$completedAt', '$linkSentAt'] }, 3600000] },
                            null
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                total: 1,
                viewed: 1,
                completed: 1,
                viewRate: {
                    $cond: [
                        { $gt: ['$total', 0] },
                        { $multiply: [{ $divide: ['$viewed', '$total'] }, 100] },
                        0
                    ]
                },
                completionRate: {
                    $cond: [
                        { $gt: ['$total', 0] },
                        { $multiply: [{ $divide: ['$completed', '$total'] }, 100] },
                        0
                    ]
                },
                avgResponseTimeHours: { $round: ['$avgResponseTime', 1] }
            }
        }
    ])
}

// toJSON 转换
manualCandidateSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    }
})

const ManualCandidate = mongoose.model('ManualCandidate', manualCandidateSchema)

export default ManualCandidate