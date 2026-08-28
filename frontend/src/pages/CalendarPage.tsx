import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import Layout from '../components/Layout'
import type { Overview } from '../types'

type CalendarItem = {
  id: string
  date: string
  title: string
  detail: string
  startTime: string
  endTime: string
  tone: string
  kind: string
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const HOURS = Array.from({ length: 19 }, (_, index) => index + 6)
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const timeToMinutes = (value: string) => { const [hour, minute] = value.split(':').map(Number); return hour * 60 + minute }

export default function CalendarPage() {
  const [data, setData] = useState<Overview>({ events: [], exams: [] })
  const [cursor, setCursor] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' })

  const load = async () => { try { setData(await api.overview()); setError('') } catch { setError('백엔드에 연결할 수 없습니다.') } }
  useEffect(() => { void load() }, [])

  const items = useMemo<CalendarItem[]>(() => [
    ...data.events.map(event => ({ id: `event-${event.id}`, date: event.starts_at.slice(0, 10), title: event.title, detail: '고정 일정', startTime: event.starts_at.slice(11, 16), endTime: event.ends_at.slice(11, 16), tone: 'event', kind: '일정' })),
    ...data.exams.flatMap(exam => exam.tasks.map(task => ({ id: `task-${task.id}`, date: task.study_date, title: exam.subject, detail: `${task.pass_number}회독 · ${task.scope_start}–${task.scope_end} ${exam.scope_unit}`, startTime: task.suggested_start_time, endTime: task.suggested_end_time, tone: task.status.toLowerCase(), kind: '공부' }))),
  ], [data])

  const monthDays = useMemo(() => {
    const year = cursor.getFullYear(); const month = cursor.getMonth()
    const first = new Date(year, month, 1); const start = new Date(year, month, 1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day })
  }, [cursor])
  const dayItems = useMemo(() => items.filter(item => item.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [items, selectedDate])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    try { await api.createEvent(form); setForm({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' }); setShowForm(false); await load() }
    catch (reason) { setError((reason as Error).message) }
  }
  const moveMonth = (amount: number) => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + amount, 1))

  return <Layout>
    <header className="page-header row"><div><span className="kicker">SCHEDULE</span><h1>{selectedDate ? '일간 타임테이블' : '월간 캘린더'}</h1><p>{selectedDate ? `${selectedDate}의 시간별 일정입니다.` : '날짜를 선택하면 하루 타임테이블을 확인할 수 있습니다.'}</p></div><div className="calendar-actions">{selectedDate && <button className="btn btn-secondary" onClick={() => setSelectedDate(null)}>← 월간으로</button>}<button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 고정 일정</button></div></header>
    {error && <div className="notice error">{error}</div>}
    {showForm && <form className="inline-form" onSubmit={submit}><label>일정명<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })}/></label><label>종류<select value={form.event_type} onChange={event => setForm({ ...form, event_type: event.target.value })}><option value="CLASS">수업</option><option value="WORK">아르바이트</option><option value="APPOINTMENT">약속</option><option value="OTHER">기타</option></select></label><label>시작<input required type="datetime-local" value={form.starts_at} onChange={event => setForm({ ...form, starts_at: event.target.value })}/></label><label>종료<input required type="datetime-local" value={form.ends_at} onChange={event => setForm({ ...form, ends_at: event.target.value })}/></label><button className="btn btn-primary">저장</button></form>}
    {!selectedDate ? <section className="month-calendar">
      <div className="month-toolbar"><button onClick={() => moveMonth(-1)}>‹</button><h2>{cursor.getFullYear()}년 {cursor.getMonth() + 1}월</h2><button onClick={() => moveMonth(1)}>›</button></div>
      <div className="weekday-row">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div>
      <div className="month-grid">{monthDays.map(day => { const key = dateKey(day); const inMonth = day.getMonth() === cursor.getMonth(); const dayEntries = items.filter(item => item.date === key); return <button className={`month-day ${inMonth ? '' : 'outside'} ${key === dateKey(new Date()) ? 'today' : ''}`} key={key} onClick={() => setSelectedDate(key)}><span className="day-number">{day.getDate()}</span><div className="month-events">{dayEntries.slice(0, 3).map(item => <span className={`month-event ${item.tone}`} key={item.id}><i/>{item.startTime} {item.title}</span>)}{dayEntries.length > 3 && <small>+{dayEntries.length - 3}개 더보기</small>}</div></button> })}</div>
    </section> : <section className="day-calendar">
      <div className="day-title"><div><span>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString('ko-KR', { weekday: 'long' })}</span><strong>{new Date(`${selectedDate}T00:00:00`).getDate()}</strong></div><p>OpenAI 추천 학습 시간과 고정 일정이 함께 표시됩니다.</p></div>
      <div className="timeline"><div className="time-axis">{HOURS.map(hour => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div><div className="time-track">{HOURS.map(hour => <i className="hour-line" style={{ top: `${(hour - 6) * 64}px` }} key={hour}/>)}{dayItems.map(item => { const start = Math.max(6 * 60, timeToMinutes(item.startTime)); const end = Math.min(24 * 60, timeToMinutes(item.endTime)); return <article className={`time-block ${item.tone}`} key={item.id} style={{ top: `${(start - 6 * 60) / 60 * 64}px`, height: `${Math.max(38, (end - start) / 60 * 64)}px` }}><span>{item.startTime}–{item.endTime} · {item.kind}</span><strong>{item.title}</strong><small>{item.detail}</small></article> })}{dayItems.length === 0 && <div className="day-empty">등록된 일정이 없습니다.</div>}</div></div>
    </section>}
  </Layout>
}
