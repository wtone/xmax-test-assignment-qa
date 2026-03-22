import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * 用户操作标记 Schema
 * 用于存储 B 端用户对候选人申请的已读/暂不考虑标记
 */
const applicationUserActionSchema = new Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true,
        },
        applicationId: {
            type: String,
            required: true,
        },
        applicationType: {
            type: String,
            enum: ['application', 'shadow'],
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        readAt: {
            type: Date,
        },
        isExcluded: {
            type: Boolean,
            default: false,
        },
        excludedAt: {
            type: Date,
        },
        excludedReason: {
            type: String,
            maxlength: 500,
        },
    },
    {
        timestamps: true,
    },
)

// 唯一复合索引：一个用户对一个申请只有一条记录
applicationUserActionSchema.index({ userId: 1, applicationId: 1, applicationType: 1 }, { unique: true })

// 查询索引
applicationUserActionSchema.index({ userId: 1, isExcluded: 1 })
applicationUserActionSchema.index({ userId: 1, isRead: 1 })

// toJSON 转换
applicationUserActionSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const ApplicationUserAction = mongoose.model('ApplicationUserAction', applicationUserActionSchema)

export default ApplicationUserAction
