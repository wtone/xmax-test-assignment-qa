import mongoose from 'mongoose'
import mongoManager from '../../utils/mongo.js'
import { PERMISSION_STATUS } from '../libs/constants.js'

const { Schema } = mongoose

const permissionSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 2,
            maxlength: 100,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 200,
        },
        resource: {
            type: String,
            required: true,
            trim: true,
            maxlength: 50,
        },
        action: {
            type: String,
            required: true,
            enum: ['create', 'read', 'update', 'delete', 'execute', 'manage'],
            trim: true,
        },
        isSystem: {
            type: Boolean,
            default: false,
        },
        status: {
            type: String,
            enum: [PERMISSION_STATUS.ACTIVE, PERMISSION_STATUS.INACTIVE],
            default: PERMISSION_STATUS.ACTIVE,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
)

// Composite index: resource + action combination
permissionSchema.index({ resource: 1, action: 1 })
permissionSchema.index({ status: 1 })
permissionSchema.index({ isSystem: 1 })
permissionSchema.index({ createdAt: -1 })

// Static method: find permission by resource and action
permissionSchema.statics.findByResourceAndAction = function (resource, action) {
    return this.findOne({ resource, action, status: PERMISSION_STATUS.ACTIVE })
}

// Static method: find all permissions by resource
permissionSchema.statics.findByResource = function (resource) {
    return this.find({ resource, status: PERMISSION_STATUS.ACTIVE })
}

// Static method: find system permissions
permissionSchema.statics.findSystemPermissions = function () {
    return this.find({ isSystem: true, status: PERMISSION_STATUS.ACTIVE })
}

// Virtual field: permission identifier
permissionSchema.virtual('identifier').get(function () {
    return `${this.resource}:${this.action}`
})

// Ensure virtual fields are included in JSON
permissionSchema.set('toJSON', { virtuals: true })
permissionSchema.set('toObject', { virtuals: true })

const PermissionModel = await mongoManager.createModel(process.env.MONGO_USER_CENTER_URI, 'Permission', permissionSchema)

export default PermissionModel
