// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  modules: ['@element-plus/nuxt', '@unocss/nuxt', '@pinia/nuxt'],
  css: ['~/assets/css/main.css'],
  // a11y：声明中文语言，屏幕阅读器才会用中文语音规则朗读（WCAG 3.1.1）
  app: {
    head: {
      htmlAttrs: { lang: 'zh-CN' },
      title: '固定资产管理系统',
      meta: [{ name: 'description', content: '集团资产全生命周期管理平台' }],
    },
  },
  runtimeConfig: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  },
})
