<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">组织架构</h2>
        <p class="page-head__hint">组织树用于资产归属与数据范围划分</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('system:org:add')" type="primary" @click="openForm()">
          新增组织
        </el-button>
      </div>
    </div>
    <el-table
      v-loading="loading"
      :data="tree"
      row-key="id"
      border
      default-expand-all
      :tree-props="{ children: 'children' }"
      empty-text="暂无组织，点击右上角「新增组织」创建"
    >
      <el-table-column prop="name" label="名称" min-width="200" />
      <el-table-column prop="code" label="编码" width="160" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="auth.can('system:org:edit')"
            link
            type="primary"
            :aria-label="`编辑组织 ${row.name}`"
            @click="openForm(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.can('system:org:del')"
            link
            type="danger"
            :aria-label="`删除组织 ${row.name}`"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="formVisible" :title="editing ? '编辑组织' : '新增组织'" width="460px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="组织名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="组织编码" prop="code">
          <el-input v-model="form.code" :disabled="!!editing" placeholder="如 ORG-004" />
        </el-form-item>
        <el-form-item label="上级组织">
          <el-tree-select
            v-model="form.parentId"
            :data="tree"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            placeholder="无（顶级组织）"
            class="w-full"
          />
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

definePageMeta({ title: '组织架构' })

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const tree = ref<any[]>([])
const formVisible = ref(false)
const editing = ref<any>(null)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/system/orgs')
    tree.value = res.data || []
  } finally {
    loading.value = false
  }
}

function openForm(row?: any) {
  editing.value = row || null
  form.name = row?.name || ''
  form.code = row?.code || ''
  form.parentId = row?.parentId || ''
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/system/orgs/${editing.value.id}`, { method: 'PUT', body: form })
    } else {
      await $fetch('/api/system/orgs', { method: 'POST', body: form })
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
  await ElMessageBox.confirm(`确定删除组织「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/system/orgs/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(load)
</script>
