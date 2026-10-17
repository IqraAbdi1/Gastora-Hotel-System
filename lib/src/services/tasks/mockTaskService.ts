import type { Actor } from '../types'
import type { TaskService } from './taskService'
import type { FrontDeskTask, NewTaskInput } from './taskTypes'

// In-memory tasks for the prototype. They last until the page is reloaded and are not shared
// with anyone else. It starts empty on purpose: no made-up assignments.
export function createMockTaskService(): TaskService {
  let tasks: FrontDeskTask[] = []
  let counter = 0
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((l) => l())

  function update(id: string, change: (t: FrontDeskTask) => FrontDeskTask) {
    const found = tasks.find((t) => t.id === id)
    if (!found) return Promise.reject(new Error(`Task ${id} not found`))
    const next = change(found)
    tasks = tasks.map((t) => (t.id === id ? next : t))
    emit()
    return Promise.resolve(next)
  }

  return {
    list: () => Promise.resolve([...tasks]),

    create(input: NewTaskInput, actor: Actor) {
      const title = input.title.trim()
      if (!title) return Promise.reject(new Error('A task needs a title'))
      if (Number.isNaN(Date.parse(input.dueAt))) return Promise.reject(new Error('A task needs a valid due date and time'))
      counter += 1
      const task: FrontDeskTask = {
        ...input,
        title,
        description: input.description.trim(),
        id: `T-${String(counter).padStart(4, '0')}`,
        status: 'open',
        createdAt: new Date().toISOString(),
        createdBy: actor,
      }
      tasks = [task, ...tasks]
      emit()
      return Promise.resolve(task)
    },

    complete: (id, actor) =>
      update(id, (t) => ({ ...t, status: 'done', completedAt: new Date().toISOString(), completedBy: actor })),

    reopen: (id) => update(id, (t) => ({ ...t, status: 'open', completedAt: undefined, completedBy: undefined })),

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
