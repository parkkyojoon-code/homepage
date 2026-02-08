"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function ManagementSystem() {
  const [isMobile, setIsMobile] = useState(false)
  const [selectedStep, setSelectedStep] = useState(0)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const steps = [
    {
      number: "01",
      stage: "과제",
      title: "최적화된 연습 문항 과제 → 반복 학습으로 실력 강화",
      description: "수업 내용을 즉시 복습할 수 있는 과제 제공합니다.",
      details: [
        "매주 수업 내용을 효과적으로 반복 학습시키기 위해 선별된 문항으로 과제가 나갑니다",
        "반복 학습을 통해 배운 내용을 완벽하게 자기 것으로 만들고 어떤 문제에도 흔들리지 않는 탄탄한 실력을 완성합니다.",
      ]
    },
    {
      number: "02",
      stage: "시험",
      title: "모의논술 테스트 및 기초수학 능력테스트",
      description: "실전과 같은 모의논술과 기초수학능력 테스트로 실전 감각을 향상시킵니다.",
      details: [
        "실전과 같은 모의논술을 통해 실전 감각을 끌어올립니다.",
        "기초수학 능력테스트를 통해, 학생의 부족한 개념과 역량을 찾아줍니다.",
      ]
    },
    {
      number: "03",
      stage: "알림",
      title: "결과 문자 알림 → 주기적인 학습 상황 전달",
      description: "학생의 학습 상태와 과제 진행도를 평가하여 주기적으로 학생과 부모님께 피드백을 합니다.",
      details: [
        "학생이 과제를 미제출할 경우 부모님과 학생에게 알림 문자를 발송하여 경각심을 높입니다."
      ]
    },
    {
      number: "04",
      stage: "피드백",
      title: "과제, 모의논술에 대한 피드백",
      description: "테스트와 과제를 분석하여 학생의 취약점을 학습시키기 위한 해결책을 제공합니다.",
      details: []
    },
    {
      number: "05",
      stage: "무한 연습",
      title: "무한 추가 문항 제공 → 학생의 요구에 맞춰 추가 문항 제공",
      description: "학생이 부족한 영역 혹은 학생이 추가로 학습하길 원하는 내용의 문항이 추가로 제공됩니다.",
      details: []
    },
    {
      number: "06",
      stage: "첨삭 시스템",
      title: "3단계 첨삭 시스템으로 실력 향상",
      description: "자가 첨삭 + 강사 첨삭 + 대면 첨삭 영상",
      details: [
        "의미없는 형식적 첨삭이 아닙니다.",
        "학생 스스로 첨삭하고, 이를 담당 코치가 다시 첨삭하는 2회 첨삭과 대면 첨삭에 해당하는 풀이 영상까지.",
        "3단계 첨삭 시스템을 통해 실제로 수학 실력 향상을 이끌어내는 첨삭을 지향합니다."
      ]
    },
    {
      number: "07",
      stage: "맞춤 관리",
      title: "개별 진도 및 과제 관리",
      description: "합류 시기 및 상황에 맞추어 학생 맞춤형 진도 및 과제량으로 학생마다 개별 맞춤형 학습을 제공합니다.",
      details: []
    }
  ]

  return (
    <section style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      position: 'relative',
      padding: isMobile ? '4rem 1rem' : '6rem 2rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '3rem' : '5rem'
          }}
        >
          <h2 style={{
            fontSize: isMobile ? '2.5rem' : '3.5rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #3B82F6, #60A5FA)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>7단계</span> 관리 시스템
          </h2>
          <p style={{
            fontSize: isMobile ? '1rem' : '1.125rem',
            color: 'rgba(255, 255, 255, 0.5)',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            체계적인 관리로 처음부터 끝까지 완벽하게
          </p>
        </motion.div>

        {/* Vertical Flow */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '0'
        }}>
          {/* Central Flow Line */}
          <div style={{
            position: 'absolute',
            left: isMobile ? '30px' : '35px',
            top: '35px',
            bottom: '100px',
            width: '2px',
            background: 'rgba(59, 130, 246, 0.2)',
            zIndex: 0
          }} />

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.08 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: isMobile ? '1.5rem' : '2rem',
                marginBottom: index < steps.length - 1 ? '0' : 0
              }}
            >
              {/* Step Number Circle */}
              <div style={{
                position: 'relative',
                flexShrink: 0,
                zIndex: 1,
                width: isMobile ? '60px' : '70px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  style={{
                    width: isMobile ? '60px' : '70px',
                    height: isMobile ? '60px' : '70px',
                    borderRadius: '50%',
                    background: '#3B82F6',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(59, 130, 246, 0.3)',
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px'
                  }}>
                    <div style={{
                      fontSize: isMobile ? '1.5rem' : '1.75rem',
                      fontWeight: '700',
                      color: '#FFFFFF',
                      lineHeight: 1
                    }}>
                      {step.number}
                    </div>
                    <div style={{
                      fontSize: '0.6rem',
                      fontWeight: '600',
                      color: 'rgba(255, 255, 255, 0.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      lineHeight: 1
                    }}>
                      {step.stage}
                    </div>
                  </div>
                </motion.div>

                {/* Arrow to next step */}
                {index < steps.length - 1 && (
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    bottom: '-30px',
                    transform: 'translateX(-50%)',
                    zIndex: 2,
                    display: 'flex',
                    justifyContent: 'center'
                  }}>
                    <motion.div
                      initial={{ y: -3 }}
                      animate={{ y: 3 }}
                      transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse' }}
                      style={{
                        width: 0,
                        height: 0,
                        borderLeft: '6px solid transparent',
                        borderRight: '6px solid transparent',
                        borderTop: '10px solid rgba(59, 130, 246, 0.3)'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Content Card */}
              <motion.div
                whileHover={{ x: 3 }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '16px',
                  padding: isMobile ? '1.5rem' : '2rem',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  marginBottom: index < steps.length - 1 ? (isMobile ? '2.5rem' : '3rem') : 0,
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Title */}
                <h3 style={{
                  fontSize: isMobile ? '1.1rem' : '1.25rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.75rem',
                  lineHeight: 1.3
                }}>
                  {step.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: isMobile ? '0.9rem' : '0.95rem',
                  color: 'rgba(255, 255, 255, 0.5)',
                  lineHeight: 1.6,
                  marginBottom: '1.25rem'
                }}>
                  {step.description}
                </p>

                {/* Details List */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  {step.details.map((detail, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem'
                    }}>
                      <div style={{
                        width: '4px',
                        height: '4px',
                        borderRadius: '50%',
                        background: '#3B82F6',
                        marginTop: '0.5rem',
                        flexShrink: 0,
                        opacity: 0.6
                      }} />
                      <span style={{
                        fontSize: isMobile ? '0.85rem' : '0.9rem',
                        color: 'rgba(255, 255, 255, 0.6)',
                        lineHeight: 1.5
                      }}>
                        {detail}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}