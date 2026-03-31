'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface LectureVideo { id: string; title: string; youtubeUrl: string; week: number }
interface LectureNotice { id: string; title: string; content: string; createdAt: string }
interface LectureAssignment { id: string; title: string; description: string; dueDate: string }
interface Lecture {
  id: string; name: string; description: string
  videos: LectureVideo[]; notices: LectureNotice[]; assignments: LectureAssignment[]
}

type TabKey = 'videos' | 'notices' | 'assignments'

function getYoutubeEmbedId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&?/]+)/)
  return m ? m[1] : null
}

export default function MyLecturesPage() {
  const router = useRouter()
  const [lectures, setLectures] = useState<Lecture[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLecture, setSelectedLecture] = useState<Lecture | null>(null)
  const [tab, setTab] = useState<TabKey>('videos')

  useEffect(() => {
    fetch('/api/my/lectures', { cache: 'no-store' })
      .then(r => { if (r.status === 401) { router.push('/my'); return null } return r.json() })
      .then(data => {
        if (!data) return
        setLectures(data)
        if (data.length > 0) setSelectedLecture(data[0])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const card: React.CSSProperties = {
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 14,
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
      불러오는 중…
    </div>
  )

  if (lectures.length === 0) return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '36px 20px 0' }}>
        <button onClick={() => router.push('/my/dashboard')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>← 대시보드</button>
        <div style={{ ...card, padding: 60, textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
          수강 중인 강의가 없습니다.<br />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.15)' }}>관리자에게 강의 배정을 요청하세요.</span>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '36px 20px 0' }}>

        <button onClick={() => router.push('/my/dashboard')} style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: 16, display: 'block' }}>← 대시보드</button>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 20 }}>내 강의</h1>

        {/* 강의 선택 탭 */}
        {lectures.length > 1 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {lectures.map(l => (
              <button key={l.id} onClick={() => { setSelectedLecture(l); setTab('videos') }} style={{
                padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: selectedLecture?.id === l.id ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
                color: selectedLecture?.id === l.id ? '#fff' : 'rgba(255,255,255,0.5)',
              }}>{l.name}</button>
            ))}
          </div>
        )}

        {selectedLecture && (
          <>
            <div style={{ ...card, padding: '16px 20px', marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: selectedLecture.description ? 6 : 0 }}>{selectedLecture.name}</div>
              {selectedLecture.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{selectedLecture.description}</div>}
            </div>

            {/* 콘텐츠 탭 */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {([
                ['videos', `🎬 영상 (${selectedLecture.videos.length})`],
                ['notices', `📢 공지 (${selectedLecture.notices.length})`],
                ['assignments', `📝 과제 (${selectedLecture.assignments.length})`],
              ] as [TabKey, string][]).map(([key, label]) => (
                <button key={key} onClick={() => setTab(key)} style={{
                  padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  background: tab === key ? '#4d8bf5' : 'rgba(255,255,255,0.07)',
                  color: tab === key ? '#fff' : 'rgba(255,255,255,0.45)',
                }}>{label}</button>
              ))}
            </div>

            {/* 영상 탭 */}
            {tab === 'videos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedLecture.videos.length === 0 ? (
                  <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 영상이 없습니다.</div>
                ) : selectedLecture.videos.map(v => {
                  const embedId = getYoutubeEmbedId(v.youtubeUrl)
                  return (
                    <div key={v.id} style={{ ...card, overflow: 'hidden' }}>
                      {embedId && (
                        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                          <iframe
                            src={`https://www.youtube.com/embed/${embedId}`}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      )}
                      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#4d8bf5', flexShrink: 0 }}>{v.week || '—'}</div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{v.title}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{v.week ? `${v.week}주차` : ''}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* 공지 탭 */}
            {tab === 'notices' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedLecture.notices.length === 0 ? (
                  <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 공지가 없습니다.</div>
                ) : selectedLecture.notices.map(n => (
                  <div key={n.id} style={{ ...card, padding: '16px 20px' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{n.title}</div>
                    {n.content && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{n.content}</div>}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 10 }}>{new Date(n.createdAt).toLocaleString('ko-KR')}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 과제 탭 */}
            {tab === 'assignments' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selectedLecture.assignments.length === 0 ? (
                  <div style={{ ...card, padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>등록된 과제가 없습니다.</div>
                ) : selectedLecture.assignments.map(a => (
                  <div key={a.id} style={{ ...card, padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: a.description ? 6 : 0 }}>{a.title}</div>
                      {a.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{a.description}</div>}
                      {a.dueDate && <div style={{ fontSize: 11, color: '#f5a623', marginTop: 8 }}>마감: {a.dueDate}</div>}
                    </div>
                    <button
                      onClick={() => router.push(`/my/submit?lectureId=${selectedLecture.id}&assignmentId=${a.id}`)}
                      style={{
                        padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        background: 'rgba(77,139,245,0.12)', border: '1px solid rgba(77,139,245,0.3)',
                        color: '#4d8bf5', cursor: 'pointer', flexShrink: 0,
                      }}
                    >제출하기</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <p style={{ textAlign: 'center', marginTop: 40, fontSize: 12, color: 'rgba(255,255,255,0.2)' }}>
          © 2026 박교준 수리논술
        </p>
      </div>
    </div>
  )
}
