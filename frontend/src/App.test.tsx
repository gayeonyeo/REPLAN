import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import App from './App'
import CalendarPage from './pages/CalendarPage'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [], exams: [] }) })))

test('renders the RE:PLAN dashboard', async () => {
  render(<App/>)
  expect(screen.getByRole('heading', { name: 'RE:PLAN' })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('아직 등록된 시험이 없습니다.')).toBeInTheDocument())
})

test('opens a daily timetable from the monthly calendar', async () => {
  await act(async () => { render(<MemoryRouter><CalendarPage/></MemoryRouter>) })
  expect(screen.getByRole('button', { name: '월' })).toHaveClass('active')
  const today = new Date().getDate().toString()
  const dayButtons = screen.getAllByRole('button', { name: new RegExp(`^${today}`) })
  fireEvent.click(dayButtons[0])
  expect(screen.getByRole('button', { name: '일' })).toHaveClass('active')
  expect(screen.getByText(/블록 위를 잡아 이동/)).toBeInTheDocument()
})

test('switches to the weekly calendar', async () => {
  await act(async () => { render(<MemoryRouter><CalendarPage/></MemoryRouter>) })
  fireEvent.click(screen.getByRole('button', { name: '주' }))
  expect(screen.getByRole('button', { name: '주' })).toHaveClass('active')
  expect(screen.getAllByRole('button', { name: /월|화|수|목|금|토|일/ }).length).toBeGreaterThan(1)
})
