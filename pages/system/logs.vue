<template>
  <div>
    <div class="page-head">
      <div>
        <h2 class="page-title">操作日志</h2>
        <p class="page-head__hint">记录登录与关键写操作，共 {{ total }} 条</p>
      </div>
    </div>

    <div
      class="card-base p-3 mb-4 toolbar flex flex-wrap items-center gap-2"
      role="search"
      aria-label="日志筛选"
    >
      <el-select
        v-model="query.module"
        clearable
        placeholder="模块"
        aria-label="按模块筛选"
        class="w-[160px]"
        @change="search"
      >
        <el-option label="认证" value="auth" />
        <el-option label="资产" value="asset" />
        <el-option label="系统" value="system" />
      </el-select>
      <el-input
        v-model="query.keyword"
        class="w-[220px]"
        placeholder="用户 / 动作"
        aria-label="按用户名或动作搜索"
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
      empty-text="暂无操作日志"
    >
      <el-table-column label="时间" width="180">
        <template #default="{ row }">
          <span class="tabular">{{ fmtTime(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="用户" width="120">
        <template #default="{ row }">{{ row.userName || '—' }}</template>
      </el-table-column>
      <el-table-column label="模块" width="100">
        <template #default="{ row }">{{ moduleMap[row.module] || row.module }}</template>
      </el-table-column>
      <el-table-column prop="action" label="动作" min-width="140" />
      <el-table-column prop="path" label="请求路径" min-width="200" show-overflow-tooltip />
      <el-table-column label="IP" width="140">
        <template #default="{ row }">
          <span class="tabular">{{ row.ip || '—' }}</span>
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({ title: '操作日志' })

const loading = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const query = reactive({ page: 1, size: 20, module: '', keyword: '' })

const moduleMap: Record<string, string> = { auth: '认证', asset: '资产', system: '系统' }

/// 后端返回 ISO 字符串，这里统一成可读格式（原先直接渲染原始字符串）
function fmtTime(v: any) {
  if (!v) return '—'
  return String(v).slice(0, 19).replace('T', ' ')
}

async function load() {
  loading.value = true
  try {
    const params: any = { page: query.page, size: query.size }
    if (query.module) params.module = query.module
    if (query.keyword) params.keyword = query.keyword
    const res: any = await $fetch('/api/system/logs', { query: params })
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

onMounted(load)
</script>
