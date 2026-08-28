import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import Layout from '../components/Layout'
import type { Overview } from '../types'

type View = 'split' | 'week'
type CalendarItem = { id: string; sourceId: number; source: 'event' | 'task'; date: string; title: string; detail: string; startTime: string; endTime: string; tone: string; kind: string }
type DragState = { item: CalendarItem; mode: 'move' | 'resize'; startY: number; start: number; end: number }

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 19 }, (_, index) => index + 6)
const DAY_START = 360
const DAY_END = 1440
const PIXELS_PER_HOUR = 32
const dateKey = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
const toMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }
const toClock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
const snap = (value: number) => Math.round(value / 15) * 15
const mondayOf = (value: Date) => { const result = new Date(value); const day = result.getDay(); result.setDate(result.getDate() - (day === 0 ? 6 : day - 1)); result.setHours(0, 0, 0, 0); return result }

export default function CalendarPage() {
  const [data, setData] = useState<Overview>({ events: [], exams: [] })
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<View>('split')
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' })
  const [preview, setPreview] = useState<{ id: string; start: number; end: number } | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const load = async () => { try { setData(await api.overview()); setError('') } catch { setError('백엔드에 연결할 수 없습니다.') } }
  useEffect(() => { void load() }, [])
  const items = useMemo<CalendarItem[]>(() => [
    ...data.events.map(item => ({ id: `event-${item.id}`, sourceId: item.id, source: 'event' as const, date: item.starts_at.slice(0, 10), title: item.title, detail: '고정 일정', startTime: item.starts_at.slice(11, 16), endTime: item.ends_at.slice(11, 16), tone: 'event', kind: '일정' })),
    ...data.exams.flatMap(exam => exam.tasks.map(item => ({ id: `task-${item.id}`, sourceId: item.id, source: 'task' as const, date: item.study_date, title: exam.subject, detail: `${item.pass_number}회독 · ${item.scope_start}–${item.scope_end} ${exam.scope_unit}`, startTime: item.suggested_start_time, endTime: item.suggested_end_time, tone: item.status.toLowerCase(), kind: '공부' }))),
    ...data.exams.map(exam => ({ id: `exam-${exam.id}`, sourceId: exam.id, source: 'event' as const, date: exam.exam_date, title: `${exam.subject} 시험`, detail: `목표 ${exam.target_passes}회독`, startTime: exam.exam_time, endTime: toClock(Math.min(1439, toMinutes(exam.exam_time) + 60)), tone: 'exam', kind: '시험' })),
  ], [data])

  const monthDays = useMemo(() => { const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1); const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay()); return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day }) }, [cursor])
  const weekDays = useMemo(() => { const start = mondayOf(cursor); return Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day }) }, [cursor])
  const dayItems = useMemo(() => items.filter(item => item.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [items, selectedDate])

  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api.createEvent(form); setForm({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' }); setShowForm(false); await load() } catch (reason) { setError((reason as Error).message) } }
  const openDay = (date: string) => { setSelectedDate(date); setCursor(new Date(`${date}T00:00:00`)) }
  const movePeriod = (amount: number) => { const next = new Date(cursor); if (view === 'split') next.setMonth(next.getMonth() + amount, 1); else next.setDate(next.getDate() + amount * 7); setCursor(next) }
  const title = view === 'split' ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월` : `${dateKey(weekDays[0])} – ${dateKey(weekDays[6])}`

  const beginDrag = (event: React.PointerEvent, item: CalendarItem, mode: 'move' | 'resize') => { if (item.kind === '시험') return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); const start = toMinutes(item.startTime); dragRef.current = { item, mode, startY: event.clientY, start, end: toMinutes(item.endTime) }; setPreview({ id: item.id, start, end: toMinutes(item.endTime) }) }
  const moveDrag = (event: React.PointerEvent) => { const drag = dragRef.current; if (!drag) return; const delta = snap((event.clientY - drag.startY) / PIXELS_PER_HOUR * 60); const duration = drag.end - drag.start; if (drag.mode === 'move') { const start = Math.max(DAY_START, Math.min(DAY_END - duration, drag.start + delta)); setPreview({ id: drag.item.id, start, end: start + duration }) } else { const end = Math.max(drag.start + 30, Math.min(DAY_END, drag.end + delta)); setPreview({ id: drag.item.id, start: drag.start, end }) } }
  const endDrag = async () => { const drag = dragRef.current; const result = preview; dragRef.current = null; setPreview(null); if (!drag || !result || (result.start === drag.start && result.end === drag.end)) return; try { if (drag.item.source === 'task') await api.updateTaskTime(drag.item.sourceId, { suggested_start_time: toClock(result.start), suggested_end_time: toClock(result.end) }); else await api.updateEventTime(drag.item.sourceId, { starts_at: `${drag.item.date}T${toClock(result.start)}:00`, ends_at: `${drag.item.date}T${toClock(result.end)}:00` }); await load() } catch (reason) { setError((reason as Error).message); await load() } }

  const renderBlock = (item: CalendarItem) => { const shown = preview?.id === item.id ? preview : { start: toMinutes(item.startTime), end: toMinutes(item.endTime) }; const start = Math.max(DAY_START, shown.start); const end = Math.min(DAY_END, shown.end); return <article className={`time-block ${item.tone} ${item.kind === '시험' ? 'locked' : ''}`} key={item.id} style={{ top: `${(start - DAY_START) / 60 * PIXELS_PER_HOUR}px`, height: `${Math.max(24, (end - start) / 60 * PIXELS_PER_HOUR)}px` }} onPointerDown={event => beginDrag(event, item, 'move')} onPointerMove={moveDrag} onPointerUp={() => void endDrag()}><span>{toClock(start)}–{toClock(end)} · {item.kind}</span><strong>{item.title}</strong><small>{item.detail}</small>{item.kind !== '시험' && <i className="resize-handle" onPointerDown={event => { event.stopPropagation(); beginDrag(event, item, 'resize') }} aria-label="길이 조절"/>}</article> }

  return <Layout>
    <header className="calendar-header"><div><span className="kicker">INTEGRATED CALENDAR</span><h1>나의 시간표</h1></div><div className="calendar-actions"><div className="view-switch" role="group" aria-label="캘린더 보기"><button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}>월 + 일</button><button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>주간</button></div><button className="btn btn-primary" onClick={() => setShowForm(value => !value)}>+ 고정 일정</button></div></header>
    {error && <div className="notice error">{error}</div>}
    {showForm && <form className="inline-form" onSubmit={submit}><label>일정명<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>종류<select value={form.event_type} onChange={event => setForm({ ...form, event_type: event.target.value })}><option value="CLASS">수업</option><option value="WORK">아르바이트</option><option value="APPOINTMENT">약속</option><option value="OTHER">기타</option></select></label><label>시작<input required type="datetime-local" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })}/></label><label>종료<input required type="datetime-local" value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })}/></label><button className="btn btn-primary">저장</button></form>}
    <section className="calendar-shell"><div className="calendar-toolbar"><button onClick={() => movePeriod(-1)}>‹</button><h2>{title}</h2><button onClick={() => movePeriod(1)}>›</button><button className="today-button" onClick={() => { const today = new Date(); setCursor(today); setSelectedDate(dateKey(today)) }}>오늘</button></div>
      {view === 'split' && <div className="month-day-split"><div className="month-calendar"><div className="weekday-row">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div><div className="month-grid">{monthDays.map(day => { const key = dateKey(day); const entries = items.filter(item => item.date === key); return <button className={`month-day ${day.getMonth() !== cursor.getMonth() ? 'outside' : ''} ${key === dateKey(new Date()) ? 'today' : ''} ${key === selectedDate ? 'selected' : ''}`} key={key} onClick={() => openDay(key)}><span className="day-number">{day.getDate()}</span><div className="month-events">{entries.slice(0, 2).map(item => <span className={`month-event ${item.tone}`} key={item.id}>{item.startTime} {item.title}</span>)}{entries.length > 2 && <small>+{entries.length - 2}</small>}</div></button> })}</div></div><div className="split-day-calendar"><div className="split-day-header"><div><span>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ko-KR', { weekday: 'long' })}</span><strong>{new Date(`${selectedDate}T00:00:00`).getDate()}</strong></div><p>블록 이동 · 아래 손잡이로 길이 조절</p></div><div className="timeline"><div className="time-axis">{HOURS.map(hour => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="time-track">{HOURS.map(hour => <i className="hour-line" style={{ top: `${(hour - 6) * PIXELS_PER_HOUR}px` }} key={hour}/>)}{dayItems.map(renderBlock)}{dayItems.length === 0 && <div className="day-empty">등록된 일정이 없습니다.</div>}</div></div></div></div>}
      {view === 'week' && <div className="week-calendar"><div className="week-columns">{weekDays.map(day => { const key = dateKey(day); const entries = items.filter(item => item.date === key); return <button key={key} className={key === dateKey(new Date()) ? 'today' : ''} onClick={() => openDay(key)}><span>{WEEKDAYS[day.getDay()]}</span><strong>{day.getDate()}</strong><div>{entries.slice(0, 6).map(item => <i className={item.tone} key={item.id}>{item.startTime}<b>{item.title}</b></i>)}</div></button> })}</div></div>}
    </section>
  </Layout>
}
