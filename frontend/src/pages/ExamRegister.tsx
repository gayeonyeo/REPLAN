import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Layout from '../components/Layout'

const futureDate = () => { const date = new Date(); date.setDate(date.getDate() + 14); return date.toISOString().slice(0, 10) }

export default function ExamRegister() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ subject: '', exam_date: futureDate(), scope_start: 1, scope_end: 200, scope_unit: '페이지', target_passes: 2 })
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await api.createExam(form); navigate('/') } catch (reason) { setError((reason as Error).message) } }
  return <Layout><header className="page-header"><span className="kicker">NEW EXAM</span><h1>시험 계획 만들기</h1><p>범위와 목표를 입력하면 기존 일정을 피해 날짜별 공부량을 나눕니다.</p></header>{error && <div className="notice error">{error}</div>}<form className="form-card" onSubmit={submit}><div className="form-grid"><label className="wide">과목명<input required value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="예: 생화학"/></label><label>시험일<input required type="date" value={form.exam_date} onChange={e => setForm({ ...form, exam_date: e.target.value })}/></label><label>목표 회독<select value={form.target_passes} onChange={e => setForm({ ...form, target_passes: Number(e.target.value) })}><option value={1}>1회독</option><option value={1.5}>1.5회독</option><option value={2}>2회독</option><option value={3}>3회독</option></select></label><label>범위 시작<input required type="number" min="0" value={form.scope_start} onChange={e => setForm({ ...form, scope_start: Number(e.target.value) })}/></label><label>범위 끝<input required type="number" min="1" value={form.scope_end} onChange={e => setForm({ ...form, scope_end: Number(e.target.value) })}/></label><label>단위<select value={form.scope_unit} onChange={e => setForm({ ...form, scope_unit: e.target.value })}><option>페이지</option><option>챕터</option><option>문제</option></select></label></div><div className="form-footer"><p>시험 전날까지 자동 배분되며 실제 수행 후 남은 일정이 다시 계산됩니다.</p><button className="btn btn-primary">계획 생성하기</button></div></form></Layout>
}
