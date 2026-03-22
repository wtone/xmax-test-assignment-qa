import mongoose from 'mongoose'
import { COLLABORATOR_PERMISSION } from '../constants/job_constants.js'

const { Schema } = mongoose

const jobCollaboratorSchema = new Schema(
    {
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'JobPost',
            required: true,
            index: true,
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        permissions: {
            type: [String],
            enum: Object.values(COLLABORATOR_PERMISSION),
            default: () => Object.values(COLLABORATOR_PERMISSION),
            required: true,
        },
        grantedBy: {
            type: String,
            required: true,
        },
        grantedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
        collection: 'job_collaborators',
    },
)

// 唯一复合索引：一个用户对一个岗位只有一条记录
jobCollaboratorSchema.index({ jobId: 1, userId: 1 }, { unique: true })

// toJSON 转换
jobCollaboratorSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const JobCollaborator = mongoose.model('JobCollaborator', jobCollaboratorSchema)

export default JobCollaborator
