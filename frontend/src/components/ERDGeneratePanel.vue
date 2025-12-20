<template>
  <div class="generate-panel" :class="{ collapsed: isCollapsed }">
    <!-- Toggle Button -->
    <div class="toggle-button" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expand Panel' : 'Collapse Panel'">
      <span class="toggle-icon">{{ isCollapsed ? '<' : '>' }}</span>
    </div>

    <div v-show="!isCollapsed" class="panel-inner">
      <div class="panel-header">
        <h3>Export & Execute</h3>
      </div>

      <div class="panel-content">
        <div v-if="!erdStore.hasTables" class="empty-state">
          <p>Create tables to generate SQL and export your ERD</p>
        </div>

        <div v-else>
          <n-space vertical :size="15">
            <!-- Generate SQL Section -->
            <div class="section">
              <h4>Generate SQL</h4>
              <n-button
                type="primary"
                block
                @click="handleGenerateSQL"
              >
                {{ hasExecutedTables ? 'Generate SQL (CREATE/ALTER)' : 'Generate CREATE TABLE SQL' }}
              </n-button>
              <p v-if="hasExecutedTables" class="hint">
                Some tables are already created. Modifications will generate ALTER statements.
              </p>
            </div>

            <!-- SQL Preview -->
            <div v-if="generatedSQL" class="sql-preview">
              <div class="preview-header">
                <h4>Generated SQL:</h4>
                <n-space>
                  <n-button size="small" @click="copySQL">Copy</n-button>
                  <n-button size="small" @click="handleExportSQL">Download .sql</n-button>
                </n-space>
              </div>
              <pre class="sql-code">{{ generatedSQL }}</pre>
            </div>

            <!-- Execute Section -->
            <div v-if="generatedSQL" class="section">
              <h4>Execute in Database</h4>
              <n-alert type="warning" :bordered="false" style="margin-bottom: 12px">
                {{ hasExecutedTables
                  ? 'This will execute CREATE and ALTER statements on your database.'
                  : 'This will create tables in your connected database. Make sure tables with same names don\'t exist.'
                }}
              </n-alert>
              <n-button
                type="warning"
                block
                :loading="executing"
                @click="handleExecuteSQL"
              >
                Execute SQL
              </n-button>
            </div>

            <n-divider />

            <!-- Export Section -->
            <div class="section">
              <h4>Export ERD</h4>
              <n-space vertical :size="10">
                <n-button block @click="handleExportPNG" :loading="exportingPNG">
                  Export as PNG
                </n-button>
                <n-button block @click="handleExportJSON">
                  Export as JSON
                </n-button>
                <n-button block @click="handleExportSQL">
                  Export as SQL
                </n-button>
              </n-space>
            </div>

            <!-- Execution Results -->
            <div v-if="executionResult" class="execution-result" :class="executionResult.success ? 'success' : 'error'">
              <h4>{{ executionResult.success ? 'Execution Successful' : 'Execution Failed' }}</h4>
              <p>{{ executionResult.message }}</p>
            </div>
          </n-space>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMessage } from 'naive-ui'
import { useErdStore } from '@/store/erdStore'
import { dbService } from '@/api/dbService'

const message = useMessage()
const erdStore = useErdStore()

const isCollapsed = ref(false)
const generatedSQL = ref('')
const executing = ref(false)
const exportingPNG = ref(false)
const executionResult = ref(null)

// Check if any tables have been executed
const hasExecutedTables = computed(() => {
  return Object.keys(erdStore.executedTables).length > 0
})

// Generate SQL
const handleGenerateSQL = () => {
  generatedSQL.value = erdStore.generateSQL()
  message.success('SQL generated')
}

// Copy SQL to clipboard
const copySQL = () => {
  navigator.clipboard.writeText(generatedSQL.value)
  message.success('SQL copied to clipboard')
}

// Export SQL file
const handleExportSQL = () => {
  if (!generatedSQL.value) {
    generatedSQL.value = erdStore.generateSQL()
  }
  erdStore.exportSQL()
  message.success('SQL file downloaded')
}

// Export JSON
const handleExportJSON = () => {
  erdStore.exportERD()
  message.success('JSON file downloaded')
}

