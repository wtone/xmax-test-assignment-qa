/**
 * 姓名脱敏：仅保留最后一个字，前面固定 **
 * 示例："王晓晨" → "**晨"，"李明" → "**明"
 * @param {string} name
 * @returns {string}
 */
export function maskName(name) {
    if (!name || typeof name !== 'string') return name
    const trimmed = name.trim()
    if (trimmed.length === 0) return name
    return '**' + trimmed.slice(-1)
}
