<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">角色管理</h2>
        <p class="page-head__hint">角色决定功能权限与数据范围，权限保存后立即生效</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('system:role:add')" type="primary" @click="openForm()">
          新增角色
        </el-button>
      </div>
    </div>
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      empty-text="暂无角色，点击右上角「新增角色」创建"
    >
      <el-table-column prop="code" label="编码" width="180" />
      <el-table-column prop="name" label="名称" width="160" />
      <el-table-column label="数据范围" width="120">
        <template #default="{ row }">{{ DATA_SCOPE[row.dataScope] || row.dataScope }}</template>
      </el-table-column>
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 1 ? 'success' : 'info'">{{ row.status === 1 ? '启用' : '禁用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" min-width="170">
        <template #default="{ row }">
          <span class="tabular">{{ String(row.createdAt).slice(0, 19).replace('T', ' ') }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="auth.can('system:role:edit')"
            link
            type="primary"
            :aria-label="`编辑角色 ${row.name}`"
            @click="openForm(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.can('system:role:edit')"
            link
            type="success"
            :aria-label="`为角色 ${row.name} 分配权限`"
            @click="openPerms(row)"
          >
            分配权限
          </el-button>
          <el-button
            v-if="auth.can('system:role:del')"
            link
            type="danger"
            :aria-label="`删除角色 ${row.name}`"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="formVisible" :title="editing ? '编辑角色' : '新增角色'" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="角色编码" prop="code">
          <el-input v-model="form.code" :disabled="!!editing" placeholder="如 ASSET_ADMIN" />
        </el-form-item>
        <el-form-item label="角色名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="数据范围" prop="dataScope">
          <el-select v-model="form.dataScope" class="w-full" aria-label="数据范围">
            <el-option v-for="(v, k) in DATA_SCOPE" :key="k" :label="v" :value="k" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.status" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="permVisible" title="分配权限" width="520px">
      <el-alert type="info" :closable="false" show-icon class="mb-2" title="勾选菜单与按钮权限，保存后立即生效" />
      <el-tree
        ref="permTreeRef"
        :data="permTree"
        show-checkbox
        node-key="code"
        :default-checked-keys="checked"
        :props="{ label: 'name', children: 'children' }"
      />
      <template #footer>
        <el-button @click="permVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="savePerms">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { errMsg } from '~/composables/useErr'
import { DATA_SCOPE } from '~/composables/useDict'

definePageMeta({ title: '角色管理' })

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const list = ref<any[]>([])

const formVisible = ref(false)
const editing = ref<any>(null)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
}

const permVisible = ref(false)
const permTreeRef = ref()
const allPerms = ref<any[]>([])
const checked = ref<string[]>([])
const permRole = ref<any>(null)

const permTree = computed(() => {
  const groups: Record<string, any> = {}
  for (const p of allPerms.value) {
    if (!groups[p.module]) {
      groups[p.module] = { code: `__mod_${p.module}`, name: moduleName(p.module), children: [] }
    }
    groups[p.module].children.push({ code: p.code, name: `${p.name}（${p.code}）` })
  }
  return Object.values(groups)
})

/// 权限树分组名：新增模块时同步补一份中文名，避免树里出现英文 module 值
function moduleName(m: string) {
  return { dashboard: '工作台', asset: '资产管理', system: '系统管理' }[m] || m
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/system/roles')
    list.value = res.data?.list || []
  } finally {
    loading.value = false
  }
}

function openForm(row?: any) {
  editing.value = row || null
  form.code = row?.code || ''
  form.name = row?.name || ''
  form.dataScope = row?.dataScope || 'ORG'
  form.status = row?.status ?? 1
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/system/roles/${editing.value.id}`, { method: 'PUT', body: form })
    } else {
      await $fetch('/api/system/roles', { method: 'POST', body: form })
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
  await ElMessageBox.confirm(`确定删除角色「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/system/roles/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

async function openPerms(row: any) {
  permRole.value = row
  if (!allPerms.value.length) {
    const res: any = await $fetch('/api/system/permissions')
    allPerms.value = res.data || []
  }
  permVisible.value = true
  const detail: any = await $fetch(`/api/system/roles/${row.id}`)
  checked.value = detail.data?.permIds || []
  await nextTick()
  permTreeRef.value?.setCheckedKeys(checked.value, false)
}

async function savePerms() {
  const leafKeys: string[] = permTreeRef.value?.getCheckedKeys(true) || []
  const permIds = allPerms.value.filter((p) => leafKeys.includes(p.code)).map((p) => p.id)
  saving.value = true
  try {
    await $fetch(`/api/system/roles/${permRole.value.id}/perms`, { method: 'PUT', body: { permIds } })
    ElMessage.success('权限已保存')
    permVisible.value = false
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>