// Export PNG
const handleExportPNG = async () => {
  try {
    exportingPNG.value = true

    // Find the vue-flow container
    const flowContainer = document.querySelector('.vue-flow')
    if (!flowContainer) {
      message.error('Canvas not found')
      return
    }

    // Dynamic import of html-to-image
    const { toPng } = await import('html-to-image')

    const dataUrl = await toPng(flowContainer, {
      backgroundColor: '#0f1419',
      quality: 1,
      pixelRatio: 2,
      filter: (node) => {
        // Filter out controls and minimap for cleaner export
        if (node.classList) {
          return !node.classList.contains('vue-flow__controls') &&
                 !node.classList.contains('vue-flow__minimap')
        }
        return true
      }
    })

    // Download the image
    const link = document.createElement('a')
    link.download = `datacraft_erd_${new Date().toISOString().slice(0, 10)}.png`
    link.href = dataUrl
    link.click()

    message.success('PNG exported successfully')
  } catch (error) {
    console.error('Export PNG error:', error)
    message.error('Failed to export PNG')
  } finally {
    exportingPNG.value = false
  }
}

// Execute SQL in database
const handleExecuteSQL = async () => {
  if (!generatedSQL.value) {
    message.warning('Generate SQL first')
    return
  }

  try {
    executing.value = true
    executionResult.value = null

    // Split SQL into individual statements and execute each
    // Remove comment lines and filter out empty statements
    const statements = generatedSQL.value
      .split(';')
      .map(s => {
        // Remove comment lines from statement
        return s.split('\n')
          .filter(line => !line.trim().startsWith('--'))
          .join('\n')
          .trim()
      })
      .filter(s => s.length > 0)

    let successCount = 0
    let errorMessages = []

    for (const statement of statements) {
      try {
        await dbService.executeDDL(statement + ';')
        successCount++
      } catch (error) {
        errorMessages.push(error.message || 'Unknown error')
      }
    }

    if (errorMessages.length === 0) {
      // Mark all tables as executed to track their current state
      erdStore.markAllTablesAsExecuted()

      executionResult.value = {
        success: true,
        message: `Successfully executed ${successCount} SQL statement(s). Tables have been created/modified.`
      }
      message.success('SQL executed successfully')

      // Clear generated SQL since it's been executed
      generatedSQL.value = ''
    } else {
      executionResult.value = {
        success: false,
        message: `Executed ${successCount} statement(s). Errors: ${errorMessages.join(', ')}`
      }
      message.warning(`Completed with ${errorMessages.length} error(s)`)
    }
  } catch (error) {
    executionResult.value = {
      success: false,
      message: error.message || 'Failed to execute SQL'
    }
    message.error('Failed to execute SQL')
  } finally {
    executing.value = false
  }
}
</script>

<style scoped>
.generate-panel {
  width: 350px;
  background: #1a1f2e;
  border-left: 1px solid #2d3548;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease;
}

.generate-panel.collapsed {
  width: 40px;
  min-width: 40px;
}

.toggle-button {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: #63e2b7;
  color: #0f1419;
  width: 30px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  z-index: 10;
  transition: all 0.2s;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
}

.toggle-button:hover {
  background: #4dd09a;
  width: 35px;
}

.toggle-icon {
  font-size: 1rem;
  font-weight: bold;
}

.panel-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-left: 35px;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #2d3548;
}

.panel-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.empty-state {
  color: #8896a8;
  text-align: center;
  padding: 40px 20px;
}

.section {
  background: rgba(255, 255, 255, 0.02);
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2d3548;
}

.section h4 {
  margin: 0 0 12px;
  color: #fff;
  font-size: 0.9rem;
}

.section .hint {
  margin: 8px 0 0;
  font-size: 0.75rem;
  color: #8896a8;
  line-height: 1.4;
}

.sql-preview {
  background: #0f1419;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2d3548;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.preview-header h4 {
  margin: 0;
  color: #fff;
  font-size: 0.9rem;
}

.sql-code {
  background: #000;
  color: #63e2b7;
  padding: 15px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
  overflow-x: auto;
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 300px;
  overflow-y: auto;
}

.execution-result {
  padding: 15px;
  border-radius: 8px;
}

.execution-result.success {
  background: rgba(99, 226, 183, 0.15);
  border: 1px solid #63e2b7;
}

.execution-result.error {
  background: rgba(255, 71, 87, 0.15);
  border: 1px solid #ff4757;
}

.execution-result h4 {
  margin: 0 0 8px;
  font-size: 0.9rem;
}

.execution-result.success h4 {
  color: #63e2b7;
}

.execution-result.error h4 {
  color: #ff4757;
}

.execution-result p {
  margin: 0;
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.5;
}
</style>
