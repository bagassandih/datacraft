<template>
  <div class="erd-container">
    <ERDSidebar />
    <ERDCanvas />
    <ERDGeneratePanel />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import { useErdStore } from '@/store/erdStore'
import ERDSidebar from '@/components/ERDSidebar.vue'
import ERDCanvas from '@/components/ERDCanvas.vue'
import ERDGeneratePanel from '@/components/ERDGeneratePanel.vue'

const router = useRouter()
const message = useMessage()
const craftStore = useCraftStore()
const erdStore = useErdStore()

const LAST_MODE_KEY = 'datacraft_last_mode'

onMounted(() => {
  // Save current mode for session restore
  localStorage.setItem(LAST_MODE_KEY, 'erd')

  // Check if connected
  if (!craftStore.isConnected) {
    message.warning('Please connect to database first')
    router.push('/')
    return
  }

  // Load existing session if available
  erdStore.loadSession()
})
</script>

<style scoped>
.erd-container {
  display: flex;
  height: 100vh;
  background: #0f1419;
  overflow: hidden;
}
</style>
