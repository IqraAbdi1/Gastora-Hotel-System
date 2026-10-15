import { useState } from 'react'
import IssueDialog from './IssueDialog'
import RoomDetailPanel from './RoomDetailPanel'
import TaskForm from './TaskForm'
import type { TabKey } from './hkModel'

// Every housekeeping page opens the same three overlays. This keeps that in one place.
export function useRoomOverlays() {
  const [detail, setDetail] = useState<{ room: string; tab: TabKey } | null>(null)
  const [issue, setIssue] = useState<string | null>(null)
  const [task, setTask] = useState<{ room: string } | null>(null)

  const overlays = (
    <>
      {detail && (
        <RoomDetailPanel
          key={detail.room + detail.tab}
          roomNumber={detail.room}
          startTab={detail.tab}
          onClose={() => setDetail(null)}
          onIssue={(room) => setIssue(room)}
        />
      )}
      {issue && <IssueDialog key={issue} roomNumber={issue} onClose={() => setIssue(null)} />}
      {task && <TaskForm presetRoom={task.room} onClose={() => setTask(null)} />}
    </>
  )

  return {
    overlays,
    openRoom: (room: string, tab: TabKey = 'overview') => setDetail({ room, tab }),
    reportIssue: (room: string) => setIssue(room),
    newTask: (room = '') => setTask({ room }),
  }
}