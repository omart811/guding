<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">流转记录</h2>
        <p class="page-head__hint">按资产当前归属过滤，共 {{ total }} 条流水</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="actionTypes.length" type="primary" @click="openFlow()">发起流转</el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="card-base p-3 mb-3 toolbar flex flex-wrap items-center gap-2" role="search" aria-label="流转记录筛选">
      <el-select
        v-model="query.type"
        class="w-[130px]"
        clearable
        placeholder="流转类型"
        aria-label="按流转类型筛选"
        @change="search"
      >
        <el-option v-for="(v, k) in FLOW_TYPE" :key="k" :label="v" :value="k" />
      </el-select>
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="资产编号 / 名称"
        aria-label="按资产编号或名称搜索"
        clearable
        @keyup.enter="search"
        @clear="search"
      />
      <el-date-picker
        v-model="range"
        type="daterange"
        value-format="YYYY-MM-DD"
        start-placeholder="开始日期"
        end-placeholder="结束日期"
        aria-label="按流转日期区间筛选"
        class="w-[250px]"
        @change="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <!-- 流水表格 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      empty-text="暂无流转记录，可调整筛选条件或发起新的流转"
    >
      <el-table-column label="流转时间" width="120">
        <template #default="{ row }">
          <span class="tabular">{{ fmtDay(row.flowDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="FLOW_TYPE_TAG[row.type] || 'info'" size="small">
            {{ FLOW_TYPE[row.type] || row.type }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="资产编号" width="140">
        <template #default="{ row }">{{ row.asset?.assetNo }}</template>
      </el-table-column>
      <el-table-column label="资产名称" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.asset?.name }}</template>
      </el-table-column>
      <el-table-column prop="fromText" label="原归属（公司/部门/使用人）" min-width="200" show-overflow-tooltip />
      <el-table-column prop="toText" label="新归属（公司/部门/使用人）" min-width="200" show-overflow-tooltip />
      <el-table-column prop="operatorName" label="操作人" width="100" />
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
    </el-table>

    <el-pagination
      v-model:current-page="query.page"
      class="mt-4 justify-end"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="query.size"
      @current-change="load"
    />

    <!-- 发起流转 -->
    <el-dialog v-model="flowVisible" title="发起资产流转" width="620px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="流转类型" prop="type">
          <el-radio-group v-model="form.type" @change="onTypeChange">
            <el-radio-button v-for="t in actionTypes" :key="t.value" :value="t.value">{{ t.label }}</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="选择资产" prop="assetIds">
          <el-select
            v-model="form.assetIds"
            multiple
            filterable
            remote
            reserve-keyword
            class="w-full"
            :remote-method="searchAssets"
            :loading="assetLoading"
            placeholder="输入资产编号或名称搜索（可多选）"
          >
            <el-option v-for="a in assetOptions" :key="a.id" :label="`${a.assetNo} ${a.name}`" :value="a.id" />
          </el-select>
        </el-form-item>

        <template v-if="form.type === 'ISSUE'">
          <el-form-item label="使用部门">
            <el-select v-model="form.toDeptId" clearable class="w-full" placeholder="请选择（使用人/部门至少填一项）">
              <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="使用人">
            <el-select v-model="form.toKeeperId" clearable filterable class="w-full" placeholder="请选择（使用人/部门至少填一项）">
              <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </template>

        <template v-else-if="form.type === 'TRANSFER'">
          <el-form-item label="目标公司">
            <el-select v-model="form.toOrgId" clearable class="w-full" placeholder="跨公司调拨需超级管理员；不填表示仅调整部门/使用人">
              <el-option v-for="o in flatOrgs" :key="o.id" :label="o.name" :value="o.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标部门">
            <el-select v-model="form.toDeptId" clearable class="w-full" placeholder="请选择">
              <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
            </el-select>
          </el-form-item>
          <el-form-item label="目标使用人">
            <el-select v-model="form.toKeeperId" clearable filterable class="w-full" placeholder="请选择">
              <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
            </el-select>
          </el-form-item>
        </template>

        <el-alert
          v-else
          type="info"
          :closable="false"
          show-icon
          title="归还后资产置为「在库」并清空使用人"
          class="mb-3"
        />

        <el-form-item label="流转日期">
          <el-date-picker v-model="form.flowDate" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="flowVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { errMsg } from '~/composables/useErr'
import { FLOW_TYPE, FLOW_TYPE_TAG } from '~/composables/useDict'

definePageMeta({ title: '流转记录' })

const auth = useAuthStore()
const { depts, users, flatOrgs, ensure } = useDictionaries()
const loading = ref(false)
const saving = ref(false)
const assetLoading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const range = ref<any>(null)
const query = reactive<any>({ page: 1, size: 20, type: '', keyword: '' })

const ALL_ACTIONS = [
  { value: 'ISSUE', label: '领用', perm: 'asset:flow:issue' },
  { value: 'RETURN', label: '归还', perm: 'asset:flow:return' },
  { value: 'TRANSFER', label: '调拨', perm: 'asset:flow:transfer' },
]
const actionTypes = computed(() => ALL_ACTIONS.filter((a) => auth.can(a.perm)))

const assetOptions = ref<any[]>([])

const flowVisible = ref(false)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  type: [{ required: true, message: '请选择流转类型', trigger: 'change' }],
  assetIds: [{ required: true, type: 'array', min: 1, message: '请选择资产', trigger: 'change' }],
}

function fmtDay(d: any) {
  return d ? String(d).slice(0, 10) : '-'
}

function params() {
  const p: any = { page: query.page, size: query.size }
  if (query.type) p.type = query.type
  if (query.keyword) p.keyword = query.keyword
  if (range.value?.[0]) p.start = range.value[0]
  if (range.value?.[1]) p.end = range.value[1]
  return p
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/asset/flows', { query: params() })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function reset() {
  Object.assign(query, { page: 1, type: '', keyword: '' })
  range.value = null
  load()
}

async function searchAssets(kw: string) {
  assetLoading.value = true
  try {
    const status = form.type === 'ISSUE' ? 'IN_STOCK' : form.type === 'RETURN' ? 'IN_USE' : ''
    const res: any = await $fetch('/api/asset/assets', { query: { keyword: kw, size: 50, status } })
    assetOptions.value = (res.data?.list || []).filter(
      (a: any) => form.type !== 'TRANSFER' || !['SCRAPPED', 'DISPOSED'].includes(a.status),
    )
  } finally {
    assetLoading.value = false
  }
}

function onTypeChange() {
  form.assetIds = []
  form.toOrgId = ''
  form.toDeptId = ''
  form.toKeeperId = ''
  searchAssets('')
}

function openFlow(type?: string) {
  Object.assign(form, {
    type: type || actionTypes.value[0]?.value || 'ISSUE',
    assetIds: [],
    toOrgId: '',
    toDeptId: '',
    toKeeperId: '',
    flowDate: new Date().toISOString().slice(0, 10),
    remark: '',
  })
  flowVisible.value = true
  searchAssets('')
}

async function submit() {
  await formRef.value?.validate()
  if (form.type === 'ISSUE' && !form.toDeptId && !form.toKeeperId) {
    return ElMessage.warning('领用需指定使用人或使用部门')
  }
  if (form.type === 'TRANSFER' && !form.toOrgId && !form.toDeptId && !form.toKeeperId) {
    return ElMessage.warning('请指定调拨目标')
  }
  saving.value = true
  try {
    const res: any = await $fetch('/api/asset/flows', { method: 'POST', body: form })
    ElMessage.success(`已提交，共处理 ${res.data?.count} 条资产`)
    flowVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await ensure(['orgs', 'depts', 'users'])
  load()
})
</script>
