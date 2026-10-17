import type { Actor, Unsubscribe } from '../types'
import type { FrontDeskTask, NewTaskInput } from './taskTypes'

// What the screens need from a task store. The mock keeps tasks in memory; an API version
// would call the backend, which also checks permissions and keeps the audit trail.
export interface TaskService {
  list(): Promise<FrontDeskTask[]>
  create(input: NewTaskInput, actor: Actor): Promise<FrontDeskTask>
  complete(id: string, actor: Actor): Promise<FrontDeskTask>
  reopen(id: string, actor: Actor): Promise<FrontDeskTask>
  /** Tell the caller when tasks change, including changes made elsewhere. */
  subscribe(listener: () => void): Unsubscribe
}
