<!-- src/views/UserView.vue -->
<template>
  <v-container fluid class="pa-4">
    <v-row v-if="machines.length > 0" justify="center">
      <v-col v-for="machineId in machines" :key="machineId" cols="12" md="6" lg="4">
         <MachineCard :machine-id="machineId" />
      </v-col>
    </v-row>
    <v-row v-else justify="center">
      <v-col cols="12" class="text-center">
        <v-alert type="info">该用户没有关联的机器。</v-alert>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useUserStore } from '@/stores/userStore';
import MachineCard from '@/components/MachineCard.vue';

const props = defineProps<{
  username: string
}>();

const userStore = useUserStore();
const machines = ref<string[]>([]);

const loadMachines = () => {
  machines.value = userStore.getMachinesForUser(props.username);
};

let pollingInterval: number | null = null;

const startPolling = () => {
  stopPolling(); // 确保只有一个定时器
  pollingInterval = window.setInterval(() => {
    userStore.loadStatuses(); // 定时更新状态
  }, 4000);
};

const stopPolling = () => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

onMounted(() => {
  loadMachines();
  startPolling();
});

onUnmounted(() => {
  stopPolling();
});

// 当路由参数变化时，重新加载机器列表
watch(() => props.username, () => {
  loadMachines();
});

</script>
