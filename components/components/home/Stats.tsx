"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function Stats() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const stats = [
    { value: "19", unit: "년", label: "연속 최고 합격률" },
    { value: "90", unit: "%", label: "2등급 이상 합격률" },
    { value: "10,000", unit: "+", label: "누적 수강생" },
  ]

  return (
    <section style={{
      padding: isMobile ? '3rem 1rem' : '4rem 1rem',
      background: '#000000'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: isMobile ? '2rem' : '3rem'
      }}>
        {stats.map((stat, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            style={{
              textAlign: 'center',
              padding: '2rem'
            }}
          >
            <div style={{
              fontSize: isMobile ? '3rem' : '4rem',
              fontWeight: '800',
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center'
            }}>
              {stat.value}
              <span style={{ fontSize: '2rem' }}>{stat.unit}</span>
            </div>
            <div style={{
              fontSize: '1rem',
              color: 'rgba(255, 255, 255, 0.6)'
            }}>
              {stat.label}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
