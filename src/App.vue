<template>
  <v-app>
    <!-- AppBar -->
    <v-app-bar app color="primary">
      <v-toolbar-title>前台应用监控</v-toolbar-title>
      <v-spacer></v-spacer>

      <v-chip
        color="#2c2c3c"
        class="ma-2 white--text"
        small
        height="56"
        style="padding-left:16px; padding-right:16px;"
      >
        <v-avatar left size="12" :color="connectionColor"></v-avatar>
        <span class="ms-2">{{ connectionText }}</span>
      </v-chip>
    </v-app-bar>

    <v-main>
      <v-container class="fill-height d-flex flex-column align-center justify-center" fluid>
        <!-- 当前应用卡片 -->
        <v-card
          elevation="5"
          class="pa-6 mb-5"
          style="width: 100%; max-width: 600px;"
          :style="{ backgroundColor: theme.global.current.value.dark ? '#1e1e2f' : '#ffffff' }"
        >
          <div class="card-title mb-4" :style="{ color: theme.global.current.value.dark ? 'white' : 'black' }">
            当前前台应用
          </div>

          <v-card-text>
            <v-fade-transition mode="out-in">
              <div
                v-if="appName"
                :key="appName"
                :class="['app-name', { 'unknown-app': appName.includes('未知应用'), 'flash': flash }]"
                :style="{ color: theme.global.current.value.dark ? 'white' : 'black' }"
              >
                {{ appName }}
              </div>
              <div v-else class="text-subtitle-1" :style="{ color: theme.global.current.value.dark ? 'white' : 'black' }">
                正在获取前台应用...
              </div>
            </v-fade-transition>
          </v-card-text>

          <div v-if="!appName" class="d-flex justify-center my-4">
            <v-progress-circular
              indeterminate
              size="64"
              width="6"
            ></v-progress-circular>
          </div>
        </v-card>

        <!-- 历史时间线 -->
        <v-card
          elevation="3"
          class="mb-5"
          style="overflow-y: auto; width: 100%; max-width: 600px;"
          max-height="50vh"
          ref="historyCard"
        >
          <v-card-title class="text-subtitle-1" :style="{ color: theme.global.current.value.dark ? 'white' : 'black' }">
            应用切换历史
          </v-card-title>
          <v-divider></v-divider>

          <v-timeline side="end">
            <v-timeline-item
              v-for="(item, index) in history"
              :key="index"
              :dot-color="getAppColor(item.name)"
              small
            >
              <template #opposite>
                {{ item.time }}
              </template>
              <template #default>
                {{ item.name }}
              </template>
            </v-timeline-item>
          </v-timeline>
        </v-card>
      </v-container>
    </v-main>

    <!-- WebSocket 错误提示 Snackbar -->
    <v-snackbar
      v-model="snackbar"
      :color="snackbarColor"
      top
      timeout="3000"
      shaped
    >
      {{ snackbarText }}
    </v-snackbar>

    <!-- 右下角固定圆形 FAB 切换暗色模式 -->
    <v-fab-transition>
      <v-fab
        color="pink"
        dark
        aria-label="切换暗色模式"
        @click="toggleDarkMode"
        fab
        size="x-large"
        app
        icon
      >
        <transition name="fab-icon" mode="out-in">
          <v-icon :key="theme.global.current.value.dark ? 'sun' : 'moon'">
            {{ theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}
          </v-icon>
        </transition>
      </v-fab>
    </v-fab-transition>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch, nextTick, computed } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { useTheme } from 'vuetify'

interface HistoryItem {
  time: string
  name: string
}

export default defineComponent({
  name: 'App',
  setup() {
    const appName = ref<string>('')
    const history = ref<HistoryItem[]>([])
    const flash = ref<boolean>(false)
    const historyCard = ref<HTMLElement | null>(null)
    const colorMap = ref<Map<string, string>>(new Map())

    const connectionState = ref<'connected' | 'connecting' | 'disconnected'>('connecting')
    const snackbar = ref(false)
    const snackbarText = ref('')
    const snackbarColor = ref('red')

    const theme = useTheme()
    const preferredDark = usePreferredDark()
    theme.global.name.value = preferredDark.value ? 'dark' : 'light'

    const toggleDarkMode = () => {
      theme.global.name.value = theme.global.name.value === 'dark' ? 'light' : 'dark'
    }
    watch(preferredDark, val => { theme.global.name.value = val ? 'dark' : 'light' })

    const connectionColor = computed(() => {
      switch (connectionState.value) {
        case 'connected': return 'green'
        case 'connecting': return 'yellow'
        case 'disconnected': return 'red'
      }
    })

    const connectionText = computed(() => {
      switch (connectionState.value) {
        case 'connected': return '已连接'
        case 'connecting': return '连接中'
        case 'disconnected': return '未连接'
      }
    })

    const getAppColor = (name: string) => {
      if (!colorMap.value.has(name)) {
        const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const colors = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink']
        colorMap.value.set(name, colors[hash % colors.length])
      }
      return colorMap.value.get(name)
    }

    const addHistory = (name: string) => {
      const now = new Date()
      const timeStr = now.toLocaleTimeString()
      history.value.unshift({ time: timeStr, name })
      if (history.value.length > 50) history.value.pop()
      nextTick(() => {
        if (historyCard.value) historyCard.value.scrollTop = 0
      })
    }

    watch(appName, () => {
      flash.value = true
      setTimeout(() => (flash.value = false), 300)
    })

    onMounted(() => {
      const ws = new WebSocket('ws://localhost:8765')
      let lastApp = ''

      ws.onopen = () => connectionState.value = 'connected'

      ws.onmessage = (event) => {
        const newName = event.data
        if (newName !== lastApp) {
          appName.value = newName
          addHistory(newName)
          lastApp = newName
        }
      }

      ws.onclose = () => {
        connectionState.value = 'disconnected'
        snackbarText.value = 'WebSocket 已断开'
        snackbarColor.value = 'red'
        snackbar.value = true
        setTimeout(() => window.location.reload(), 2000)
      }

      ws.onerror = () => {
        connectionState.value = 'disconnected'
        snackbarText.value = 'WebSocket 连接出错'
        snackbarColor.value = 'red'
        snackbar.value = true
        ws.close()
      }
    })

    return {
      appName, history, flash, historyCard, getAppColor,
      connectionColor, connectionText, snackbar, snackbarText, snackbarColor,
      theme, toggleDarkMode
    }
  }
})
</script>

<style lang="scss">
@import 'vuetify/styles';

.card-title {
  font-weight: bold;
  text-align: left;
  font-size: 1.8rem;
}

.app-name {
  transition: all 0.3s ease-in-out;
  font-size: 2.5rem;
}

.flash {
  animation: flashAnim 0.3s;
}

.unknown-app {
  color: #ff5252;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@keyframes flashAnim { 0% { opacity:0.2;} 50%{opacity:1;} 100%{opacity:0.2;} }

.fab-icon-enter-active, .fab-icon-leave-active {
  transition: transform 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease;
  position: absolute;
  left: 0; right: 0; top: 0; bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.fab-icon-enter-from { transform: scale(0.6) rotate(-90deg); opacity: 0; }
.fab-icon-enter-to { transform: scale(1) rotate(0deg); opacity: 1; }
.fab-icon-leave-from { transform: scale(1) rotate(0deg); opacity: 1; }
.fab-icon-leave-to { transform: scale(0.6) rotate(90deg); opacity: 0; }

/* 保证 v-icon 在 transition 中不改变布局 */
.fixed-fab .v-icon { line-height: 1; }
</style>

