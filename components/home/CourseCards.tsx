"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import Link from "next/link"
import { ArrowRight, Users, Clock, BookOpen } from "lucide-react"

const courses = [
  {
    id: "suri",
    title: "수리논술",
    subtitle: "상위권 대학 합격의 지름길",
    description: "19년 연속 최고 합격률, 체계적인 논술 대비",
    features: ["고3, N수생", "1개월 주1회 3시간", "온라인 40만원 / 오프라인 80만원"],
    color: "#0066FF",
    href: "/classes"
  },
  {
    id: "suneung",
    title: "수능수학",
    subtitle: "등급 상승의 핵심 전략",
    description: "수능 수학 만점을 위한 추론모듈 수업",
    features: ["고3, N수생", "1개월 주1회 3시간", "온라인 28만원"],
    color: "#00DDFF",
    href: "/classes"
  }
]

export default function CourseCards() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: '#000000'
    }}>
      <div style={{
        maxWidth: '1000px',
        margin: '0 auto'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <h2 style={{
            fontSize: isMobile ? '2rem' : '2.5rem',
            fontWeight: '800',
            marginBottom: '1rem',
            color: '#FFFFFF'
          }}>
            수업 안내
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            수능 수학 2등급 이상만 받아오면, 수강생 90% 합격 신화!
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '2rem'
        }}>
          {courses.map((course, index) => (
            <motion.div
              key={course.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Link href={course.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '20px',
                  padding: '2rem',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = course.color
                  e.currentTarget.style.transform = 'translateY(-5px)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.transform = 'translateY(0)'
                }}
                >
                  <div style={{
                    fontSize: '0.875rem',
                    color: course.color,
                    marginBottom: '0.5rem',
                    fontWeight: '600'
                  }}>
                    {course.subtitle}
                  </div>
                  <h3 style={{
                    fontSize: '1.75rem',
                    fontWeight: '800',
                    color: '#FFFFFF',
                    marginBottom: '1rem'
                  }}>
                    {course.title}
                  </h3>
                  <p style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    marginBottom: '1.5rem',
                    lineHeight: 1.6
                  }}>
                    {course.description}
                  </p>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginBottom: '1.5rem'
                  }}>
                    {course.features.map((feature, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        fontSize: '0.9rem',
                        color: 'rgba(255, 255, 255, 0.7)'
                      }}>
                        {idx === 0 && <Users size={16} style={{ color: course.color }} />}
                        {idx === 1 && <Clock size={16} style={{ color: course.color }} />}
                        {idx === 2 && <BookOpen size={16} style={{ color: course.color }} />}
                        {feature}
                      </div>
                    ))}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    color: course.color,
                    fontWeight: '600'
                  }}>
                    자세히 보기 <ArrowRight size={18} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
