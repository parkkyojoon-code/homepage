"use client"

import { motion } from "framer-motion"
import { ArrowRight, Check } from "lucide-react"
import * as React from "react"
import { useRouter } from "next/navigation"

const courses = [
  {
    id: 1,
    classId: "1",
    option: "offline",
    category: "수리논술",
    title: "수리논술 현강반",
    description: "최상위권 대학 논술 완벽 대비 현장 강의",
    price: "월 80만원",
    features: [
      "학생 만족도 및 합격률 국내 최고의 수리논술 수업",
      "실전 모의논술과 3단계 1:1 맞춤 첨삭 지도",
      "기초 수학 테스트 및 과제로 근본적인 수학 실력 향상",
      "대학별 출제경향 완벽 분석\n[최근 4개년 100% 적중]"
    ],
    type: "논술"
  },
  {
    id: 2,
    classId: "1",
    option: "online",
    category: "수리논술",
    title: "수리논술 온라인반",
    description: "시간과 장소 제약 없는 프리미엄 온라인 강의",
    price: "월 40만원",
    features: [
      "대치 현강을 내 스케줄에 맞춰 자유롭게 수강",
      "현강 수업과 동일한 3단계 1:1 맞춤 첨삭 지도",
      "24시간 무한 질의응답 가능",
      "현강과 동일한 합격률로 검증된 국내 최상위 수리논술 인강"
    ],
    type: "논술"
  },
  {
    id: 3,
    classId: "2",
    option: "offline",
    category: "수능수학",
    title: "수능수학 현강반",
    description: "수능 수학 1등급 완성 현장 강의",
    price: "월 40만원",
    features: [
      "1등급? No. 수능 수학 만점을 목표로 하는 수업",
      "Time Attack부터 Killer Crush까지\n만점에 필요한 모든 것을 관리하는 수업",
      "잘못된 수학 학습 습관을 갈아엎는 수업",
      "요행없이 수학의 근본 실력을 키우는 수업"
    ],
    type: "수능"
  },
  {
    id: 4,
    classId: "2",
    option: "online",
    category: "수능수학",
    title: "수능수학 온라인반",
    description: "수능 수학 1등급 완성 온라인 프로그램",
    price: "월 28만원",
    features: [
      "현강과 동일한 관리를 해주는 인강의 혁명",
      "어느 등급대건 수학만큼은 만점을 목표로 하는 수업",
      "실시간 테스트와 개인별 약점 집중 관리",
      "과외를 받는 것처럼 실시간 1:1 무한 질문 가능"
    ],
    type: "수능"
  }
]

