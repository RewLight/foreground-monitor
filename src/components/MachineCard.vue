<!-- src/components/MachineCard.vue -->
<template>
  <v-card elevation="2" class="mb-4">
    <v-card-title class="text-h6">
      {{ machineId }}
    </v-card-title>
    <v-card-text>
      <!-- 当前状态 -->
      <div class="mb-4">
        <strong>当前应用:</strong>
        <span v-if="currentStatus" class="ml-2">{{ currentStatus.app || currentStatus.window_title || '未知' }}</span>
        <span v-else class="ml-2 text--disabled">加载中...</span>
      </div>
      <div class="mb-4">
        <strong>窗口标题:</strong>
        <span v-if="currentStatus" class="ml-2">{{ currentStatus.window_title || '无' }}</span>
        <span v-else class="ml-2 text--disabled">加载中...</span>
      </div>
      <div class="mb-4">
        <strong>最后更新:</strong>
        <span v-if="currentStatus" class="ml-2">{{ formatTime(currentStatus.access_time) }}</span>
        <span v-else class="ml-2 text--disabled">加载中...</span>
      </div>

      <!-- 历史 Timeline -->
      <div>
        <strong>历史记录:</strong>
        <v-timeline v-if="history.length > 0" side="end" density="compact" class="mt-2">
          <v-timeline-item
            v-for="(item, index) in history"
            :key="index"
            :dot-color="getTitleColor(item.window_title)"
            size="small"
          >
            <template #opposite>
              <small>{{ formatTime(item.access_time) }}</small>
            </template>
            <div>
              <div><strong>{{ item.app || '未知应用' }}</strong></div>
              <div>{{ item.window_title || '无标题' }}</div>
            </div>
          </v-timeline-item>
        </v-timeline>
        <div v-else class="text--disabled mt-2">暂无历史记录</div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { useUserStore } from '@/stores/userStore';

const props = defineProps<{
  machineId: string
}>();

const userStore = useUserStore();
const currentStatus = computed(() => userStore.getStatusForMachine(props.machineId));
// 简化处理：这里只是显示当前状态，实际历史需要后端支持或前端缓存
// 假设我们用当前状态作为历史记录来演示
const history = computed(() => currentStatus.value ? [currentStatus.value] : []);

const getTitleColor = (title: string) => {
  if (!title) return 'grey';
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['red', 'pink', 'purple', 'deep-purple', 'indigo', 'blue', 'light-blue', 'cyan', 'teal', 'green', 'light-green', 'lime', 'yellow', 'amber', 'orange', 'deep-orange'];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

</script>

<style scoped>
/* 尽量避免手写样式，使用 Vuetify 工具类 */
</style>
