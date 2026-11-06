import { ArrowLeft, CalendarClock, Check, CircleUserRound, Clock3, Flag, FolderKanban } from 'lucide-react'
import BoardPage from './BoardPage'
import type { ProjectTaskRecord } from './ProjectTasksPage'

const taskStages: ProjectTaskRecord['status'][] = ['To do', 'In progress', 'Completed']

export default function ProjectTaskDetailPage({ task, onBack }: { task: ProjectTaskRecord; onBack: () => void }) {
  const activeStage = taskStages.indexOf(task.status)
  return <div className="directory-page task-detail-page">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to project tasks</button>
    <header className="task-detail-heading">
      <div><span className="directory-eyebrow">DELIVERY WORKSPACE / PROJECT TASKS</span><h1>{task.project}</h1><p>{task.title}</p></div>
      <span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span>
    </header>

    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="task-detail-card">
          <div className="task-detail-card-heading"><span className="task-detail-icon orange"><Check size={17}/></span><div><h2>Task overview</h2><p>Key information for this project task.</p></div></div>
          <div className="task-detail-properties">
            <div><span className="task-detail-property-icon blue"><FolderKanban size={16}/></span><div><small>Project</small><b>{task.project}</b></div></div>
            <div><span className="task-detail-property-icon purple"><Flag size={16}/></span><div><small>Priority</small><b><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></b></div></div>
            <div><span className="task-detail-property-icon green"><CircleUserRound size={16}/></span><div><small>Assignee</small><b>{task.assignee}</b></div></div>
            <div><span className="task-detail-property-icon orange"><CalendarClock size={16}/></span><div><small>Due date</small><b className={task.overdue ? 'overdue-date' : ''}>{task.due}{task.overdue && <em>Overdue</em>}</b></div></div>
          </div>
        </section>

        <section className="task-detail-card task-progress-card" aria-label={`Task progress: stage ${activeStage + 1} of ${taskStages.length}`}>
          <div className="task-detail-card-heading"><span className="task-detail-icon blue"><Clock3 size={17}/></span><div><h2>Progress</h2><p>Stage {activeStage + 1} of {taskStages.length} · {task.status}</p></div></div>
          <div className="task-progress-steps">{taskStages.map((stage, index) => <div className={`task-progress-step ${index < activeStage ? 'complete' : ''} ${index === activeStage ? 'current' : ''}`} key={stage} aria-current={index === activeStage ? 'step' : undefined}><span>{index < activeStage ? <Check size={15}/> : index + 1}</span><b>{stage}</b></div>)}</div>
        </section>
      </div>

      <aside className="task-detail-side">
        <section className="task-detail-card related-project-card">
          <div className="task-detail-card-heading"><span className="task-detail-icon green"><FolderKanban size={17}/></span><div><h2>Related project</h2><p>Project linked to this task</p></div></div>
          <div className="related-project-name">{task.project}</div>
          <div className="related-project-meta"><span>Task due date</span><b>{task.due}</b></div>
        </section>
        <div className="task-detail-note"><span className="online-dot"/><p>Changes to task details can be managed from the Project tasks workspace.</p></div>
      </aside>
    </div>
    <div className="task-detail-board-section"><BoardPage /></div>
  </div>
}
