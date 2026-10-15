// PM2 单机部署：npm run build 后执行 pm2 start ecosystem.config.cjs
// 密钥放在不入库的 ecosystem.env.cjs（缺失时退回占位值，仅供本机调试，切勿用于生产）
const fs = require('node:fs')
const path = require('node:path')

const envFile = path.join(__dirname, 'ecosystem.env.cjs')
const secrets = fs.existsSync(envFile) ? require(envFile) : {}
const jwtSecret = secrets.JWT_SECRET || process.env.JWT_SECRET || 'CHANGE_ME_BEFORE_PROD'

module.exports = {
  apps: [
    {
      name: 'fam',
      script: './.output/server/index.mjs',
      cwd: __dirname,
      // 显式指定解释器：不依赖 PATH，也不用 WorkBuddy 隔离目录下的 node（那路径会随版本变化）
      interpreter: 'C:/Program Files/nodejs/node.exe',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        // 必须监听所有网卡，否则局域网内其他机器访问不到
        HOST: '0.0.0.0',
        PORT: 8001,
        // 相对路径由 server/utils/prisma.ts 统一解析到 prisma/dev.db
        DATABASE_URL: 'file:./dev.db',
        // 运行时覆盖：Nuxt runtimeConfig 走 NUXT_ 前缀，两个都设避免踩坑
        JWT_SECRET: jwtSecret,
        NUXT_JWT_SECRET: jwtSecret,
      },
    },
  ],
}
