"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Target, TrendingUp, Award } from "lucide-react"

export default function TargetAudience() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const audiences = [
    {
      icon: Target,
      title: "내신은 낮지만",
      highlight: "높은 대학을 원하는 학생",
      description: "내신 3~7등급도 상위권 대학 합격 가능"
    },
    {
      icon: TrendingUp,
      title: "수능 외에",
      highlight: "플랜B가 필요한 학생",
      description: "수능 실패 시 논술로 역전 기회 확보"
    },
    {
      icon: Award,
      title: "수학 실력으로",
      highlight: "대학 가고 싶은 학생",
      description: "수학만 잘하면 원하는 대학 진학 가능"
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
            marginBottom: '1rem',
            color: '#FFFFFF'
          }}>
            이런 학생에게 <span style={{ color: '#0099FF' }}>추천</span>합니다
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '1.5rem'
        }}>
          {audiences.map((item, index) => (
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
                textAlign: 'center'
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '16px',
                background: 'rgba(0, 102, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1.5rem'
              }}>
                <item.icon size={28} style={{ color: '#0099FF' }} />
              </div>
              <h3 style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '0.25rem'
              }}>
                {item.title}
              </h3>
              <h4 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '1rem'
              }}>
                {item.highlight}
              </h4>
              <p style={{
                fontSize: '0.9rem',
                color: 'rgba(255, 255, 255, 0.5)',
                lineHeight: 1.6
              }}>
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
