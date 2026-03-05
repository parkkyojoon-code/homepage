"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import { useState, useEffect } from "react"

export default function FinalCTA() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <section id="contact" style={{
      padding: isMobile ? '5rem 1rem' : '8rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle Background Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.08) 0%, transparent 50%)'
      }} />

      <div style={{
        maxWidth: '700px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center'
          }}
        >
          {/* Main Heading */}
          <h2 style={{
            fontSize: isMobile ? 'clamp(1.75rem, 6vw, 2.5rem)' : 'clamp(2rem, 4vw, 2.75rem)',
            fontWeight: '800',
            marginBottom: '1.5rem',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            color: '#FFFFFF'
          }}>
            아직 고민되시나요? 걱정 마세요.
          </h2>

          {/* Subheading */}
          <p style={{
            fontSize: isMobile ? '1rem' : '1.125rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '0.75rem',
            lineHeight: 1.6
          }}>
            혼자 고민하기엔 시간이 너무 아깝습니다.
          </p>

          <p style={{
            fontSize: isMobile ? '1rem' : '1.125rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '3rem',
            lineHeight: 1.6
          }}>
            가장 확실한 방법을 찾을 수 있도록 도와드릴게요.
          </p>

          {/* Primary CTA Button - 카카오톡 상담 */}
          <motion.a
            href="http://pf.kakao.com/_YFDjn/chat"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1.125rem 2.5rem',
              background: 'linear-gradient(90deg, #0066FF 0%, #0099FF 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: '700',
              boxShadow: '0 20px 40px rgba(0, 102, 255, 0.3)',
              cursor: 'pointer',
              transition: 'all 0.3s',
              letterSpacing: '-0.01em',
              textDecoration: 'none'
            }}
          >
            수업 상담하기
            <ArrowRight size={20} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
