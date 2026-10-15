<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">资产台账</h2>
        <p class="page-head__hint">共 {{ total }} 条资产，金额单位为元</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="selection.length" @click="printLabels(selection)">
          打印标签（{{ selection.length }}）
        </el-button>
        <el-button
          v-if="auth.can('asset:ledger:export')"
          :loading="exporting"
          @click="exportExcel"
        >
          导出 Excel
        </el-button>
        <el-button v-if="auth.can('asset:ledger:add')" type="primary" @click="openForm()">
          新增资产
        </el-button>
      </div>
    </div>

    <!-- 概览 -->
    <section aria-label="台账概览" class="stat-grid mb-3">
      <div v-for="s in statCards" :key="s.label" class="stat-card">
        <div class="stat-card__label">
          <span v-if="s.color" class="stat-card__dot" :style="{ background: s.color }" aria-hidden="true" />
          {{ s.label }}
        </div>
        <div class="stat-card__value">{{ s.value }}</div>
      </div>
    </section>

    <!-- 筛选 -->
    <div class="card-base p-3 mb-3 toolbar flex flex-wrap items-center gap-2" role="search" aria-label="资产筛选">
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="编号 / 名称 / 规格 / 品牌"
        aria-label="按编号、名称、规格或品牌搜索"
        clearable
        @keyup.enter="search"
        @clear="search"
      />
      <el-tree-select
        v-model="query.categoryId"
        :data="categories"
        :props="{ label: 'name', children: 'children' }"
        node-key="id"
        check-strictly
        clearable
        placeholder="资产分类"
        aria-label="按资产分类筛选"
        class="w-[180px]"
        @change="search"
      />
      <el-select
        v-model="query.status"
        class="w-[120px]"
        clearable
        placeholder="状态"
        aria-label="按资产状态筛选"
        @change="search"
      >
        <el-option v-for="(v, k) in ASSET_STATUS" :key="k" :label="v" :value="k" />
      </el-select>
      <el-select
        v-model="query.orgId"
        class="w-[150px]"
        clearable
        placeholder="所属公司"
        aria-label="按所属公司筛选"
        @change="search"
      >
        <el-option v-for="o in flatOrgs" :key="o.id" :label="o.name" :value="o.id" />
      </el-select>
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="购置起"
        end-placeholder="购置止"
        aria-label="按购置日期区间筛选"
        class="w-[250px]"
        @change="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <!-- 台账表格 -->
    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      row-key="id"
      empty-text="没有符合条件的资产，可调整筛选条件后重试"
      @selection-change="(v: any[]) => (selection = v)"
    >
      <el-table-column type="selection" width="46" fixed reserve-selection />
      <el-table-column prop="assetNo" label="资产编号" width="140" fixed />
      <el-table-column prop="name" label="资产名称" min-width="140" show-overflow-tooltip />
      <el-table-column label="分类" width="110">
        <template #default="{ row }">{{ row.category?.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="spec" label="规格型号" min-width="150" show-overflow-tooltip />
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="ASSET_STATUS_TAG[row.status] || 'info'" size="small">
            {{ ASSET_STATUS[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="所属公司" width="120">
        <template #default="{ row }">{{ row.org?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="使用部门" width="110">
        <template #default="{ row }">{{ row.dept?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="使用人" width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ row.keeper?.name || '-' }}</template>
      </el-table-column>
      <el-table-column prop="location" label="存放地点" min-width="140" show-overflow-tooltip />
      <el-table-column label="购置日期" width="110">
        <template #default="{ row }">
          <span class="tabular">{{ fmtDay(row.purchaseDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="原值(元)" width="120" align="right" class-name="tabular">
        <template #default="{ row }">{{ money(row.originalValue) }}</template>
      </el-table-column>
      <el-table-column label="净值(元)" width="120" align="right" class-name="tabular">
        <template #default="{ row }">{{ money(row.netValue) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <el-button link type="info" :aria-label="`查看 ${row.name} 的二维码标签`" @click="printLabels([row])">
            二维码
          </el-button>
          <el-button link type="info" :aria-label="`查看 ${row.name} 的流转记录`" @click="openFlows(row)">
            流转
          </el-button>
          <el-button
            v-if="auth.can('asset:ledger:edit')"
            link
            type="primary"
            :aria-label="`编辑资产 ${row.name}`"
            @click="openForm(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.can('asset:ledger:del')"
            link
            type="danger"
            :aria-label="`删除资产 ${row.name}`"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      class="mt-4 justify-end"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.size"
      @current-change="load"
    />

    <!-- 新增 / 编辑 -->
    <el-dialog v-model="formVisible" :title="dialogTitle" width="760px">
      <!-- 二维码面板：编辑态展示当前资产编号；新增保存成功后展示刚生成的编号 -->
      <div v-if="qrAsset" class="qr-panel">
        <div class="qr-panel__code">
          <AssetQrcode :text="qrAsset.assetNo" :nominal="200" />
        </div>
        <div class="qr-panel__info">
          <div class="qr-panel__no">{{ qrAsset.assetNo }}</div>
          <div class="qr-panel__name">{{ qrAsset.name || form.name }}</div>
          <p class="qr-panel__hint">
            {{ createdAsset ? '资产已保存，打印标签贴到实物上即可完成建档。' : '扫码可识别该资产编号；标签打印后贴到实物上。' }}
          </p>
          <el-button size="small" @click="printLabels([qrAsset])">打印此标签</el-button>
        </div>
      </div>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-row :gutter="12">
          <el-col :xs="24" :sm="12">
            <el-form-item label="资产名称" prop="name"><el-input v-model="form.name" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="资产分类" prop="categoryId">
              <el-tree-select
                v-model="form.categoryId"
                :data="categories"
                :props="{ label: 'name', children: 'children' }"
                node-key="id"
                check-strictly
                class="w-full"
                placeholder="请选择"
              />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="规格型号"><el-input v-model="form.spec" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="品牌"><el-input v-model="form.brand" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="状态">
              <el-select v-model="form.status" class="w-full" aria-label="资产状态">
                <el-option v-for="(v, k) in ASSET_STATUS" :key="k" :label="v" :value="k" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="单位"><el-input v-model="form.unit" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="所属公司">
              <el-select v-model="form.orgId" clearable class="w-full" placeholder="请选择">
                <el-option v-for="o in flatOrgs" :key="o.id" :label="o.name" :value="o.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="使用部门">
              <el-select v-model="form.deptId" clearable class="w-full" placeholder="请选择">
                <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="使用人">
              <el-select v-model="form.keeperId" clearable filterable class="w-full" placeholder="请选择">
                <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="存放地点"><el-input v-model="form.location" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="购置日期">
              <el-date-picker v-model="form.purchaseDate" type="date" value-format="YYYY-MM-DD" class="w-full" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="原值(元)"><el-input-number v-model="form.originalValue" :min="0" :precision="2" class="w-full" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="累计折旧"><el-input-number v-model="form.accumulated" :min="0" :precision="2" class="w-full" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12">
            <el-form-item label="净值(元)"><el-input-number v-model="form.netValue" :min="0" :precision="2" class="w-full" /></el-form-item>
          </el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="供应商"><el-input v-model="form.supplier" /></el-form-item></el-col>
          <el-col :xs="24" :sm="12"><el-form-item label="发票号"><el-input v-model="form.invoiceNo" /></el-form-item></el-col>
          <el-col :span="24"><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <template v-if="!createdAsset">
          <el-button @click="formVisible = false">取消</el-button>
          <el-button type="primary" :loading="saving" @click="save">保存</el-button>
        </template>
        <template v-else>
          <el-button @click="finishCreate">完成</el-button>
          <el-button type="primary" @click="printLabels([qrAsset])">打印标签</el-button>
        </template>
      </template>
    </el-dialog>

    <!-- 资产流转记录 -->
    <el-dialog
      v-model="flowVisible"
      :title="`流转记录 - ${flowAsset?.name || ''}（${flowAsset?.assetNo || ''}）`"
      width="820px"
    >
      <el-table
        v-loading="flowLoading"
        :data="flows"
        border
        stripe
        size="small"
        empty-text="该资产暂无流转记录"
      >
        <el-table-column label="时间" width="110">
          <template #default="{ row }">
            <span class="tabular">{{ fmtDay(row.flowDate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <el-tag :type="FLOW_TYPE_TAG[row.type] || 'info'" size="small">
              {{ FLOW_TYPE[row.type] || row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fromText" label="原归属" min-width="170" show-overflow-tooltip />
        <el-table-column prop="toText" label="新归属" min-width="170" show-overflow-tooltip />
        <el-table-column prop="operatorName" label="操作人" width="90" />
        <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      </el-table>
    </el-dialog>

    <!-- 二维码标签：预览 + 打印。
         Teleport 到 body，打印时靠 @media print 把其余内容全部隐藏，只留这一层 -->
    <Teleport to="body">
      <div
        v-if="sheet.length"
        class="label-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="资产二维码标签"
      >
        <div class="label-sheet__bar no-print">
          <strong>二维码标签（{{ sheet.length }} 张）</strong>
          <span class="label-sheet__hint">
            标签 62×32mm，A4 每页 3 列；打印请选「实际大小 / 100%」并关闭页眉页脚
          </span>
          <div class="flex-1" />
          <el-button @click="sheet = []">关闭</el-button>
          <el-button type="primary" @click="doPrint">打印</el-button>
        </div>
        <div class="label-sheet__grid">
          <div v-for="a in sheet" :key="a.id" class="asset-label">
            <div class="asset-label__qr">
              <AssetQrcode :text="qrPayload(a)" />
            </div>
            <div class="asset-label__info">
              <div class="asset-label__no">{{ a.assetNo }}</div>
              <div class="asset-label__name">{{ a.name }}</div>
              <div class="asset-label__meta">{{ labelMeta(a) }}</div>
              <div class="asset-label__brand">固定资产管理系统</div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { errMsg } from '~/composables/useErr'
import { ASSET_STATUS, ASSET_STATUS_TAG, FLOW_TYPE, FLOW_TYPE_TAG } from '~/composables/useDict'
import { qrPayload } from '~/composables/useQrcode'

definePageMeta({ title: '资产台账' })

const auth = useAuthStore()
const { categories, depts, users, flatOrgs, ensure } = useDictionaries()

const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const tableRef = ref()
const selection = ref<any[]>([])
const list = ref<any[]>([])
const total = ref(0)
const range = ref<any>(null)
const query = reactive<any>({ page: 1, size: 20, keyword: '', categoryId: '', status: '', orgId: '' })

const stats = ref<any>({})
/// 圆点只在指标映射到资产状态时着色（在用/在库），中性聚合值（总数、金额）不加色
const statCards = computed<{ label: string; value: any; color?: string }[]>(() => [
  { label: '资产总数', value: stats.value.total ?? '-' },
  { label: '在用', value: stats.value.inUse ?? '-', color: 'var(--success-text)' },
  { label: '在库', value: stats.value.inStock ?? '-', color: 'var(--info-text)' },
  { label: '原值合计(元)', value: money(stats.value.originalValue) },
  { label: '净值合计(元)', value: money(stats.value.netValue) },
])

const formVisible = ref(false)
const editing = ref<any>(null)
/// 新增保存成功后暂存的资产快照：弹窗不关闭，直接展示二维码与打印入口
const createdAsset = ref<any>(null)
/// 弹窗二维码要展示的资产：新建完成态取保存结果，编辑态取表格行
const qrAsset = computed(() => createdAsset.value || editing.value || null)
const dialogTitle = computed(() =>
  createdAsset.value
    ? `新增成功 · ${form.assetNo}`
    : editing.value
      ? `编辑资产 ${form.assetNo}`
      : '新增资产',
)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  name: [{ required: true, message: '请输入资产名称', trigger: 'blur' }],
  categoryId: [{ required: true, message: '请选择资产分类', trigger: 'change' }],
}

// 流转记录
const flowVisible = ref(false)
const flowLoading = ref(false)
const flowAsset = ref<any>(null)
const flows = ref<any[]>([])

function money(v: any) {
  if (v === undefined || v === null || v === '') return '-'
  return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDay(d: any) {
  return d ? String(d).slice(0, 10) : '-'
}

function params() {
  const p: any = { page: query.page, size: query.size }
  for (const k of ['keyword', 'categoryId', 'status', 'orgId']) if (query[k]) p[k] = query[k]
  if (range.value?.[0]) p.start = range.value[0]
  if (range.value?.[1]) p.end = range.value[1]
  return p
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/asset/assets', { query: params() })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

async function loadStats() {
  try {
    const res: any = await $fetch('/api/asset/assets/stats')
    stats.value = res.data || {}
  } catch {
    stats.value = {}
  }
}

function search() {
  query.page = 1
  load()
}

function reset() {
  Object.assign(query, { page: 1, keyword: '', categoryId: '', status: '', orgId: '' })
  range.value = null
  load()
}

function openForm(row?: any) {
  editing.value = row || null
  createdAsset.value = null
  Object.assign(form, {
    assetNo: row?.assetNo || '',
    name: row?.name || '',
    categoryId: row?.categoryId || '',
    spec: row?.spec || '',
    brand: row?.brand || '',
    unit: row?.unit || '台',
    status: row?.status || 'IN_STOCK',
    orgId: row?.orgId || '',
    deptId: row?.deptId || '',
    keeperId: row?.keeperId || '',
    location: row?.location || '',
    purchaseDate: row?.purchaseDate ? String(row.purchaseDate).slice(0, 10) : '',
    originalValue: row?.originalValue ?? 0,
    accumulated: row?.accumulated ?? 0,
    netValue: row?.netValue ?? 0,
    supplier: row?.supplier || '',
    invoiceNo: row?.invoiceNo || '',
    remark: row?.remark || '',
  })
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/asset/assets/${editing.value.id}`, { method: 'PUT', body: form })
      ElMessage.success('保存成功')
      formVisible.value = false
    } else {
      // 新增：保存后不关弹窗，回填编号直接出二维码，可当场打印标签
      const res: any = await $fetch('/api/asset/assets', { method: 'POST', body: form })
      const created = res.data || {}
      form.assetNo = created.assetNo || ''
      createdAsset.value = {
        id: created.id,
        assetNo: created.assetNo,
        name: form.name,
        location: form.location,
        // 接口只回 id/编号，org/dept 名称本地补全，供标签展示
        org: (flatOrgs.value as any[]).find((o) => o.id === form.orgId) || null,
        dept: (depts.value as any[]).find((x) => x.id === form.deptId) || null,
      }
      ElMessage.success(`新增成功，资产编号 ${form.assetNo}，可直接打印二维码标签`)
    }
    load()
    loadStats()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

/// 新建完成态：关闭弹窗（列表在保存时已刷新）
function finishCreate() {
  formVisible.value = false
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除资产「${row.name}（${row.assetNo}）」？`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/asset/assets/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
    loadStats()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

async function exportExcel() {
  exporting.value = true
  try {
    const blob: any = await $fetch('/api/asset/assets/export', { query: params(), responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const d = new Date()
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    a.href = url
    a.download = `资产台账_${ymd}.xlsx`
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

async function openFlows(row: any) {
  flowAsset.value = row
  flowVisible.value = true
  flowLoading.value = true
  flows.value = []
  try {
    const res: any = await $fetch('/api/asset/flows', { query: { assetId: row.id, size: 50 } })
    flows.value = res.data?.list || []
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    flowLoading.value = false
  }
}

// 二维码标签：预览 + 打印
const sheet = ref<any[]>([])

/// 标签上的辅助信息：公司 · 部门 · 存放地点（有则显示）
function labelMeta(a: any) {
  return [a?.org?.name, a?.dept?.name, a?.location].filter(Boolean).join(' · ') || '—'
}

function printLabels(rows: any[]) {
  if (!rows?.length) return
  sheet.value = rows.slice()
}

async function doPrint() {
  // 等二维码 SVG 全部就绪，否则会打出空白方块
  await nextTick()
  const imgs = Array.from(document.querySelectorAll<HTMLImageElement>('.asset-label__qr img'))
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise((r) => {
            img.onload = img.onerror = () => r(null)
          }),
    ),
  )
  window.print()
}

/// 预览层是模态：Esc 只关预览层。
/// 必须用捕获阶段 + stopPropagation——否则 Esc 会冒泡到底层 el-dialog 的 overlay，
/// 把「新增/编辑」表单弹窗一起关掉（EP closeOnPressEscape 默认开启）
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && sheet.value.length) {
    e.stopPropagation()
    e.preventDefault()
    sheet.value = []
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onKeydown, true)
  await ensure()
  load()
  loadStats()
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown, true))
</script>

<style scoped>
.stat-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
  display: inline-block;
}

/* 弹窗二维码面板：64px 矢量码 + 编号/名称 + 打印入口 */
.qr-panel {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--g-100);
}
.qr-panel__code {
  width: 84px;
  height: 84px;
  flex: 0 0 84px;
  box-sizing: border-box;
  padding: 4px;
  background: #fff;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
}
.qr-panel__info {
  min-width: 0;
}
.qr-panel__no {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}
.qr-panel__name {
  margin-top: 2px;
  font-size: 13px;
  color: var(--text-1);
}
.qr-panel__hint {
  margin: 6px 0 8px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}
</style>
