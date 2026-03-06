"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"

const targetItems = [
  {
    title: "수능 / 정시 만으로는 불안해 보험이 필요한 학생",
    emotion: "불안해서 잠 못 이루는",
    highlight: "보험이 필요한",
    emoji: "😰",
    color: "#FF6B6B"
  },
  {
    title: "수학만 성적이 좋은 학생",
    emotion: "다른 과목이 발목 잡는",
    highlight: "수학만",
    emoji: "😔",
    color: "#4ECDC4"
  },
  {
    title: "내신 성적이 부족해 학종/교과를 못 쓰는 학생",
    emotion: "기회가 막혀서 답답한",
    highlight: "학종/교과를 못 쓰는",
    emoji: "😤",
    color: "#FFD93D"
  },
  {
    title: "수능 성적이 애매한 학생",
    emotion: "어디도 확실하지 않은",
    highlight: "애매한",
    emoji: "😟",
    color: "#A29BFE"
  },
  {
    title: "남은 시간 여러 과목을 동시에 향상시키는 것이 어려운 상황인 학생",
    emotion: "시간에 쫓기는",
    highlight: "시간이 없는",
    emoji: "😫",
    color: "#FD79A8"
  },
  {
    title: "무엇보다도 내 수능/내신 성적보다 더 높은 대학에 가기를 원하는 학생",
    emotion: "꿈을 포기할 수 없는",
    highlight: "더 높은 대학",
    emoji: "🥺",
    color: "#00D2FF"
  }
]

export default function TargetAudience() {
  const [isMobile, setIsMobile] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

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

      <div style={{
        maxWidth: '800px',
        margin: '0 auto',
        position: 'relative'
      }}>
        {/* Header - Clean Center Aligned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginBottom: isMobile ? '2rem' : '3rem'
          }}
        >
          {/* Main Title */}
          <h2 style={{
            fontSize: isMobile ? '2.5rem' : '3.5rem',
            fontWeight: '800',
            lineHeight: 1.2,
            letterSpacing: '-0.03em',
            marginBottom: '2rem'
          }}>
            <span style={{
              color: 'rgba(255, 255, 255, 0.6)',
              fontWeight: '400',
              fontSize: '0.5em',
              display: 'block',
              marginBottom: '1rem'
            }}>
              이 중
            </span>
            <span style={{
              color: '#FFFFFF',
              display: 'inline-block',
              position: 'relative'
            }}>
              {/* 하 위의 동그라미 */}
              <span style={{ position: 'relative' }}>
                하
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '6px',
                  height: '6px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
                }} />
              </span>
              {/* 나 위의 동그라미 */}
              <span style={{ position: 'relative' }}>
                나
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '6px',
                  height: '6px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
                }} />
              </span>
              {/* 라도 위의 동그라미들 */}
              <span style={{ position: 'relative' }}>
                라
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '6px',
                  height: '6px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
                }} />
              </span>
              <span style={{ position: 'relative' }}>
                도
                <span style={{
                  position: 'absolute',
                  top: '-8px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '6px',
                  height: '6px',
                  background: '#FFFFFF',
                  borderRadius: '50%',
                  boxShadow: '0 0 10px rgba(255, 255, 255, 0.5)'
                }} />
              </span>
            </span>
            <span style={{
              color: 'rgba(255, 255, 255, 0.5)',
              fontWeight: '400',
              fontSize: '0.4em',
              display: 'block',
              marginTop: '0.8rem'
            }}>
              해당된다면 끝까지 보세요
            </span>
          </h2>
        </motion.div>

        {/* Cards - Vertical List with Check */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0',
          marginBottom: '6rem',
          maxWidth: '700px',
          margin: '0 auto'
        }}>
          {targetItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{
                delay: index * 0.1,
                duration: 0.4
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseLeave={() => setSelectedIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1.5rem',
                padding: isMobile ? '1rem 1.5rem' : '1.2rem 2rem',
                margin: '0.3rem 0',
                border: selectedIndex === index
                  ? `2px solid ${item.color}40`
                  : '2px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                cursor: 'pointer',
                position: 'relative',
                background: selectedIndex === index
                  ? `linear-gradient(135deg, ${item.color}08 0%, transparent 100%)`
                  : 'rgba(255, 255, 255, 0.02)',
                transition: 'all 0.3s ease',
                boxShadow: selectedIndex === index
                  ? `0 4px 20px ${item.color}15`
                  : 'none'
              }}
            >
              {/* Emoji instead of Check */}
              <motion.div
                animate={{
                  scale: selectedIndex === index ? 1.2 : 1,
                  rotate: selectedIndex === index ? [0, -10, 10, 0] : 0
                }}
                transition={{ duration: 0.3 }}
                style={{
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '1.8rem',
                  filter: selectedIndex === index ? 'none' : 'saturate(0.5)'
                }}
              >
                {item.emoji}
              </motion.div>

              {/* Text Content with Emotion */}
              <div style={{ flex: 1 }}>
                {/* Emotion Label */}
                {selectedIndex === index && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{
                      fontSize: '0.85rem',
                      color: item.color,
                      fontWeight: '600',
                      marginBottom: '0.5rem',
                      letterSpacing: '0.02em'
                    }}
                  >
                    {item.emotion}
                  </motion.p>
                )}

                {/* Main Text */}
                <p style={{
                  fontSize: isMobile ? '1rem' : '1.125rem',
                  color: '#FFFFFF',
                  fontWeight: '500',
                  lineHeight: 1.6,
                  margin: 0,
                  letterSpacing: '-0.01em'
                }}>
                  {item.title}
                </p>
              </div>

              {/* Hover Arrow */}
              <motion.div
                animate={{
                  opacity: selectedIndex === index ? 1 : 0,
                  x: selectedIndex === index ? 0 : -20
                }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '1.2rem',
                  color: item.color
                }}
              >
                →
              </motion.div>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  )
}