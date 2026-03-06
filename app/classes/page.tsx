"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowLeft, Users, Clock, BookOpen, Check } from "lucide-react"

const courses = [
  {
    id: "suri-online",
    category: "수리논술",
    title: "수리논술 온라인",
    price: "400,000",
    period: "4주",
    schedule: "주 1회 3시간",
    target: "고3, N수생",
    features: [
      "실시간 라이브 수업",
      "녹화본 무제한 복습",
      "카카오톡 1:1 관리방",
      "과제 첨삭 피드백"
    ]
  },
  {
    id: "suri-offline",
    category: "수리논술",
    title: "수리논술 오프라인",
    price: "800,000",
    period: "4주",
    schedule: "주 1회 3시간",
    target: "고3, N수생",
    features: [
      "대면 수업",
      "즉각적인 첨삭 피드백",
      "카카오톡 1:1 관리방",
      "교재 포함"
    ]
  },
  {
    id: "suneung",
    category: "수능수학",
    title: "수능수학 온라인",
    price: "280,000",
    period: "4주",
    schedule: "주 1회 3시간",
    target: "고3, N수생",
    features: [
      "추론모듈 수업",
      "실시간 라이브",
      "녹화본 무제한 복습",
      "1:1 관리 시스템"
    ]
  }
]

export default function ClassesPage() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      paddingTop: '100px',
      paddingBottom: '4rem'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <motion.div
            whileHover={{ x: -5 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              marginBottom: '2rem',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={18} />
            홈으로 돌아가기
          </motion.div>
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: '3rem' }}
        >
          <h1 style={{
            fontSize: isMobile ? '2rem' : '2.5rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            수업 신청
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            수능 수학 2등급 이상만 받아오면, 수강생 90% 합격 신화!
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '1.5rem'
        }}>
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '20px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                fontSize: '0.875rem',
                color: '#0099FF',
                marginBottom: '0.5rem',
                fontWeight: '600'
              }}>
                {course.category}
              </div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '800',
                color: '#FFFFFF',
                marginBottom: '1rem'
              }}>
                {course.title}
              </h3>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  <Users size={16} style={{ color: '#0099FF' }} />
                  {course.target}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  color: 'rgba(255, 255, 255, 0.7)'
                }}>
                  <Clock size={16} style={{ color: '#0099FF' }} />
                  {course.period} / {course.schedule}
                </div>
              </div>

              <div style={{
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                paddingTop: '1.5rem',
                marginBottom: '1.5rem'
              }}>
                {course.features.map((feature, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.9rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '0.5rem'
                  }}>
                    <Check size={16} style={{ color: '#00DD00' }} />
                    {feature}
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto' }}>
                <div style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  marginBottom: '1rem'
                }}>
                  ₩{course.price}
                  <span style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontWeight: '400'
                  }}> / {course.period}</span>
                </div>
                <a
                  href="http://pf.kakao.com/_YFDjn/chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '1rem',
                    background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    fontWeight: '700',
                    textAlign: 'center',
                    textDecoration: 'none',
                    cursor: 'pointer'
                  }}
                >
                  상담 신청하기
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
