'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface Assignment {
  type: 'homework' | 'basic_math' | 'mock'
  date: string
  name: string
  submitted: 'O' | 'X'
  grade: string
  completeness: number | null
}

interface Student {
  id: string
  name: string
  class: string
  student_phone: string | null
  parent_phone: string | null
  address: string
  address_detail: string
  zipcode: string
  total_hw: number
  submitted_count: number
  submission_rate: number
  a_count: number
  b_count: number
  c_count: number
  assignments: Assignment[]
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const TYPE_COLOR: Record<string, string> = {
  homework: '#34d17e',
  basic_math: '#4d8bf5',
  mock: '#f5a623',
}

export default function StudentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [student, setStudent] = useState<Student | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [addingRow, setAddingRow] = useState(false)
  const [resetMsg, setResetMsg] = useState<string | null>(null)
  const [newAssignment, setNewAssignment] = useState<Assignment>({
    type: 'homework', date: '', name: '', submitted: 'X', grade: '-', completeness: null,
  })
  const saveTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetch(`/api/admin/students/${id}`, { cache: 'no-store' })
      .then(r => { if (r.status === 401) router.push('/admin'); return r.json() })
      .then(data => { setStudent(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  const save = useCallback(async (body: object) => {
    setSaveStatus('saving')
    try {
      const res = await fetch(`/api/admin/students/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      const updated: Student = await res.json()
      setStudent(updated)
      setSaveStatus('saved')
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch {
      setSaveStatus('error')
    }
  }, [id])

  function handleInfoBlur(field: string, value: string) {
    if (!student) return
    if ((student as Record<string, unknown>)[field] === value) return
    save({ field, value })
  }

  function handleAssignmentBlur(index: number, updated: Assignment) {
    save({ field: 'assignment_update', index, assignment: updated })
  }

  async function handleAddAssignment() {
    await save({ field: 'assignment_add', assignment: newAssignment })
    setNewAssignment({ type: 'homework', date: '', name: '', submitted: 'X', grade: '-', completeness: null })
    setAddingRow(false)
  }

  function handleDeleteAssignment(index: number) {
    if (!confirm(`"${student?.assignments[index].name || `${index + 1}번`}" 과제를 삭제할까요?`)) return
    save({ field: 'assignment_delete', index })
  }

  function updateLocalAssignment(index: number, patch: Partial<Assignment>) {
    if (!student) return
    const updated = [...student.assignments]
    updated[index] = { ...updated[index], ...patch }
    setStudent({ ...student, assignments: updated })
  }

  async function handleResetPassword() {
    if (!confirm('비밀번호를 초기값(84431621)으로 초기화할까요?')) return
    setResetMsg(null)
    try {
      const res = await fetch(`/api/admin/students/${id}/reset-password`, { method: 'POST' })
      if (res.ok) setResetMsg('✅ 초기화 완료')
      else setResetMsg('초기화 실패')
    } catch {
      setResetMsg('서버 오류')
    }
    setTimeout(() => setResetMsg(null), 3000)
  }

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16, marginBottom: 20, overflow: 'hidden',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#fff', fontSize: 13, padding: '7px 10px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  }
  const cellInput: React.CSSProperties = {
    background: 'transparent', border: '1px solid transparent',
    borderRadius: 6, color: '#fff', fontSize: 12, padding: '4px 6px',
    outline: 'none', width: '100%', boxSizing: 'border-box',
    transition: 'border-color 0.15s, background 0.15s',
  }

  function rateColor(rate: number) {
    if (rate >= 80) return '#34d17e'
    if (rate >= 50) return '#f5c842'
    return '#ef5454'
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      불러오는 중…
    </div>
  )
  if (!student) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      학생을 찾을 수 없습니다.
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 20px 0' }}>

        {/* 상단 */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <button onClick={() => router.push('/admin/students')} style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none',
              border: 'none', cursor: 'pointer', padding: 0, marginBottom: 12,
            }}>← 학생 목록</button>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 4 }}>{student.name}</h1>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{student.class}</span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 20,
            background: saveStatus === 'saving' ? 'rgba(77,139,245,0.15)'
              : saveStatus === 'saved' ? 'rgba(52,209,126,0.15)'
              : saveStatus === 'error' ? 'rgba(239,84,84,0.15)' : 'transparent',
            color: saveStatus === 'saving' ? '#4d8bf5'
              : saveStatus === 'saved' ? '#34d17e'
              : saveStatus === 'error' ? '#ef5454' : 'rgba(255,255,255,0.2)',
            transition: 'all 0.2s',
          }}>
            {saveStatus === 'saving' ? '저장 중…' : saveStatus === 'saved' ? '✓ 저장됨' : saveStatus === 'error' ? '저장 실패' : '자동 저장'}
          </div>
        </div>

        {/* 집계 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { label: '제출률', value: `${student.submission_rate}%`, color: rateColor(student.submission_rate) },
            { label: 'A등급', value: student.a_count, color: '#4d8bf5' },
            { label: 'B등급', value: student.b_count, color: '#34d17e' },
            { label: 'C등급', value: student.c_count, color: '#f5a623' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ ...card, padding: '16px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "'DM Mono',monospace", lineHeight: 1, marginBottom: 4 }}>{value}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
            </div>
          ))}
        </div>

        {/* 기본 정보 */}
        <div style={card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            기본 정보
          </div>
          <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {([
              ['이름', 'name', student.name ?? ''],
              ['반', 'class', student.class ?? ''],
              ['학생 번호', 'student_phone', student.student_phone ?? ''],
              ['학부모 번호', 'parent_phone', student.parent_phone ?? ''],
            ] as [string, string, string][]).map(([label, field, val]) => (
              <div key={field}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                <input
                  defaultValue={val}
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; handleInfoBlur(field, e.target.value) }}
                />
              </div>
            ))}
          </div>

          {/* 배송지 */}
          <div style={{ padding: '0 20px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>배송지</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 8 }}>
                <input
                  defaultValue={student.zipcode ?? ''}
                  placeholder="우편번호"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; handleInfoBlur('zipcode', e.target.value) }}
                />
                <input
                  defaultValue={student.address ?? ''}
                  placeholder="기본 주소"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                  onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; handleInfoBlur('address', e.target.value) }}
                />
              </div>
              <input
                defaultValue={student.address_detail ?? ''}
                placeholder="상세 주소"
                style={inputStyle}
                onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.5)')}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; handleInfoBlur('address_detail', e.target.value) }}
              />
            </div>
          </div>

          {/* 비밀번호 초기화 */}
          <div style={{ padding: '12px 20px 16px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleResetPassword} style={{
              padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(239,84,84,0.08)', border: '1px solid rgba(239,84,84,0.2)',
              color: '#f08888', cursor: 'pointer',
            }}>
              🔑 비밀번호 초기화
            </button>
            {resetMsg && (
              <span style={{ fontSize: 12, color: resetMsg.startsWith('✅') ? '#34d17e' : '#f08888' }}>{resetMsg}</span>
            )}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginLeft: 'auto' }}>초기값: 84431621</span>
          </div>
        </div>

        {/* 과제 테이블 */}
        <div style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
              과제 목록 <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>({student.assignments.length}개)</span>
            </div>
            <button onClick={() => setAddingRow(true)} style={{
              fontSize: 12, fontWeight: 600, color: '#4d8bf5',
              background: 'rgba(77,139,245,0.1)', border: '1px solid rgba(77,139,245,0.25)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
            }}>+ 과제 추가</button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                  {['#', '타입', '날짜', '과제명', '제출', '등급', '완성도', ''].map(h => (
                    <th key={h} style={{
                      padding: '10px 12px', fontSize: 10, fontWeight: 700,
                      color: 'rgba(255,255,255,0.3)', textAlign: 'left',
                      letterSpacing: '0.07em', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(255,255,255,0.06)', whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {student.assignments.map((a, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '6px 12px', fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: "'DM Mono',monospace", whiteSpace: 'nowrap' }}>{i + 1}</td>

                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <select value={a.type}
                        onChange={e => {
                          const newType = e.target.value as Assignment['type']
                          const resetGrade = newType === 'mock' ? '-' : '-'
                          const resetComp = newType === 'mock' ? null : a.completeness
                          const patched = { ...a, type: newType, grade: resetGrade, completeness: resetComp }
                          updateLocalAssignment(i, { type: newType, grade: resetGrade, completeness: resetComp })
                          handleAssignmentBlur(i, patched)
                        }}
                        style={{
                          background: `${TYPE_COLOR[a.type]}18`, border: `1px solid ${TYPE_COLOR[a.type]}40`,
                          borderRadius: 6, color: TYPE_COLOR[a.type], fontSize: 11, fontWeight: 700,
                          padding: '3px 6px', cursor: 'pointer', outline: 'none',
                        }}>
                        <option value="homework" style={{ background: '#1e1e2e', color: '#fff' }}>과제</option>
                        <option value="basic_math" style={{ background: '#1e1e2e', color: '#fff' }}>기초수학</option>
                        <option value="mock" style={{ background: '#1e1e2e', color: '#fff' }}>모의논술</option>
                      </select>
                    </td>

                    <td style={{ padding: '6px 8px', minWidth: 100 }}>
                      <input value={a.date}
                        onChange={e => updateLocalAssignment(i, { date: e.target.value })}
                        onBlur={e => handleAssignmentBlur(i, { ...a, date: e.target.value })}
                        style={{ ...cellInput, minWidth: 90 }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(77,139,245,0.4)'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                        onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent' }}
                      />
                    </td>

                    <td style={{ padding: '6px 8px', minWidth: 160 }}>
                      <input value={a.name}
                        onChange={e => updateLocalAssignment(i, { name: e.target.value })}
                        onBlur={e => handleAssignmentBlur(i, { ...a, name: e.target.value })}
                        style={{ ...cellInput, minWidth: 150 }}
                        onFocus={e => { e.target.style.borderColor = 'rgba(77,139,245,0.4)'; e.target.style.background = 'rgba(255,255,255,0.05)' }}
                        onBlurCapture={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent' }}
                      />
                    </td>

                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => {
                        const toggled = a.submitted === 'O' ? 'X' : 'O'
                        updateLocalAssignment(i, { submitted: toggled })
                        save({ field: 'assignment_update', index: i, assignment: { ...a, submitted: toggled } })
                      }} style={{
                        padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 800,
                        cursor: 'pointer', border: 'none',
                        background: a.submitted === 'O' ? 'rgba(52,209,126,0.15)' : 'rgba(239,84,84,0.1)',
                        color: a.submitted === 'O' ? '#34d17e' : '#ef5454',
                      }}>{a.submitted}</button>
                    </td>

                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      {a.type === 'mock' ? (
                        <select value={a.grade}
                          onChange={e => { updateLocalAssignment(i, { grade: e.target.value }); handleAssignmentBlur(i, { ...a, grade: e.target.value }) }}
                          style={{
                            background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)',
                            borderRadius: 6, color: '#f5a623', fontSize: 11, fontWeight: 700,
                            padding: '3px 6px', cursor: 'pointer', outline: 'none', width: 100,
                          }}>
                          {['-', '상위 10%', '상위 20%', '상위 30%', '상위 40%', '상위 50%'].map(g => (
                            <option key={g} value={g} style={{ background: '#1e1e2e', color: '#fff' }}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <select value={a.grade}
                          onChange={e => { updateLocalAssignment(i, { grade: e.target.value }); handleAssignmentBlur(i, { ...a, grade: e.target.value }) }}
                          style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 6, color: '#fff', fontSize: 12,
                            padding: '3px 6px', cursor: 'pointer', outline: 'none', width: 100,
                          }}>
                          {['-', 'A', 'B', 'C'].map(g => <option key={g} value={g} style={{ background: '#1e1e2e', color: '#fff' }}>{g}</option>)}
                        </select>
                      )}
                    </td>

                    <td style={{ padding: '6px 8px', width: 90 }}>
                      {a.type === 'mock' ? (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '3px 6px' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number" min={0} max={100} step={10}
                            value={a.completeness != null ? Math.round(a.completeness * 100) : ''}
                            placeholder="—"
                            onChange={e => {
                              const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                              updateLocalAssignment(i, { completeness: v != null ? v / 100 : null })
                            }}
                            onBlur={e => {
                              const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                              handleAssignmentBlur(i, { ...a, completeness: v != null ? v / 100 : null })
                            }}
                            style={{
                              width: 52, background: 'transparent',
                              border: '1px solid transparent', borderRadius: 6,
                              color: '#fff', fontSize: 12, fontFamily: "'DM Mono',monospace",
                              padding: '3px 6px', outline: 'none', textAlign: 'right',
                            }}
                            onFocus={e => (e.target.style.borderColor = 'rgba(77,139,245,0.4)')}
                            onBlurCapture={e => (e.target.style.borderColor = 'transparent')}
                          />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>%</span>
                        </div>
                      )}
                    </td>

                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleDeleteAssignment(i)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(239,84,84,0.4)', fontSize: 14, padding: '4px 6px', borderRadius: 6,
                      }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#ef5454')}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,84,84,0.4)')}
                      >✕</button>
                    </td>
                  </tr>
                ))}

                {addingRow && (
                  <tr style={{ background: 'rgba(77,139,245,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>new</td>
                    <td style={{ padding: '6px 8px' }}>
                      <select value={newAssignment.type}
                        onChange={e => setNewAssignment(p => ({ ...p, type: e.target.value as Assignment['type'] }))}
                        style={{ background: `${TYPE_COLOR[newAssignment.type]}18`, border: `1px solid ${TYPE_COLOR[newAssignment.type]}40`, borderRadius: 6, color: TYPE_COLOR[newAssignment.type], fontSize: 11, fontWeight: 700, padding: '3px 6px', outline: 'none' }}>
                        <option value="homework" style={{ background: '#1e1e2e', color: '#fff' }}>과제</option>
                        <option value="basic_math" style={{ background: '#1e1e2e', color: '#fff' }}>기초수학</option>
                        <option value="mock" style={{ background: '#1e1e2e', color: '#fff' }}>모의논술</option>
                      </select>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={newAssignment.date} onChange={e => setNewAssignment(p => ({ ...p, date: e.target.value }))}
                        placeholder="날짜" style={{ ...cellInput, minWidth: 90, borderColor: 'rgba(77,139,245,0.3)', background: 'rgba(255,255,255,0.04)' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <input value={newAssignment.name} onChange={e => setNewAssignment(p => ({ ...p, name: e.target.value }))}
                        placeholder="과제명" style={{ ...cellInput, minWidth: 150, borderColor: 'rgba(77,139,245,0.3)', background: 'rgba(255,255,255,0.04)' }} />
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <button onClick={() => setNewAssignment(p => ({ ...p, submitted: p.submitted === 'O' ? 'X' : 'O' }))}
                        style={{ padding: '4px 12px', borderRadius: 6, fontSize: 13, fontWeight: 800, cursor: 'pointer', border: 'none', background: newAssignment.submitted === 'O' ? 'rgba(52,209,126,0.15)' : 'rgba(239,84,84,0.1)', color: newAssignment.submitted === 'O' ? '#34d17e' : '#ef5454' }}>
                        {newAssignment.submitted}
                      </button>
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      {newAssignment.type === 'mock' ? (
                        <select value={newAssignment.grade} onChange={e => setNewAssignment(p => ({ ...p, grade: e.target.value }))}
                          style={{ background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.35)', borderRadius: 6, color: '#f5a623', fontSize: 11, fontWeight: 700, padding: '3px 6px', outline: 'none', width: 100 }}>
                          {['-', '상위 10%', '상위 20%', '상위 30%', '상위 40%', '상위 50%'].map(g => (
                            <option key={g} value={g} style={{ background: '#1e1e2e', color: '#fff' }}>{g}</option>
                          ))}
                        </select>
                      ) : (
                        <select value={newAssignment.grade} onChange={e => setNewAssignment(p => ({ ...p, grade: e.target.value }))}
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff', fontSize: 12, padding: '3px 6px', outline: 'none', width: 100 }}>
                          {['-', 'A', 'B', 'C'].map(g => <option key={g} value={g} style={{ background: '#1e1e2e', color: '#fff' }}>{g}</option>)}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', width: 90 }}>
                      {newAssignment.type === 'mock' ? (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: '3px 6px' }}>—</span>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <input
                            type="number" min={0} max={100} step={10}
                            value={newAssignment.completeness != null ? Math.round(newAssignment.completeness * 100) : ''}
                            placeholder="—"
                            onChange={e => {
                              const v = e.target.value === '' ? null : Math.min(100, Math.max(0, Number(e.target.value)))
                              setNewAssignment(p => ({ ...p, completeness: v != null ? v / 100 : null }))
                            }}
                            style={{
                              width: 52, background: 'rgba(255,255,255,0.04)',
                              border: '1px solid rgba(77,139,245,0.3)', borderRadius: 6,
                              color: '#fff', fontSize: 12, fontFamily: "'DM Mono',monospace",
                              padding: '3px 6px', outline: 'none', textAlign: 'right',
                            }}
                          />
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>%</span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={handleAddAssignment} style={{ background: 'rgba(52,209,126,0.15)', border: '1px solid rgba(52,209,126,0.3)', borderRadius: 6, color: '#34d17e', fontSize: 12, fontWeight: 700, padding: '4px 10px', cursor: 'pointer' }}>추가</button>
                        <button onClick={() => setAddingRow(false)} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '4px 8px', cursor: 'pointer' }}>✕</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {student.assignments.length === 0 && !addingRow && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
              과제가 없습니다. 위 버튼으로 추가하세요.
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술 · 관리자 전용
        </p>
      </div>
    </div>
  )
}
