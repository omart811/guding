<template>
  <div>
    <!-- 头部：盘点单信息 -->
    <div class="card-base p-4 mb-3">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <el-button
              link
              aria-label="返回盘点任务列表"
              title="返回盘点任务列表"
              @click="router.push('/asset/inventories')"
            >
              <el-icon><ArrowLeft /></el-icon>
            </el-button>
            <h2 class="page-title">{{ info.name }}</h2>
            <el-tag :type="info.status === 'DONE' ? 'success' : 'warning'" size="small">
              {{ INV_STATUS[info.status] || info.status }}
            </el-tag>
          </div>
          <div class="text-[13px] text-[var(--text-2)] pl-8">
            {{ info.code }} · 范围：{{ info.orgId ? orgName : '全公司' }} · 负责人：{{ info.ownerName || '-' }} ·
            开始：<span class="tabular">{{ fmtDay(info.startDate) }}</span>
          </div>
          <div v-if="info.remark" class="text-[13px] text-[var(--text-3)] pl-8 mt-1">{{ info.remark }}</div>
        </div>
        <div class="flex gap-2 shrink-0">
          <el-button v-if="auth.can('asset:inventory:export')" :loading="exporting" @click="exportExcel">
            导出明细
          </el-button>
          <el-button
            v-if="auth.can('asset:inventory:finish') && info.status === 'DONE'"
            @click="act('reopen')"
          >
            重新开启
          </el-button>
          <el-button
            v-if="auth.can('asset:inventory:finish') && info.status !== 'DONE'"
            type="primary"
            :loading="finishing"
            @click="act('finish')"
          >
            完成盘点
          </el-button>
        </div>
      </div>

      <!-- 统计 -->
      <div class="stat-grid mt-4">
        <div v-for="s in statCards" :key="s.label" class="stat-card">
          <div class="stat-card__label">
            <span class="stat-card__dot" :style="{ background: s.color }" aria-hidden="true" />
            {{ s.label }}
          </div>
          <div class="stat-card__value" :style="{ color: s.color }">{{ s.value }}</div>
        </div>
      </div>
    </div>

    <!-- 筛选 + 批量操作 -->
    <div
      class="card-base p-3 mb-3 toolbar flex flex-wrap items-center gap-2"
      role="search"
      aria-label="盘点明细筛选"
    >
      <el-select
        v-model="query.result"
        class="w-[130px]"
        clearable
        placeholder="盘点结果"
        aria-label="按盘点结果筛选"
        @change="load"
      >
        <el-option v-for="(v, k) in INV_RESULT" :key="k" :label="v" :value="k" />
      </el-select>
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="资产编号 / 名称"
        aria-label="按资产编号或名称搜索明细"
        clearable
        @keyup.enter="load"
        @clear="load"
      />
      <el-button type="primary" @click="load">查询</el-button>
      <div class="flex-1" />
      <template v-if="canCheck">
        <span class="text-[13px] text-[var(--text-2)]" aria-live="polite">已选 {{ selection.length }} 项</span>
        <el-button
          :disabled="!selection.length"
          type="success"
          plain
          :aria-label="`标记正常 已选 ${selection.length} 项`"
          @click="batchMark('NORMAL')"
        >
          标记正常
        </el-button>
        <el-button
          :disabled="!selection.length"
          type="danger"
          plain
          :aria-label="`标记盘亏 已选 ${selection.length} 项`"
          @click="batchMark('MISSING')"
        >
          标记盘亏
        </el-button>
        <el-button
          :disabled="!selection.length"
          type="warning"
          plain
          :aria-label="`标记损坏 已选 ${selection.length} 项`"
          @click="batchMark('DAMAGED')"
        >
          标记损坏
        </el-button>
        <el-button
          :disabled="!selection.length"
          :aria-label="`撤销盘点 已选 ${selection.length} 项`"
          @click="batchMark('PENDING')"
        >
          撤销盘点
        </el-button>
      </template>
    </div>

    <!-- 明细 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="items"
      border
      stripe
      row-key="id"
      empty-text="没有符合条件的明细，可调整筛选条件"
      @selection-change="(v: any[]) => (selection = v)"
    >
      <el-table-column v-if="canCheck" type="selection" width="46" reserve-selection />
      <el-table-column prop="assetNo" label="资产编号" width="150" />
      <el-table-column prop="assetName" label="资产名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="categoryName" label="分类" width="110" show-overflow-tooltip />
      <el-table-column label="账面状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="ASSET_STATUS_TAG[row.expectedStatus] || 'info'" size="small">
            {{ ASSET_STATUS[row.expectedStatus] || row.expectedStatus || '-' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orgName" label="所属公司" width="110" show-overflow-tooltip />
      <el-table-column prop="deptName" label="使用部门" width="110" show-overflow-tooltip />
      <el-table-column prop="keeperName" label="使用人" width="90" show-overflow-tooltip />
      <el-table-column prop="expectedLocation" label="账面存放地点" min-width="140" show-overflow-tooltip />
      <el-table-column label="盘点结果" width="130" align="center">
        <template #default="{ row }">
          <el-select
            v-if="canCheck"
            :model-value="row.result"
            size="small"
            class="w-full"
            :aria-label="`设置 ${row.assetNo} 的盘点结果`"
            @change="(v: string) => markOne(row, v)"
          >
            <el-option v-for="(v, k) in INV_RESULT" :key="k" :label="v" :value="k" />
          </el-select>
          <el-tag v-else :type="INV_RESULT_TAG[row.result] || 'info'" size="small">
            {{ INV_RESULT[row.result] || row.result }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="checkerName" label="盘点人" width="90" />
      <el-table-column label="盘点时间" width="110">
        <template #default="{ row }">
          <span class="tabular">{{ row.checkedAt ? fmtDay(row.checkedAt) : '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="盘点备注" min-width="150">
        <template #default="{ row }">
          <el-input
            v-if="canCheck"
            :model-value="row.remark || ''"
            size="small"
            placeholder="填写盘点备注"
            :aria-label="`${row.assetNo} 的盘点备注`"
            @change="(v: string) => saveRemark(row, v)"
          />
          <span v-else class="text-[13px]">{{ row.remark || '-' }}</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="text-[13px] text-[var(--text-3)] mt-3">
      共 {{ items.length }} 条明细（单次最多展示 2000 条，可用上方筛选缩小范围）
    </div>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { errMsg } from '~/composables/useErr'
import {
  ASSET_STATUS,
  ASSET_STATUS_TAG,
  INV_RESULT,
  INV_RESULT_TAG,
  INV_STATUS,
} from '~/composables/useDict'

definePageMeta({ title: '盘点执行' })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const id = route.params.id as string
const { flatOrgs, ensure } = useDictionaries()

const loading = ref(false)
const finishing = ref(false)
const exporting = ref(false)
const info = ref<any>({})
const items = ref<any[]>([])
const selection = ref<any[]>([])
const tableRef = ref()
const query = reactive<any>({ result: '', keyword: '' })

const canCheck = computed(() => auth.can('asset:inventory:check') && info.value.status !== 'DONE')
const orgName = computed(() => flatOrgs.value.find((x: any) => x.id === info.value.orgId)?.name || '-')

/// 结果类指标「有值才着色」：计数为 0 时用中性色，避免 0 盘亏显示成红色假警报
const st = computed(() => info.value.stats || ({} as any))
const resultColor = (n: number, semantic: string) => (n > 0 ? semantic : 'var(--text-3)')

const statCards = computed(() => [
  { label: '应盘', value: st.value.total ?? 0, color: 'var(--text-1)' },
  { label: '已盘', value: st.value.checked ?? 0, color: 'var(--brand-strong)' },
  { label: '待盘', value: st.value.pending ?? 0, color: 'var(--text-3)' },
  { label: '正常', value: st.value.normal ?? 0, color: resultColor(st.value.normal ?? 0, 'var(--success-text)') },
  { label: '盘亏', value: st.value.missing ?? 0, color: resultColor(st.value.missing ?? 0, 'var(--danger-text)') },
  { label: '损坏', value: st.value.damaged ?? 0, color: resultColor(st.value.damaged ?? 0, 'var(--warning-text)') },
])

const fmtDay = (d: any) => (d ? String(d).slice(0, 10) : '-')

async function load() {
  loading.value = true
  try {
    const p: any = {}
    if (query.result) p.result = query.result
    if (query.keyword) p.keyword = query.keyword
    const res: any = await $fetch(`/api/asset/inventories/${id}`, { query: p })
    info.value = res.data || {}
    items.value = res.data?.items || []
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

/// 单条录入
async function markOne(row: any, result: string) {
  try {
    await $fetch(`/api/asset/inventories/${id}/check`, {
      method: 'POST',
      body: { items: [{ id: row.id, result, remark: row.remark }] },
    })
    ElMessage.success(`已标记为「${INV_RESULT[result]}」`)
    await load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
    load()
  }
}

/// 备注单独保存（沿用当前盘点结果）
async function saveRemark(row: any, remark: string) {
  try {
    await $fetch(`/api/asset/inventories/${id}/check`, {
      method: 'POST',
      body: { items: [{ id: row.id, result: row.result, remark }] },
    })
    ElMessage.success('备注已保存')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

/// 批量标记
async function batchMark(result: string) {
  const ids = selection.value.map((r) => r.id)
  try {
    await $fetch(`/api/asset/inventories/${id}/check`, {
      method: 'POST',
      body: { itemIds: ids, result },
    })
    ElMessage.success(`已批量标记 ${ids.length} 项为「${INV_RESULT[result]}」`)
    tableRef.value?.clearSelection()
    await load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

async function act(action: string) {
  if (action === 'finish') {
    await ElMessageBox.confirm('完成盘点后不可再录入结果，确定继续？', '提示', { type: 'warning' })
  }
  finishing.value = true
  try {
    await $fetch(`/api/asset/inventories/${id}`, { method: 'PUT', body: { action } })
    ElMessage.success(action === 'finish' ? '盘点已完成' : '已重新开启')
    await load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    finishing.value = false
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const blob: any = await $fetch(`/api/asset/inventories/${id}/export`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `盘点明细_${info.value.code}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (e: any) {
    if (e?.data instanceof Blob) {
      try {
        ElMessage.error(JSON.parse(await e.data.text())?.message || '导出失败')
      } catch {
        ElMessage.error('导出失败')
      }
    } else {
      ElMessage.error(errMsg(e))
    }
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await ensure(['orgs'])
  load()
})
</script>
