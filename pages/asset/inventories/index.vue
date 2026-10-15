<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">盘点任务</h2>
        <p class="page-head__hint">盘点明细为创建时的账面快照，共 {{ total }} 个盘点单</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('asset:inventory:add')" type="primary" @click="openForm()">
          新建盘点
        </el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="card-base p-3 mb-3 toolbar flex flex-wrap items-center gap-2" role="search" aria-label="盘点单筛选">
      <el-select
        v-model="query.status"
        class="w-[130px]"
        clearable
        placeholder="盘点状态"
        aria-label="按盘点状态筛选"
        @change="search"
      >
        <el-option v-for="(v, k) in INV_STATUS" :key="k" :label="v" :value="k" />
      </el-select>
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="盘点单号 / 名称"
        aria-label="按盘点单号或名称搜索"
        clearable
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
      <el-button @click="reset">重置</el-button>
    </div>

    <!-- 列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      empty-text="暂无盘点单，点击右上角「新建盘点」创建"
    >
      <el-table-column prop="code" label="盘点单号" width="150" fixed />
      <el-table-column prop="name" label="盘点名称" min-width="200" show-overflow-tooltip />
      <el-table-column label="盘点范围" min-width="130" show-overflow-tooltip>
        <template #default="{ row }">{{ row.orgName }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'DONE' ? 'success' : 'warning'" size="small">
            {{ INV_STATUS[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="盘点进度" width="150" align="center">
        <template #default="{ row }">
          <div class="flex items-center gap-2">
            <el-progress
              :percentage="row.total ? Math.round((row.checked / row.total) * 100) : 0"
              :stroke-width="6"
              :show-text="false"
              :aria-label="`已盘 ${row.checked} 项，共 ${row.total} 项`"
              class="flex-1"
            />
            <span class="text-[12px] text-[var(--text-3)] shrink-0 tabular">{{ row.checked }}/{{ row.total }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="盘亏" width="70" align="center">
        <template #default="{ row }">
          <span :class="row.missing ? 'text-[var(--danger-text)] font-medium tabular' : 'text-[var(--text-3)] tabular'">
            {{ row.missing }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="损坏" width="70" align="center">
        <template #default="{ row }">
          <span :class="row.damaged ? 'text-[var(--warning-text)] font-medium tabular' : 'text-[var(--text-3)] tabular'">
            {{ row.damaged }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="ownerName" label="负责人" width="100" />
      <el-table-column label="开始日期" width="110">
        <template #default="{ row }">
          <span class="tabular">{{ fmtDay(row.startDate) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :aria-label="`进入盘点单 ${row.name}`" @click="open(row)">
            盘点
          </el-button>
          <el-button
            v-if="auth.can('asset:inventory:del') && row.status !== 'DONE'"
            link
            type="danger"
            :aria-label="`删除盘点单 ${row.name}`"
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

    <!-- 新建盘点 -->
    <el-dialog v-model="formVisible" title="新建盘点单" width="560px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="盘点名称" prop="name">
          <el-input v-model="form.name" placeholder="如：2026 年四季度集团总部资产盘点" />
        </el-form-item>
        <el-form-item label="盘点范围">
          <el-select v-model="form.orgId" clearable class="w-full" placeholder="不选则盘点全部管辖资产">
            <el-option v-for="o in flatOrgs" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="限定部门">
          <el-select v-model="form.deptId" clearable class="w-full" placeholder="不选则含该范围全部部门">
            <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="限定分类">
          <el-tree-select
            v-model="form.categoryId"
            :data="categories"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            class="w-full"
            placeholder="不选则含全部分类"
          />
        </el-form-item>
        <el-form-item label="负责人">
          <el-select v-model="form.ownerId" clearable filterable class="w-full" placeholder="默认当前用户">
            <el-option v-for="u in users" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="开始日期">
          <el-date-picker v-model="form.startDate" type="date" value-format="YYYY-MM-DD" class="w-full" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">创建并生成明细</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { errMsg } from '~/composables/useErr'
import { INV_STATUS } from '~/composables/useDict'

definePageMeta({ title: '盘点任务' })

const auth = useAuthStore()
const router = useRouter()
const { categories, depts, users, flatOrgs, ensure } = useDictionaries()
const loading = ref(false)
const saving = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const query = reactive<any>({ page: 1, size: 20, status: '', keyword: '' })

const formVisible = ref(false)
const formRef = ref()
const form = reactive<any>({})
const rules = { name: [{ required: true, message: '请输入盘点名称', trigger: 'blur' }] }

const fmtDay = (d: any) => (d ? String(d).slice(0, 10) : '-')

function params() {
  const p: any = { page: query.page, size: query.size }
  if (query.status) p.status = query.status
  if (query.keyword) p.keyword = query.keyword
  return p
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/asset/inventories', { query: params() })
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
  Object.assign(query, { page: 1, status: '', keyword: '' })
  load()
}

function open(row: any) {
  router.push(`/asset/inventories/${row.id}`)
}

function openForm() {
  Object.assign(form, {
    name: `${new Date().getFullYear()} 年资产盘点`,
    orgId: '',
    deptId: '',
    categoryId: '',
    ownerId: '',
    startDate: new Date().toISOString().slice(0, 10),
    remark: '',
  })
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    const res: any = await $fetch('/api/asset/inventories', { method: 'POST', body: form })
    ElMessage.success(`盘点单 ${res.data?.code} 已创建，共 ${res.data?.count} 项资产`)
    formVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除盘点单「${row.name}」？明细将一并删除。`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/asset/inventories/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(async () => {
  await ensure()
  load()
})
</script>
