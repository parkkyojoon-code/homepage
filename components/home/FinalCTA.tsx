"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export default function FinalCTA() {
  return (
    <section style={{
      padding: '5rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <div style={{
        maxWidth: '1200px',
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
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            paddingTop: '4rem',
            textAlign: 'center'
          }}
        >
          <h2 style={{
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            fontWeight: '800',
            marginBottom: '0.75rem',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            color: '#FFFFFF'
          }}>
            아직 고민되시나요? 걱정 마세요.
          </h2>

          <p style={{
            fontSize: 'clamp(0.95rem, 1.5vw, 1.05rem)',
            color: '#808080',
            marginBottom: '2rem',
            lineHeight: 1.7,
            letterSpacing: '-0.01em'
          }}>
            혼자 고민하기엔 시간이 너무 아깝습니다.<br />
            가장 확실한 방법을 찾을 수 있도록 도와드릴게요.
          </p>

          <motion.a
            href="http://pf.kakao.com/_YFDjn/chat"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.875rem 2rem',
              background: 'linear-gradient(90deg, #0066FF 0%, #0099FF 100%)',
              border: 'none',
              borderRadius: '100px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 8px 30px rgba(0, 102, 255, 0.35)',
              cursor: 'pointer',
              letterSpacing: '-0.01em'
            }}
          >
            수업 상담하기
            <ArrowRight size={16} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
