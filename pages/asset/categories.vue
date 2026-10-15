<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">资产分类</h2>
        <p class="page-head__hint">支持多级分类，使用年限用于折旧计算（月）</p>
      </div>
      <div class="page-head__actions">
        <el-button v-if="auth.can('asset:category:add')" type="primary" @click="openForm()">
          新增分类
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
      empty-text="暂无资产分类，点击右上角「新增分类」创建"
    >
      <el-table-column prop="name" label="分类名称" min-width="200" />
      <el-table-column prop="code" label="分类编码" width="140" />
      <el-table-column label="使用年限(月)" width="120" align="center">
        <template #default="{ row }">
          <span class="tabular">{{ row.usefulLife }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="auth.can('asset:category:edit')"
            link
            type="primary"
            :aria-label="`编辑分类 ${row.name}`"
            @click="openForm(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="auth.can('asset:category:del')"
            link
            type="danger"
            :aria-label="`删除分类 ${row.name}`"
            @click="remove(row)"
          >
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="formVisible" :title="editing ? '编辑分类' : '新增分类'" width="480px">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="分类名称" prop="name"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="分类编码" prop="code">
          <el-input v-model="form.code" :disabled="!!editing" placeholder="如 ELEC-NB" />
        </el-form-item>
        <el-form-item label="上级分类">
          <el-tree-select
            v-model="form.parentId"
            :data="parentOptions"
            :props="{ label: 'name', children: 'children' }"
            node-key="id"
            check-strictly
            clearable
            placeholder="无（顶级分类）"
            class="w-full"
          />
        </el-form-item>
        <el-form-item label="使用年限(月)">
          <el-input-number v-model="form.usefulLife" :min="1" :max="600" class="w-full" />
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
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

definePageMeta({ title: '资产分类' })

const auth = useAuthStore()
const loading = ref(false)
const saving = ref(false)
const tree = ref<any[]>([])
const formVisible = ref(false)
const editing = ref<any>(null)
const formRef = ref()
const form = reactive<any>({})
const rules = {
  name: [{ required: true, message: '请输入分类名称', trigger: 'blur' }],
  code: [{ required: true, message: '请输入分类编码', trigger: 'blur' }],
}

/// 编辑时剔除自身及其子树，避免形成环
const parentOptions = computed(() => {
  const prune = (nodes: any[]): any[] =>
    nodes
      .filter((n) => n.id !== editing.value?.id)
      .map((n) => ({ ...n, children: n.children ? prune(n.children) : undefined }))
  return prune(tree.value)
})

async function load() {
  loading.value = true
  try {
    const res: any = await $fetch('/api/asset/categories')
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
  form.usefulLife = row?.usefulLife ?? 60
  form.remark = row?.remark || ''
  formVisible.value = true
}

async function save() {
  await formRef.value?.validate()
  saving.value = true
  try {
    if (editing.value) {
      await $fetch(`/api/asset/categories/${editing.value.id}`, { method: 'PUT', body: form })
    } else {
      await $fetch('/api/asset/categories', { method: 'POST', body: form })
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
  await ElMessageBox.confirm(`确定删除分类「${row.name}」？`, '提示', { type: 'warning' })
  try {
    await $fetch(`/api/asset/categories/${row.id}`, { method: 'DELETE' })
    ElMessage.success('删除成功')
    load()
  } catch (e: any) {
    ElMessage.error(errMsg(e))
  }
}

onMounted(load)
</script>
