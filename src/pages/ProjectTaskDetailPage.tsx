import { ArrowLeft, ArrowRight, CalendarClock, Check, CircleUserRound, Clock3, Flag, FolderKanban } from 'lucide-react'
import BoardPage from './BoardPage'
import type { ProjectTaskRecord } from './ProjectTasksPage'

const taskStages: ProjectTaskRecord['status'][] = ['To do', 'In progress', 'Completed']

export default function ProjectTaskDetailPage({ task, onBack, onOpenProject, hideOpenProject = false, projectContext = false, projectClient }: { task: ProjectTaskRecord; onBack: () => void; onOpenProject: (projectName: string) => void; hideOpenProject?: boolean; projectContext?: boolean; projectClient?: string }) {
  const activeStage = taskStages.indexOf(task.status)
  return <div className="directory-page task-detail-page">
    <button className="task-detail-back" onClick={onBack}><ArrowLeft size={15}/> Back to project tasks</button>
    <header className="task-detail-heading">
      <div><span className="directory-eyebrow">DELIVERY WORKSPACE / PROJECT TASKS</span><h1>{task.project}</h1><p>{task.title}</p></div>
      <div className="task-detail-heading-actions"><span className={`project-task-status ${task.status.toLowerCase().replace(/ /g, '-')}`}>{task.status}</span>{!hideOpenProject && <button type="button" className="task-open-project" onClick={() => onOpenProject(task.project)}>Open full project <ArrowRight size={14}/></button>}</div>
    </header>

    <div className="task-detail-grid">
      <div className="task-detail-main">
        <section className="task-detail-card">
          <div className="task-detail-card-heading"><span className="task-detail-icon orange"><Check size={17}/></span><div><h2>Task overview</h2><p>Key information for this project task.</p></div></div>
          <div className="task-detail-properties">
            <div><span className="task-detail-property-icon blue"><FolderKanban size={16}/></span><div><small>Project</small><b><button type="button" className="task-project-link" onClick={() => onOpenProject(task.project)}>{task.project}</button></b></div></div>
            <div><span className="task-detail-property-icon purple"><Flag size={16}/></span><div><small>Priority</small><b><span className={`priority ${task.priority.toLowerCase()}`}>{task.priority}</span></b></div></div>
            <div><span className="task-detail-property-icon green"><CircleUserRound size={16}/></span><div><small>Assignee</small><b>{task.assignee}</b></div></div>
            <div><span className="task-detail-property-icon orange"><CalendarClock size={16}/></span><div><small>Due date</small><b className={task.overdue ? 'overdue-date' : ''}>{task.due}{task.overdue && <em>Overdue</em>}</b></div></div>
          </div>
        </section>
      </div>
      <section className="task-detail-card task-progress-card" aria-label={`Task progress: stage ${activeStage + 1} of ${taskStages.length}`}>
        <div className="task-detail-card-heading"><span className="task-detail-icon blue"><Clock3 size={17}/></span><div><h2>Progress</h2><p>Stage {activeStage + 1} of {taskStages.length} · {task.status}</p></div></div>
        <div className="task-progress-steps">{taskStages.map((stage, index) => <div className={`task-progress-step ${index < activeStage ? 'complete' : ''} ${index === activeStage ? 'current' : ''}`} key={stage} aria-current={index === activeStage ? 'step' : undefined}><span>{index < activeStage ? <Check size={15}/> : index + 1}</span><b>{stage}</b></div>)}</div>
      </section>
    </div>
    <div className="task-detail-board-section"><BoardPage projectContext={projectContext} projectName={projectContext ? task.project : undefined} projectClient={projectContext ? projectClient : undefined}/></div>
  </div>
}
