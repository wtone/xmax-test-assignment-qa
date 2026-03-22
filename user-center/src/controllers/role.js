import Role from '../models/Role.js'
import User from '../models/User.js'
import errors, { errorProcess } from '../errors.js'

const listRoles = async ctx => {
    const { page = 1, limit = 20 } = ctx.query
    const skip = (page - 1) * limit

    ctx.logger.info('Starting role list retrieval', {
        operation: 'role_list_start',
        page: parseInt(page),
        limit: parseInt(limit),
        skip,
        timestamp: new Date().toISOString(),
    })

    const roles = await Role.find().populate('permissions').skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 })

    const total = await Role.countDocuments()

    ctx.logger.info('Role list retrieval successful', {
        operation: 'role_list_success',
        rolesCount: roles.length,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
    })

    ctx.success({
        roles,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    })
}

const createRole = async ctx => {
    const name = ctx.validateBody('name').required('Role name cannot be empty').val()

    const { description, permissions = [] } = ctx.request.body

    ctx.logger.info('Starting role creation', {
        operation: 'role_create_start',
        name,
        description,
        permissionsCount: permissions.length,
        permissions,
        timestamp: new Date().toISOString(),
    })

    const existingRole = await Role.findOne({ name })
    if (existingRole) {
        ctx.logger.warn('Role creation failed - name already exists', {
            operation: 'role_create_name_exists',
            name,
            existingRoleId: existingRole._id,
        })
        return ctx.error(errorProcess(errors.ROLE_ALREADY_EXISTS, [name]))
    }

    ctx.logger.info('Role name check passed, creating role', {
        operation: 'role_create_creating',
        name,
        description,
        permissions,
    })

    const role = new Role({
        name,
        description,
        permissions,
    })

    await role.save()
    await role.populate('permissions')

    ctx.logger.info('Role creation successful', {
        operation: 'role_create_success',
        roleId: role._id,
        name: role.name,
        description: role.description,
        permissionsCount: role.permissions.length,
    })

    ctx.success(role)
}

const getRoleDetail = async ctx => {
    const { roleId } = ctx.params

    ctx.logger.info('Starting role detail retrieval', {
        operation: 'role_get_detail_start',
        roleId,
        timestamp: new Date().toISOString(),
    })

    const role = await Role.findById(roleId).populate('permissions')
    if (!role) {
        ctx.logger.warn('Role detail retrieval failed - role not found', {
            operation: 'role_get_detail_not_found',
            roleId,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, [roleId]))
    }

    ctx.logger.info('Role detail retrieval successful', {
        operation: 'role_get_detail_success',
        roleId: role._id,
        name: role.name,
        description: role.description,
        permissionsCount: role.permissions.length,
    })

    ctx.success(role)
}

const updateRole = async ctx => {
    const { roleId } = ctx.params
    const { name, description } = ctx.request.body

    ctx.logger.info('Starting role update', {
        operation: 'role_update_start',
        roleId,
        updateData: { name, description },
        timestamp: new Date().toISOString(),
    })

    if (name) {
        ctx.logger.info('Checking if role name already exists', {
            operation: 'role_update_check_name',
            roleId,
            newName: name,
        })

        const existingRole = await Role.findOne({
            name,
            _id: { $ne: roleId },
        })
        if (existingRole) {
            ctx.logger.warn('Role update failed - name already exists', {
                operation: 'role_update_name_exists',
                roleId,
                newName: name,
                existingRoleId: existingRole._id,
            })
            return ctx.error(errorProcess(errors.ROLE_ALREADY_EXISTS, [name]))
        }
    }

    ctx.logger.info('Starting role information update', {
        operation: 'role_update_updating',
        roleId,
        updateFields: { name, description },
    })

    const role = await Role.findByIdAndUpdate(roleId, { $set: { name, description } }, { new: true, runValidators: true }).populate('permissions')

    if (!role) {
        ctx.logger.warn('Role update failed - role not found', {
            operation: 'role_update_not_found',
            roleId,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, [roleId]))
    }

    ctx.logger.info('Role update successful', {
        operation: 'role_update_success',
        roleId: role._id,
        name: role.name,
        description: role.description,
        permissionsCount: role.permissions.length,
    })

    ctx.success(role)
}

const deleteRole = async ctx => {
    const { roleId } = ctx.params

    ctx.logger.info('Starting role deletion', {
        operation: 'role_delete_start',
        roleId,
        timestamp: new Date().toISOString(),
    })

    const role = await Role.findByIdAndDelete(roleId)
    if (!role) {
        ctx.logger.warn('Role deletion failed - role not found', {
            operation: 'role_delete_not_found',
            roleId,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, [roleId]))
    }

    ctx.logger.info('Role deletion successful', {
        operation: 'role_delete_success',
        roleId: role._id,
        roleName: role.name,
    })

    ctx.success({ message: 'Role deleted successfully' })
}

const assignPermissions = async ctx => {
    const { roleId } = ctx.params
    const permissions = ctx.validateBody('permissions').required('Permissions must be an array').val()

    // const { permissions } = ctx.request.body

    ctx.logger.info('Starting role permission assignment', {
        operation: 'role_assign_permissions_start',
        roleId,
        permissionsCount: permissions.length,
        permissions,
        timestamp: new Date().toISOString(),
    })

    const role = await Role.findByIdAndUpdate(roleId, { $set: { permissions } }, { new: true, runValidators: true }).populate('permissions')

    if (!role) {
        ctx.logger.warn('Permission assignment failed - role not found', {
            operation: 'role_assign_permissions_not_found',
            roleId,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, [roleId]))
    }

    ctx.logger.info('Role permission assignment successful', {
        operation: 'role_assign_permissions_success',
        roleId: role._id,
        roleName: role.name,
        oldPermissionsCount: permissions.length,
        newPermissionsCount: role.permissions.length,
        assignedPermissions: permissions,
    })

    ctx.success(role)
}

const checkRole = async ctx => {
    const userId = ctx.validateBody('userId').required('User ID cannot be empty').val()
    const roleName = ctx.validateBody('roleName').required('Role name cannot be empty').val()

    // const { userId, roleName } = ctx.request.body

    ctx.logger.info('Starting user role check', {
        operation: 'role_check_start',
        userId,
        roleName,
        timestamp: new Date().toISOString(),
    })

    const user = await User.findById(userId).populate('roles')
    if (!user) {
        ctx.logger.warn('Role check failed - user not found', {
            operation: 'role_check_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    ctx.logger.info('User information retrieved, checking role', {
        operation: 'role_check_checking',
        userId,
        roleName,
        userRolesCount: user.roles.length,
        userRoles: user.roles.map(r => r.name),
    })

    const hasRole = user.roles.some(role => role.name === roleName)

    ctx.logger.info('User role check completed', {
        operation: 'role_check_success',
        userId,
        roleName,
        hasRole,
        userRoles: user.roles.map(r => r.name),
    })

    ctx.success({ hasRole })
}

export default {
    listRoles,
    createRole,
    getRoleDetail,
    updateRole,
    deleteRole,
    assignPermissions,
    checkRole,
}
