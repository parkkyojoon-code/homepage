"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

export default function TypingEffect() {
  const [isMobile, setIsMobile] = useState(false)
  const [text, setText] = useState("")
  const [showCursor, setShowCursor] = useState(true)

  const lines = [
    "수능 31223도 고려대에",
    "수능 63237도 수석입학으로 이화여대에",
    "수능 올7등급도 홍익대에",
    "수능 5등급도 연세대에",
    "수능 33123도 한양대에",
    "수능 61336도 경희대, 건국대에",
    "수능 515448도 연세대에"
  ]

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Typing effect
  useEffect(() => {
    let lineIndex = 0
    let charIndex = 0
    let isDeleting = false
    let timeout: NodeJS.Timeout

    const type = () => {
      const currentLine = lines[lineIndex]

      if (!isDeleting) {
        // Typing
        setText(currentLine.substring(0, charIndex))
        charIndex++

        if (charIndex > currentLine.length) {
          // Finished typing, wait then delete
          isDeleting = true
          timeout = setTimeout(type, 1000) // Wait 1 second
        } else {
          timeout = setTimeout(type, 60) // Typing speed
        }
      } else {
        // Deleting
        setText(currentLine.substring(0, charIndex))
        charIndex--

        if (charIndex < 0) {
          // Finished deleting, move to next line
          isDeleting = false
          lineIndex = (lineIndex + 1) % lines.length
          charIndex = 0
          timeout = setTimeout(type, 100) // Pause before next line
        } else {
          timeout = setTimeout(type, 30) // Deleting speed
        }
      }
    }

    type()

    return () => clearTimeout(timeout)
  }, [])

  // Cursor blinking
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setShowCursor((prev) => !prev)
    }, 500)
    return () => clearInterval(cursorInterval)
  }, [])

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '5rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>

      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Main container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.8rem'
        }}>
          {/* Title */}
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontSize: isMobile ? '2rem' : '2.5rem',
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            박교준 수리논술에서는
          </motion.h2>

          {/* Modern box with typing effect */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
            style={{
              position: 'relative',
              display: 'inline-block'
            }}
          >
            {/* Main box - clean white border */}
            <div style={{
              position: 'relative',
              background: 'transparent',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '20px',
              padding: isMobile ? '1rem 2.5rem' : '1.3rem 3.5rem',
              minHeight: isMobile ? '60px' : '70px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: isMobile ? '300px' : '500px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}>
                <span style={{
                  fontSize: isMobile ? '1.375rem' : '1.65rem',
                  fontWeight: '600',
                  color: '#00D4FF',
                  letterSpacing: '-0.01em',
                  lineHeight: 1.4,
                  textShadow: '0 0 20px rgba(0, 212, 255, 0.5)'
                }}>
                  {text}
                </span>
                {/* Typing cursor */}
                <span style={{
                  fontSize: isMobile ? '1.375rem' : '1.65rem',
                  fontWeight: '300',
                  color: '#00D4FF',
                  opacity: showCursor ? 1 : 0,
                  transition: 'opacity 0.1s ease'
                }}>
                  |
                </span>
              </div>
            </div>
          </motion.div>

          {/* Bottom text */}
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 1.2 }}
            style={{
              fontSize: isMobile ? '1.75rem' : '2.25rem',
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              marginTop: '0'
            }}
          >
            합격했습니다.
          </motion.h3>
        </div>

      </div>
    </section>
  )
}