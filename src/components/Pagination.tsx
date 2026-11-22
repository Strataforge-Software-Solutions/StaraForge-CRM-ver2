import { useState } from 'react'
export function usePagination<T>(items: T[], resetKey = '') {
  const [selection, setSelection] = useState({ page: 1, key: resetKey })
  const [size, setSize] = useState(10)
  const pages = Math.max(1, Math.ceil(items.length / size))
  const page = selection.key === resetKey ? Math.min(selection.page, pages) : 1
  const setPage = (value: number) => setSelection({ page: value, key: resetKey })
  return { items: items.slice((page - 1) * size, page * size), page, pages, size, total: items.length, setPage, setSize: (value: number) => { setSize(value); setPage(1) } }
}
export function Pagination({ paging, noun }: { paging: ReturnType<typeof usePagination>; noun: string }) {
  return <div className="directory-panel-foot"><span>{paging.total ? (paging.page - 1) * paging.size + 1 : 0}–{Math.min(paging.page * paging.size, paging.total)} of {paging.total} {noun}</span><span className="pagination"><button type="button" aria-label="Previous page" disabled={paging.page <= 1} onClick={() => paging.setPage(paging.page - 1)}>‹</button>Page {paging.page} of {paging.pages}<button type="button" aria-label="Next page" disabled={paging.page >= paging.pages} onClick={() => paging.setPage(paging.page + 1)}>›</button></span><label>Rows <select aria-label="Rows per page" value={paging.size} onChange={event => paging.setSize(Number(event.target.value))}>{[10, 25, 50].map(size => <option key={size}>{size}</option>)}</select></label></div>
}
