"use client"

import { motion, useMotionValue, useTransform, animate } from "framer-motion"
import { useEffect, useState } from "react"

const stats = [
  {
    number: 2628,
    suffix: "+",
    label: "누적 수강생",
    description: ""
  },
  {
    number: 92,
    suffix: "%",
    label: "19년간 합격률(2등급)",
    description: ""
  },
  {
    number: 1987,
    suffix: "+",
    label: "누적 합격생",
    description: ""
  }
]

function Counter({ from, to, duration = 2 }: { from: number; to: number; duration?: number }) {
  const [value, setValue] = useState(from)

  useEffect(() => {
    const controls = animate(from, to, {
      duration,
      onUpdate: (latest) => {
        setValue(Number.isInteger(to) ? Math.floor(latest) : parseFloat(latest.toFixed(1)))
      }
    })
    return () => controls.stop()
  }, [from, to, duration])

  return <>{value}</>
}

export default function Stats() {
  const [isInView, setIsInView] = useState(false)
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
      padding: isMobile ? '3rem 1rem 4rem 1rem' : '5rem 1rem 8rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          radial-gradient(circle at 20% 50%, rgba(0, 102, 255, 0.05) 0%, transparent 50%),
          radial-gradient(circle at 80% 50%, rgba(0, 153, 255, 0.03) 0%, transparent 50%)
        `
      }} />

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginBottom: '3rem'
          }}
        >
          <div style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: '#0099FF',
            marginBottom: '1rem',
            letterSpacing: '0.1em'
          }}>
            PROVEN RESULTS
          </div>
          <h2 style={{
            fontSize: isMobile ? '2rem' : '2.5rem',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            lineHeight: 1.2,
            letterSpacing: '-0.02em'
          }}>
            숫자로 증명하는<br />
            <span style={{
              background: 'linear-gradient(90deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              압도적인 성과
            </span>
          </h2>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          onViewportEnter={() => setIsInView(true)}
          viewport={{ once: true, amount: 0.3 }}
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: isMobile ? '1.5rem' : '2rem',
            maxWidth: '900px',
            margin: '0 auto'
          }}
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              style={{
                textAlign: 'center',
                padding: isMobile ? '2rem 1.5rem' : '3rem 2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '24px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Glow Effect */}
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: index * 0.2
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '200px',
                  height: '200px',
                  background: 'radial-gradient(circle, rgba(0, 102, 255, 0.1) 0%, transparent 70%)',
                  pointerEvents: 'none'
                }}
              />

              {/* Number */}
              <div style={{
                fontSize: isMobile ? '2.5rem' : '3.5rem',
                fontWeight: '900',
                background: 'linear-gradient(180deg, #FFFFFF 0%, #808080 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: '0.5rem',
                lineHeight: 1,
                letterSpacing: '-0.02em'
              }}>
                {isInView && (
                  <>
                    <Counter from={0} to={stat.number} duration={2} />
                    <span>{stat.suffix}</span>
                  </>
                )}
              </div>

              {/* Label */}
              <div style={{
                fontSize: isMobile ? '1rem' : '1.125rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.5rem',
                letterSpacing: '-0.01em'
              }}>
                {stat.label}
              </div>

              {/* Description - only show if exists */}
              {stat.description && (
                <div style={{
                  fontSize: '0.875rem',
                  color: '#666666',
                  letterSpacing: '-0.01em'
                }}>
                  {stat.description}
                </div>
              )}
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginTop: isMobile ? '4rem' : '6rem',
            padding: isMobile ? '2rem 1rem' : '3rem 2rem',
            maxWidth: '800px',
            margin: '0 auto'
          }}
        >
          <h3 style={{
            fontSize: isMobile ? '1.5rem' : '1.875rem',
            fontWeight: '600',
            color: '#FFFFFF',
            marginBottom: '1.5rem',
            lineHeight: 1.4,
            letterSpacing: '-0.02em'
          }}>
            이 숫자들은 계속 늘어나고 있습니다
          </h3>

          <div style={{
            fontSize: isMobile ? '1.5rem' : '2rem',
            fontWeight: '700',
            lineHeight: 1.3,
            letterSpacing: '-0.02em',
            position: 'relative',
            paddingTop: '5rem'
          }}>
            {/* Simple modern arrow */}
            <div
              style={{
                position: 'absolute',
                top: '-10px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '60px',
                height: '80px'
              }}
            >
              <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
                {/* Simple straight line */}
                <line
                  x1="30"
                  y1="0"
                  x2="30"
                  y2="60"
                  stroke="#0099FF"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                  opacity="0.5"
                />

                {/* Simple chevron arrow */}
                <path
                  d="M 15 55 L 30 70 L 45 55"
                  stroke="#0099FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />

                {/* Second chevron for depth */}
                <path
                  d="M 15 65 L 30 80 L 45 65"
                  stroke="#0066FF"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.6"
                />
              </svg>
            </div>

            <span style={{
              color: 'rgba(255, 255, 255, 0.8)',
              fontWeight: '400',
              display: 'block',
              marginBottom: '1rem',
              fontSize: '0.8em'
            }}>
              그리고 다음 합격자는
            </span>
            <span style={{
              display: 'inline-block',
              padding: '0.75rem 2rem',
              background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.15) 0%, rgba(0, 221, 255, 0.1) 100%)',
              border: '2px solid rgba(0, 153, 255, 0.3)',
              borderRadius: '100px',
              position: 'relative',
              fontSize: '1.05em'
            }}>
              바로 당신입니다
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}