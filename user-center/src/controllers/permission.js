import Permission from '../models/Permission.js'
import User from '../models/User.js'
import errors, { errorProcess } from '../errors.js'

const listPermissions = async ctx => {
    const { page = 1, limit = 20 } = ctx.query
    const skip = (page - 1) * limit

    ctx.logger.info('Starting permission list retrieval', {
        operation: 'permission_list_start',
        page: parseInt(page),
        limit: parseInt(limit),
        skip,
        timestamp: new Date().toISOString(),
    })

    const permissions = await Permission.find().skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 })

    const total = await Permission.countDocuments()

    ctx.logger.info('Permission list retrieval successful', {
        operation: 'permission_list_success',
        permissionsCount: permissions.length,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
    })

    ctx.success({
        permissions,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    })
}

const createPermission = async ctx => {
    const name = ctx.validateBody('name').required('Permission name cannot be empty').val()
    const resource = ctx.validateBody('resource').required('Resource cannot be empty').val()
    const action = ctx.validateBody('action').required('Action cannot be empty').val()

    const { description } = ctx.request.body

    ctx.logger.info('Starting permission creation', {
        operation: 'permission_create_start',
        name,
        description,
        resource,
        action,
        timestamp: new Date().toISOString(),
    })

    const existingPermission = await Permission.findOne({ name })
    if (existingPermission) {
        ctx.logger.warn('Permission creation failed - name already exists', {
            operation: 'permission_create_name_exists',
            name,
            existingPermissionId: existingPermission._id,
        })
        return ctx.error(errorProcess(errors.PERMISSION_ALREADY_EXISTS, [name]))
    }

    ctx.logger.info('Permission name check passed, creating permission', {
        operation: 'permission_create_creating',
        name,
        description,
        resource,
        action,
    })

    const permission = new Permission({
        name,
        description,
        resource,
        action,
    })

    await permission.save()

    ctx.logger.info('Permission creation successful', {
        operation: 'permission_create_success',
        permissionId: permission._id,
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
    })

    ctx.success(permission)
}

const getPermissionDetail = async ctx => {
    const { permissionId } = ctx.params

    ctx.logger.info('Starting permission detail retrieval', {
        operation: 'permission_get_detail_start',
        permissionId,
        timestamp: new Date().toISOString(),
    })

    const permission = await Permission.findById(permissionId)
    if (!permission) {
        ctx.logger.warn('Permission detail retrieval failed - permission not found', {
            operation: 'permission_get_detail_not_found',
            permissionId,
        })
        return ctx.error(errorProcess(errors.PERMISSION_NOT_FOUND, [permissionId]))
    }

    ctx.logger.info('Permission detail retrieval successful', {
        operation: 'permission_get_detail_success',
        permissionId: permission._id,
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
    })

    ctx.success(permission)
}

const updatePermission = async ctx => {
    const { permissionId } = ctx.params
    const { name, description, resource, action } = ctx.request.body

    ctx.logger.info('Starting permission update', {
        operation: 'permission_update_start',
        permissionId,
        updateData: { name, description, resource, action },
        timestamp: new Date().toISOString(),
    })

    if (name) {
        ctx.logger.info('Checking if permission name already exists', {
            operation: 'permission_update_check_name',
            permissionId,
            newName: name,
        })

        const existingPermission = await Permission.findOne({
            name,
            _id: { $ne: permissionId },
        })
        if (existingPermission) {
            ctx.logger.warn('Permission update failed - name already exists', {
                operation: 'permission_update_name_exists',
                permissionId,
                newName: name,
                existingPermissionId: existingPermission._id,
            })
            return ctx.error(errorProcess(errors.PERMISSION_ALREADY_EXISTS, [name]))
        }
    }

    ctx.logger.info('Starting permission information update', {
        operation: 'permission_update_updating',
        permissionId,
        updateFields: { name, description, resource, action },
    })

    const permission = await Permission.findByIdAndUpdate(
        permissionId,
        { $set: { name, description, resource, action } },
        { new: true, runValidators: true },
    )

    if (!permission) {
        ctx.logger.warn('Permission update failed - permission not found', {
            operation: 'permission_update_not_found',
            permissionId,
        })
        return ctx.error(errorProcess(errors.PERMISSION_NOT_FOUND, [permissionId]))
    }

    ctx.logger.info('Permission update successful', {
        operation: 'permission_update_success',
        permissionId: permission._id,
        name: permission.name,
        description: permission.description,
        resource: permission.resource,
        action: permission.action,
    })

    ctx.success(permission)
}

const deletePermission = async ctx => {
    const { permissionId } = ctx.params

    ctx.logger.info('Starting permission deletion', {
        operation: 'permission_delete_start',
        permissionId,
        timestamp: new Date().toISOString(),
    })

    const permission = await Permission.findByIdAndDelete(permissionId)
    if (!permission) {
        ctx.logger.warn('Permission deletion failed - permission not found', {
            operation: 'permission_delete_not_found',
            permissionId,
        })
        return ctx.error(errorProcess(errors.PERMISSION_NOT_FOUND, [permissionId]))
    }

    ctx.logger.info('Permission deletion successful', {
        operation: 'permission_delete_success',
        permissionId: permission._id,
        permissionName: permission.name,
        resource: permission.resource,
        action: permission.action,
    })

    ctx.success({ message: 'Permission deleted successfully' })
}

const checkPermission = async ctx => {
    const userId = ctx.validateBody('userId').required('User ID cannot be empty').val()
    const resource = ctx.validateBody('resource').required('Resource cannot be empty').val()
    const action = ctx.validateBody('action').required('Action cannot be empty').val()

    ctx.logger.info('Starting user permission check', {
        operation: 'permission_check_start',
        userId,
        resource,
        action,
        timestamp: new Date().toISOString(),
    })

    const user = await User.findById(userId).populate({
        path: 'roles',
        populate: {
            path: 'permissions',
        },
    })

    if (!user) {
        ctx.logger.warn('Permission check failed - user not found', {
            operation: 'permission_check_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    ctx.logger.info('User information retrieved, checking permissions', {
        operation: 'permission_check_checking',
        userId,
        resource,
        action,
        userRolesCount: user.roles.length,
    })

    // Check if user has permission
    let hasPermission = false
    let matchedPermission = null
    let matchedRole = null

    for (const role of user.roles) {
        if (role.permissions && Array.isArray(role.permissions)) {
            for (const permission of role.permissions) {
                if (permission.resource === resource && permission.action === action) {
                    hasPermission = true
                    matchedPermission = permission
                    matchedRole = role
                    break
                }
            }
        }
        if (hasPermission) break
    }

    ctx.logger.info('User permission check completed', {
        operation: 'permission_check_success',
        userId,
        resource,
        action,
        hasPermission,
        matchedPermissionId: matchedPermission?._id,
        matchedPermissionName: matchedPermission?.name,
        matchedRoleId: matchedRole?._id,
        matchedRoleName: matchedRole?.name,
    })

    ctx.success({ hasPermission })
}

export default {
    listPermissions,
    createPermission,
    getPermissionDetail,
    updatePermission,
    deletePermission,
    checkPermission,
}
