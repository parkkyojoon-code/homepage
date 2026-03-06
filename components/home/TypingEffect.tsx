"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function TypingEffect() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const quotes = [
    { grade: "6등급", result: "연세대 합격", highlight: "연세대" },
    { grade: "5등급", result: "고려대 합격", highlight: "고려대" },
    { grade: "4등급", result: "서강대 합격", highlight: "서강대" },
    { grade: "7등급", result: "한양대 합격", highlight: "한양대" },
  ]

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #050510 100%)',
      overflow: 'hidden'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        textAlign: 'center'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ marginBottom: '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? '1.75rem' : '2.25rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            실제 <span style={{ color: '#0099FF' }}>합격 사례</span>
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            내신과 상관없이, 수학 실력만으로 상위권 대학 합격
          </p>
        </motion.div>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '1rem'
        }}>
          {quotes.map((quote, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '12px',
                padding: '1.5rem 2rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem'
              }}
            >
              <span style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.5)'
              }}>
                내신 {quote.grade}
              </span>
              <span style={{ color: 'rgba(255, 255, 255, 0.3)' }}>→</span>
              <span style={{
                fontSize: '1.125rem',
                fontWeight: '700',
                color: '#0099FF'
              }}>
                {quote.highlight}
              </span>
              <span style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                합격
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
