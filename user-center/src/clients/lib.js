import request from 'request-promise'
import error, { errorProcess } from '../errors.js'
import { log } from '../../utils/logger.js'

const logger = log(import.meta.url)

export const fetch = async (params, host, traceId, options = {}) => {
    const { uri, method, body, qs, headers } = params
    try {
        const _uri = `${host?.replace(/\/$/, '') || 'NOT_SET_HOST'}/${uri?.replace(/^\//, '')}`
        logger.info('[fetch]', JSON.stringify({ params, host, traceId, _uri }))
        return await request({
            uri: _uri,
            method,
            headers: {
                'content-type': 'application/json',
                'trace-id': traceId ?? '',
                'cache-ignore-expire': options.isCacheIgnoreExpire,
                ...headers,
            },
            body,
            qs,
            json: true,
        })
    } catch (_) {
        logger.info('ERR', _.toString())
        const errorMessage = _.toString()

        // Classify the error based on the error message
        if (errorMessage.includes('404')) {
            return errorProcess(error.RESOURCE_NOT_FOUND, [_uri || 'resource'])
        } else if (errorMessage.includes('ETIMEDOUT') || errorMessage.includes('timeout')) {
            return errorProcess(error.TIMEOUT, [errorMessage.replace(/"/g, "'")])
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ENOTFOUND')) {
            return errorProcess(error.SERVICE_UNAVAILABLE, [host || 'service'])
        } else {
            // Default to TIMEOUT for backwards compatibility
            return errorProcess(error.TIMEOUT, [errorMessage.replace(/"/g, "'")])
        }
    }
}

export const commonReturn = (dict = {}) => {
    logger.info('[return common]', `${JSON.stringify(dict ?? {}).substring(0, 500)}....`)
    if (dict.statusCode === 200 || dict.code === 1000) dict.code = 0
    return [dict.data, dict.code === 0 ? null : { code: dict.code, message: dict.message ?? dict.msg }]
}

export const directReturn = (dict = {}) => {
    logger.info('[return direct]', `${JSON.stringify(dict ?? {}).substring(0, 500)}....`)
    return [dict, !dict.code ? null : { code: dict.code, message: dict.message ?? dict.msg }]
}
