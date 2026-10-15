<template>
  <main class="login-page">
    <!-- 品牌侧（大屏显示）：说明系统做什么，避免登录页只有一个空卡片 -->
    <section class="login-brand" aria-label="系统简介">
      <div class="login-brand__inner">
        <div class="login-brand__mark" aria-hidden="true">
          <el-icon :size="22"><Box /></el-icon>
        </div>
        <h2 class="login-brand__title">固定资产管理系统</h2>
        <p class="login-brand__desc">
          集团资产从入库、领用、调拨到盘点、报废的全生命周期台账，一处录入，多级可见。
        </p>
        <ul class="login-brand__list">
          <li><strong>台账</strong>资产卡片、分类树、多维筛选与导出</li>
          <li><strong>流转</strong>领用 / 归还 / 调拨，状态与使用人强一致</li>
          <li><strong>盘点</strong>按范围生成快照，差异自动汇总</li>
        </ul>
      </div>
    </section>

    <!-- 表单侧 -->
    <section class="login-form-wrap">
      <div class="login-card">
        <header class="mb-6">
          <h1 class="login-card__title">登录</h1>
          <p class="login-card__hint">请使用管理员分配的账号登录</p>
        </header>

        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="onSubmit"
        >
          <!-- 登录失败内联常驻提示：toast 3 秒即消失，容易漏看 -->
          <el-alert
            v-if="err"
            class="mb-3"
            type="error"
            :closable="false"
            show-icon
            role="alert"
            :title="err"
          />
          <el-form-item label="用户名" prop="username">
            <el-input
              v-model="form.username"
              size="large"
              placeholder="请输入用户名"
              autocomplete="username"
              @input="err = ''"
            >
              <template #prefix><el-icon><User /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-form-item label="密码" prop="password">
            <el-input
              v-model="form.password"
              size="large"
              type="password"
              placeholder="请输入密码"
              autocomplete="current-password"
              show-password
              @input="err = ''"
              @keyup.enter="onSubmit"
            >
              <template #prefix><el-icon><Lock /></el-icon></template>
            </el-input>
          </el-form-item>
          <el-button
            class="w-full mt-1"
            size="large"
            type="primary"
            :loading="loading"
            @click="onSubmit"
          >
            登录
          </el-button>
        </el-form>

        <p class="login-card__demo">演示账号：admin / Admin@123</p>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { User, Lock, Box } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { errMsg } from '~/composables/useErr'

definePageMeta({ layout: 'blank' })

const auth = useAuthStore()
const router = useRouter()
const formRef = ref()
const loading = ref(false)
const err = ref('')
const form = reactive({ username: 'admin', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

async function onSubmit() {
  await formRef.value?.validate()
  loading.value = true
  err.value = ''
  try {
    await auth.login(form.username, form.password)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (e: any) {
    // 内联常驻展示，用户改输入时自动清除
    err.value = errMsg(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100%;
  display: grid;
  grid-template-columns: 1fr;
  background: var(--bg-page);
}

/* 品牌侧：实色深蓝，不用渐变（避免廉价感，也保证文字对比度） */
.login-brand {
  display: none;
  background: #1c2b4a;
  color: #fff;
  padding: 48px 56px;
  position: relative;
  overflow: hidden;
}
/* 极细网格纹理，提供质感但不喧宾夺主 */
.login-brand::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
}
.login-brand__inner {
  position: relative;
  z-index: 1;
  max-width: 460px;
  margin: auto 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: 100%;
}
.login-brand__mark {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-md);
  background: var(--brand);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
}
.login-brand__title {
  font-size: 26px;
  font-weight: 600;
  margin: 0 0 10px;
  letter-spacing: 0.5px;
}
.login-brand__desc {
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.78);
  margin: 0 0 28px;
}
.login-brand__list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.82);
}
.login-brand__list li {
  display: flex;
  gap: 10px;
  align-items: baseline;
  padding-left: 14px;
  border-left: 2px solid rgba(93, 135, 255, 0.6);
}
.login-brand__list strong {
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
}

.login-form-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--bg-box);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 28px;
}
.login-card__title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 6px;
}
.login-card__hint {
  font-size: 13px;
  color: var(--text-3);
  margin: 0;
}
.login-card__demo {
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
  margin: 20px 0 0;
  padding-top: 14px;
  border-top: 1px dashed var(--border);
}

@media (min-width: 1024px) {
  .login-page {
    grid-template-columns: 1.15fr 1fr;
  }
  .login-brand {
    display: block;
  }
}
</style>
