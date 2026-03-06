"use client"

import { motion } from "framer-motion"
import { BookOpen, Users, Trophy, Target, Brain, CheckCircle } from "lucide-react"

const features = [
  {
    icon: Brain,
    title: "개인 맞춤형 학습",
    description: "AI 기반 약점 분석으로 당신만의 커리큘럼 설계",
    stats: "평균 2등급 상승"
  },
  {
    icon: Users,
    title: "1:1 밀착 관리",
    description: "전담 튜터가 매일 학습 현황 체크 및 피드백",
    stats: "98% 만족도"
  },
  {
    icon: Trophy,
    title: "실전 모의고사",
    description: "실제 수능과 동일한 환경에서 매주 실전 연습",
    stats: "적중률 92%"
  },
  {
    icon: Target,
    title: "목표 대학 관리",
    description: "대학별 입시 전략 수립 및 지속적인 컨설팅",
    stats: "합격률 98%"
  }
]

export default function Features() {
  return (
    <section style={{
      padding: '8rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #050505 100%)',
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
          style={{
            textAlign: 'center',
            marginBottom: '5rem'
          }}
        >
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#0099FF',
            marginBottom: '1rem',
            letterSpacing: '0.1em'
          }}>
            WHY CHOOSE US
          </div>
          <h2 style={{
            fontSize: 'clamp(2rem, 4vw, 3rem)',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>
            박교준 수학이<br />
            <span style={{
              background: 'linear-gradient(90deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              특별한 이유
            </span>
          </h2>
          <p style={{
            fontSize: '1.125rem',
            color: '#808080',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: 1.6
          }}>
            23년간 축적된 노하우와 데이터로
            당신의 성공을 보장합니다
          </p>
        </motion.div>

        {/* Features Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem'
        }}>
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
              style={{
                padding: '2.5rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              {/* Gradient Overlay */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, transparent 0%, rgba(0, 102, 255, 0.5) 50%, transparent 100%)',
                opacity: 0,
                transition: 'opacity 0.3s'
              }} />

              {/* Icon Container */}
              <div style={{
                width: '56px',
                height: '56px',
                background: 'rgba(0, 102, 255, 0.1)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '1.5rem'
              }}>
                <feature.icon size={28} style={{
                  color: '#0099FF'
                }} />
              </div>

              {/* Content */}
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.75rem',
                letterSpacing: '-0.02em'
              }}>
                {feature.title}
              </h3>
              <p style={{
                fontSize: '0.9375rem',
                color: '#808080',
                marginBottom: '1.5rem',
                lineHeight: 1.6
              }}>
                {feature.description}
              </p>

              {/* Stats Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem 1rem',
                background: 'rgba(0, 255, 136, 0.1)',
                borderRadius: '8px'
              }}>
                <CheckCircle size={16} style={{
                  color: '#00FF88'
                }} />
                <span style={{
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#00FF88'
                }}>
                  {feature.stats}
                </span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          style={{
            textAlign: 'center',
            marginTop: '5rem',
            padding: '3rem',
            background: 'rgba(0, 102, 255, 0.05)',
            border: '1px solid rgba(0, 102, 255, 0.1)',
            borderRadius: '24px'
          }}
        >
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '1rem',
            letterSpacing: '-0.02em'
          }}>
            지금 시작하면 <span style={{ color: '#0099FF' }}>3개월 후</span> 당신도 바뀝니다
          </h3>
          <p style={{
            fontSize: '1rem',
            color: '#808080',
            marginBottom: '2rem'
          }}>
            매년 2,000명 이상의 학생들이 박교준 수학과 함께 목표를 달성했습니다
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '1rem 2.5rem',
              background: 'linear-gradient(90deg, #0066FF 0%, #0099FF 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 20px 40px rgba(0, 102, 255, 0.3)',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 102, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 102, 255, 0.3)';
            }}
          >
            무료 상담 신청하기
          </motion.button>
        </motion.div>
      </div>
    </section>
  )
}