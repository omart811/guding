<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">工作台</h2>
        <p class="page-head__hint">
          {{ auth.user?.name }}，当前数据范围：{{ scopeText }}
        </p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('asset:inventory:add')" @click="router.push('/asset/inventories')">
          盘点任务
        </el-button>
        <el-button v-if="auth.can('asset:ledger')" type="primary" @click="router.push('/asset/ledger')">
          资产台账
        </el-button>
      </div>
    </div>

    <!-- 概览：指标卡统一用文字色 + 语义圆点，不再使用彩色块堆叠 -->
    <section aria-label="关键指标" class="stat-grid mb-4">
      <div v-for="s in stats" :key="s.label" class="stat-card">
        <div class="stat-card__label">
          <span v-if="s.color" class="stat-card__dot" :style="{ background: s.color }" aria-hidden="true" />
          {{ s.label }}
        </div>
        <div class="stat-card__value" :class="s.value === '-' ? 'is-empty' : ''" aria-live="polite">
          {{ s.value }}
        </div>
      </div>
    </section>

    <!-- 系统信息 -->
    <section class="card-base p-4" aria-label="系统信息">
      <h3 class="page-title mb-3">系统信息</h3>
      <el-descriptions :column="descriptionsColumn" :label-width="descriptionsColumn === 1 ? '96px' : '120px'" border>
        <el-descriptions-item label="当前用户">
          {{ auth.user?.name }}（{{ auth.user?.roles?.map((r) => r.name).join('、') || '无角色' }}）
        </el-descriptions-item>
        <el-descriptions-item label="所属组织">{{ auth.user?.org?.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="数据范围">{{ scopeText }}</el-descriptions-item>
        <el-descriptions-item label="技术栈">Nuxt3 + Element Plus + UnoCSS + Nitro + Prisma</el-descriptions-item>
        <el-descriptions-item label="数据库">SQLite（本地，可切 MySQL）</el-descriptions-item>
        <el-descriptions-item label="部署方式">PM2 单机</el-descriptions-item>
      </el-descriptions>
    </section>
  </div>
</template>

<script setup lang="ts">
import { DATA_SCOPE } from '~/composables/useDict'

definePageMeta({ title: '工作台' })

const auth = useAuthStore()
const router = useRouter()

/// 指标卡圆点仅作「状态图例」：只有映射到业务状态时才给 color，
/// 中性聚合值（总数、计数）不加色，避免用 success/warning/danger 传递虚假语义
const stats = ref<{ label: string; value: string; color?: string }[]>([
  { label: '资产总数', value: '-' },
  { label: '用户总数', value: '-' },
  { label: '角色数量', value: '-' },
  { label: '组织数量', value: '-' },
  { label: '今日操作', value: '-' },
])

const scopeText = computed(() => DATA_SCOPE[auth.user?.scope || 'SELF'])

/// 窄屏描述列表改单列，避免 label 与内容挤压
const descriptionsColumn = ref(3)
const mq = ref<MediaQueryList | null>(null)
function applyColumns() {
  const w = window.innerWidth
  descriptionsColumn.value = w < 640 ? 1 : w < 1100 ? 2 : 3
}
onMounted(() => {
  applyColumns()
  mq.value = window.matchMedia('(max-width: 1100px)')
  mq.value.addEventListener('change', applyColumns)
  window.addEventListener('resize', applyColumns)
})
onBeforeUnmount(() => {
  mq.value?.removeEventListener('change', applyColumns)
  window.removeEventListener('resize', applyColumns)
})

function countOrgs(tree: any[] = []): number {
  return tree.reduce((n, o) => n + 1 + countOrgs(o.children || []), 0)
}

onMounted(async () => {
  const [a, u, r, o, l] = await Promise.all([
    $fetch<any>('/api/asset/assets/stats').catch(() => null),
    $fetch<any>('/api/system/users?page=1&size=1').catch(() => null),
    $fetch<any>('/api/system/roles').catch(() => null),
    $fetch<any>('/api/system/orgs').catch(() => null),
    $fetch<any>('/api/system/logs?page=1&size=1&today=1').catch(() => null),
  ])
  stats.value[0].value = a?.data?.total ?? '-'
  stats.value[1].value = u?.data?.total ?? '-'
  stats.value[2].value = r?.data?.list?.length ?? '-'
  stats.value[3].value = o?.data ? countOrgs(o.data) : '-'
  stats.value[4].value = l?.data?.total ?? '-'
})
</script>

<style scoped>
.stat-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
  display: inline-block;
}
.stat-card__value.is-empty {
  color: var(--text-3);
}
</style>
