"use client"

import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"

export default function FinalCTA() {
  return (
    <section id="contact" style={{
      padding: '6rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle Background Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.08) 0%, transparent 60%)'
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
            fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
            fontWeight: '800',
            marginBottom: '1.25rem',
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            color: '#FFFFFF'
          }}>
            아직 고민되시나요? 걱정 마세요.
          </h2>

          {/* Subheading */}
          <p style={{
            fontSize: 'clamp(1rem, 2vw, 1.25rem)',
            color: '#808080',
            marginBottom: '2.5rem',
            lineHeight: 1.6,
            letterSpacing: '-0.01em'
          }}>
            혼자 고민하기엔 시간이 너무 아깝습니다.<br />
            가장 확실한 방법을 찾을 수 있도록 도와드릴게요.
          </p>

          {/* Single KakaoTalk Button */}
          <motion.a
            href="http://pf.kakao.com/_YFDjn/chat"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              padding: '1rem 2.25rem',
              background: 'linear-gradient(90deg, #0066FF 0%, #0099FF 100%)',
              border: 'none',
              borderRadius: '10px',
              color: '#FFFFFF',
              fontSize: '1.05rem',
              fontWeight: '700',
              textDecoration: 'none',
              boxShadow: '0 16px 40px rgba(0, 102, 255, 0.3)',
              cursor: 'pointer',
              letterSpacing: '-0.01em'
            }}
          >
            수업 상담하기
            <ArrowRight size={18} />
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
