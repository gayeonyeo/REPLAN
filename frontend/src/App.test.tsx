import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ events: [], exams: [] }) })))

test('renders the adaptive planner dashboard', async () => {
  render(<App/>)
  expect(screen.getByRole('heading', { name: /밀려도 괜찮아요/ })).toBeInTheDocument()
  await waitFor(() => expect(screen.getByText('아직 등록된 시험이 없습니다.')).toBeInTheDocument())
})
