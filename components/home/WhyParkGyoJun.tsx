"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Target, Zap, Users, BarChart3 } from "lucide-react"

export default function WhyParkGyoJun() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const reasons = [
    {
      icon: Target,
      title: "100% 적중 신화",
      description: "19년간 축적된 출제 경향 분석으로 매년 적중"
    },
    {
      icon: Zap,
      title: "추론모듈 수업",
      description: "수학적 사고력을 근본부터 향상시키는 독자적 교육법"
    },
    {
      icon: Users,
      title: "1:1 맞춤 관리",
      description: "카카오톡 관리방을 통한 실시간 피드백과 첨삭"
    },
    {
      icon: BarChart3,
      title: "검증된 합격률",
      description: "수능 2등급 이상 학생 90% 합격이라는 압도적 결과"
    }
  ]

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: '#000000'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? '1.75rem' : '2.25rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            왜 <span style={{ color: '#0099FF' }}>박교준</span>인가요?
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            19년간 결과로 증명해온 차별화된 시스템
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '1.5rem'
        }}>
          {reasons.map((reason, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                padding: '2rem',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start'
              }}
            >
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '12px',
                background: 'rgba(0, 102, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <reason.icon size={24} style={{ color: '#0099FF' }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.5rem'
                }}>
                  {reason.title}
                </h3>
                <p style={{
                  fontSize: '0.95rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  lineHeight: 1.6
                }}>
                  {reason.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
