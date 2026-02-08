"use client"

import { motion } from "framer-motion"
import { useEffect, useState } from "react"
import { TrendingUp, Users, Trophy, Target } from "lucide-react"

interface StatProps {
  value: number
  suffix: string
  label: string
  prefix?: string
  icon: React.ElementType
  color: string
}

function StatCounter({ value, suffix, label, prefix = "", icon: Icon, color }: StatProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const duration = 2000
    const steps = 60
    const increment = value / steps
    let current = 0

    const timer = setInterval(() => {
      current += increment
      if (current >= value) {
        setCount(value)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)

    return () => clearInterval(timer)
  }, [value])

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      whileHover={{ scale: 1.05 }}
      style={{
        textAlign: 'center',
        padding: '2rem',
        background: 'rgba(255, 255, 255, 0.02)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        borderRadius: '20px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Glow Effect */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1
      }}>
        <Icon
          size={40}
          style={{
            color: color,
            margin: '0 auto 1rem',
            filter: `drop-shadow(0 0 20px ${color}50)`
          }}
        />
        <div style={{
          fontSize: 'clamp(2.5rem, 5vw, 4rem)',
          fontWeight: '900',
          background: `linear-gradient(135deg, ${color} 0%, ${color}CC 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: '0.5rem',
          textShadow: `0 0 40px ${color}40`
        }}>
          {prefix}{count}{suffix}
        </div>
        <p style={{
          color: '#808080',
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          fontWeight: '600'
        }}>{label}</p>
      </div>
    </motion.div>
  )
}

export default function TrustSection() {
  return (
    <section style={{
      padding: '6rem 1rem',
      background: '#000000',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 102, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 102, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '4rem' }}
        >
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'rgba(0, 255, 136, 0.1)',
              border: '1px solid rgba(0, 255, 136, 0.3)',
              borderRadius: '100px',
              marginBottom: '1.5rem'
            }}
          >
            <span style={{ color: '#00FF88', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
              2024 RESULTS
            </span>
          </motion.div>

          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: '900',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            <span style={{
              background: 'linear-gradient(135deg, #FFFFFF 0%, #E0E0E0 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              숫자로 증명하는
            </span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              압도적 성과
            </span>
          </h2>
          <p style={{
            color: '#808080',
            fontSize: '1.2rem',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            박교준 수학이 만들어낸 2024년 입시 결과를 확인하세요
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          <StatCounter
            value={98}
            suffix="%"
            label="합격률"
            icon={Trophy}
            color="#00DDFF"
          />
          <StatCounter
            value={156}
            suffix="명"
            label="SKY 합격"
            icon={Target}
            color="#0099FF"
          />
          <StatCounter
            value={23}
            suffix="명"
            label="만점자 배출"
            icon={TrendingUp}
            color="#0066FF"
          />
          <StatCounter
            value={3.7}
            suffix="등급"
            label="평균 상승"
            icon={Users}
            color="#00B8FF"
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{ textAlign: 'center' }}
        >
          <button style={{
            padding: '1rem 2rem',
            background: 'transparent',
            border: '1px solid rgba(0, 102, 255, 0.3)',
            borderRadius: '100px',
            color: '#0099FF',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.3s',
            backdropFilter: 'blur(10px)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.6)';
            e.currentTarget.style.background = 'rgba(0, 102, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
            e.currentTarget.style.background = 'transparent';
          }}
          >
            상세 합격 현황 보기 →
          </button>
        </motion.div>
      </div>
    </section>
  )
}