export default function CourseCards() {
  const [isMobile, setIsMobile] = React.useState(false)
  const router = useRouter()

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <section style={{
      padding: '8rem 1rem',
      background: '#000000',
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: '5rem' }}
        >
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#0099FF',
            marginBottom: '1rem',
            letterSpacing: '0.1em'
          }}>
            COURSES
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>
            당신에게 맞는<br />
            <span style={{
              background: 'linear-gradient(90deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              최적의 수업을 선택하세요
            </span>
          </h2>
          <p style={{
            fontSize: '1.125rem',
            color: '#808080',
            maxWidth: '600px',
            lineHeight: 1.6
          }}>
            박교준 수학의 검증된 커리큘럼으로
            당신의 목표를 현실로 만들어드립니다
          </p>
        </motion.div>

        {/* 수리논술 Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            marginBottom: isMobile ? '1.5rem' : '3rem',
            background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.03) 0%, transparent 100%)',
            borderRadius: isMobile ? '20px' : '32px',
            padding: isMobile ? '1.5rem' : '3rem',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Background Decoration */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 20% 50%, rgba(0, 102, 255, 0.05) 0%, transparent 50%)',
            pointerEvents: 'none'
          }} />

          {/* Section Header */}
          <div style={{
            marginBottom: isMobile ? '1rem' : '1.5rem',
            position: 'relative'
          }}>
            <h3 style={{
              fontSize: isMobile ? '2.5rem' : '3rem',
              fontWeight: '800',
              color: '#FFFFFF',
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              수리논술
            </h3>
            <p style={{
              fontSize: isMobile ? '1rem' : '1.25rem',
              color: '#808080'
            }}>
              국내최고합격률 박교준의 오페론 수리논술
            </p>
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem',
            marginBottom: '2rem'
          }}>
            {courses.filter(course => course.type === "논술").map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ y: -8 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  border: '1px solid rgba(0, 102, 255, 0.3)',
                  borderRadius: '24px',
                  padding: '2.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onClick={() => router.push(`/classes/${course.classId}?option=${course.option}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
                }}
              >


                {/* Title & Description */}
                <h3 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.75rem',
                  letterSpacing: '-0.02em'
                }}>
                  {course.title.split(' ').map((word, idx) => {
                    if (word === '현강반' || word === '온라인반') {
                      const color = course.type === '수능' ? '#EF4444' : '#60A5FA'
                      return <span key={idx} style={{ color }}> {word}</span>
                    }
                    return idx === 0 ? word : ' ' + word
                  })}
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#808080',
                  marginBottom: '2rem',
                  lineHeight: 1.5
                }}>
                  {course.description}
                </p>

                {/* Features */}
                <ul style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  {course.features.map((feature, idx) => (
                    <li key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.9375rem',
                      color: '#B0B0B0'
                    }}>
                      <Check size={16} style={{
                        color: '#0099FF',
                        flexShrink: 0
                      }} />
                      <span style={{ whiteSpace: 'pre-line' }}>{feature}</span>
                    </li>
                  ))}
                </ul>


                {/* Price & CTA */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{
                      fontSize: '1.5rem',
                      fontWeight: '700',
                      color: '#FFFFFF'
                    }}>
                      {course.price}
                    </span>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/classes/${course.classId}?option=${course.option}`)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      padding: '0.75rem 1.75rem',
                      background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#FFFFFF',
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 14px rgba(0, 102, 255, 0.25)',
                      letterSpacing: '0.02em'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #0099FF 0%, #00BBFF 100%)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 102, 255, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(0, 102, 255, 0.25)';
                    }}
                  >
                    지금 신청하기
                    <ArrowRight size={16} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* 수능수학 Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.03) 0%, transparent 100%)',
            borderRadius: isMobile ? '20px' : '32px',
            padding: isMobile ? '1.5rem' : '3rem',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          {/* Background Decoration */}
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 80% 50%, rgba(239, 68, 68, 0.05) 0%, transparent 50%)',
            pointerEvents: 'none'
          }} />

          {/* Section Header */}
          <div style={{
            marginBottom: isMobile ? '1rem' : '1.5rem',
            position: 'relative'
          }}>
            <h3 style={{
              fontSize: isMobile ? '2.5rem' : '3rem',
              fontWeight: '800',
              color: '#FFFFFF',
              marginBottom: '1rem',
              letterSpacing: '-0.02em'
            }}>
              수능수학
            </h3>
            <p style={{
              fontSize: isMobile ? '1rem' : '1.25rem',
              color: '#808080'
            }}>
              1등급? NO. 수능 수학 만점을 목표로 하는 수업
            </p>
          </div>

          {/* Cards Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
            gap: '2rem'
          }}>
            {courses.filter(course => course.type === "수능").map((course, index) => (
              <motion.div
                key={course.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.6 }}
                whileHover={{ y: -8 }}
                style={{
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '24px',
                  padding: '2.5rem',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onClick={() => router.push(`/classes/${course.classId}?option=${course.option}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.04) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
              >

                {/* Title & Description */}
                <h3 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.75rem',
                  letterSpacing: '-0.02em'
                }}>
                  {course.title.split(' ').map((word, idx) => {
                    if (word === '현강반' || word === '온라인반') {
                      const color = course.type === '수능' ? '#EF4444' : '#60A5FA'
                      return <span key={idx} style={{ color }}> {word}</span>
                    }
                    return idx === 0 ? word : ' ' + word
                  })}
                </h3>
                <p style={{
                  fontSize: '1rem',
                  color: '#808080',
                  marginBottom: '2rem',
                  lineHeight: 1.5
                }}>
                  {course.description}
                </p>

                {/* Features */}
                <ul style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                  marginBottom: '2rem'
                }}>
                  {course.features.map((feature, idx) => (
                    <li key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.9375rem',
                      color: '#B0B0B0'
                    }}>
                      <Check size={16} style={{
                        color: '#EF4444',
                        flexShrink: 0
                      }} />
                      <span style={{ whiteSpace: 'pre-line' }}>{feature}</span>
                    </li>
                  ))}
                </ul>


                {/* Price & CTA */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      marginBottom: '0.25rem'
                    }}>
                      <span style={{
                        fontSize: '1.5rem',
                        fontWeight: '700',
                        color: '#FFFFFF'
                      }}>
                        {course.price}
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      router.push(`/classes/${course.classId}?option=${course.option}`)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.6rem',
                      padding: '0.75rem 1.75rem',
                      background: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
                      border: 'none',
                      borderRadius: '10px',
                      color: '#FFFFFF',
                      fontSize: '0.95rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: '0 4px 14px rgba(239, 68, 68, 0.25)',
                      letterSpacing: '0.02em'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #EF4444 0%, #F87171 100%)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.35)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)';
                      e.currentTarget.style.boxShadow = '0 4px 14px rgba(239, 68, 68, 0.25)';
                    }}
                  >
                    지금 신청하기
                    <ArrowRight size={16} />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

