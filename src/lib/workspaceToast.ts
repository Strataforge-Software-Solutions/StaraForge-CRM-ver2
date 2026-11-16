export const workspaceToastEvent = 'strataforge:workspace-toast'

export function showWorkspaceToast(message: string) {
  window.dispatchEvent(new CustomEvent<string>(workspaceToastEvent, { detail: message }))
}
