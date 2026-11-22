import { useEffect } from 'react'

const help: Record<string, string> = {
  'Total Leads': 'Number of leads currently recorded in the workspace.',
  'Active Projects': 'Projects currently planned or being delivered.',
  'Pending Tasks': 'Project tasks that still need to be completed.',
  'Conversion Rate': 'Share of leads that became won opportunities.',
  'Due or overdue': 'Open leads whose follow-up date is today or earlier.',
  'No next action': 'Open leads missing a next action or follow-up date.',
  'Leads acquired': 'Leads created during the selected reporting period.',
  'Open pipeline': 'Leads still moving through the sales stages.',
  'Win rate': 'Percentage of reported leads marked as won.',
  'Won opportunity value': 'Recorded value from leads marked as won.',
  'Lead Performance': 'Shows how many leads were created and won during the selected period.',
  'Lead Sources': 'Shows where new inquiries came from so you can compare your channels.',
  'Recent activity': 'Shows the latest changes and conversations in this workspace.',
  'Recent leads': 'Shows recently added inquiries. Open a lead to review or update it.',
  'Upcoming project tasks': 'Shows project work with upcoming due dates.',
  'Project status': 'Shows the current stage of your active projects.',
  'Lead sources': 'Breaks down leads by their recorded source for the selected report period.',
  'Pipeline by stage': 'Shows how many leads are currently in each sales stage.',
  'Cash received over time': 'Shows recorded client payments over the selected period.',
  'Client contacts': 'Lists client contact details for quick reference.',
  'Recent project activity': 'Summarizes recent project and task changes.',
  'Your follow-up queue': 'Find leads that need a next action, owner, or follow-up date. Select a view to narrow the queue.',
  'Owner and next action': 'Assign a responsible person, write the next step, and set when to follow up. Save to update this lead.',
  'Lead overview': 'Shows the lead’s contact details and current sales information.',
  'Lead progress': 'Shows this lead’s path through the sales stages.',
  'Proposal progress': 'Tracks the proposal from draft through acceptance and deposit.',
  'Proposal versions': 'Keeps a history of proposal versions sent to the client.',
  'Accepted proposal and deposit': 'Record the accepted proposal and deposit before converting the lead to a project.',
  'Convert to website project': 'Creates a project from a qualified lead after acceptance and deposit are recorded.',
  'Payments and schedule': 'Tracks the agreed amount, payments received, and remaining balance.',
  'All Leads': 'Lists every lead in this workspace. Use the tabs to filter by stage, search to find a lead, and the row actions to view, edit, or delete it.',
  'New Leads': 'Shows new inquiries that have not yet moved into a sales conversation.',
  'Contacted': 'Shows leads where an initial conversation has started.',
  'Discovery': 'Shows leads whose needs and project scope are being explored.',
  'Proposal sent': 'Shows leads waiting for a decision on a sent proposal.',
  'Awaiting deposit': 'Shows accepted opportunities waiting for the deposit to be recorded.',
  'Won': 'Shows leads that became confirmed projects.',
  'Lost': 'Shows leads that did not proceed.',
  'Client directory': 'Search and manage client records and their linked projects.',
  'Project directory': 'Search and manage projects, dates, status, and linked clients.',
  'Client information': 'Shows this client’s contact and relationship details.',
  'Project information': 'Shows the project’s key details, client, dates, and delivery status.',
  'Project tasks': 'Shows tasks linked to this project and their progress.',
  'Task overview': 'Shows this task’s owner, due date, and project context.',
  'Progress': 'Tracks how far this task has moved toward completion.',
  'Projects': 'Shows projects connected to this record or workspace view.',
  'Tasks': 'Shows the work planned for this project.',
  'Accepted scope': 'Shows the proposal scope accepted for this project.',
  'Profile': 'Manage your account name, photo, and personal details.',
  'Notifications': 'Choose which workspace updates you want to receive.',
  'Regional preferences': 'Set formats used for dates, times, and regional display.',
  'Sign-in and security': 'Review how you sign in and protect your account.',
  'Two-factor authentication': 'Manage the extra verification step required when signing in.',
  'Password & recovery': 'Update your password and account recovery options.',
  'Sessions & devices': 'Review this device’s current session and sign out if needed.',
  'Activity log': 'Review recorded changes made in the workspace.',
  'Workspace membership': 'See who can access this workspace and manage member accounts.',
  'Calendar': 'View scheduled events, tasks, and follow-up dates.',
  'Contacts': 'Shows people connected to this customer.',
  'Opportunities': 'Shows sales opportunities connected to this customer.',
  'Timeline': 'Shows this customer’s recorded activity in date order.',
  'Notes': 'Keep context and details that help with future conversations.',
  'Tags': 'Organize records with labels for easier filtering.',
  'Actions': 'Use these controls to update or move this record.',
  'Comments': 'Keep discussion and updates connected to this item.',
  'Attachments': 'See files added to this item.',
}

export default function CardHelp() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.main-area')
    if (!root) return
    const selector = '.card, .report-card, .crm-panel, .directory-panel, .task-detail-card, .admin-panel, .account-settings-card, .settings-card, .security-card, .calendar-panel, .client-drawer-section, .project-drawer-section, .metric, .directory-stat'
    const addHelp = () => {
      root.querySelectorAll<HTMLElement>(selector).forEach(card => {
        const heading = card.querySelector<HTMLElement>('h2, h3, .card-title, .metric-label, .directory-stat > div > span')
        if (!heading || heading.dataset.cardHelpAdded) return
        const name = (heading.textContent || '').trim().replace(/\s*\(\d+\)$/, '')
        const description = help[name]
        if (!description) return
        heading.dataset.cardHelpAdded = 'true'
        const wrap = document.createElement('span')
        wrap.className = 'card-help-wrap'
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'card-help-button'
        button.textContent = '?'
        button.setAttribute('aria-label', `About ${name}`)
        button.setAttribute('aria-expanded', 'false')
        const popover = document.createElement('span')
        popover.className = 'card-help-popover'
        popover.setAttribute('role', 'tooltip')
        popover.textContent = description
        wrap.append(button, popover)
        heading.append(wrap)
        button.addEventListener('click', event => {
          event.stopPropagation()
          const open = wrap.classList.toggle('open')
          button.setAttribute('aria-expanded', String(open))
        })
        button.addEventListener('keydown', event => { if (event.key === 'Escape') { wrap.classList.remove('open'); button.setAttribute('aria-expanded', 'false') } })
      })
    }
    addHelp()
    const observer = new MutationObserver(addHelp)
    observer.observe(root, { childList: true, subtree: true })
    const close = (event: PointerEvent) => {
      if ((event.target as Element).closest?.('.card-help-wrap')) return
      root.querySelectorAll('.card-help-wrap.open').forEach(wrap => { wrap.classList.remove('open'); wrap.querySelector('button')?.setAttribute('aria-expanded', 'false') })
    }
    document.addEventListener('pointerdown', close)
    return () => { observer.disconnect(); document.removeEventListener('pointerdown', close); root.querySelectorAll('.card-help-wrap').forEach(wrap => wrap.remove()); root.querySelectorAll('[data-card-help-added]').forEach(node => node.removeAttribute('data-card-help-added')) }
  }, [])
  return null
}
