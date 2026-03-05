"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { ArrowRight } from "lucide-react"

export default function CourseConsultation() {
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
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: isMobile ? '3rem 1.5rem' : '4rem 3rem',
            textAlign: 'center'
          }}
        >
          {/* Main Text */}
          <p style={{
            fontSize: isMobile ? '1rem' : '1.125rem',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '1rem',
            lineHeight: 1.6
          }}>
            그래도 본인에게 어떤 수업이 잘 맞을지 고민되신다면,
          </p>

          <h3 style={{
            fontSize: isMobile ? '1.5rem' : '1.875rem',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '2.5rem',
            lineHeight: 1.4
          }}>
            학생에게 맞는 수업을 찾아드리겠습니다.
          </h3>

          {/* CTA Button */}
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
              padding: '1rem 2.5rem',
              background: '#FFFFFF',
              border: 'none',
              borderRadius: '100px',
              color: '#000000',
              fontSize: '1.1rem',
              fontWeight: '700',
              textDecoration: 'none',
              cursor: 'pointer',
              transition: 'all 0.3s'
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
