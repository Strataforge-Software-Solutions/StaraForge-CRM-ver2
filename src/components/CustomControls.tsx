import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

type CustomSelectProps = {
  value: string
  options: Array<string | { label: string; value: string }>
  onChange?: (value: string) => void
  ariaLabel?: string
  className?: string
  showChevron?: boolean
}

export function CustomSelect({ value, options, onChange, ariaLabel, className = '', showChevron = true }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [localValue, setLocalValue] = useState(value)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const normalized = options.map(option => typeof option === 'string' ? { label: option, value: option } : option)
  const currentValue = onChange ? value : localValue
  const selectedOption = normalized.find(option => option.value === currentValue) ?? normalized[0] ?? { label: currentValue, value: currentValue }

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target as Node
      if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  useLayoutEffect(() => {
    if (!open) return
    const updateMenuPosition = () => {
      const trigger = containerRef.current?.querySelector('.custom-select-trigger')
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const menuHeight = Math.min(240, normalized.length * 37 + 10)
      const below = window.innerHeight - rect.bottom
      const above = rect.top
      const openUp = below < menuHeight + 10 && above > below
      setMenuStyle({ position: 'fixed', left: rect.left, width: rect.width, top: openUp ? 'auto' : rect.bottom + 5, bottom: openUp ? window.innerHeight - rect.top + 5 : 'auto' })
    }
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    window.addEventListener('scroll', updateMenuPosition, true)
    return () => {
      window.removeEventListener('resize', updateMenuPosition)
      window.removeEventListener('scroll', updateMenuPosition, true)
    }
  }, [open, normalized.length])

  return <div className={`custom-select ${className}`} ref={containerRef}>
    <button type="button" className="custom-select-trigger" role="combobox" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={() => setOpen(current => !current)} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); if (event.key === 'ArrowDown' && !open) { event.preventDefault(); setOpen(true) } }}>
      <span>{selectedOption.label}</span>{showChevron && <ChevronDown size={14}/>}
    </button>
    {open && createPortal(<div ref={menuRef} className="custom-select-menu" style={menuStyle} id={listId} role="listbox" aria-label={ariaLabel ?? 'Options'}>
      {normalized.map(option => <button key={option.value} type="button" role="option" aria-selected={selectedOption.value === option.value} className={selectedOption.value === option.value ? 'selected' : ''} onClick={() => { if (onChange) onChange(option.value); else setLocalValue(option.value); setOpen(false) }}>{option.label}</button>)}
    </div>, document.body)}
  </div>
}

const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const parseDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? new Date(year, month - 1, day) : null
}

export function CustomDatePicker({ value, onChange, ariaLabel = 'Choose date' }: { value: string; onChange: (value: string) => void; ariaLabel?: string }) {
  const parsedValue = parseDate(value)
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => parsedValue ?? new Date())
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (parsedValue) setMonth(parsedValue) }, [value])
  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [open])

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - ((firstDay.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + index)
    return day
  })
  const displayDate = parsedValue?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) ?? 'Select date'

  return <div className="custom-date-picker" ref={containerRef}>
    <button type="button" className="custom-date-trigger" aria-label={ariaLabel} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <span>{displayDate}</span><CalendarDays size={15}/>
    </button>
    {open && <div className="custom-date-popover" role="dialog" aria-label="Choose a date">
      <div className="custom-date-heading"><button type="button" aria-label="Previous month" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() - 1, 1))}><ChevronLeft size={16}/></button><b>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</b><button type="button" aria-label="Next month" onClick={() => setMonth(current => new Date(current.getFullYear(), current.getMonth() + 1, 1))}><ChevronRight size={16}/></button></div>
      <div className="custom-date-grid" role="grid">
        {weekdayNames.map(day => <span className="custom-date-weekday" role="columnheader" key={day}>{day}</span>)}
        {days.map(day => {
          const key = dateKey(day)
          return <button key={key} type="button" role="gridcell" aria-label={day.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} aria-selected={value === key} className={`${day.getMonth() === month.getMonth() ? '' : 'outside'} ${value === key ? 'selected' : ''}`} onClick={() => { onChange(key); setOpen(false) }}>{day.getDate()}</button>
        })}
      </div>
    </div>}
  </div>
}
