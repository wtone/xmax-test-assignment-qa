/**
 * 职位相关常量定义
 */

export const JOB_DESCRIPTION_MAX_LENGTH = 30000
export const OTHER_REQUIREMENTS_MAX_LENGTH = 5000

// 职位类型
export const CONTRACT_TYPE = {
    FULL_TIME: 'full-time',
    PART_TIME: 'part-time',
    CONTRACT: 'contract',
    INTERNSHIP: 'internship',
}

// 职位类型中文映射
export const CONTRACT_TYPE_LABEL = {
    [CONTRACT_TYPE.FULL_TIME]: '全职',
    [CONTRACT_TYPE.PART_TIME]: '兼职',
    [CONTRACT_TYPE.CONTRACT]: '合同工',
    [CONTRACT_TYPE.INTERNSHIP]: '实习',
}

// 学历要求
export const EDUCATION_LEVEL = {
    NONE: 'none',
    HIGH_SCHOOL: 'high-school',
    ASSOCIATE: 'associate',
    BACHELOR: 'bachelor',
    MASTER: 'master',
    PHD: 'phd',
}

// 学历中文映射
export const EDUCATION_LEVEL_LABEL = {
    [EDUCATION_LEVEL.NONE]: '不限',
    [EDUCATION_LEVEL.HIGH_SCHOOL]: '高中',
    [EDUCATION_LEVEL.ASSOCIATE]: '大专',
    [EDUCATION_LEVEL.BACHELOR]: '本科',
    [EDUCATION_LEVEL.MASTER]: '硕士',
    [EDUCATION_LEVEL.PHD]: '博士',
}

// 办公方式
export const WORK_MODE = {
    ONSITE: 'onsite',
    REMOTE: 'remote',
    HYBRID: 'hybrid',
}

// 办公方式中文映射
export const WORK_MODE_LABEL = {
    [WORK_MODE.ONSITE]: '现场办公',
    [WORK_MODE.REMOTE]: '远程办公',
    [WORK_MODE.HYBRID]: '混合办公',
}

// 工作经验选项（用于前端选择框）
export const EXPERIENCE_OPTIONS = [
    { value: '0-1', label: '1年以下', min: 0, max: 1 },
    { value: '1-3', label: '1-3年', min: 1, max: 3 },
    { value: '3-5', label: '3-5年', min: 3, max: 5 },
    { value: '5-10', label: '5-10年', min: 5, max: 10 },
    { value: '10+', label: '10年以上', min: 10, max: 50 },
    { value: 'none', label: '不限', min: 0, max: 50 },
]

// 时间单位（用于合同时长、薪资周期等）
export const TIME_UNIT = {
    HOUR: 'hour',
    DAY: 'day',
    MONTH: 'month',
    YEAR: 'year',
}

// 时间单位中文映射
export const TIME_UNIT_LABEL = {
    [TIME_UNIT.HOUR]: '小时',
    [TIME_UNIT.DAY]: '天',
    [TIME_UNIT.MONTH]: '个月',
    [TIME_UNIT.YEAR]: '年',
}

// 薪资周期（使用 TIME_UNIT 的值）
export const SALARY_PERIOD = TIME_UNIT

// 薪资周期中文映射（带货币单位）
export const SALARY_PERIOD_LABEL = {
    [SALARY_PERIOD.HOUR]: '元/小时',
    [SALARY_PERIOD.DAY]: '元/天',
    [SALARY_PERIOD.MONTH]: '元/月',
    [SALARY_PERIOD.YEAR]: '元/年',
}

// 货币类型
export const CURRENCY = {
    CNY: 'CNY',
    USD: 'USD',
    EUR: 'EUR',
    GBP: 'GBP',
    JPY: 'JPY',
}

// 热门城市列表（用于位置选择）
export const HOT_CITIES = [
    '北京',
    '上海',
    '广州',
    '深圳',
    '杭州',
    '成都',
    '武汉',
    '西安',
    '南京',
    '苏州',
    '天津',
    '重庆',
    '长沙',
    '郑州',
    '厦门',
    '青岛',
    '大连',
    '宁波',
    '无锡',
    '佛山',
]

// 技能标签建议（可扩展）
export const SKILL_SUGGESTIONS = {
    frontend: ['JavaScript', 'TypeScript', 'React', 'Vue', 'Angular', 'HTML5', 'CSS3', 'Webpack', 'Node.js'],
    backend: ['Java', 'Python', 'Go', 'C++', 'PHP', 'Ruby', 'Rust', 'Spring', 'Django', 'Express'],
    mobile: ['iOS', 'Android', 'React Native', 'Flutter', 'Swift', 'Kotlin', 'Objective-C'],
    devops: ['Docker', 'Kubernetes', 'Jenkins', 'GitLab CI', 'AWS', 'Azure', 'GCP', 'Terraform'],
    database: ['MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Oracle', 'SQL Server'],
    ai: ['Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision'],
}

// 岗位协作者权限
export const COLLABORATOR_PERMISSION = {
    MANAGE: 'manage', // 管理岗位（编辑、发布、暂停、关闭、删除）
    INTERVIEW: 'interview', // 面试管理（查看申请、安排面试、评价候选人）
}

// 协作者角色（用于 API 响应标记）
export const COLLABORATOR_ROLE = {
    OWNER: 'owner', // 所有者（发布人），不存入 JobCollaborator 表
    COLLABORATOR: 'collaborator', // 协作者
}

// 面试服务阶梯定价（基于年薪，单位：元）
// 匹配规则: 找到第一个满足 salary <= maxSalary 的档位
export const INTERVIEW_PRICING_TIERS = [
    {
        id: 'tier1',
        maxSalary: 200000, // n ≤ 20万
        label: '20万以下',
        originalPrice: 599,
        currentPrice: 399,
    },
    {
        id: 'tier2',
        maxSalary: 300000, // 20万 < n ≤ 30万
        label: '20-30万',
        originalPrice: 1049,
        currentPrice: 699,
    },
    {
        id: 'tier3',
        maxSalary: 400000, // 30万 < n ≤ 40万
        label: '30-40万',
        originalPrice: 1499,
        currentPrice: 999,
    },
    {
        id: 'tier4',
        maxSalary: 500000, // 40万 < n ≤ 50万
        label: '40-50万',
        originalPrice: 1949,
        currentPrice: 1299,
    },
    {
        id: 'tier5',
        maxSalary: Infinity, // n > 50万
        label: '50万以上',
        originalPrice: 2249,
        currentPrice: 1499,
    },
]

// 根据年薪获取对应的定价档位
export function getPricingTierBySalary(annualSalary) {
    return (
        INTERVIEW_PRICING_TIERS.find(tier => annualSalary <= tier.maxSalary) ||
        INTERVIEW_PRICING_TIERS[INTERVIEW_PRICING_TIERS.length - 1]
    )
}
