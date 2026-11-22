import { flushDatabaseWrites } from './database'
export const workspaceToastEvent = 'strataforge:workspace-toast'

export function showWorkspaceToast(message: string) {
  void flushDatabaseWrites().then(() => window.dispatchEvent(new CustomEvent<string>(workspaceToastEvent, { detail: message }))).catch(() => window.dispatchEvent(new CustomEvent<string>(workspaceToastEvent, { detail: 'Changes are not saved yet. Use the save status banner to retry. Your draft is preserved.' })))
}
