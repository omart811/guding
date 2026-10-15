// PM2 单机部署：npm run build 后执行 pm2 start ecosystem.config.cjs
module.exports = {
  apps: [
    {
      name: 'fam',
      script: './.output/server/index.mjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        DATABASE_URL: 'file:./dev.db',
        JWT_SECRET: 'change-me-in-production',
        NUXT_JWT_SECRET: 'change-me-in-production',
      },
    },
  ],
}
