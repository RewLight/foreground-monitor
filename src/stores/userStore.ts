// src/stores/userStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useApi } from '@/composables/useApi' // 引入 API composable

interface MachineStatus {
  machine: string;
  window_title: string;
  app: string;
  access_time: string; // ISO string
}

export const useUserStore = defineStore('user', () => {
  const { fetchGroupMap, fetchCurrentStatus } = useApi()

  const userMachineMap = ref<Record<string, string[]>>({});
  const machineStatuses = ref<Record<string, MachineStatus>>({});
  const selectedUser = ref<string>('');

  const loadUsersAndMachines = async () => {
    try {
      const map = await fetchGroupMap();
      userMachineMap.value = map;
      // 默认选择第一个用户
      if (!selectedUser.value && Object.keys(map).length > 0) {
          selectedUser.value = Object.keys(map)[0];
      }
    } catch (error) {
      console.error("Failed to load group map:", error);
      // 可以在这里触发 snackbar
    }
  };

  const loadStatuses = async () => {
    try {
      const statuses = await fetchCurrentStatus();
      const statusMap: Record<string, MachineStatus> = {};
      statuses.forEach(status => {
        statusMap[status.machine] = status;
      });
      machineStatuses.value = statusMap;
    } catch (error) {
      console.error("Failed to load current status:", error);
      // 可以在这里触发 snackbar
    }
  };

  const selectUser = (username: string) => {
    selectedUser.value = username;
  };

  const getUsernames = () => {
    return Object.keys(userMachineMap.value);
  };

  const getMachinesForUser = (username: string) => {
    return userMachineMap.value[username] || [];
  };

  const getStatusForMachine = (machineId: string) => {
    return machineStatuses.value[machineId];
  };

  return {
    userMachineMap,
    machineStatuses,
    selectedUser,
    loadUsersAndMachines,
    loadStatuses,
    selectUser,
    getUsernames,
    getMachinesForUser,
    getStatusForMachine,
  };
});
