<template>
  <SpeedInsights/>
  <v-app>
    <v-app-bar app>
      <template #prepend>
        <v-btn
          icon
          href="https://github.com/RewLight/foreground-monitor"
          target="_blank"
          rel="noopener"
          aria-label="GitHub"
        >
          <v-icon>mdi-github</v-icon>
        </v-btn>
      </template>

      <v-toolbar-title>春茶在干什么</v-toolbar-title>
      <v-spacer></v-spacer>

      <template #append>
        <v-chip
          class="ma-2"
          small
          height="56"
          style="padding-left:16px; padding-right:16px;"
        >
          <v-avatar left size="12" :color="isAlive ? 'green' : 'red'"></v-avatar>
          <span class="ms-2">{{ isAlive ? '哈气中' : '死了' }}</span>
        </v-chip>
      </template>
    </v-app-bar>

    <v-main>
      <v-container class="fill-height d-flex flex-column align-center justify-center" fluid>
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
            <v-progress-circular indeterminate size="64" width="6"></v-progress-circular>
          </div>
        </v-card>

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
              <template #opposite>{{ item.time }}</template>
              <template #default>{{ item.name }}</template>
            </v-timeline-item>
          </v-timeline>
        </v-card>
      </v-container>
    </v-main>

    <v-snackbar v-model="snackbar" :color="snackbarColor" top timeout="3000" shaped>
      {{ snackbarText }}
    </v-snackbar>

    <v-fab-transition>
      <v-fab color="pink" dark aria-label="切换暗色模式" @click="toggleDarkMode" fab size="x-large" app icon>
        <transition name="fab-icon" mode="out-in">
          <v-icon>{{ theme.global.current.value.dark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
        </transition>
      </v-fab>
    </v-fab-transition>
  </v-app>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, nextTick, computed, watch } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { useTheme } from 'vuetify'
import { SpeedInsights } from "@vercel/speed-insights/vue"

interface HistoryItem { time: string; name: string }

export default defineComponent({
  name: 'App',
  setup() {
    const appName = ref<string>('')
    const history = ref<HistoryItem[]>([])
    const flash = ref<boolean>(false)
    const historyCard = ref<HTMLElement | null>(null)
    const colorMap = ref<Map<string, string>>(new Map())
    const status = ref<{ lastUpdateTimestamp?: number }>({})

    const snackbar = ref(false)
    const snackbarText = ref('')
    const snackbarColor = ref('red')

    const theme = useTheme()
    const preferredDark = usePreferredDark()
    theme.global.name.value = preferredDark.value ? 'dark' : 'light'
    const toggleDarkMode = () => { theme.global.name.value = theme.global.name.value === 'dark' ? 'light' : 'dark' }

    const getAppColor = (name: string) => {
      if (!colorMap.value.has(name)) {
        const hash = Array.from(name).reduce((acc, c) => acc + c.charCodeAt(0), 0)
        const colors = ['red','orange','yellow','green','cyan','blue','purple','pink']
        colorMap.value.set(name, colors[hash % colors.length])
      }
      return colorMap.value.get(name)
    }

    const addHistory = (name: string) => {
      const now = new Date()
      const timeStr = now.toLocaleTimeString()
      history.value.unshift({ time: timeStr, name })
      if (history.value.length > 50) history.value.pop()
      nextTick(() => { if(historyCard.value) historyCard.value.scrollTop = 0 })
    }

    const isAlive = computed(() => {
      if (!status.value.lastUpdateTimestamp) return false
      const now = Date.now() / 1000
      return (now - status.value.lastUpdateTimestamp) <= 60
    })

    onMounted(() => {
      const fetchStatus = async () => {
        try {
          const res = await fetch('/api/current-status?machine=chuncha-pad&limit=1')
          if (!res.ok) throw new Error(res.statusText)

          const data = await res.json()

          if (data.length > 0) {
            const appData = data[0]
            if (appName.value !== appData.window_title) {
              appName.value = appData.window_title
              addHistory(appData.window_title)

              // 更新状态信息
              status.value.lastUpdateTimestamp = new Date(appData.access_time).getTime() / 1000
              flash.value = true
              setTimeout(() => (flash.value = false), 300) // 3秒后停止闪烁
            }
          }

        } catch (err) {
          console.error(err)
          // 在Snackbar中显示具体的错误信息
          snackbarText.value = `获取状态失败`
          snackbarColor.value = 'red'
          snackbar.value = true // 显示 Snackbar
        }
      }

      fetchStatus()
      setInterval(fetchStatus, 5000) // 每隔5秒重新请求

    })

    return {
      appName, history, flash, historyCard, getAppColor,
      snackbar, snackbarText, snackbarColor,
      theme, toggleDarkMode, isAlive
    }
  }
})
</script>

<style lang="scss">
@use 'vuetify/styles' as *;

body, html, #app { font-family: 'Rubik','Noto Sans SC',sans-serif; }

.card-title { font-weight: bold; text-align:left; font-size:1.8rem; }
.app-name { transition: all 0.3s ease-in-out; font-size:2.5rem; }
.flash { animation: flashAnim 0.3s; }
.unknown-app { color: #ff5252; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity:0; }
@keyframes flashAnim { 0% { opacity:0.2; } 50% { opacity:1; } 100% { opacity:0.2; } }

.fab-icon-enter-active, .fab-icon-leave-active {
  transition: transform 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease;
  position: absolute; left:0; right:0; top:0; bottom:0;
  display:flex; align-items:center; justify-content:center;
}

.fab-icon-enter-from { transform: scale(0.6) rotate(-90deg); opacity:0; }
  .fab-icon-enter-to { transform: scale(1) rotate(0deg); opacity:1; }
  .fab-icon-leave-from { transform: scale(1) rotate(0deg); opacity:1; }
  .fab-icon-leave-to { transform: scale(0.6) rotate(90deg); opacity:0; }
</style>
