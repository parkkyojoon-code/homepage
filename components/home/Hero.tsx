"use client"

import { motion } from "framer-motion"
import { ChevronDown, Sparkles, Zap } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"

export default function Hero() {
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
      position: 'relative',
      minHeight: '70vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#000000',
      overflow: 'hidden',
      paddingBottom: '2rem'
    }}>
      {/* Animated Background Effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 30% 20%, rgba(0, 102, 255, 0.15) 0%, transparent 50%),
          radial-gradient(circle at 70% 80%, rgba(0, 184, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 10% 50%, rgba(0, 102, 255, 0.08) 0%, transparent 50%)
        `
      }} />

      {/* Floating Particles */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {[...Array(20)].map((_, i) => {
          const left = ((i * 37) % 100);
          const top = ((i * 53) % 100);
          const duration = 10 + (i % 10);
          const delay = i * 0.25;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                width: '2px',
                height: '2px',
                background: '#0066FF',
                boxShadow: '0 0 10px #0066FF',
                borderRadius: '50%',
                left: `${left}%`,
                top: `${top}%`,
                animation: `float ${duration}s ease-in-out infinite`,
                animationDelay: `${delay}s`
              }}
            />
          );
        })}
      </div>

      {/* Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        padding: '0 20px',
        maxWidth: '1400px',
        margin: '0 auto',
        width: '100%'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '1.2rem'
            }}
          >
            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#0099FF',
              boxShadow: '0 0 10px #0099FF'
            }}/>
            <span style={{
              fontSize: isMobile ? '14px' : '16px',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 1)',
              letterSpacing: '0.5px',
              position: 'relative'
            }}>
              19년간 국내 최고 합격률
              <span style={{
                position: 'absolute',
                bottom: '-2px',
                left: 0,
                right: 0,
                height: '1px',
                background: 'linear-gradient(90deg, #0099FF 0%, transparent 100%)',
                opacity: 0.6
              }}/>
            </span>
            <div style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: '#0099FF',
              boxShadow: '0 0 10px #0099FF'
            }}/>
          </motion.div>

          {/* Main Title */}
          <h1 style={{
            fontSize: isMobile ? 'clamp(2rem, 8vw, 3rem)' : 'clamp(2.5rem, 5vw, 4.5rem)',
            fontWeight: '800',
            marginBottom: isMobile ? '1rem' : '1.5rem',
            lineHeight: 1.1,
            letterSpacing: '-0.02em'
          }}>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              style={{
                display: 'block',
                color: '#FFFFFF',
                marginBottom: '0.5rem',
                fontSize: isMobile ? '0.6em' : '0.7em',
                fontWeight: '400',
                opacity: 0.85
              }}
            >
              수학만으로 성적보다
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              style={{
                display: 'block',
                marginBottom: '0.2rem',
                background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                fontSize: isMobile ? '1em' : '1.1em',
                fontWeight: '900'
              }}
            >
              더 높은 대학 가고 싶은
            </motion.span>
            <motion.span
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              style={{
                display: 'block',
                color: '#FFFFFF'
              }}
            >
              학생 찾습니다
            </motion.span>
          </h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            style={{
              fontSize: 'clamp(1.1rem, 2vw, 1.3rem)',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '3rem',
              lineHeight: 1.6,
              fontWeight: '400'
            }}
          >
            최종 수능수학{' '}
            <span style={{
              color: '#00DDFF',
              fontWeight: '700'
            }}>
              2등급 이상 90% 합격
            </span>
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              flexWrap: 'wrap',
              gap: isMobile ? '0.75rem' : '1rem',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: isMobile ? '5rem' : '6rem',
              padding: isMobile ? '0 1rem' : '0'
            }}
          >
            <Link href="/classes" style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? '280px' : 'none' }}>
              <button
                style={{
                  padding: isMobile ? '16px 24px' : '14px 32px',
                  fontSize: isMobile ? '0.95rem' : '1rem',
                  fontWeight: '600',
                  background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  boxShadow: '0 4px 30px rgba(0, 102, 255, 0.3)',
                  position: 'relative',
                  overflow: 'hidden',
                  width: '100%'
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
                <span style={{ position: 'relative', zIndex: 1 }}>수업 신청하기</span>
                <Zap size={20} style={{ display: 'inline', marginLeft: '8px', verticalAlign: 'middle' }} />
              </button>
            </Link>

            <Link href="/classes" style={{ textDecoration: 'none', width: isMobile ? '100%' : 'auto', maxWidth: isMobile ? '280px' : 'none' }}>
              <button
                style={{
                  padding: isMobile ? '16px 24px' : '14px 32px',
                  fontSize: isMobile ? '0.95rem' : '1rem',
                  fontWeight: '600',
                  background: 'transparent',
                  color: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.3s',
                  backdropFilter: 'blur(10px)',
                  width: '100%'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.5)';
                  e.currentTarget.style.background = 'rgba(0, 102, 255, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                커리큘럼 확인하기
              </button>
            </Link>
          </motion.div>

        </motion.div>

        {/* Scroll Indicator - 더 아래로 */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{
              opacity: { delay: 1.2, duration: 0.5 },
              y: { delay: 1.2, duration: 2, repeat: Infinity }
            }}
            style={{
              position: 'absolute',
              bottom: '-30px',
              left: '50%',
              transform: 'translateX(-50%)',
              cursor: 'pointer'
            }}
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            <ChevronDown size={28} style={{
              color: 'rgba(255, 255, 255, 0.4)'
            }} />
          </motion.div>
        )}
      </div>
    </section>
  )
}