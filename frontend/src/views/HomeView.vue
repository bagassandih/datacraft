<template>
  <div class="home-container">
    <div class="connection-card" :class="{ 'wide-card': step === 3 }">
      <h1>DataCraft</h1>
      <p class="subtitle">Visual SQL Query Builder & ERD Designer</p>

      <!-- Step 1: Server Connection -->
      <div v-if="step === 1">
        <n-form ref="formRef" :model="formData" :rules="rules" size="large">
          <n-form-item label="Database Type" path="client">
            <n-select
              v-model:value="formData.client"
              :options="dbTypes"
              placeholder="Select database type"
            />
          </n-form-item>

          <n-form-item label="Host" path="host">
            <n-input v-model:value="formData.host" placeholder="localhost" />
          </n-form-item>

          <n-form-item label="Port" path="port">
            <n-input-number
              v-model:value="formData.port"
              :min="1"
              :max="65535"
              placeholder="5432"
              style="width: 100%"
            />
          </n-form-item>

          <n-form-item label="Username" path="user">
            <n-input v-model:value="formData.user" placeholder="postgres" />
          </n-form-item>

          <n-form-item label="Password" path="password">
            <n-input
              v-model:value="formData.password"
              type="password"
              placeholder="Leave empty if no password"
              show-password-on="click"
            />
          </n-form-item>

          <n-button
            type="primary"
            size="large"
            block
            :loading="loading"
            @click="handleServerConnect"
          >
            Connect to Server
          </n-button>
        </n-form>
      </div>

      <!-- Step 2: Database Selection -->
      <div v-else-if="step === 2">
        <div class="step-info">
          <n-tag type="success">Connected to {{ formData.host }}</n-tag>
        </div>

        <n-form size="large" style="margin-top: 20px">
          <n-form-item label="Select Database">
            <n-select
              v-model:value="selectedDatabase"
              :options="databaseOptions"
              placeholder="Choose a database"
              filterable
            />
          </n-form-item>

          <n-space vertical>
            <n-button
              type="primary"
              size="large"
              block
              :loading="loading"
              :disabled="!selectedDatabase"
              @click="handleDatabaseConnect"
            >
              Connect to Database
            </n-button>

            <n-button
              size="large"
              block
              @click="step = 1"
            >
              Back
            </n-button>
          </n-space>
        </n-form>
      </div>

      <!-- Step 3: Feature Selection -->
      <div v-else-if="step === 3">
        <div class="step-info">
          <n-tag type="success">Connected to {{ selectedDatabase }}</n-tag>
        </div>

        <p class="feature-prompt">What would you like to do?</p>

        <div class="feature-cards">
          <div class="feature-card" @click="navigateTo('query')">
            <div class="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <line x1="10" y1="9" x2="8" y2="9"/>
              </svg>
            </div>
            <h3>Crafting Query</h3>
            <p>Build SQL queries visually by connecting tables and defining relationships. Generate SELECT statements with JOINs, WHERE clauses, and more.</p>
          </div>

          <div class="feature-card" @click="navigateTo('erd')">
            <div class="feature-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <path d="M10 6.5h4"/>
                <path d="M6.5 10v4"/>
                <path d="M17.5 10v4"/>
                <path d="M10 17.5h4"/>
              </svg>
            </div>
            <h3>Crafting ERD</h3>
            <p>Design your database schema visually. Create tables, define columns, set relationships, and export as SQL or image for documentation.</p>
          </div>
        </div>

        <n-button
          size="large"
          block
          style="margin-top: 20px"
          @click="step = 2"
        >
          Back
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import { dbService } from '@/api/dbService'

const router = useRouter()
const message = useMessage()
const craftStore = useCraftStore()

const formRef = ref(null)
const loading = ref(false)
const step = ref(1)
const databases = ref([])
const selectedDatabase = ref(null)

const dbTypes = [
  { label: 'PostgreSQL', value: 'pg' },
  { label: 'MySQL', value: 'mysql2' }
]

const formData = reactive({
  client: 'pg',
  host: 'localhost',
  port: 5432,
  user: '',
  password: ''
})

const rules = {
  client: { required: true, message: 'Please select database type' },
  host: { required: true, message: 'Please enter host' },
  port: { required: true, type: 'number', message: 'Please enter port' },
  user: { required: true, message: 'Please enter username' }
  // password is optional (for local dev without password)
}

const databaseOptions = computed(() =>
  databases.value.map(db => ({ label: db, value: db }))
)

const LAST_MODE_KEY = 'datacraft_last_mode'

// Check for existing session on mount
onMounted(async () => {
  const hasSession = craftStore.loadSession()
  if (hasSession && craftStore.isConnected) {
    try {
      loading.value = true
      // Re-establish backend connection
      await dbService.connect(craftStore.dbConnection)

      // Refresh schema
      const schemaResult = await dbService.getSchema()
      craftStore.setSchema(schemaResult.data)

      message.success('Session restored! Reconnected to database.')

      // Redirect to last used mode
      const lastMode = localStorage.getItem(LAST_MODE_KEY) || 'query'
      router.push(`/${lastMode}`)
    } catch (error) {
      // If reconnection fails, clear session and stay on home page
      message.warning('Session expired or database unavailable. Please reconnect.')
      craftStore.clearConnection()
    } finally {
      loading.value = false
    }
  }
})

const handleServerConnect = async () => {
  try {
    await formRef.value?.validate()
    loading.value = true

    // List databases
    const result = await dbService.listDatabases(formData)
    databases.value = result.databases

    message.success('Connected to server!')
    step.value = 2
  } catch (error) {
    message.error(error.message || 'Connection failed')
  } finally {
    loading.value = false
  }
}

const handleDatabaseConnect = async () => {
  try {
    loading.value = true

    // Connect to specific database
    const config = {
      ...formData,
      database: selectedDatabase.value
    }

    await dbService.connect(config)

    // Save connection config
    craftStore.setConnection(config)

    // Get schema
    const schemaResult = await dbService.getSchema()
    craftStore.setSchema(schemaResult.data)

    message.success('Connected to database successfully!')

    // Navigate to feature selection
    step.value = 3
  } catch (error) {
    message.error(error.message || 'Connection failed')
  } finally {
    loading.value = false
  }
}

const navigateTo = (feature) => {
  // Save last mode for session restore
  localStorage.setItem(LAST_MODE_KEY, feature)
  router.push(`/${feature}`)
}
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1e3a5f 0%, #0f1419 100%);
  padding: 20px;
}

.connection-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

h1 {
  margin: 0 0 10px;
  color: #fff;
  text-align: center;
  font-size: 2.5rem;
}

.subtitle {
  margin: 0 0 30px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  font-size: 1.1rem;
}

.step-info {
  text-align: center;
  margin-bottom: 20px;
}

:deep(.n-form-item-label) {
  color: rgba(255, 255, 255, 0.9);
}

.wide-card {
  max-width: 700px !important;
}

.feature-prompt {
  text-align: center;
  color: rgba(255, 255, 255, 0.8);
  font-size: 1.1rem;
  margin: 20px 0;
}

.feature-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  margin-top: 20px;
}

.feature-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  text-align: center;
}

.feature-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(99, 226, 183, 0.5);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.feature-icon {
  color: #63e2b7;
  margin-bottom: 16px;
}

.feature-card h3 {
  color: #fff;
  font-size: 1.2rem;
  margin: 0 0 12px;
}

.feature-card p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .feature-cards {
    grid-template-columns: 1fr;
  }

  .wide-card {
    max-width: 100% !important;
  }
}
</style>
