// 配置文件类型
export interface GroupMap {
  [username: string]: string[];
}

export interface NameKeys {
  [username: string]: string[];
}

// 状态数据类型
export interface MachineStatus {
  machine: string;
  window_title: string;
  app: string;
  access_time: string;
  raw?: Record<string, any>;
}

// 请求体类型
export interface IngestRequestBody {
  machine: string;
  window_title?: string;
  app?: string;
  event_time?: string;
  raw?: Record<string, any>;
}

// 查询参数类型
export interface StatusQueryParams {
  name?: string;
  machine?: string;
  limit?: number;
}

// KV 键名常量
export const KV_KEYS = {
  GROUP_MAP: 'config:group-map',
  NAME_KEYS: 'config:name-keys',
  MACHINE_STATUS: (machineId: string) => `status:machine:${machineId}`,
  USER_MACHINES: (username: string) => `cache:user-machines:${username}`
} as const;

// 响应类型
export interface HealthResponse {
  ok: boolean;
}

export interface ErrorResponse {
  error: string;
}

export interface SuccessResponse {
  ok: boolean;
}
