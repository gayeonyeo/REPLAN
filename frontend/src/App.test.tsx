import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import CalendarPage from './pages/CalendarPage'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [], exams: [] }) })))

test('renders the adaptive planner dashboard', async () => {
  render(<App/>)
  expect(screen.getByRole('heading', { name: /밀려도 괜찮아요/ })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('아직 등록된 시험이 없습니다.')).toBeInTheDocument())
})

test('opens a daily timetable from the monthly calendar', async () => {
  await act(async () => { render(<MemoryRouter><CalendarPage/></MemoryRouter>) })
  expect(screen.getByRole('heading', { name: '월간 캘린더' })).toBeInTheDocument()
  const today = new Date().getDate().toString()
  const dayButtons = screen.getAllByRole('button', { name: new RegExp(`^${today}`) })
  fireEvent.click(dayButtons[0])
  expect(screen.getByRole('heading', { name: '일간 타임테이블' })).toBeInTheDocument()
  expect(screen.getByText(/OpenAI 추천 학습 시간/)).toBeInTheDocument()
})
