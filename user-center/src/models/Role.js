import mongoose from 'mongoose'
import mongoManager from '../../utils/mongo.js'
import { ROLE_STATUS, USER_TYPE } from '../libs/constants.js'

const { Schema } = mongoose

const roleSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 50,
        },
        displayName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        permissions: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Permission',
            },
        ],
        isSystem: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: [ROLE_STATUS.ACTIVE, ROLE_STATUS.INACTIVE],
            default: ROLE_STATUS.ACTIVE,
        },
        userType: {
            type: String,
            enum: [USER_TYPE.C_END, USER_TYPE.B_END, 'ALL'], // Role applicable user types
            default: 'ALL',
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
)

// Indexes
roleSchema.index({ userType: 1, status: 1 })
roleSchema.index({ isSystem: 1 })
roleSchema.index({ createdAt: -1 })

// Static method: get default roles
roleSchema.statics.getDefaultRoles = function (userType = 'C') {
    return this.find({
        status: ROLE_STATUS.ACTIVE,
        $or: [{ userType: userType }, { userType: 'ALL' }],
        name: { $in: userType === USER_TYPE.C_END ? ['user'] : ['business_user'] },
    })
}

// Static method: create system roles
roleSchema.statics.createSystemRoles = async function () {
    const systemRoles = [
        {
            name: 'super_admin',
            displayName: 'Super Administrator',
            description: 'Super administrator with all permissions',
            isSystem: true,
            userType: USER_TYPE.B_END,
        },
        {
            name: 'admin',
            displayName: 'Administrator',
            description: 'System administrator',
            isSystem: true,
            userType: USER_TYPE.B_END,
        },
        {
            name: 'user',
            displayName: 'Regular User',
            description: 'C-side regular user',
            isSystem: true,
            userType: USER_TYPE.C_END,
        },
        {
            name: 'business_user',
            displayName: 'Business User',
            description: 'B-side business user',
            isSystem: true,
            userType: USER_TYPE.B_END,
        },
    ]

    for (const roleData of systemRoles) {
        await this.findOneAndUpdate({ name: roleData.name }, roleData, { upsert: true, new: true })
    }
}

// Instance method: check if has specific permission
roleSchema.methods.hasPermission = function (permissionName) {
    return this.permissions.some(permission => permission.name === permissionName)
}

// Instance method: add permission
roleSchema.methods.addPermission = function (permissionId) {
    if (!this.permissions.includes(permissionId)) {
        this.permissions.push(permissionId)
    }
    return this.save()
}

// Instance method: remove permission
roleSchema.methods.removePermission = function (permissionId) {
    this.permissions = this.permissions.filter(p => !p.equals(permissionId))
    return this.save()
}

// Instance method: get permission details
roleSchema.methods.getPermissionsDetail = async function () {
    await this.populate('permissions')
    return this.permissions
}

// Prevent deletion of system roles
roleSchema.pre('remove', function (next) {
    if (this.isSystem) {
        const error = new Error('System roles cannot be deleted')
        error.code = 403001
        return next(error)
    }
    next()
})

// Prevent modification of system role names
roleSchema.pre('save', function (next) {
    if (this.isSystem && this.isModified('name')) {
        const error = new Error('System role name cannot be modified')
        error.code = 403002
        return next(error)
    }
    next()
})

// Static method: find system roles
roleSchema.statics.findSystemRoles = function () {
    return this.find({ isSystem: true, status: ROLE_STATUS.ACTIVE })
}

// Static method: find role by name
roleSchema.statics.findByName = function (name) {
    return this.findOne({ name, status: ROLE_STATUS.ACTIVE })
}

// Virtual field: permission count
roleSchema.virtual('permissionCount').get(function () {
    return this.permissions.length
})

// Ensure virtual fields are included in JSON
roleSchema.set('toJSON', { virtuals: true })
roleSchema.set('toObject', { virtuals: true })

const RoleModel = await mongoManager.createModel(process.env.MONGO_USER_CENTER_URI, 'Role', roleSchema)

export default RoleModel
