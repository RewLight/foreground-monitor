import {
  GroupMap,
  NameKeys,
  MachineStatus,
  IngestRequestBody,
  KV_KEYS,
  StatusQueryParams
} from "./types";
import {
  createErrorResponse,
  createSuccessResponse,
  handleCORS,
  parseQueryParams
} from "./utils";

export interface Env {
  DESKTOP_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS 处理
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      switch (path) {
        case '/api/health':
          return handleHealth();

        case '/api/group-map':
          return handleGetGroupMap(env);

        case '/api/ingest':
          if (request.method === 'POST') {
            return handleIngest(request, env);
          }
          break;

        case '/api/current-status':
          return handleGetCurrentStatus(request, env);

        case '/api/current-latest':
          return handleGetLatestStatus(env);

        default:
          return createErrorResponse('Not Found', 404);
      }
    } catch (error: any) {
      console.error('Worker Error:', error);
      return createErrorResponse('Internal Server Error', 500);
    }

    return createErrorResponse('Method Not Allowed', 405);
  }
};

// 健康检查
function handleHealth(): Response {
  return createSuccessResponse({ ok: true });
}

// 获取组映射
async function handleGetGroupMap(env: Env): Promise<Response> {
  try {
    const groupMap = await env.DESKTOP_KV.get<GroupMap>(KV_KEYS.GROUP_MAP, 'json');
    return createSuccessResponse(groupMap || {});
  } catch (error) {
    return createErrorResponse('Failed to get group map', 500);
  }
}

// 上报事件
async function handleIngest(request: Request, env: Env): Promise<Response> {
  // 认证检查
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createErrorResponse('Missing or invalid token', 401);
  }

  const token = authHeader.substring(7);

  try {
    const body: IngestRequestBody = await request.json();
    const { machine, window_title, app, event_time } = body;

    if (!machine) {
      return createErrorResponse('Missing machine ID', 400);
    }

    // 验证认证和权限
    const isValid = await validateAuth(env, token, machine);
    if (!isValid) {
      return createErrorResponse('Forbidden', 403);
    }

    // 构建状态对象
    const statusData: MachineStatus = {
      machine,
      window_title: window_title || '',
      app: app || '',
      access_time: event_time || new Date().toISOString(),
    };

    // 保存到 KV (只保留最新状态)
    await env.DESKTOP_KV.put(
      KV_KEYS.MACHINE_STATUS(machine),
      JSON.stringify(statusData),
      { expirationTtl: 86400 * 30 } // 30天过期
    );

    return createSuccessResponse({ ok: true });

  } catch (error) {
    return createErrorResponse('Invalid request body', 400);
  }
}

// 获取当前状态
async function handleGetCurrentStatus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const params = parseQueryParams(url);

  const queryParams: StatusQueryParams = {
    name: params.name,
    machine: params.machine,
    limit: params.limit ? Math.min(parseInt(params.limit) || 50, 500) : 50
  };

  try {
    let machines: string[] = [];

    if (queryParams.machine) {
      // 指定特定机器
      machines = [queryParams.machine];
    } else if (queryParams.name) {
      // 获取用户的所有机器
      const groupMap = await env.DESKTOP_KV.get<GroupMap>(KV_KEYS.GROUP_MAP, 'json') || {};
      machines = groupMap[queryParams.name] || [];
    } else {
      // 获取所有机器的最新状态
      const allMachines = await getAllMachines(env);
      machines = allMachines.slice(0, queryParams.limit);
    }

    // 并行获取所有机器的状态
    const statusPromises = machines.map(machineId =>
      env.DESKTOP_KV.get<MachineStatus>(KV_KEYS.MACHINE_STATUS(machineId), 'json')
    );

    const statuses = await Promise.all(statusPromises);
    const validStatuses = statuses.filter((status): status is MachineStatus => status !== null);

    return createSuccessResponse(validStatuses);

  } catch (error) {
    return createErrorResponse('Failed to get status', 500);
  }
}

// 获取最新状态（每个机器的最新一条）
async function handleGetLatestStatus(env: Env): Promise<Response> {
  try {
    const allMachines = await getAllMachines(env);

    // 并行获取所有机器的最新状态
    const statusPromises = allMachines.map(machineId =>
      env.DESKTOP_KV.get<MachineStatus>(KV_KEYS.MACHINE_STATUS(machineId), 'json')
    );

    const statuses = await Promise.all(statusPromises);
    const validStatuses = statuses.filter((status): status is MachineStatus => status !== null);

    return createSuccessResponse(validStatuses);

  } catch (error) {
    return createErrorResponse('Failed to get latest status', 500);
  }
}

// 认证验证
async function validateAuth(env: Env, token: string, machine: string): Promise<boolean> {
  try {
    const nameKeys = await env.DESKTOP_KV.get<NameKeys>(KV_KEYS.NAME_KEYS, 'json') || {};
    const groupMap = await env.DESKTOP_KV.get<GroupMap>(KV_KEYS.GROUP_MAP, 'json') || {};

    // 查找 token 对应的用户
    let user: string | null = null;
    for (const [username, tokens] of Object.entries(nameKeys)) {
      if (tokens.includes(token)) {
        user = username;
        break;
      }
    }

    if (!user) return false;

    // 检查机器是否在用户白名单中
    const userMachines = groupMap[user] || [];
    return userMachines.includes(machine);

  } catch (error) {
    return false;
  }
}

// 获取所有机器列表（从 group-map 中提取）
async function getAllMachines(env: Env): Promise<string[]> {
  try {
    const groupMap = await env.DESKTOP_KV.get<GroupMap>(KV_KEYS.GROUP_MAP, 'json') || {};
    const allMachines = new Set<string>();

    Object.values(groupMap).forEach(machines => {
      machines.forEach(machine => allMachines.add(machine));
    });

    return Array.from(allMachines);

  } catch (error) {
    return [];
  }
}
