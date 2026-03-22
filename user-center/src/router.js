import healthRouter from './routes/health.router.js'
import authRouter from './routes/auth.router.js'
import userRouter from './routes/user.router.js'
import roleRouter from './routes/role.router.js'
import permissionRouter from './routes/permission.router.js'
import checkRouter from './routes/check.router.js'
import adminRouter from './routes/admin.router.js'
import metadataRouter from './routes/metadata.router.js'
import publicRouter from './routes/public.router.js'
import internalRouter from './routes/internal.router.js'
import aiUserProfileRouter from './routes/aiUserProfile.router.js'

export default app => {
    app.use(healthRouter.routes())
        .use(authRouter.routes())
        .use(userRouter.routes())
        .use(roleRouter.routes())
        .use(permissionRouter.routes())
        .use(checkRouter.routes())
        .use(adminRouter.routes())
        .use(metadataRouter.routes())
        .use(publicRouter.routes())
        .use(internalRouter.routes())
        .use(aiUserProfileRouter.routes())
        .use(healthRouter.allowedMethods())
}