{/* Selection Guide Section */}
        <div style={{
          marginTop: isMobile ? '6rem' : '8rem',
          marginLeft: isMobile ? '-1rem' : '-2rem',
          marginRight: isMobile ? '-1rem' : '-2rem',
          background: '#000000'
        }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.6 }}
            style={{
              padding: isMobile ? '4rem 1rem' : '6rem 2rem',
              position: 'relative'
            }}
          >
            {/* Section Title */}
            <h3 style={{
              fontSize: isMobile ? '2rem' : '2.5rem',
              fontWeight: '800',
              color: '#FFFFFF',
              marginBottom: '1rem',
              textAlign: 'center',
              letterSpacing: '-0.02em'
            }}>
              그래서, 나는 <span style={{
                background: 'linear-gradient(90deg, #0066FF 0%, #00DDFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>어떤 반</span>을 선택해야 하나요?
            </h3>

            <p style={{
              fontSize: isMobile ? '1.125rem' : '1.25rem',
              color: '#808080',
              textAlign: 'center',
              marginBottom: '3rem',
              lineHeight: 1.6
            }}>
              학생의 성향과 환경에 따라 최적의 선택이 달라집니다
            </p>


            {/* Comparison Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
              gap: '2rem',
              maxWidth: '1000px',
              margin: '0 auto'
            }}>
            {/* 현강반 추천 */}
            <motion.div
              whileHover={{ y: -5 }}
              style={{
                background: 'rgba(96, 165, 250, 0.05)',
                border: '1px solid rgba(96, 165, 250, 0.2)',
                borderRadius: '20px',
                padding: isMobile ? '2rem 1.5rem' : '2.5rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.3)';
                e.currentTarget.style.background = 'rgba(96, 165, 250, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(96, 165, 250, 0.2)';
                e.currentTarget.style.background = 'rgba(96, 165, 250, 0.05)';
              }}
            >
              <div style={{
                display: 'inline-block',
                padding: '0.375rem 1rem',
                background: 'rgba(96, 165, 250, 0.15)',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#60A5FA',
                  letterSpacing: '0.02em'
                }}>
                  현강반 추천
                </span>
              </div>

              <h4 style={{
                fontSize: isMobile ? '1.375rem' : '1.5rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '1.5rem'
              }}>
                이런 학생이라면 <span style={{ color: '#60A5FA' }}>현강반</span>을 추천합니다
              </h4>

              <ul style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#60A5FA', flexShrink: 0 }}>•</span>
                  대면 수업에서 몰입도가 높은 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#60A5FA', flexShrink: 0 }}>•</span>
                  스스로 페이스 조절이 어려운 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#60A5FA', flexShrink: 0 }}>•</span>
                  강한 학습 루틴과 규칙적인 스케줄이 필요한 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#60A5FA', flexShrink: 0 }}>•</span>
                  현장 긴장감 속에서 실력이 향상되는 학생
                </li>
              </ul>
            </motion.div>

            {/* 온라인반 추천 */}
            <motion.div
              whileHover={{ y: -5 }}
              style={{
                background: 'rgba(220, 38, 38, 0.08)',
                border: '1px solid rgba(220, 38, 38, 0.3)',
                borderRadius: '20px',
                padding: isMobile ? '2rem 1.5rem' : '2.5rem',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.4)';
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.3)';
                e.currentTarget.style.background = 'rgba(220, 38, 38, 0.08)';
              }}
            >
              <div style={{
                display: 'inline-block',
                padding: '0.375rem 1rem',
                background: 'rgba(239, 68, 68, 0.15)',
                borderRadius: '8px',
                marginBottom: '1.5rem'
              }}>
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#DC2626',
                  letterSpacing: '0.02em'
                }}>
                  온라인반 추천
                </span>
              </div>

              <h4 style={{
                fontSize: isMobile ? '1.375rem' : '1.5rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '1.5rem'
              }}>
                이런 학생이라면 <span style={{ color: '#EF4444' }}>온라인반</span>을 추천합니다
              </h4>

              <ul style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#EF4444', flexShrink: 0 }}>•</span>
                  거리가 멀어 현강 수업이 어려운 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#EF4444', flexShrink: 0 }}>•</span>
                  학원 일정으로 스케줄 조정이 어려운 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#EF4444', flexShrink: 0 }}>•</span>
                  정해진 시간대가 아닌, 원하는 시간에 수강하고 싶은 학생
                </li>
                <li style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  color: '#B0B0B0',
                  lineHeight: 1.5
                }}>
                  <span style={{ color: '#EF4444', flexShrink: 0 }}>•</span>
                  자기주도 학습 능력이 있는 학생
                </li>
              </ul>
            </motion.div>
          </div>

          {/* Final CTA */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
            style={{
              textAlign: 'center',
              marginTop: isMobile ? '5rem' : '6rem',
              padding: isMobile ? '2.5rem 1.5rem' : '3.5rem 2rem',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '24px',
              position: 'relative',
              maxWidth: '700px',
              margin: `${isMobile ? '5rem' : '6rem'} auto 0`,
              backdropFilter: 'blur(10px)',
              boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            }}
          >
            {/* Content */}
            <div style={{
              maxWidth: '500px',
              margin: '0 auto'
            }}>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, duration: 0.6 }}
                style={{
                  fontSize: isMobile ? '1.25rem' : '1.5rem',
                  fontWeight: '400',
                  color: '#B0B0B0',
                  marginBottom: '0.75rem',
                  lineHeight: 1.4,
                  letterSpacing: '-0.01em'
                }}
              >
                그래도 본인에게 어떤 수업이 잘 맞을지 고민되신다면,
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, duration: 0.6 }}
                style={{
                  fontSize: isMobile ? '1.375rem' : '1.625rem',
                  color: '#FFFFFF',
                  fontWeight: '700',
                  marginBottom: '2.5rem',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.3
                }}
              >
                학생에게 맞는 수업을 찾아드리겠습니다.
              </motion.p>

              <motion.button
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, duration: 0.6 }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => window.open('https://pf.kakao.com/_xnxaxmxj', '_blank')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.625rem',
                  padding: isMobile ? '1rem 2.25rem' : '1.125rem 2.75rem',
                  background: '#FFFFFF',
                  border: 'none',
                  borderRadius: '100px',
                  color: '#000000',
                  fontSize: isMobile ? '1rem' : '1.0625rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.01em'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.95)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = '#FFFFFF';
                }}
              >
                수업 상담하기
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  style={{ marginLeft: '0.25rem' }}
                >
                  <path
                    d="M6 12L10 8L6 4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </motion.button>
            </div>
          </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}