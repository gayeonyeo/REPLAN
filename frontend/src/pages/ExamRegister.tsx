import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Layout from '../components/Layout'

const futureDate = () => { const value = new Date(); value.setDate(value.getDate() + 14); return value.toISOString().slice(0, 10) }

export default function ExamRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ subject: '', exam_date: futureDate(), exam_time: '09:00', scope_start: 1, scope_end: 200, scope_unit: '페이지', target_passes: 2, priority_chapters: '' })
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api.createExam(form); navigate('/') } catch (reason) { setError((reason as Error).message) } }
  return <Layout>
    <header className="page-header"><span className="kicker">PLAN A NEW EXAM</span><h1>시험과 우선순위를<br/>함께 알려주세요.</h1><p>같은 날 여러 시험도 시간별로 등록할 수 있고, 교수님이 강조한 범위는 AI 계획에서 먼저 고려합니다.</p></header>
    {error && <div className="notice error">{error}</div>}
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <label className="wide">과목명<input required value={form.subject} onChange={event => setForm({ ...form, subject: event.target.value })} placeholder="예: 생화학"/></label>
        <label>시험일<input required type="date" value={form.exam_date} onChange={event => setForm({ ...form, exam_date: event.target.value })}/></label>
        <label>시험 시간<input required type="time" value={form.exam_time} onChange={event => setForm({ ...form, exam_time: event.target.value })}/></label>
        <label>목표 회독<select value={form.target_passes} onChange={event => setForm({ ...form, target_passes: Number(event.target.value) })}><option value={1}>1회독</option><option value={1.5}>1.5회독</option><option value={2}>2회독</option><option value={3}>3회독</option><option value={4}>4회독</option></select></label>
        <label>단위<select value={form.scope_unit} onChange={event => setForm({ ...form, scope_unit: event.target.value })}><option>페이지</option><option>챕터</option><option>문제</option></select></label>
        <label>범위 시작<input required type="number" min="0" value={form.scope_start} onChange={event => setForm({ ...form, scope_start: Number(event.target.value) })}/></label>
        <label>범위 끝<input required type="number" min="1" value={form.scope_end} onChange={event => setForm({ ...form, scope_end: Number(event.target.value) })}/></label>
        <label className="wide">우선할 챕터·범위<textarea value={form.priority_chapters} onChange={event => setForm({ ...form, priority_chapters: event.target.value })} placeholder="예: 3장은 교수님이 특히 강조, 7장은 언급만 함" rows={4}/><small>강조 이유까지 적으면 계획 우선순위를 더 정확하게 잡을 수 있어요.</small></label>
      </div>
      <div className="form-footer"><p>고정 일정과 다른 시험의 학습 블록을 피해 겹치지 않게 계획합니다.</p><button className="btn btn-primary">RE:PLAN 만들기</button></div>
    </form>
  </Layout>
}
