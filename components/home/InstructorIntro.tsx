"use client"

import { motion } from "framer-motion"
import { MessageCircle, Play } from "lucide-react"
import { useState, useEffect } from "react"

export default function InstructorIntro() {
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
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 20% 50%, rgba(0, 102, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 80% 50%, rgba(0, 184, 255, 0.05) 0%, transparent 50%)
        `
      }} />

      <div style={{
        maxWidth: '1000px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Section Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? 'clamp(1.75rem, 6vw, 2.5rem)' : 'clamp(2rem, 5vw, 3rem)',
            fontWeight: '900',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            <span style={{ color: '#FFFFFF' }}>박교준 수학을 </span>
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>영상으로</span>
            <span style={{ color: '#FFFFFF' }}> 만나보세요</span>
          </h2>
        </motion.div>

        {/* YouTube Video Embed */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            position: 'relative',
            width: '100%',
            paddingBottom: '56.25%', // 16:9 aspect ratio
            borderRadius: '20px',
            overflow: 'hidden',
            marginBottom: '3rem',
            boxShadow: '0 20px 60px rgba(0, 102, 255, 0.2)'
          }}
        >
          <iframe
            src="https://www.youtube.com/embed/jwqGhBunZ4g"
            title="박교준 수학 소개 영상"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none'
            }}
          />
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            gap: '1rem',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {/* 카카오톡 상담 버튼 */}
          <a
            href="http://pf.kakao.com/_YFDjn/chat"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: '#FEE500',
              border: 'none',
              borderRadius: '100px',
              color: '#000000',
              fontSize: '1.1rem',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'all 0.3s',
              boxShadow: '0 4px 20px rgba(254, 229, 0, 0.3)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-3px)';
              e.currentTarget.style.boxShadow = '0 8px 30px rgba(254, 229, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(254, 229, 0, 0.3)';
            }}
          >
            <MessageCircle size={22} />
            <span>수업 상담하기</span>
          </a>

          {/* 유튜브 채널 버튼 */}
          <a
            href="https://www.youtube.com/@수학천재박교준"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1rem 2rem',
              background: 'transparent',
              border: '2px solid rgba(255, 0, 0, 0.5)',
              borderRadius: '100px',
              color: '#FF0000',
              fontSize: '1.1rem',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 0, 0, 0.1)';
              e.currentTarget.style.borderColor = '#FF0000';
              e.currentTarget.style.transform = 'translateY(-3px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(255, 0, 0, 0.5)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <Play size={22} />
            <span>YouTube 채널</span>
          </a>
        </motion.div>
      </div>
    </section>
  )
}