import { useDatabaseCollection } from './database'
import { recordId } from './records'
import type { ProjectDirectoryRow } from '../pages/ProjectsPage'
export type Receipt = { id: string; projectId: string; workflowKey?: string; amount: number; currency: string; date: string; note: string; scheduleId?: string }
export type PaymentSchedule = { id: string; projectId: string; name: string; amount: number; currency: string; due: string }
export function moneyValue(value: string) { const match = value.match(/^(PHP|USD)\s*([\d,.]+)/); return { currency: match?.[1] || 'PHP', amount: Number(match?.[2]?.replace(/,/g, '') || 0) } }
export const money = (amount: number, currency = 'PHP') => `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
export function usePaymentLedger() {
  const [payments] = useDatabaseCollection<Receipt[]>('payments', [])
  const [schedules] = useDatabaseCollection<PaymentSchedule[]>('paymentSchedules', [])
  const [workflows] = useDatabaseCollection<Record<string, any>>('leadWorkflows', {})
  const [projects] = useDatabaseCollection<ProjectDirectoryRow[]>('projects', [])
  const [leads] = useDatabaseCollection<any[]>('leads', [])
  const deposits: Receipt[] = Object.entries(workflows).flatMap(([key, workflow]) => {
    const lead = leads.find(row => row.workflowKey === key || row.id === key || row.email?.trim().toLowerCase() === key)
    const matching = projects.filter(row => row.clientId && row.clientId === lead?.clientId || row.client === lead?.client)
    const project = projects.find(row => row.workflowKey === key || (row.leadId && row.leadId === lead?.id) || (workflow.projectName && row.name === workflow.projectName)) || (matching.length === 1 ? matching[0] : undefined)
    const currency = moneyValue(project?.value || lead?.budget || 'PHP 0').currency
    return (workflow.deposits || []).map((deposit: any, index: number) => ({ id: deposit.id || `deposit:${key}:${index}`, projectId: project ? recordId(project) : '', workflowKey: key, amount: deposit.amount, currency, date: deposit.date, note: deposit.note || 'Initial deposit' }))
  })
  return { receipts: [...deposits, ...payments], schedules }
}
