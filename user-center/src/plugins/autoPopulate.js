// 自动为 populate 操作注入正确的模型引用
export function autoPopulatePlugin(schema) {
    // 拦截 populate 方法
    schema.pre(['find', 'findOne', 'findOneAndUpdate'], function () {
        // 自动为 roles 字段添加 model 引用
        if (this.getPopulatedPaths().includes('roles')) {
            this.populate('roles')
        }
        // 自动为 permissions 字段添加 model 引用
        if (this.getPopulatedPaths().includes('permissions')) {
            this.populate('permissions')
        }
    })
}
