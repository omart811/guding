<template>
  <img
    v-if="url"
    :src="url"
    :alt="`资产 ${text} 的二维码`"
    class="asset-qrcode"
  />
  <span
    v-else
    class="asset-qrcode asset-qrcode--pending"
    :aria-label="`资产 ${text} 的二维码生成中`"
    aria-busy="true"
  />
</template>

<script setup lang="ts">
/// 资产二维码：给定文本渲染为 SVG。
/// 显示尺寸由父级 CSS 决定（矢量化，打印不失真），`nominal` 只影响 SVG 标称宽高。
const props = withDefaults(defineProps<{ text: string; nominal?: number }>(), { nominal: 240 })

const { svg } = useQrcode()
const url = ref('')

async function render() {
  if (!import.meta.client || !props.text) return
  try {
    url.value = await svg(props.text, props.nominal)
  } catch {
    url.value = ''
  }
}

onMounted(render)
watch(() => [props.text, props.nominal], render)
</script>
