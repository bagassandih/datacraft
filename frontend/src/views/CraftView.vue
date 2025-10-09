<template>
  <div class="craft-container">
    <SidebarDB />
    <CanvasCraft />
    <FilterPanel />
    <GeneratePanel />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import SidebarDB from '@/components/SidebarDB.vue'
import CanvasCraft from '@/components/CanvasCraft.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import GeneratePanel from '@/components/GeneratePanel.vue'

const router = useRouter()
const message = useMessage()
const craftStore = useCraftStore()

onMounted(() => {
  // Check if connected
  if (!craftStore.isConnected) {
    message.warning('Please connect to database first')
    router.push('/')
  }
})
</script>

<style scoped>
.craft-container {
  display: flex;
  height: 100vh;
  background: #0f1419;
  overflow: hidden;
}
</style>
