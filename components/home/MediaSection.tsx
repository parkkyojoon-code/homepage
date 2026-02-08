"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Play, Youtube, MessageCircle, ChevronLeft, ChevronRight } from "lucide-react"
import { useState, useEffect } from "react"

const videos = [
  {
    id: "Vt-tvpLHjF8",
    title: "수학 5등급에서 1등급 찍는 '미친' 수학 공부법",
    views: "조회수 52만",
    duration: "24:35"
  },
  {
    id: "jwqGhBunZ4g",
    title: "수능 수학 만점 전략 - 킬러문항 완벽 분석",
    views: "조회수 38만",
    duration: "18:20"
  },
  {
    id: "4JxGN2_Vxpk",
    title: "수리논술 합격의 핵심 비법 공개",
    views: "조회수 29만",
    duration: "15:45"
  },
  {
    id: "uBQYI9OP_2M",
    title: "6등급→1등급 실제 성공 사례",
    views: "조회수 21만",
    duration: "12:30"
  }
]

export default function MediaSection() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto scroll
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % videos.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev === 0 ? videos.length - 1 : prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length)
  }

  const getCardStyle = (index: number) => {
    const diff = index - currentIndex
    const normalizedDiff = ((diff + videos.length) % videos.length)
    
    // 현재 카드
    if (normalizedDiff === 0) {
      return {
        scale: 1,
        x: 0,
        zIndex: 10,
        opacity: 1,
        filter: 'brightness(1)'
      }
    }
    // 오른쪽 카드
    if (normalizedDiff === 1) {
      return {
        scale: isMobile ? 0.7 : 0.75,
        x: isMobile ? 200 : 350,
        zIndex: 5,
        opacity: 0.6,
        filter: 'brightness(0.5)'
      }
    }
    // 왼쪽 카드
    if (normalizedDiff === videos.length - 1) {
      return {
        scale: isMobile ? 0.7 : 0.75,
        x: isMobile ? -200 : -350,
        zIndex: 5,
        opacity: 0.6,
        filter: 'brightness(0.5)'
      }
    }
    // 숨겨진 카드들
    return {
      scale: 0.5,
      x: normalizedDiff > videos.length / 2 ? -500 : 500,
      zIndex: 1,
      opacity: 0,
      filter: 'brightness(0.3)'
    }
  }

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Effects */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 50% 50%, rgba(255, 0, 0, 0.05) 0%, transparent 50%)
        `
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: isMobile ? '2rem' : '3rem' }}
        >
          <h2 style={{
            fontSize: 'clamp(1.8rem, 4vw, 3rem)',
            fontWeight: '800',
            marginBottom: '1rem',
            lineHeight: 1.2,
            letterSpacing: '-0.03em'
          }}>
            <span style={{ color: '#FFFFFF' }}>박교준 수학을</span>{' '}
            <span style={{
              background: 'linear-gradient(135deg, #FF0000 0%, #FF6666 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>영상으로</span>
            <span style={{ color: '#FFFFFF' }}> 만나보세요</span>
          </h2>
        </motion.div>

        {/* Carousel Container */}
        <div style={{ 
          position: 'relative', 
          height: isMobile ? '280px' : '400px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {/* Navigation Buttons */}
          <button
            onClick={handlePrev}
            style={{
              position: 'absolute',
              left: isMobile ? '10px' : '50px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              transition: 'all 0.3s'
            }}
          >
            <ChevronLeft size={isMobile ? 20 : 24} />
          </button>
          
          <button
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: isMobile ? '10px' : '50px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: isMobile ? '40px' : '48px',
              height: isMobile ? '40px' : '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 20,
              transition: 'all 0.3s'
            }}
          >
            <ChevronRight size={isMobile ? 20 : 24} />
          </button>

          {/* Video Cards */}
          <div style={{
            position: 'relative',
            width: isMobile ? '280px' : '500px',
            height: '100%'
          }}>
            {videos.map((video, index) => {
              const style = getCardStyle(index)
              return (
                <motion.a
                  key={video.id}
                  href={`https://youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  animate={{
                    scale: style.scale,
                    x: style.x,
                    zIndex: style.zIndex,
                    opacity: style.opacity
                  }}
                  transition={{ 
                    type: 'spring', 
                    stiffness: 300, 
                    damping: 30 
                  }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginLeft: isMobile ? '-140px' : '-250px',
                    marginTop: isMobile ? '-125px' : '-175px',
                    width: isMobile ? '280px' : '500px',
                    background: 'rgba(20, 20, 20, 0.9)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    textDecoration: 'none',
                    filter: style.filter
                  }}
                  onClick={(e) => {
                    if (index !== currentIndex) {
                      e.preventDefault()
                      setCurrentIndex(index)
                    }
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    position: 'relative',
                    aspectRatio: '16/9',
                    background: `url(https://img.youtube.com/vi/${video.id}/maxresdefault.jpg) center/cover`,
                    backgroundColor: '#1a1a1a'
                  }}>
                    {/* Play Button Overlay */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: isMobile ? '50px' : '70px',
                      height: isMobile ? '50px' : '70px',
                      background: 'rgba(255, 0, 0, 0.9)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 30px rgba(255, 0, 0, 0.5)'
                    }}>
                      <Play size={isMobile ? 20 : 28} style={{ color: '#FFFFFF', marginLeft: '3px', fill: '#FFFFFF' }} />
                    </div>
                    {/* Duration Badge */}
                    <div style={{
                      position: 'absolute',
                      bottom: '10px',
                      right: '10px',
                      background: 'rgba(0, 0, 0, 0.8)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: isMobile ? '0.7rem' : '0.85rem',
                      color: '#FFFFFF',
                      fontWeight: '500'
                    }}>
                      {video.duration}
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div style={{ padding: isMobile ? '1rem' : '1.25rem' }}>
                    <h4 style={{
                      fontWeight: '700',
                      color: '#FFFFFF',
                      marginBottom: '0.5rem',
                      fontSize: isMobile ? '0.9rem' : '1.1rem',
                      letterSpacing: '-0.01em',
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{video.title}</h4>
                    <p style={{ color: '#808080', fontSize: isMobile ? '0.8rem' : '0.9rem' }}>
                      {video.views}
                    </p>
                  </div>
                </motion.a>
              )
            })}
          </div>
        </div>

        {/* Dots Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '2rem'
        }}>
          {videos.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              style={{
                width: currentIndex === index ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: currentIndex === index ? '#FF0000' : 'rgba(255, 255, 255, 0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '1rem',
            flexWrap: 'wrap',
            marginTop: '2.5rem'
          }}
        >
          {/* 수업 상담하기 (카카오채널) */}
          <motion.a
            href="http://pf.kakao.com/_YFDjn"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.875rem 1.5rem' : '1rem 2rem',
              background: 'linear-gradient(135deg, #FEE500 0%, #E5CF00 100%)',
              borderRadius: '100px',
              color: '#000000',
              fontSize: isMobile ? '0.9rem' : '1rem',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'all 0.3s',
              boxShadow: '0 4px 30px rgba(254, 229, 0, 0.3)',
              border: 'none'
            }}
          >
            <MessageCircle size={isMobile ? 18 : 20} />
            수업 상담하기
          </motion.a>

          {/* YouTube 채널 */}
          <motion.a
            href="https://www.youtube.com/@수학천재박교준"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.98 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: isMobile ? '0.875rem 1.5rem' : '1rem 2rem',
              background: 'transparent',
              border: '2px solid #FF0000',
              borderRadius: '100px',
              color: '#FF0000',
              fontSize: isMobile ? '0.9rem' : '1rem',
              fontWeight: '700',
              textDecoration: 'none',
              transition: 'all 0.3s'
            }}
          >
            <Youtube size={isMobile ? 18 : 20} />
            YouTube 채널
          </motion.a>
        </motion.div>
      </div>
    </section>
  )
}
