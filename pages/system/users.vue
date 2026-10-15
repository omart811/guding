<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">用户管理</h2>
        <p class="page-head__hint">共 {{ total }} 个用户，组织与部门决定其数据范围</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('system:user:add')" type="primary" @click="openForm()">
          新增用户
        </el-button>
      </div>
    </div>

    <div
      class="card-base p-3 mb-4 toolbar flex flex-wrap items-center gap-2"
      role="search"
      aria-label="用户筛选"
    >
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="用户名 / 姓名"
        aria-label="按用户名或姓名搜索"
        clearable
        @keyup.enter="search"
        @clear="search"
      />
      <el-button type="primary" @click="search">查询</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      empty-text="没有符合条件的用户，可调整搜索条件"
    >
      <el-table-column prop="username" label="用户名" width="120" />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column label="组织" width="140">
        <template #default="{ row }">{{ row.org?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="部门" width="120">
        <template #default="{ row }">{{ row.dept?.name || '-' }}</template>
      </el-table-column>
      <el-table-column label="角色" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="r in row.roles" :key="r.roleId" size="small" class="mr-1">{{ r.role.name }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="手机号" width="130">
        <template #default="{ row }">
          <span class="tabular">{{ row.phone || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="auth.can('system:user:edit')"
            link
            type="primary"
            :aria-label="`编辑 ${row.name}`"
            @click="openForm(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.can('system:user:resetpwd')"
            link
            type="warning"
            :aria-label="`重置密码 ${row.name}`"
            @click="resetPwd(row)"
          >
            重置密码
          </el-button>
          <el-button
            v-if="auth.can('system:user:del')"
            link
            type="danger"
            :aria-label="`删除 ${row.name}`"
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

    <el-dialog v-model="formVisible" :title="editing ? '编辑用户' : '新增用户'" width="520px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80px">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" :disabled="!!editing" placeholder="登录账号" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="姓名" />
        </el-form-item>
        <el-form-item v-if="!editing" label="初始密码">
          <el-input v-model="form.password" placeholder="留空默认 Admin@123" />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="所属组织">
          <el-select v-model="form.orgId" clearable class="w-full" placeholder="请选择">
            <el-option v-for="o in flatOrgs" :key="o.id" :label="o.name" :value="o.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="所属部门">
          <el-select v-model="form.deptId" clearable filterable class="w-full" placeholder="请选择">
            <el-option v-for="d in depts" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.roleIds" multiple class="w-full" placeholder="请选择">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { errMsg } from '~/composables/useErr'

definePageMeta({ title: '用户管理' })

const auth = useAuthStore()
const { depts, flatOrgs, ensure } = useDictionaries()
const loading = ref(false)
const saving = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, keyword: '' })
const roles = ref<any[]>([])
const formVisible = ref(false)
const editing = ref<any>(null)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/system/users', { query: query })
    list.value = res.data?.list || []
    total.value = res.data?.total || 0
  } finally {
    loading.value = false
  }
}

function search() {
  query.page = 1
  load()
}

function openForm(row?: any) {
  editing.value = row || null
  form.username = row?.username || ''
  form.name = row?.name || ''
  form.phone = row?.phone || ''
  form.password = ''
  form.orgId = row?.orgId || ''
  form.deptId = row?.deptId || ''
  form.roleIds = row?.roles?.map((r: any) => r.roleId) || []
  form.status = row?.status ?? 1
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/system/users/${editing.value.id}`, { method: 'PUT', body: form })
    } else {
      await $fetch('/api/system/users', { method: 'POST', body: form })
    }
    ElMessage.success('保存成功')
    formVisible.value = false
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

async function remove(row: any) {
  await ElMessageBox.confirm(`确定删除用户「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/system/users/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

async function resetPwd(row: any) {
  const { value } = await ElMessageBox.prompt(`请输入「${row.name}」的新密码（至少6位）`, '重置密码', {
    inputType: 'password',
    inputValidator: (v: string) => (v && v.length >= 6) || '密码至少6位',
  })
  try {
    await $fetch(`/api/system/users/${row.id}/password`, { method: 'PUT', body: { password: value } })
    ElMessage.success('密码已重置')
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(async () => {
  const [roleRes] = await Promise.all([
    $fetch<any>('/api/system/roles').catch(() => null),
    ensure(['orgs', 'depts']),
  ])
  roles.value = roleRes?.data?.list || []
  load()
})
</script>
