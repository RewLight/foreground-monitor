// src/composables/useApi.ts
import { ref } from 'vue'

interface GroupMap {
  [key: string]: string[];
}

interface MachineStatus {
  machine: string;
  window_title: string;
  app: string;
  access_time: string;
}

// 用于缓存进行中的请求
const pendingRequests: Record<string, Promise<any> | null> = {
  groupMap: null,
  currentStatus: null
};

// API 基础路径
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const useApi = () => {
  const fetchWithCache = async <T>(key: string, url: string): Promise<T> => {
    if (pendingRequests[key]) {
      // 如果有正在进行的请求，则复用它
      return pendingRequests[key] as Promise<T>;
    }

    // 创建新的请求
    const promise = fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .finally(() => {
        // 请求完成后清除缓存
        pendingRequests[key] = null;
      });

    pendingRequests[key] = promise;
    return promise;
  };

  const fetchGroupMap = (): Promise<GroupMap> => {
    return fetchWithCache<GroupMap>('groupMap', `${API_BASE}/group-map`);
  };

  const fetchCurrentStatus = (): Promise<MachineStatus[]> => {
    return fetchWithCache<MachineStatus[]>('currentStatus', `${API_BASE}/current-status`);
  };

  return {
    fetchGroupMap,
    fetchCurrentStatus,
  };
};
