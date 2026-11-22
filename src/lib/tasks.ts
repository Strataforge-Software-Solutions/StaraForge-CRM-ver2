import { useDatabaseCollection } from './database'
import { recordId } from './records'
import type { ProjectTaskRecord } from '../pages/ProjectTasksPage'
export function useWorkspaceTasks(): [ProjectTaskRecord[], (update: (current: ProjectTaskRecord[]) => ProjectTaskRecord[]) => void] {
  const [tasks, setTasks] = useDatabaseCollection<ProjectTaskRecord[]>('tasks', [])
  const [board, setBoard] = useDatabaseCollection<any[]>('projectBoard', [])
  const boardTasks: ProjectTaskRecord[] = board.flatMap(column => column.tickets.map((ticket: any) => ({ ...ticket, id: ticket.id, due: ticket.due || ticket.date || '', assignee: ticket.assigneeName || ticket.owner || 'Unassigned', status: /won|deploy|complete/i.test(`${column.id} ${column.name}`) ? 'Completed' : /progress|building|review|test/i.test(`${column.id} ${column.name}`) ? 'In progress' : 'To do' })))
  const all = [...tasks, ...boardTasks]
  return [all, update => {
    const next = update(all)
    const boardIds = new Set(boardTasks.map(recordId))
    const plain = next.filter(item => !boardIds.has(recordId(item)))
    if (JSON.stringify(plain) !== JSON.stringify(tasks)) setTasks(plain)
    const changed = boardTasks.filter(task => next.find(item => recordId(item) === recordId(task))?.status !== task.status)
    if (changed.length) setBoard(current => {
      const moved = current.map(column => ({ ...column, tickets: column.tickets.filter((ticket: any) => !changed.some(task => task.id === ticket.id)) }))
      for (const task of changed) {
        const updated = next.find(item => recordId(item) === recordId(task)); if (!updated) continue
        const original = current.flatMap(column => column.tickets).find(ticket => ticket.id === task.id)
        const destination = updated.status === 'Completed' ? 'won' : updated.status === 'In progress' ? 'progress' : 'new'
        moved.find(column => column.id === destination)?.tickets.push(original)
      }
      return moved
    })
  }]
}
