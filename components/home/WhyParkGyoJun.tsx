"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function WhyParkGyoJun() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const features = [
    {
      number: "1",
      title: "전국 최고 합격률이 증명해 주는 강사",
      description: [
        "최종 수능 수학 2등급만 맞춰오면 90% 이상 합격.",
        "3등급 이하도 30% 가까이 합격.",
        "19년간, 수천 명의 학생들이 직접 증명.",
        "결과로 말하는 수업, 말이 아닌 '합격률'로 증명하는 강사입니다."
      ]
    },
    {
      number: "2",
      title: "100% 적중 신화를 쓰고 있는 자체 콘텐츠를 갖춘 강사",
      description: [
        "매년 논술 시험의 출제 경향을 완벽하게 분석한 독자적 콘텐츠로 압도적 합격률 기록.",
        "단순히 기출 문제 풀이에 그치지 않고 출제 원리까지 꿰뚫는 콘텐츠로 모든 유형에 반응할 수 있게 학습시킵니다."
      ]
    },
    {
      number: "3",
      title: "수학 실력 자체를 끌어올리는 추론모듈 수업",
      description: [
        "시험 스킬만 가르치는 수업 아닙니다.",
        "이 수업은 학생의 수학적 사고력과 문제 해결 능력을 본질부터 끌어올립니다.",
        "심지어 수능 수학 등급도 함께 올라가는 효과를 확인할 수 있습니다."
      ]
    },
    {
      number: "4",
      title: "압도적인 높은 학생 만족도",
      description: [
        "수강생들이 직접 느끼는 차원이 다른 수업 퀄리티.",
        "수학 실력이 좋은 학생들이 이 수업을 좋아하는 데는 이유가 있습니다.",
        "단순히 강의를 듣고 끝나는 것이 아니라, 매 수업마다 성장을 느낄 수 있습니다."
      ]
    },
    {
      number: "5",
      title: "수능에 영향이 없도록 시간 투자를 최소화시켜주는 수업",
      description: [
        "이 수업은 학생이 '정시파이터'라고 가정하고 설계되었습니다.",
        "논술 준비에 시간을 많이 할애할 필요 없습니다.",
        "주당 3시간 수업 + 매주 2~3시간 자율 학습만으로도 논술을 완벽하게 준비할 수 있습니다."
      ]
    },
    {
      number: "6",
      title: "모든 대학을 한 번에 준비 시켜주는 수업",
      description: [
        "특정 대학만 대비하는 비효율적인 수업이 아닙니다.",
        "이 수업은 모든 대학의 수리논술을 한 번에 대비할 수 있도록 설계되었습니다.",
        "그러니 처음부터 대학을 정해놓고 갈 필요가 전혀 없습니다."
      ],
      footer: "이 수업 하나로 모든 대학을 준비할 수 있습니다."
    }
  ]

  return (
    <section style={{
      minHeight: '100vh',
      background: '#0A0A0A',
      position: 'relative',
      padding: isMobile ? '4rem 1rem' : '8rem 2rem'
    }}>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '4rem' : '6rem'
          }}
        >
          <p style={{
            fontSize: isMobile ? '0.875rem' : '1rem',
            color: '#3B82F6',
            fontWeight: '600',
            letterSpacing: '0.1em',
            marginBottom: '1rem',
            textTransform: 'uppercase'
          }}>
            Why Choose Us
          </p>
          <h2 style={{
            fontSize: isMobile ? '3rem' : '4.5rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem',
            letterSpacing: '-0.03em',
            lineHeight: 1.1
          }}>
            왜, <span style={{
              background: 'linear-gradient(135deg, #60A5FA, #3B82F6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>박교준</span>인가?
          </h2>
          <p style={{
            fontSize: isMobile ? '1rem' : '1.125rem',
            color: 'rgba(255, 255, 255, 0.6)',
            fontWeight: '400'
          }}>
            6가지 차별화된 강점
          </p>
        </motion.div>

        {/* Features Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: isMobile ? '3rem' : '4rem'
        }}>
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                padding: isMobile ? '2rem' : '2.5rem',
                background: '#0F0F0F',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Large Number Background */}
              <div style={{
                position: 'absolute',
                top: '-20px',
                right: '20px',
                fontSize: '8rem',
                fontWeight: '800',
                color: 'rgba(107, 114, 128, 0.05)',
                lineHeight: 1,
                userSelect: 'none',
                pointerEvents: 'none'
              }}>
                {feature.number}
              </div>

              {/* Number Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                background: 'linear-gradient(135deg, #3B82F6, #1E40AF)',
                borderRadius: '10px',
                marginBottom: '1.5rem'
              }}>
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#FFFFFF'
                }}>
                  {feature.number}
                </span>
              </div>

              {/* Title */}
              <h3 style={{
                fontSize: isMobile ? '1.25rem' : '1.375rem',
                fontWeight: '600',
                color: '#FFFFFF',
                marginBottom: '1.5rem',
                lineHeight: 1.4
              }}>
                {feature.title}
              </h3>

              {/* Description */}
              <div style={{
                fontSize: isMobile ? '0.925rem' : '1rem',
                color: 'rgba(255, 255, 255, 0.7)',
                lineHeight: 1.7
              }}>
                {feature.description.map((desc, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    marginBottom: idx < feature.description.length - 1 ? '1rem' : 0
                  }}>
                    <span style={{
                      color: '#3B82F6',
                      marginRight: '0.75rem',
                      fontSize: '1.25rem',
                      lineHeight: 1.2
                    }}>•</span>
                    <span>{desc}</span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              {feature.footer && (
                <div style={{
                  marginTop: '2rem',
                  paddingTop: '1.5rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)'
                }}>
                  <p style={{
                    color: '#60A5FA',
                    fontWeight: '500',
                    fontSize: isMobile ? '0.925rem' : '1rem'
                  }}>
                    → {feature.footer}
                  </p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}