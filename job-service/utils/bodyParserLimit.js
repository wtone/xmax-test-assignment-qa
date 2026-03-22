export const normalizeBodyParserLimit = (value, fallback = '10mb') => {
    if (!value) return fallback

    const normalized = String(value).trim().toLowerCase()

    if (/^\d+(kb|mb|gb)$/i.test(normalized)) {
        return normalized
    }

    if (/^\d+[kmg]$/.test(normalized)) {
        const unitMap = { k: 'kb', m: 'mb', g: 'gb' }
        const unit = normalized.slice(-1)
        return `${normalized.slice(0, -1)}${unitMap[unit]}`
    }

    if (/^\d+$/.test(normalized)) {
        return `${normalized}b`
    }

    return fallback
}
