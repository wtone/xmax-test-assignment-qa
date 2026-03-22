import mongoose from 'mongoose'

const { Schema } = mongoose

/**
 * 人工面试评分 Schema
 * 用于存储 B 端对 C 端候选人的人工面试评分
 */
const manualInterviewRatingSchema = new Schema(
    {
        jobId: {
            type: String,
            required: true,
            index: true,
        },
        candidateId: {
            type: String,
            required: true,
            index: true,
        },
        companyId: {
            type: String,
            required: true,
            index: true,
        },
        rating: {
            type: Number,
            required: true,
            min: 1,
            max: 10,
            validate: {
                validator: Number.isInteger,
                message: 'rating must be an integer',
            },
        },
        // 基于职位标签的动态评分（每项 1-3: 差/一般/好）
        tagRatings: [
            {
                tagId: { type: String, required: true },
                label: { type: String, required: true },
                category: { type: String, required: true },
                score: {
                    type: Number,
                    required: true,
                    min: 1,
                    max: 3,
                    validate: {
                        validator: Number.isInteger,
                        message: 'score must be an integer',
                    },
                },
                _id: false,
            },
        ],
        // 补充评价
        comment: {
            type: String,
            maxlength: 500,
        },
        ratedBy: {
            type: String,
            required: true,
        },
    },
    {
        timestamps: true,
    },
)

// 唯一复合索引：一个 job + candidate 只能有一条评分记录
manualInterviewRatingSchema.index({ jobId: 1, candidateId: 1 }, { unique: true })

// 企业查询索引
manualInterviewRatingSchema.index({ companyId: 1, jobId: 1 })

// toJSON 转换
manualInterviewRatingSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const ManualInterviewRating = mongoose.model('ManualInterviewRating', manualInterviewRatingSchema)

export default ManualInterviewRating
