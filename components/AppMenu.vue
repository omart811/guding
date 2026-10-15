<template>
  <el-menu
    class="art-menu"
    :default-active="active"
    :collapse="collapsed"
    :collapse-transition="false"
    router
  >
    <template v-for="m in allMenus" :key="m.code">
      <el-sub-menu v-if="m.children?.length && visibleChildren(m).length" :index="m.code">
        <template #title>
          <el-icon v-if="m.icon"><component :is="icons[m.icon]" /></el-icon>
          <span>{{ m.name }}</span>
        </template>
        <el-menu-item v-for="c in visibleChildren(m)" :key="c.code" :index="c.path!">
          <el-icon v-if="c.icon"><component :is="icons[c.icon]" /></el-icon>
          <template #title>{{ c.name }}</template>
        </el-menu-item>
      </el-sub-menu>
      <el-menu-item v-else-if="auth.can(m.code)" :index="m.path!">
        <el-icon v-if="m.icon"><component :is="icons[m.icon]" /></el-icon>
        <template #title>{{ m.name }}</template>
      </el-menu-item>
    </template>
  </el-menu>
</template>

<script setup lang="ts">
/// 侧边栏导航：桌面侧栏与移动端抽屉共用一份，避免两处维护导致菜单不一致
import {
  Odometer,
  Box,
  Notebook,
  Switch,
  Checked,
  FolderOpened,
  Setting,
  User,
  Avatar,
  OfficeBuilding,
  Document,
} from '@element-plus/icons-vue'
import { allMenus, type MenuItem } from '~/composables/useMenus'

defineProps<{ active?: string; collapsed?: boolean }>()

const auth = useAuthStore()

/// 菜单图标映射：useMenus 里的 icon 字段按名取用
const icons: Record<string, any> = {
  Odometer,
  Box,
  Notebook,
  Switch,
  Checked,
  FolderOpened,
  Setting,
  User,
  Avatar,
  OfficeBuilding,
  Document,
}

/// 只保留当前用户有权限的子项，无子项则整个分组不渲染
function visibleChildren(m: MenuItem) {
  return (m.children || []).filter((c) => auth.can(c.code))
}
</script>
