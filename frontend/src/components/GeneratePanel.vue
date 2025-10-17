<template>
  <div class="generate-panel" :class="{ collapsed: isCollapsed }">
    <!-- Toggle Button -->
    <div class="toggle-button" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expand Query Generator' : 'Collapse Query Generator'">
      <span class="toggle-icon">{{ isCollapsed ? '◀' : '▶' }}</span>
    </div>

    <div v-show="!isCollapsed" class="panel-inner">
      <div class="panel-header">
        <h3>⚡ Query Generator</h3>
      </div>

      <div class="panel-content">
      <div v-if="!craftStore.hasNodes" class="empty-state">
        <p>Add tables from the sidebar to start building your query</p>
      </div>

      <div v-else>
        <n-space vertical :size="15">
          <n-button
            type="primary"
            block
            size="large"
            :loading="generating"
            @click="handleGenerate"
          >
            Generate SQL
          </n-button>

          <div v-if="craftStore.generatedQuery" class="query-preview">
            <h4>Generated Query:</h4>
            <pre class="sql-code">{{ craftStore.generatedQuery }}</pre>

            <n-space>
              <n-button
                type="success"
                :loading="executing"
                @click="handleExecute"
              >
                Execute Query
              </n-button>
              <n-button @click="copyQuery">
                Copy
              </n-button>
            </n-space>
          </div>

          <div v-if="craftStore.queryResults" class="results-section">
            <h4>Results ({{ craftStore.queryResults.count }} rows):</h4>
            <div class="results-table">
              <table>
                <thead>
                  <tr>
                    <th
                      v-for="(value, key) in craftStore.queryResults.rows[0]"
                      :key="key"
                    >
                      {{ key }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(row, index) in craftStore.queryResults.rows"
                    :key="index"
                  >
                    <td v-for="(value, key) in row" :key="key">
                      {{ value }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </n-space>
      </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import { dbService } from '@/api/dbService'

const message = useMessage()
const craftStore = useCraftStore()

const isCollapsed = ref(false)
const generating = ref(false)
const executing = ref(false)

const handleGenerate = async () => {
  try {
    generating.value = true

    // Create a mapping from node ID to a unique identifier
    // This is needed because the same table can appear multiple times
    const nodeIdMap = new Map()
    craftStore.nodes.forEach((node, index) => {
      nodeIdMap.set(node.id, `${node.data.table}_${index}`)
    })

    // Prepare nodes with unique IDs, aliases, selected columns, and position
    const nodes = craftStore.nodes.map((node, index) => ({
      id: `${node.data.table}_${index}`, // Use table name + index for uniqueness
      tableName: node.data.table, // Keep original table name
      alias: node.data.alias || node.data.table,
      position: node.position, // Include position for visual ordering
      // Only include columns that are explicitly selected
      columns: (node.data.selectedColumns && node.data.selectedColumns.length > 0)
        ? node.data.selectedColumns
        : []
    }))

    // Map edges to use the new unique IDs
    const edges = craftStore.edges.map(edge => ({
      ...edge,
      source: nodeIdMap.get(edge.source),
      target: nodeIdMap.get(edge.target)
    }))

    const result = await dbService.generateQuery({
      nodes,
      edges,
      filters: craftStore.queryClauses.filters,
      orderBy: craftStore.queryClauses.orderBy,
      groupBy: craftStore.queryClauses.groupBy,
      having: craftStore.queryClauses.having
    })

    craftStore.setGeneratedQuery(result.query)
    message.success('Query generated successfully')
  } catch (error) {
    message.error(error.message || 'Failed to generate query')
  } finally {
    generating.value = false
  }
}

const handleExecute = async () => {
  try {
    executing.value = true

    const result = await dbService.executeQuery(craftStore.generatedQuery)

    craftStore.setQueryResults(result)
    message.success(`Query executed: ${result.count} rows returned`)
  } catch (error) {
    message.error(error.message || 'Failed to execute query')
  } finally {
    executing.value = false
  }
}

const copyQuery = () => {
  navigator.clipboard.writeText(craftStore.generatedQuery)
  message.success('Query copied to clipboard')
}
</script>

<style scoped>
.generate-panel {
  width: 400px;
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
  box-shadow: 3px 0 12px rgba(99, 226, 183, 0.4);
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

.query-preview {
  background: #0f1419;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2d3548;
}

.query-preview h4 {
  margin: 0 0 10px;
  color: #fff;
  font-size: 0.9rem;
}

.sql-code {
  background: #000;
  color: #63e2b7;
  padding: 15px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  overflow-x: auto;
  margin: 10px 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.results-section {
  background: #0f1419;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #2d3548;
}

.results-section h4 {
  margin: 0 0 10px;
  color: #fff;
  font-size: 0.9rem;
}

.results-table {
  overflow-x: auto;
  max-height: 400px;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

th {
  background: #63e2b7;
  color: #0f1419;
  padding: 8px;
  text-align: left;
  font-weight: 600;
  position: sticky;
  top: 0;
}

td {
  padding: 8px;
  border-bottom: 1px solid #2d3548;
  color: #fff;
}

tr:hover {
  background: rgba(99, 226, 183, 0.1);
}
</style>
