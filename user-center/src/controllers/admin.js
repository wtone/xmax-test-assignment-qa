import User from '../models/User.js'
import Role from '../models/Role.js'
import Permission from '../models/Permission.js'
import errors, { errorProcess } from '../errors.js'

/**
 * @swagger
 * /api/v1/admin/users/{userId}/roles:
 *   post:
 *     summary: Assign roles to a user (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roleIds
 *             properties:
 *               roleIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of role IDs to assign
 *     responses:
 *       200:
 *         description: Roles assigned successfully
 */
const assignRolesToUser = async ctx => {
    const { userId } = ctx.params
    const roleIds = ctx.validateBody('roleIds').required('Role IDs array is required').val()

    ctx.logger.info('Starting role assignment to user', {
        operation: 'admin_assign_roles_start',
        userId,
        roleIds,
        adminId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    // Find the user
    const user = await User.findById(userId)
    if (!user) {
        ctx.logger.warn('Role assignment failed - user not found', {
            operation: 'admin_assign_roles_user_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    // Validate role IDs
    const roles = await Role.find({ _id: { $in: roleIds } })
    if (roles.length !== roleIds.length) {
        ctx.logger.warn('Role assignment failed - some roles not found', {
            operation: 'admin_assign_roles_invalid_roles',
            userId,
            requestedRoles: roleIds.length,
            foundRoles: roles.length,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, [roleIds.join(', ')]))
    }

    // Assign roles to user
    user.roles = roleIds
    await user.save()

    // Get updated user with role details
    const updatedUser = await User.findById(userId).populate('roles')

    ctx.logger.info('Roles assigned successfully', {
        operation: 'admin_assign_roles_success',
        userId,
        assignedRoles: roles.map(r => r.name),
        adminId: ctx.state.user?.id,
    })

    ctx.success({
        message: 'Roles assigned successfully',
        user: {
            id: updatedUser._id,
            username: updatedUser.username,
            email: updatedUser.email,
            roles: updatedUser.roles,
        },
    })
}

/**
 * @swagger
 * /api/v1/admin/assign-default-roles:
 *   post:
 *     summary: Assign default roles to all users without roles (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     responses:
 *       200:
 *         description: Default roles assigned successfully
 */
const assignDefaultRoles = async ctx => {
    ctx.logger.info('Starting default role assignment process', {
        operation: 'admin_assign_default_roles_start',
        adminId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    // Find all users without roles
    const usersWithoutRoles = await User.find({ roles: { $size: 0 } })

    if (usersWithoutRoles.length === 0) {
        ctx.logger.info('No users without roles found', {
            operation: 'admin_assign_default_roles_no_users',
        })
        return ctx.success({
            message: 'All users already have roles assigned',
            usersProcessed: 0,
        })
    }

    // Get default roles
    const userRole = await Role.findOne({ name: 'user', userType: 'C' })
    const businessRole = await Role.findOne({ name: 'business_user', userType: 'B' })

    if (!userRole || !businessRole) {
        ctx.logger.error('Default roles not found', {
            operation: 'admin_assign_default_roles_roles_missing',
            userRoleExists: !!userRole,
            businessRoleExists: !!businessRole,
        })
        return ctx.error(errorProcess(errors.ROLE_NOT_FOUND, ['user or business role']))
    }

    let processedCount = 0
    const results = []

    // Process each user
    for (const user of usersWithoutRoles) {
        try {
            const roleToAssign = user.type === 'C' ? userRole : businessRole
            user.roles = [roleToAssign._id]
            await user.save()

            results.push({
                userId: user._id,
                username: user.username,
                userType: user.type,
                assignedRole: roleToAssign.name,
                success: true,
            })
            processedCount++
        } catch (error) {
            ctx.logger.error('Failed to assign role to user', {
                operation: 'admin_assign_default_roles_user_error',
                userId: user._id,
                error: error.message,
            })
            results.push({
                userId: user._id,
                username: user.username,
                userType: user.type,
                success: false,
                error: error.message,
            })
        }
    }

    ctx.logger.info('Default role assignment completed', {
        operation: 'admin_assign_default_roles_completed',
        totalUsers: usersWithoutRoles.length,
        successfulAssignments: processedCount,
        adminId: ctx.state.user?.id,
    })

    ctx.success({
        message: `Default roles assigned to ${processedCount} users`,
        totalUsers: usersWithoutRoles.length,
        successfulAssignments: processedCount,
        results,
    })
}

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     summary: List all users with their roles (Admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Users list with roles
 */
const listUsers = async ctx => {
    const { page = 1, limit = 20 } = ctx.query
    const skip = (page - 1) * limit

    ctx.logger.info('Starting admin user list retrieval', {
        operation: 'admin_list_users_start',
        page: parseInt(page),
        limit: parseInt(limit),
        adminId: ctx.state.user?.id,
        timestamp: new Date().toISOString(),
    })

    const users = await User.find().populate('roles').skip(skip).limit(parseInt(limit)).sort({ createdAt: -1 })

    const total = await User.countDocuments()

    ctx.logger.info('Admin user list retrieval successful', {
        operation: 'admin_list_users_success',
        usersCount: users.length,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
    })

    ctx.success({
        users: users.map(user => ({
            id: user._id,
            username: user.username,
            email: user.email,
            type: user.type,
            status: user.status,
            roles: user.roles,
            createdAt: user.createdAt,
            lastLoginAt: user.lastLoginAt,
        })),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit),
        },
    })
}

export default {
    assignRolesToUser,
    assignDefaultRoles,
    listUsers,
}
