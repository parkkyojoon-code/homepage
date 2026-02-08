"use client"

import { motion } from "framer-motion"
import { useState, useEffect, useRef } from "react"
import Image from "next/image"

const reviews = [
  "/reviews/review01.webp",
  "/reviews/review02.png",
  "/reviews/review03.png",
  "/reviews/review04.png",
  "/reviews/review05.png"
]

export default function ReviewScroll() {
  const [isMobile, setIsMobile] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const isScrollingRef = useRef(false)
  const itemsPerPage = 3
  const totalPages = Math.ceil(reviews.length / itemsPerPage)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle scroll event to update current page
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      // Skip if we're programmatically scrolling
      if (isScrollingRef.current) return

      const scrollLeft = container.scrollLeft
      const containerWidth = container.offsetWidth
      const scrollPercentage = scrollLeft / (container.scrollWidth - containerWidth)
      const newPage = Math.round(scrollPercentage * (totalPages - 1))

      setCurrentPage(newPage)
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [totalPages])

  const scrollToPage = (page: number, instant: boolean = false) => {
    const container = containerRef.current
    if (container) {
      // Set flag to prevent scroll event from firing
      isScrollingRef.current = true

      const firstItemIndex = page * itemsPerPage
      if (container.children[firstItemIndex]) {
        const childElement = container.children[firstItemIndex] as HTMLElement
        const scrollPosition = childElement.offsetLeft

        // Manually set the page first
        setCurrentPage(page)

        container.scrollTo({
          left: scrollPosition,
          behavior: instant ? 'instant' : 'smooth'
        })

        // Reset flag after animation completes
        setTimeout(() => {
          isScrollingRef.current = false
        }, instant ? 0 : 500)
      }
    }
  }

  const handlePrev = () => {
    if (currentPage > 0) {
      scrollToPage(currentPage - 1)
    } else {
      // At first page, jump to last page
      scrollToPage(totalPages - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages - 1) {
      scrollToPage(currentPage + 1)
    } else {
      // At last page, jump to first page
      scrollToPage(0)
    }
  }

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 2rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 25% 25%, rgba(0, 212, 255, 0.02) 0%, transparent 50%),
          radial-gradient(circle at 75% 75%, rgba(0, 153, 255, 0.02) 0%, transparent 50%)
        `,
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative'
      }}>

        {/* Main Gallery Container */}
        <div style={{
          position: 'relative'
        }}>
          {/* Left Arrow Button - Always visible */}
          {!isMobile && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePrev}
              style={{
                position: 'absolute',
                left: '-60px',
                top: '40%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)'
                e.currentTarget.style.border = '1px solid rgba(0, 212, 255, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              ←
            </motion.button>
          )}

          {/* Right Arrow Button - Always visible */}
          {!isMobile && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNext}
              style={{
                position: 'absolute',
                right: '-60px',
                top: '40%',
                transform: 'translateY(-50%)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#FFFFFF',
                fontSize: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                zIndex: 10
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)'
                e.currentTarget.style.border = '1px solid rgba(0, 212, 255, 0.4)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.2)'
              }}
            >
              →
            </motion.button>
          )}

          {/* Gallery Scroll Container */}
          <div
            ref={containerRef}
            style={{
              display: 'flex',
              gap: '1.5rem',
              overflowX: 'auto',
              scrollSnapType: 'x mandatory',
              scrollBehavior: 'smooth',
              paddingBottom: '1rem',
              WebkitOverflowScrolling: 'touch',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              transition: 'scroll 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            {reviews.map((review, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.5,
                  delay: index * 0.1
                }}
                style={{
                  flexShrink: 0,
                  scrollSnapAlign: 'center',
                  position: 'relative',
                  width: isMobile ? '85vw' : '450px',
                  height: isMobile ? '60vh' : '600px',
                  maxHeight: isMobile ? '500px' : '600px',
                  cursor: 'pointer',
                  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  marginBottom: '80px'
                }}
                onMouseEnter={(e) => {
                  if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(-10px)'
                    const glow = e.currentTarget.querySelector('.glow-effect') as HTMLElement
                    if (glow) {
                      glow.style.opacity = '1'
                      glow.style.width = '100%'
                      glow.style.height = '80px'
                      glow.style.filter = 'blur(25px)'
                    }
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isMobile) {
                    e.currentTarget.style.transform = 'translateY(0)'
                    const glow = e.currentTarget.querySelector('.glow-effect') as HTMLElement
                    if (glow) {
                      glow.style.opacity = '0.8'
                      glow.style.width = '80%'
                      glow.style.height = '60px'
                      glow.style.filter = 'blur(20px)'
                    }
                  }
                }}
              >
                {/* Image directly without container */}
                <div style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  zIndex: 2
                }}>
                  <Image
                    src={review}
                    alt={`합격 후기 ${index + 1}`}
                    fill
                    style={{
                      objectFit: 'contain'
                    }}
                    sizes="(max-width: 768px) 85vw, 450px"
                    quality={100}
                    priority={index < 3}
                  />
                </div>

                {/* Clean Modern Glow - Hidden on mobile */}
                {!isMobile && (
                  <div
                    className="glow-effect"
                    style={{
                      position: 'absolute',
                      bottom: '-30px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '80%',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'radial-gradient(closest-side, rgba(0, 212, 255, 0.3), transparent)',
                      filter: 'blur(20px)',
                      opacity: 0.8,
                      transition: 'all 0.4s ease',
                      pointerEvents: 'none'
                    }}
                  />
                )}
              </motion.div>
            ))}
          </div>

          {/* Modern Dot Indicators - Only 2 dots for pages */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px',
            marginTop: '2.5rem'
          }}>
            {Array.from({ length: totalPages }, (_, index) => (
              <button
                key={index}
                onClick={() => scrollToPage(index)}
                style={{
                  width: currentPage === index ? '32px' : '10px',
                  height: '10px',
                  borderRadius: '5px',
                  border: 'none',
                  background: currentPage === index
                    ? 'linear-gradient(90deg, #00D4FF 0%, #0099FF 100%)'
                    : 'rgba(255, 255, 255, 0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {currentPage === index && (
                  <motion.div
                    layoutId="activeIndicator"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(90deg, #00D4FF 0%, #0099FF 100%)',
                      borderRadius: '5px'
                    }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Swipe Hint */}
        {isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            style={{
              textAlign: 'center',
              marginTop: '1.5rem'
            }}
          >
            <span style={{
              fontSize: '0.9rem',
              color: 'rgba(255, 255, 255, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <motion.span
                animate={{ x: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                ← →
              </motion.span>
              스와이프하여 더 보기
            </span>
          </motion.div>
        )}
      </div>

      <style jsx>{`
        div::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      {/* More Success Stories CTA - Clean Design */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        style={{
          marginTop: '6rem',
          padding: '5rem 1rem',
          position: 'relative',
          textAlign: 'center'
        }}
      >
        <div style={{
          maxWidth: '700px',
          margin: '0 auto'
        }}>
          {/* Main Text */}
          <motion.h3
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontSize: isMobile ? '1.75rem' : '2.25rem',
              fontWeight: '700',
              color: '#FFFFFF',
              lineHeight: 1.5,
              marginBottom: '1rem'
            }}
          >
            이 외에도 역전 합격 사례는 너무 많아
          </motion.h3>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              fontSize: isMobile ? '1.5rem' : '1.875rem',
              fontWeight: '600',
              color: 'rgba(255, 255, 255, 0.8)',
              marginBottom: '4rem'
            }}
          >
            다 담을 수 없습니다.
          </motion.p>

          {/* Divider Line */}
          <motion.div
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              width: '60px',
              height: '1px',
              background: 'rgba(255, 255, 255, 0.2)',
              margin: '0 auto 4rem auto'
            }}
          />

          {/* Sub Text */}
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            style={{
              fontSize: isMobile ? '1.1rem' : '1.25rem',
              color: 'rgba(255, 255, 255, 0.6)',
              marginBottom: '1rem'
            }}
          >
            더 궁금하시다면
          </motion.p>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            style={{
              fontSize: isMobile ? '1rem' : '1.125rem',
              color: 'rgba(255, 255, 255, 0.5)',
              marginBottom: '3rem'
            }}
          >
            아래 링크를 클릭하세요
          </motion.p>

          {/* CTA Button */}
          <motion.a
            href="#"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.5 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              padding: isMobile ? '1rem 2.5rem' : '1.125rem 3rem',
              fontSize: isMobile ? '1.05rem' : '1.125rem',
              fontWeight: '600',
              color: '#FFFFFF',
              background: 'transparent',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '100px',
              textDecoration: 'none',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#FFFFFF'
              e.currentTarget.style.color = '#000000'
              e.currentTarget.style.borderColor = '#FFFFFF'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#FFFFFF'
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)'
            }}
          >
            더 많은 합격 사례 보기
            <motion.span
              animate={{ x: [0, 5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ display: 'inline-block' }}
            >
              →
            </motion.span>
          </motion.a>
        </div>
      </motion.div>
    </section>
  )
}