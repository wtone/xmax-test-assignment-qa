import _ from 'lodash'
import { Validator } from 'koa-bouncer'
import assert from 'better-assert'

export default async (ctx, next) => {
    Validator.addMethod('isIn', function (arr, tip) {
        assert(_.isArray(arr))
        // prettier-ignore
        this.checkPred(val => [].concat(val).every(item => _.includes(arr, item)), tip || ` '${this.key}' should be one of [ '${arr.join("', '")}' ].  BUT got -->  ${this.val()}  <-- `)
        return this
    })

    // '1727648153'
    // '1727648153000'
    Validator.addMethod('toTimestamp', function (tip) {
        const sampleLength = '1727648153'.length
        this.checkPred(
            val => {
                if (val.length === sampleLength) {
                    val += '000'
                }
                const timestamp = new Date(+val).getTime()
                return timestamp.toString().match(/^1\d{12}$/)
            },
            tip || ` '${this.key}' should be a timestamp. `,
        )
        this.tap(val => (val.length === sampleLength ? (val *= 1000) : +val))
        return this
    })

    // to uppercase
    Validator.addMethod('toUpperCase', function (tip) {
        this.tap(val => val.toUpperCase())
        return this
    })

    // to lowercase
    Validator.addMethod('toLowerCase', function (tip) {
        this.tap(val => val.toLowerCase())
        return this
    })

    Validator.addMethod('splitToArray', function (tip) {
        // prettier-ignore
        this.tap(val => val?.split(',').map(v => v.trim()).filter(Boolean) || [])
        return this
    })

    await next()
}
