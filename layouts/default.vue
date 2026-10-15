<template>
  <div class="h-full flex">
    <!-- 键盘用户可直接跳过导航（WCAG 2.4.1） -->
    <a class="skip-link" href="#main-content">跳到主要内容</a>

    <!-- 侧边栏（桌面）：可折叠为图标栏 -->
    <aside
      v-if="!isMobile"
      class="bg-white border-r border-[var(--border)] flex flex-col shrink-0 transition-[width] duration-200"
      :class="collapsed ? 'w-[68px]' : 'w-[230px]'"
    >
      <div class="h-[60px] flex items-center gap-2.5 px-4 shrink-0">
        <div class="brand-mark" aria-hidden="true">
          <el-icon :size="18"><Box /></el-icon>
        </div>
        <span v-if="!collapsed" class="font-semibold text-[15px] text-[var(--text-1)] truncate">
          固定资产管理系统
        </span>
      </div>
      <el-scrollbar class="flex-1">
        <nav aria-label="主导航">
          <AppMenu :active="route.path" :collapsed="collapsed" />
        </nav>
      </el-scrollbar>
    </aside>

    <!-- 侧边栏（移动端）：抽屉，避免窄屏挤压内容 -->
    <el-drawer
      v-if="isMobile"
      v-model="drawer"
      direction="ltr"
      size="240px"
      :with-header="false"
      class="app-drawer"
    >
      <div class="h-[60px] flex items-center gap-2.5 px-4 border-b border-[var(--border)]">
        <div class="brand-mark" aria-hidden="true">
          <el-icon :size="18"><Box /></el-icon>
        </div>
        <span class="font-semibold text-[15px] text-[var(--text-1)] truncate">固定资产管理系统</span>
      </div>
      <nav aria-label="主导航">
        <AppMenu :active="route.path" />
      </nav>
    </el-drawer>

    <!-- 主区 -->
    <div class="flex-1 flex flex-col min-w-0">
      <header
        class="h-[60px] bg-white border-b border-[var(--border)] flex items-center justify-between gap-3 px-3 sm:px-5 shrink-0"
      >
        <div class="flex items-center gap-2 min-w-0">
          <el-button v-if="isMobile" circle aria-label="打开导航菜单" @click="drawer = true">
            <el-icon><Fold /></el-icon>
          </el-button>
          <el-button
            v-else
            circle
            :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
            :aria-expanded="!collapsed"
            @click="collapsed = !collapsed"
          >
            <el-icon><component :is="collapsed ? Expand : Fold" /></el-icon>
          </el-button>
          <h1 class="text-[15px] font-medium text-[var(--text-1)] m-0 truncate">{{ pageTitle }}</h1>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 shrink-0">
          <span class="hidden sm:inline text-[13px] text-[var(--text-2)] truncate max-w-[160px]">
            {{ auth.user?.org?.name }}
          </span>
          <el-dropdown @command="onCommand">
            <button
              type="button"
              class="user-trigger"
              aria-haspopup="menu"
              :aria-label="`账号菜单，当前用户 ${auth.user?.name || ''}`"
            >
              <span class="user-trigger__avatar" aria-hidden="true">
                <el-icon :size="15"><User /></el-icon>
              </span>
              <span class="text-[13px] text-[var(--text-1)] max-w-[90px] truncate">{{ auth.user?.name }}</span>
              <el-icon class="text-[var(--text-3)]" :size="12"><CaretBottom /></el-icon>
            </button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item disabled>
                  {{ auth.user?.roles?.map((r: any) => r.name).join('、') || '无角色' }}
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main id="main-content" tabindex="-1" class="flex-1 overflow-auto p-3 sm:p-4">
        <slot />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Box, User, CaretBottom, Fold, Expand } from '@element-plus/icons-vue'

const route = useRoute()
const auth = useAuthStore()

/// 移动端（<900px）用抽屉导航；桌面可手动折叠侧栏
const isMobile = ref(false)
const collapsed = ref(false)
const drawer = ref(false)
let mq: MediaQueryList | null = null

onMounted(() => {
  mq = window.matchMedia('(max-width: 900px)')
  const apply = () => {
    isMobile.value = mq!.matches
    if (mq!.matches) drawer.value = false
  }
  apply()
  mq.addEventListener('change', apply)
})
onBeforeUnmount(() => mq?.removeEventListener('change', apply))

const pageTitle = computed(() => ((route.meta as any).title as string) || '工作台')

/// 切换路由后收起移动端抽屉，避免遮挡内容
watch(
  () => route.path,
  () => (drawer.value = false),
)

watch(
  pageTitle,
  (t) => {
    if (t && process.client) document.title = `${t} - 固定资产管理系统`
  },
  { immediate: true },
)

async function onCommand(cmd: string) {
  if (cmd === 'logout') {
    await auth.logout()
    navigateTo('/login')
  }
}
</script>

<style scoped>
.brand-mark {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  background: var(--brand-strong);
}

/* 用户菜单触发器：用原生 button 保证键盘可达与语义正确 */
.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  background: transparent;
  cursor: pointer;
  font: inherit;
  transition: background-color var(--dur-fast) var(--ease-out);
}
.user-trigger:hover {
  background: var(--hover);
}
.user-trigger:focus-visible {
  outline: var(--focus-ring);
  outline-offset: 2px;
}
.user-trigger__avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-bg);
  color: var(--brand-strong);
  flex-shrink: 0;
}
</style>
