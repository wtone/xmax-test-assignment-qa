import User from '../models/User.js'
import errors, { errorProcess } from '../errors.js'

/**
 * @swagger
 * /api/v1/users/profile:
 *   get:
 *     summary: Get user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     responses:
 *       200:
 *         description: User profile
 */
const getProfile = async ctx => {
    const userId = ctx.state.user.id

    ctx.logger.info('Starting user profile retrieval', {
        operation: 'user_get_profile_start',
        userId,
        timestamp: new Date().toISOString(),
    })

    const user = await User.findById(userId).populate('roles')

    if (!user) {
        ctx.logger.warn('User profile retrieval failed - user not found', {
            operation: 'user_get_profile_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    ctx.logger.info('User profile retrieval successful', {
        operation: 'user_get_profile_success',
        userId: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
        rolesCount: user.roles.length,
    })

    ctx.success({
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
        emailVerified: user.emailVerified,
        roles: user.roles,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
    })
}

/**
 * @swagger
 * /api/v1/users/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Update successful
 */
const updateProfile = async ctx => {
    const userId = ctx.state.user.id
    const { username } = ctx.request.body

    ctx.logger.info('Starting user profile update', {
        operation: 'user_update_profile_start',
        userId,
        updateFields: { username },
        timestamp: new Date().toISOString(),
    })

    if (username) {
        const validatedUsername = ctx.validateBody('username').required('Username cannot be empty').val()

        ctx.logger.info('Checking if username already exists', {
            operation: 'user_update_profile_check_username',
            userId,
            newUsername: validatedUsername,
        })

        // Check if username already exists
        const existingUser = await User.findOne({
            username: validatedUsername,
            _id: { $ne: userId },
        })

        if (existingUser) {
            ctx.logger.warn('User profile update failed - username already exists', {
                operation: 'user_update_profile_username_exists',
                userId,
                newUsername: username,
                existingUserId: existingUser._id,
            })
            return ctx.error(errorProcess(errors.USERNAME_ALREADY_EXISTS, [username]))
        }
    }

    ctx.logger.info('Starting user information update', {
        operation: 'user_update_profile_updating',
        userId,
        updateData: { username },
    })

    const user = await User.findByIdAndUpdate(userId, { $set: { username } }, { new: true, runValidators: true }).populate('roles')

    if (!user) {
        ctx.logger.warn('User profile update failed - user not found', {
            operation: 'user_update_profile_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    ctx.logger.info('User profile update successful', {
        operation: 'user_update_profile_success',
        userId: user._id,
        oldUsername: ctx.state.user.username,
        newUsername: user.username,
        email: user.email,
    })

    ctx.success({
        id: user._id,
        username: user.username,
        email: user.email,
        status: user.status,
        emailVerified: user.emailVerified,
        roles: user.roles,
        updatedAt: user.updatedAt,
    })
}

/**
 * @swagger
 * /api/v1/users/permissions:
 *   get:
 *     summary: Get user permissions
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     responses:
 *       200:
 *         description: User permissions list
 */
const getUserPermissions = async ctx => {
    const userId = ctx.state.user.id

    ctx.logger.info('Starting user permissions retrieval', {
        operation: 'user_get_permissions_start',
        userId,
        timestamp: new Date().toISOString(),
    })

    const user = await User.findById(userId).populate({
        path: 'roles',
        populate: {
            path: 'permissions',
        },
    })

    if (!user) {
        ctx.logger.warn('User permissions retrieval failed - user not found', {
            operation: 'user_get_permissions_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    ctx.logger.info('User information retrieved, collecting permissions', {
        operation: 'user_get_permissions_collecting',
        userId,
        rolesCount: user.roles.length,
    })

    // Collect all permissions
    const permissions = new Set()
    user.roles.forEach(role => {
        if (role.permissions) {
            role.permissions.forEach(permission => {
                permissions.add(permission.name)
            })
        }
    })

    const permissionsArray = Array.from(permissions)

    ctx.logger.info('User permissions retrieval successful', {
        operation: 'user_get_permissions_success',
        userId,
        permissionsCount: permissionsArray.length,
        permissions: permissionsArray,
    })

    ctx.success({
        permissions: permissionsArray,
    })
}

/**
 * @swagger
 * /api/v1/users/roles:
 *   get:
 *     summary: Get user roles
 *     tags: [User]
 *     security:
 *       - bearerAuth: []
 *       - X-User-ID: []
 *     responses:
 *       200:
 *         description: User roles list
 */
const getUserRoles = async ctx => {
    const userId = ctx.state.user.id

    ctx.logger.info('Starting user roles retrieval', {
        operation: 'user_get_roles_start',
        userId,
        timestamp: new Date().toISOString(),
    })

    const user = await User.findById(userId).populate('roles')

    if (!user) {
        ctx.logger.warn('User roles retrieval failed - user not found', {
            operation: 'user_get_roles_not_found',
            userId,
        })
        return ctx.error(errorProcess(errors.USER_NOT_FOUND, [userId]))
    }

    const roles = user.roles.map(role => ({
        id: role._id,
        name: role.name,
        description: role.description,
    }))

    ctx.logger.info('User roles retrieval successful', {
        operation: 'user_get_roles_success',
        userId,
        rolesCount: roles.length,
        roleNames: roles.map(r => r.name),
    })

    ctx.success({
        roles,
    })
}

export default {
    getProfile,
    updateProfile,
    getUserPermissions,
    getUserRoles,
}
