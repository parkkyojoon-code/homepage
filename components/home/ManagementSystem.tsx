"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { CheckCircle, MessageSquare, FileText, Clock, Users, BookOpen, Award } from "lucide-react"

export default function ManagementSystem() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const steps = [
    { icon: CheckCircle, title: "과제", desc: "매주 체계적인 과제 제공" },
    { icon: FileText, title: "시험", desc: "주기적 실력 점검 테스트" },
    { icon: MessageSquare, title: "알림", desc: "카카오톡 실시간 알림" },
    { icon: Award, title: "피드백", desc: "개인별 맞춤 피드백" },
    { icon: BookOpen, title: "무한 연습", desc: "반복 학습 콘텐츠" },
    { icon: Users, title: "첨삭", desc: "논술 답안 첨삭 시스템" },
    { icon: Clock, title: "맞춤 관리", desc: "1:1 학습 관리" }
  ]

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #050510 100%)'
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
            <span style={{ color: '#0099FF' }}>7단계</span> 관리 시스템
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            합격까지 철저하게 관리합니다
          </p>
        </motion.div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                minWidth: isMobile ? '100%' : '200px'
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: 'rgba(0, 102, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <step.icon size={18} style={{ color: '#0099FF' }} />
              </div>
              <div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: '700',
                  color: '#FFFFFF'
                }}>
                  {step.title}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  {step.desc}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
