import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import Layout from '../components/Layout'
import type { Overview, StudyTask } from '../types'

const empty: Overview = { events: [], exams: [] }
const statusLabel: Record<string, string> = { PLANNED: '예정', COMPLETED: '완료', PARTIAL: '일부 완료', MISSED: '미완료' }

export default function Dashboard() {
  const [data, setData] = useState<Overview>(empty)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [partialTask, setPartialTask] = useState<StudyTask | null>(null)
  const [actualEnd, setActualEnd] = useState('')

  const load = async () => { try { setData(await api.overview()); setError('') } catch { setError('백엔드에 연결할 수 없습니다. 8000번 포트의 서버를 실행해 주세요.') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])

  const planned = useMemo(() => data.exams.flatMap(exam => exam.tasks.map(task => ({ task, exam }))).filter(item => item.task.status === 'PLANNED').sort((a, b) => a.task.study_date.localeCompare(b.task.study_date)), [data])

  const resetDemo = async () => { setLoading(true); try { setData(await api.resetDemo()); setMessage('시연 데이터가 준비되었습니다. 첫 계획을 일부 완료해 보세요.'); setError('') } catch (reason) { setError((reason as Error).message) } finally { setLoading(false) } }
  const checkIn = async (task: StudyTask, result: 'COMPLETED' | 'PARTIAL' | 'MISSED') => {
    if (result === 'PARTIAL' && !actualEnd) { setPartialTask(task); return }
    try {
      const response = await api.checkIn(task.id, { result, actual_scope_end: result === 'PARTIAL' ? Number(actualEnd) : null }) as { message: string; previous_version: number; new_version: number }
      setMessage(`${response.message} 계획 v${response.previous_version} → v${response.new_version}`)
      setPartialTask(null); setActualEnd(''); await load()
    } catch (reason) { setError((reason as Error).message) }
  }

  return <Layout>
    <section className="hero"><div><span className="kicker">ADAPTIVE STUDY PLANNER</span><h1>밀려도 괜찮아요.<br/><em>남은 계획이 다시 맞춰집니다.</em></h1><p>일정과 실제 공부량을 반영해 시험일까지의 계획을 매일 현실적으로 조정합니다.</p><div className="hero-actions"><button className="btn btn-primary" onClick={resetDemo}>30초 데모 시작</button><Link className="btn btn-secondary" to="/exams/new">내 시험 등록</Link></div></div><div className="loop-card"><span>계획</span><b>→</b><span>수행</span><b>→</b><span>재계획</span><small>실제 기록이 다음 계획의 기준이 됩니다</small></div></section>
    {error && <div className="notice error">{error}</div>}{message && <div className="notice success">{message}</div>}
    <section className="section-heading"><div><span className="kicker">ACTIVE EXAMS</span><h2>시험 진행 현황</h2></div><Link to="/exams/new">+ 시험 추가</Link></section>
    {loading ? <div className="empty">불러오는 중...</div> : data.exams.length === 0 ? <div className="empty"><b>아직 등록된 시험이 없습니다.</b><p>데모를 시작하거나 첫 시험을 등록해 보세요.</p></div> : <div className="exam-grid">{data.exams.map(exam => { const percent = Math.min(100, exam.current_passes / exam.target_passes * 100); return <article className="exam-card" key={exam.id}><div className="exam-top"><span className="subject-dot"/><div><h3>{exam.subject}</h3><p>{exam.exam_date} · 목표 {exam.target_passes}회독</p></div><span className="version">AI · v{exam.plan_version}</span></div><div className="metrics"><div><strong>{exam.current_passes}</strong><span>현재 회독</span></div><div><strong>{exam.forecast_passes}</strong><span>예상 회독</span></div><div><strong>{exam.tasks.filter(t => t.status === 'PLANNED').length}</strong><span>남은 계획</span></div></div><div className="progress"><i style={{ width: `${percent}%` }}/></div><p className="range">범위 {exam.scope_start}–{exam.scope_end} {exam.scope_unit}</p>{exam.ai_summary && <p className="ai-summary">{exam.ai_summary}</p>}</article> })}</div>}
    <section className="section-heading"><div><span className="kicker">NEXT ACTION</span><h2>가장 가까운 공부 계획</h2></div><Link to="/calendar">전체 캘린더</Link></section>
    <div className="task-list">{planned.slice(0, 4).map(({ task, exam }) => <article className="task-row" key={task.id}><div className="date-box"><strong>{new Date(`${task.study_date}T00:00:00`).getDate()}</strong><span>{new Date(`${task.study_date}T00:00:00`).toLocaleDateString('ko-KR', { weekday: 'short' })}</span></div><div className="task-copy"><span>{exam.subject} · {task.pass_number}회독</span><h3>{task.scope_start}–{task.scope_end} {exam.scope_unit}</h3><small>{task.suggested_start_time}–{task.suggested_end_time} · {statusLabel[task.status]} · 계획 v{task.plan_version}</small></div><div className="check-actions"><button onClick={() => void checkIn(task, 'COMPLETED')}>완료</button><button onClick={() => { setPartialTask(task); setActualEnd('') }}>일부</button><button className="muted" onClick={() => void checkIn(task, 'MISSED')}>미완료</button></div></article>)}{planned.length === 0 && data.exams.length > 0 && <div className="empty">남은 공부 계획이 없습니다.</div>}</div>
    {partialTask && <div className="modal-backdrop"><div className="modal"><span className="kicker">PARTIAL CHECK-IN</span><h2>어디까지 완료했나요?</h2><p>오늘 계획: {partialTask.scope_start}–{partialTask.scope_end}</p><label>실제 완료 지점<input type="number" min={partialTask.scope_start} max={partialTask.scope_end - 1} value={actualEnd} onChange={event => setActualEnd(event.target.value)} placeholder={`${partialTask.scope_start} 이상 ${partialTask.scope_end - 1} 이하`}/></label><div className="modal-actions"><button className="btn btn-secondary" onClick={() => setPartialTask(null)}>취소</button><button className="btn btn-primary" onClick={() => void checkIn(partialTask, 'PARTIAL')}>기록하고 재계획</button></div></div></div>}
  </Layout>
}
