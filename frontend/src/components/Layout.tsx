import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

export default function Layout({ children }: { children: ReactNode }) {
  return <><nav className="topbar"><NavLink to="/" className="brand"><span className="brand-mark">N</span>Nexus</NavLink><div className="nav-links"><NavLink to="/">대시보드</NavLink><NavLink to="/calendar">캘린더</NavLink><NavLink to="/exams/new">시험 등록</NavLink></div></nav><main className="container">{children}</main></>
}
