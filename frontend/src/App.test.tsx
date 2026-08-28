import { render, screen } from '@testing-library/react'

import App from './App'

describe('App', () => {
  it('renders the Phase 0 landing screen', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '적응형 시험 계획 캘린더' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Phase 0 준비가 완료되었습니다.')).toBeInTheDocument()
  })
})

