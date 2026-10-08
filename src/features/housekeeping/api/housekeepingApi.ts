
import type {
  ChangeRoomStatusRequest,
  ChangeRoomStatusResponse,
  CreateHousekeepingTaskRequest,
  HousekeepingApiError,
  HousekeepingRoomDetailsDto,
  HousekeepingRoomSummary,
  HousekeepingTaskDto,
  PageResult,
} from './housekeepingContracts'

export type HousekeepingRequestContext = {
  tenantId: string
  propertyId: string
  accessToken: string | null
}

export type HousekeepingApi = {
  getRooms(
    context: HousekeepingRequestContext,
    signal?: AbortSignal,
  ): Promise<PageResult<HousekeepingRoomSummary>>

  getTasks(
    context: HousekeepingRequestContext,
    signal?: AbortSignal,
  ): Promise<PageResult<HousekeepingTaskDto>>

  getRoomDetails(
    context: HousekeepingRequestContext,
    roomId: string,
    signal?: AbortSignal,
  ): Promise<HousekeepingRoomDetailsDto>

  changeRoomStatus(
    context: HousekeepingRequestContext,
    request: ChangeRoomStatusRequest,
  ): Promise<ChangeRoomStatusResponse>

  createTask(
    context: HousekeepingRequestContext,
    request: CreateHousekeepingTaskRequest,
  ): Promise<HousekeepingTaskDto>
}

type ApiClientOptions = {
  baseUrl?: string
  fetchImpl?: typeof fetch
}

function createApiError(
  response: Response,
  payload: unknown,
): HousekeepingApiError {
  if (
    payload &&
    typeof payload === 'object' &&
    'code' in payload &&
    'message' in payload &&
    typeof payload.code === 'string' &&
    typeof payload.message === 'string'
  ) {
    return {
      status: response.status,
      code: payload.code,
      message: payload.message,
      traceId:
        'traceId' in payload && typeof payload.traceId === 'string'
          ? payload.traceId
          : undefined,
    }
  }

  return {
    status: response.status,
    code: 'HOUSEKEEPING_API_ERROR',
    message: `Housekeeping request failed with HTTP ${response.status}.`,
  }
}

export function createHousekeepingApi(
  options: ApiClientOptions = {},
): HousekeepingApi {
  const baseUrl = (
    options.baseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    ''
  ).replace(/\/$/, '')

  const fetchImpl = options.fetchImpl ?? fetch

  async function request<T>(
    context: HousekeepingRequestContext,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers)

    headers.set('Accept', 'application/json')
    headers.set('Content-Type', 'application/json')
    headers.set('X-Tenant-Id', context.tenantId)
    headers.set('X-Property-Id', context.propertyId)

    if (context.accessToken) {
      headers.set(
        'Authorization',
        `Bearer ${context.accessToken}`,
      )
    }

    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...init,
      headers,
    })

    if (!response.ok) {
      let payload: unknown

      try {
        payload = await response.json()
      } catch {
        payload = undefined
      }

      throw createApiError(response, payload)
    }

    if (response.status === 204) {
      return undefined as T
    }

    return (await response.json()) as T
  }

  return {
    getRooms(context, signal) {
      return request<PageResult<HousekeepingRoomSummary>>(
        context,
        '/api/v1/housekeeping/rooms',
        { signal },
      )
    },

    getTasks(context, signal) {
      return request<PageResult<HousekeepingTaskDto>>(
        context,
        '/api/v1/housekeeping/tasks',
        { signal },
      )
    },

    getRoomDetails(context, roomId, signal) {
      return request<HousekeepingRoomDetailsDto>(
        context,
        `/api/v1/housekeeping/rooms/${encodeURIComponent(roomId)}`,
        { signal },
      )
    },

    changeRoomStatus(context, requestBody) {
      return request<ChangeRoomStatusResponse>(
        context,
        `/api/v1/housekeeping/rooms/${encodeURIComponent(requestBody.roomId)}/status`,
        {
          method: 'PUT',
          body: JSON.stringify(requestBody),
        },
      )
    },

    createTask(context, requestBody) {
      return request<HousekeepingTaskDto>(
        context,
        '/api/v1/housekeeping/tasks',
        {
          method: 'POST',
          body: JSON.stringify(requestBody),
        },
      )
    },
  }
}
