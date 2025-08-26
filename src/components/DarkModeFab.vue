<!-- src/components/DarkModeFab.vue -->
<template>
  <v-fab
    :color="preferredDark ? 'yellow' : 'indigo'"
    :dark="!preferredDark"
    aria-label="Toggle Dark Mode"
    @click="toggleDark"
    class="fab-position"
    size="large"
    app
    icon
  >
    <transition name="fab-icon" mode="out-in">
      <v-icon :key="preferredDark ? 'light' : 'dark'">
        {{ preferredDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}
      </v-icon>
    </transition>
  </v-fab>
</template>

<script setup lang="ts">
import { usePreferredDark, useToggle } from '@vueuse/core'

// usePreferredDark 会自动监听系统主题变化
const preferredDark = usePreferredDark()
// useToggle 可以创建一个切换器
const toggleDark = useToggle(preferredDark)

// 如果需要直接控制 Vuetify 主题，可以这样：
// import { useTheme } from 'vuetify'
// const theme = useTheme()
// const toggleDark = () => {
//   theme.global.name.value = theme.global.current.value.dark ? 'light' : 'dark'
// }
// 并且监听 preferredDark 来同步 Vuetify 主题
</script>

<style scoped>
.fab-position {
  position: fixed;
  bottom: 16px;
  right: 16px;
}

/* 图标切换动画 */
.fab-icon-enter-active,
.fab-icon-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  margin: auto;
}

.fab-icon-enter-from {
  transform: scale(0.5) rotate(-15deg);
  opacity: 0;
}

.fab-icon-enter-to {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}

.fab-icon-leave-from {
  transform: scale(1) rotate(0deg);
  opacity: 1;
}

.fab-icon-leave-to {
  transform: scale(0.5) rotate(15deg);
  opacity: 0;
}
</style>
