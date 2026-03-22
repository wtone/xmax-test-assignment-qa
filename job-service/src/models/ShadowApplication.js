import mongoose from 'mongoose'
import crypto from 'crypto'

const { Schema } = mongoose

const shadowApplicationSchema = new Schema(
    {
        shadowApplicationId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'JobPost',
            required: true,
        },

        candidateEmail: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },

        pseudoCandidateId: {
            type: String,
            required: true,
        },

        candidateInfo: {
            name: { type: String, required: true },
            email: { type: String, required: true },
            phone: String,
            title: String,
            location: String,
            summary: String,
            skills: Schema.Types.Mixed,
            experience: Schema.Types.Mixed,
            education: Schema.Types.Mixed,
        },

        shadowResumeId: {
            type: String,
            required: true,
        },

        matchScore: {
            type: Number,
            min: 0,
            max: 100,
        },

        evaluation: Schema.Types.Mixed,

        invitedAt: Date,
        invitedBy: String,

        status: {
            type: String,
            enum: ['active', 'hidden', 'revoked'],
            default: 'active',
        },

        realCandidateId: String,
        hiddenAt: Date,
        revokedAt: Date,
    },
    {
        collection: 'shadow_applications',
        timestamps: true,
    },
)

shadowApplicationSchema.index({ jobId: 1, candidateEmail: 1 }, { unique: true })
shadowApplicationSchema.index({ jobId: 1, status: 1, matchScore: -1 })
shadowApplicationSchema.index({ realCandidateId: 1, jobId: 1, status: 1 })

shadowApplicationSchema.pre('validate', function (next) {
    if (!this.shadowApplicationId && this.isNew) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const random = crypto.randomBytes(4).toString('hex')
        this.shadowApplicationId = `shadow_${date}_${random}`
    }
    next()
})

shadowApplicationSchema.statics.generatePseudoCandidateId = function (email) {
    const hash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex')
    return `shadow_${hash.slice(0, 32)}`
}

shadowApplicationSchema.set('toJSON', {
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const ShadowApplication = mongoose.model('ShadowApplication', shadowApplicationSchema)

export default ShadowApplication
