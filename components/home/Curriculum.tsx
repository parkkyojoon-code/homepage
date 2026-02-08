"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { Target, TrendingUp, Trophy, Rocket, BookOpen, Brain } from "lucide-react"

const curriculumData = {
  "6등급": [
    { month: "1-2개월", goal: "개념 완벽 정리", target: "5등급 도달", icon: Target, color: "#00DDFF" },
    { month: "3-4개월", goal: "유형별 문제 풀이", target: "3등급 도달", icon: TrendingUp, color: "#0099FF" },
    { month: "5-6개월", goal: "실전 모의고사", target: "1등급 완성", icon: Trophy, color: "#0066FF" }
  ],
  "5등급": [
    { month: "1-2개월", goal: "핵심 개념 강화", target: "4등급 도달", icon: BookOpen, color: "#00B8FF" },
    { month: "3-4개월", goal: "응용 문제 훈련", target: "2등급 도달", icon: Brain, color: "#0088FF" },
    { month: "5-6개월", goal: "최상위권 도전", target: "1등급 완성", icon: Rocket, color: "#0055FF" }
  ],
  "4등급": [
    { month: "1-2개월", goal: "약점 집중 공략", target: "3등급 도달", icon: Target, color: "#00CCFF" },
    { month: "3-4개월", goal: "고난도 문제 정복", target: "2등급 도달", icon: TrendingUp, color: "#0077FF" },
    { month: "5개월", goal: "1등급 안정화", target: "1등급 유지", icon: Trophy, color: "#0044FF" }
  ],
  "3등급": [
    { month: "1-2개월", goal: "심화 개념 학습", target: "2등급 도달", icon: BookOpen, color: "#00AAFF" },
    { month: "3-4개월", goal: "킬러 문항 대비", target: "1등급 도달", icon: Brain, color: "#0066FF" },
    { month: "5개월", goal: "만점 도전", target: "최상위권", icon: Rocket, color: "#0033FF" }
  ],
  "2등급": [
    { month: "1-2개월", goal: "1등급 진입 전략", target: "1등급 도달", icon: Target, color: "#0099FF" },
    { month: "3-4개월", goal: "안정적 1등급", target: "상위 1%", icon: TrendingUp, color: "#0055FF" },
    { month: "5개월", goal: "수능 만점", target: "만점 달성", icon: Trophy, color: "#0022FF" }
  ]
}

export default function Curriculum() {
  const [selectedGrade, setSelectedGrade] = useState("6등급")

  return (
    <section style={{
      padding: '6rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 10% 20%, rgba(0, 102, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 90% 80%, rgba(0, 221, 255, 0.05) 0%, transparent 50%)
        `
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'rgba(0, 102, 255, 0.1)',
              border: '1px solid rgba(0, 102, 255, 0.3)',
              borderRadius: '100px',
              marginBottom: '1.5rem'
            }}
          >
            <span style={{ color: '#0099FF', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
              CURRICULUM
            </span>
          </motion.div>

          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: '900',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            <span style={{ color: '#FFFFFF' }}>당신의 현재 등급에서</span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>1등급까지 가는 길</span>
          </h2>
          <p style={{ color: '#808080', fontSize: '1.2rem' }}>
            체계적인 6개월 로드맵으로 확실한 성적 향상
          </p>
        </motion.div>

        {/* Grade Selector */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4rem' }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.02)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '15px',
            padding: '4px'
          }}>
            {Object.keys(curriculumData).map((grade) => (
              <button
                key={grade}
                onClick={() => setSelectedGrade(grade)}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '12px',
                  fontWeight: '700',
                  transition: 'all 0.3s',
                  border: 'none',
                  cursor: 'pointer',
                  background: selectedGrade === grade
                    ? 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)'
                    : 'transparent',
                  color: selectedGrade === grade ? '#FFFFFF' : '#808080',
                  boxShadow: selectedGrade === grade ? '0 0 20px rgba(0, 102, 255, 0.5)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedGrade !== grade) {
                    e.currentTarget.style.color = '#B0B0B0';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedGrade !== grade) {
                    e.currentTarget.style.color = '#808080';
                  }
                }}
              >
                {grade}
              </button>
            ))}
          </div>
        </div>

        {/* Curriculum Timeline */}
        <motion.div
          key={selectedGrade}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative' }}
        >
          {/* Center Line */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '2px',
            height: '100%',
            background: 'linear-gradient(180deg, rgba(0, 102, 255, 0.2) 0%, rgba(0, 221, 255, 0.2) 100%)',
            display: 'none'
          }} className="md:block" />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {curriculumData[selectedGrade as keyof typeof curriculumData].map((item, index) => {
              const Icon = item.icon
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.2 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexDirection: index % 2 === 0 ? 'row' : 'row-reverse',
                    gap: '2rem'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ textAlign: index % 2 === 0 ? 'right' : 'left' }}>
                      <motion.div
                        whileHover={{ scale: 1.05, y: -5 }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          backdropFilter: 'blur(10px)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '20px',
                          padding: '2rem',
                          display: 'inline-block',
                          position: 'relative',
                          overflow: 'hidden',
                          cursor: 'pointer'
                        }}
                      >
                        {/* Glow Effect */}
                        <div style={{
                          position: 'absolute',
                          top: '-50%',
                          left: '-50%',
                          width: '200%',
                          height: '200%',
                          background: `radial-gradient(circle, ${item.color}15 0%, transparent 70%)`,
                          pointerEvents: 'none'
                        }} />

                        <div style={{ position: 'relative', zIndex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                              width: '48px',
                              height: '48px',
                              background: `linear-gradient(135deg, ${item.color}20 0%, ${item.color}10 100%)`,
                              borderRadius: '12px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <Icon size={24} style={{
                                color: item.color,
                                filter: `drop-shadow(0 0 10px ${item.color}50)`
                              }} />
                            </div>
                            <span style={{
                              color: item.color,
                              fontSize: '0.9rem',
                              fontWeight: '700',
                              letterSpacing: '1px'
                            }}>{item.month}</span>
                          </div>
                          <h3 style={{
                            fontSize: '1.3rem',
                            fontWeight: '800',
                            color: '#FFFFFF',
                            marginBottom: '0.5rem'
                          }}>{item.goal}</h3>
                          <p style={{
                            color: item.color,
                            fontWeight: '600',
                            fontSize: '1rem'
                          }}>
                            목표: {item.target}
                          </p>
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  {/* Center Dot */}
                  <div style={{
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '64px'
                  }} className="md:flex">
                    <div style={{
                      width: '16px',
                      height: '16px',
                      background: `linear-gradient(135deg, ${item.color} 0%, ${item.color}CC 100%)`,
                      borderRadius: '50%',
                      boxShadow: `0 0 20px ${item.color}80`
                    }} />
                  </div>

                  <div style={{ flex: 1, display: 'none' }} className="md:block" />
                </motion.div>
              )
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{ textAlign: 'center', marginTop: '4rem' }}
        >
          <button style={{
            padding: '1rem 2.5rem',
            fontSize: '1.1rem',
            fontWeight: '700',
            background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '100px',
            cursor: 'pointer',
            transition: 'all 0.3s',
            boxShadow: '0 4px 30px rgba(0, 102, 255, 0.3)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 8px 40px rgba(0, 102, 255, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 30px rgba(0, 102, 255, 0.3)';
          }}
          >
            상세 커리큘럼 다운로드 →
          </button>
        </motion.div>
      </div>
    </section>
  )
}