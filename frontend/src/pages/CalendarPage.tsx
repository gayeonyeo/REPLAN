import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import Layout from '../components/Layout'
import type { Overview } from '../types'

export default function CalendarPage() {
  const [data, setData] = useState<Overview>({ events: [], exams: [] })
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' })
  const load = async () => { try { setData(await api.overview()) } catch { setError('백엔드에 연결할 수 없습니다.') } }
  useEffect(() => { void load() }, [])
  const rows = useMemo(() => [...data.events.map(event => ({ date: event.starts_at.slice(0, 10), kind: '고정 일정', title: event.title, detail: `${event.starts_at.slice(11, 16)}–${event.ends_at.slice(11, 16)}`, tone: 'event' })), ...data.exams.flatMap(exam => exam.tasks.map(task => ({ date: task.study_date, kind: `${task.pass_number}회독`, title: exam.subject, detail: `${task.scope_start}–${task.scope_end} ${exam.scope_unit}`, tone: task.status.toLowerCase() })))].sort((a, b) => a.date.localeCompare(b.date)), [data])
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api.createEvent(form); setForm({ title: '', event_type: 'CLASS', starts_at: '', ends_at: '' }); setShowForm(false); await load() } catch (reason) { setError((reason as Error).message) } }
  return <Layout><header className="page-header row"><div><span className="kicker">SCHEDULE</span><h1>통합 캘린더</h1><p>고정 일정과 자동 생성된 공부 계획을 함께 확인합니다.</p></div><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ 고정 일정</button></header>{error && <div className="notice error">{error}</div>}{showForm && <form className="inline-form" onSubmit={submit}><label>일정명<input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label>종류<select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}><option value="CLASS">수업</option><option value="WORK">아르바이트</option><option value="APPOINTMENT">약속</option><option value="OTHER">기타</option></select></label><label>시작<input required type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })}/></label><label>종료<input required type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })}/></label><button className="btn btn-primary">저장</button></form>}<div className="calendar-list">{rows.map((row, index) => <article className="calendar-row" key={`${row.date}-${row.title}-${index}`}><time>{row.date}</time><i className={`tone ${row.tone}`}/><div><span>{row.kind}</span><h3>{row.title}</h3></div><strong>{row.detail}</strong></article>)}{rows.length === 0 && <div className="empty">등록된 일정이 없습니다.</div>}</div></Layout>
}
