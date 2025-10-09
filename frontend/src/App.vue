<template>
  <n-config-provider :theme="darkTheme">
    <n-message-provider>
      <router-view />
    </n-message-provider>
  </n-config-provider>
</template>

<script setup>
import { darkTheme } from 'naive-ui'
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #0f1419;
  color: #fff;
}

#app {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

/* Scrollbar styling */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: #1a1f2e;
}

::-webkit-scrollbar-thumb {
  background: #2d3548;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #3d4558;
}
</style>
