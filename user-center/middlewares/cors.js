import cors from 'koa2-cors'

process.env.ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || []

export default cors({
    origin: '*',
    exposeHeaders: ['WWW-Authenticate', 'Server-Authorization'],
    maxAge: 5,
    credentials: true,
    allowMethods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH'],
    allowHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'X-Requested-With',
        'Access-Control-Allow-Credentials',
        'X-User-Id',
        'X-User-Role',
        'X-Trace-Id',
    ],
})
