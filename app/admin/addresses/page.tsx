'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface AddressRow {
  id: string
  name: string
  class: string
  student_phone: string
  parent_phone: string
  address: string
  address_detail: string
  has_address: boolean
}

export default function AdminAddressesPage() {
  const router = useRouter()
  const [rows, setRows] = useState<AddressRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [onlyFilled, setOnlyFilled] = useState(false)
  const [classFilter, setClassFilter] = useState('전체')

  useEffect(() => {
    fetch('/api/admin/addresses', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/admin'); return null } return r.json() })
      .then(data => { if (data) { setRows(data); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [])

  const classes = ['전체', ...Array.from(new Set(rows.map(r => r.class).filter(Boolean))).sort()]

  const filtered = rows.filter(r => {
    if (onlyFilled && !r.has_address) return false
    if (classFilter !== '전체' && r.class !== classFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.name.includes(q) || r.student_phone.includes(q) || r.parent_phone.includes(q) || r.address.toLowerCase().includes(q)
    }
    return true
  })

  const filled = rows.filter(r => r.has_address).length

  function downloadExcel() {
    const a = document.createElement('a')
    a.href = '/api/admin/addresses?format=xlsx'
    a.download = `addresses_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
  }

  const th: React.CSSProperties = {
    padding: '10px 14px', fontSize: 10, fontWeight: 700,
    color: 'rgba(255,255,255,0.3)', textAlign: 'left',
    letterSpacing: '0.07em', textTransform: 'uppercase',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    background: 'rgba(255,255,255,0.03)',
    whiteSpace: 'nowrap',
  }
  const td: React.CSSProperties = {
    padding: '10px 14px', fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    verticalAlign: 'middle',
  }

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ marginBottom: 28 }}>
          <button onClick={() => router.push('/admin/dashboard')} style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
            border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
          }}>← 대시보드</button>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>📦 배송지 관리</h1>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                전체 {rows.length}명 중 <span style={{ color: '#34d17e', fontWeight: 700 }}>{filled}명</span> 배송지 입력 완료
              </p>
            </div>
            <button onClick={downloadExcel} style={{
              padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
              background: 'rgba(52,209,126,0.12)', border: '1px solid rgba(52,209,126,0.3)',
              color: '#34d17e', cursor: 'pointer',
            }}>↓ 엑셀 다운로드</button>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="이름·번호·주소 검색"
            style={{
              flex: 1, minWidth: 180, padding: '9px 14px', borderRadius: 10,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 13, outline: 'none',
            }}
          />
          <button onClick={() => setOnlyFilled(p => !p)} style={{
            padding: '9px 14px', borderRadius: 10, fontSize: 12, fontWeight: 600,
            cursor: 'pointer', border: '1px solid',
            borderColor: onlyFilled ? 'rgba(52,209,126,0.4)' : 'rgba(255,255,255,0.1)',
            background: onlyFilled ? 'rgba(52,209,126,0.1)' : 'rgba(255,255,255,0.04)',
            color: onlyFilled ? '#34d17e' : 'rgba(255,255,255,0.4)',
          }}>입력된 것만</button>
        </div>

        {/* 반 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
          {classes.map(c => (
            <button key={c} onClick={() => setClassFilter(c)} style={{
              padding: '5px 12px', borderRadius: 16, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', border: 'none',
              background: classFilter === c ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
              color: classFilter === c ? '#fff' : 'rgba(255,255,255,0.45)',
            }}>{c}</button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 10 }}>
          {loading ? '불러오는 중…' : `${filtered.length}명`}
        </div>

        {/* 테이블 */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr>
                  {['이름', '반', '학생 번호', '학부모 번호', '기본 주소', '상세 주소'].map(h => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>
                      불러오는 중…
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ ...td, textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.2)' }}>
                      해당하는 학생이 없습니다.
                    </td>
                  </tr>
                ) : filtered.map(r => (
                  <tr key={r.id}
                    onClick={() => router.push(`/admin/students/${r.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...td, fontWeight: 700, color: '#fff' }}>{r.name}</td>
                    <td style={{ ...td, color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{r.class || '—'}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.student_phone || '—'}</td>
                    <td style={{ ...td, fontFamily: "'DM Mono',monospace", fontSize: 12 }}>{r.parent_phone || '—'}</td>
                    <td style={{ ...td, color: r.address ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.2)', fontStyle: r.address ? 'normal' : 'italic' }}>
                      {r.address || '미입력'}
                    </td>
                    <td style={{ ...td, color: r.address_detail ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)', fontStyle: r.address_detail ? 'normal' : 'italic', fontSize: 12 }}>
                      {r.address_detail || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
