"use client"

import React, { useState, useMemo, useRef, useEffect } from "react"
import { motion, AnimatePresence, useInView } from "framer-motion"
import { Star, Award, Users, BookOpen, TrendingUp, Globe, Medal, GraduationCap, ChevronLeft, ChevronRight } from "lucide-react"

// Instructor 타입 정의
interface Instructor {
  id: string
  name: string
  title: string
  subject: string[]
  image: string
  experience: number
  education: string[]
  achievements: string[]
  satisfaction: number
  students: number
  classes: string[]
  specialties: string[]
  awards: string[]
}

// 강사 데이터
const instructorsData: Instructor[] = [
  {
    id: "1",
    name: "박교준",
    title: "수학 최고 강사",
    subject: ["수학", "수리논술"],
    image: "/images/instructor-1.jpg",
    experience: 15,
    education: ["서울대학교 수학과 졸업", "서울대학교 수학과 석사"],
    achievements: ["2024 수능 만점자 23명 배출", "98% 합격률 달성", "대치동 1타 강사"],
    satisfaction: 4.9,
    students: 1250,
    classes: ["수능수학 완성반", "수리논술 오페론", "의대 수학 특강"],
    specialties: ["미적분", "기하", "확률과 통계"],
    awards: ["올해의 강사상", "교육부 우수강사", "학부모 선정 베스트 강사"]
  },
  {
    id: "2",
    name: "황윤지",
    title: "통합과학 전문가",
    subject: ["과학"],
    image: "/images/instructor-2.jpg",
    experience: 12,
    education: ["연세대학교 화학과 졸업", "KAIST 화학공학 석사"],
    achievements: ["과학 올림피아드 지도교사", "95% 이상 성적 향상", "기초부터 심화까지"],
    satisfaction: 4.8,
    students: 890,
    classes: ["쌩노베 통합과학", "화학1 완성반", "과학 탐구 집중반"],
    specialties: ["화학", "물리", "생명과학"],
    awards: ["과학교육 혁신상", "우수 지도교사상"]
  },
  {
    id: "3",
    name: "이승호",
    title: "물리학 마스터",
    subject: ["과학"],
    image: "/images/instructor-3.jpg",
    experience: 18,
    education: ["서울대학교 물리학과 졸업", "서울대학교 물리학과 박사"],
    achievements: ["물리 만점자 다수 배출", "국제 물리 올림피아드 코치", "논리적 사고력 강화"],
    satisfaction: 4.9,
    students: 750,
    classes: ["물리학1 완성반", "물리학2 심화반", "과학 실험 특강"],
    specialties: ["역학", "전자기학", "현대물리"],
    awards: ["물리교육 공로상", "과학인재 양성 기여상"]
  },
  {
    id: "4",
    name: "김수현",
    title: "생명과학 전문가",
    subject: ["과학"],
    image: "/images/instructor-4.jpg",
    experience: 10,
    education: ["연세대학교 생명과학과 졸업", "서울대학교 생명과학과 석사"],
    achievements: ["생명과학 분야 전문성", "의대 진학률 92%", "실험 중심 교육"],
    satisfaction: 4.7,
    students: 650,
    classes: ["생명과학1 기초반", "생명과학2 심화반", "생물 실험 특강"],
    specialties: ["세포생물학", "분자생물학", "생태학"],
    awards: ["생명과학교육 우수상"]
  },
  {
    id: "5",
    name: "정민수",
    title: "논술 스페셜리스트",
    subject: ["수리논술"],
    image: "/images/instructor-5.jpg",
    experience: 14,
    education: ["서울대학교 수학교육과 졸업", "서울대학교 수학교육과 석사"],
    achievements: ["논술 전형 합격률 85%", "대학별 맞춤 지도", "논리적 글쓰기 전문"],
    satisfaction: 4.8,
    students: 420,
    classes: ["수리논술 완성반", "대학별 논술 특강", "논술 첨삭 집중반"],
    specialties: ["논리적 사고", "수학적 글쓰기", "문제 해결"],
    awards: ["논술교육 혁신상", "우수 논술 지도교사"]
  },
  {
    id: "6",
    name: "최영미",
    title: "국어 논술 마스터",
    subject: ["논술"],
    image: "/images/instructor-6.jpg",
    experience: 16,
    education: ["서울대학교 국어국문학과 졸업", "서울대학교 국어교육과 석사"],
    achievements: ["인문 논술 전문가", "명문대 합격률 90%", "창의적 사고력 개발"],
    satisfaction: 4.9,
    students: 380,
    classes: ["인문 논술 완성반", "국어 논술 기초반", "창의 논술 특강"],
    specialties: ["비판적 사고", "창의적 글쓰기", "인문학적 사고"],
    awards: ["국어교육 공로상", "논술지도 우수교사"]
  }
]

// 과목 카테고리
const subjects = [
  { id: "all", label: "전체", icon: Globe },
  { id: "수학", label: "수학", icon: BookOpen },
  { id: "과학", label: "과학", icon: TrendingUp },
  { id: "수리논술", label: "수리논술", icon: GraduationCap },
  { id: "논술", label: "논술", icon: Award }
]

// 3D 플립 카드 컴포넌트
interface InstructorCardProps {
  instructor: Instructor
  index: number
}

const InstructorCard: React.FC<InstructorCardProps> = ({ instructor, index }) => {
  const [isFlipped, setIsFlipped] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        delay: index * 0.1,
        duration: 0.8,
        ease: [0.16, 1, 0.3, 1]
      }}
      whileHover={{
        y: -20,
        scale: 1.05,
        rotateY: isFlipped ? 180 : 0
      }}
      onMouseEnter={() => setIsFlipped(true)}
      onMouseLeave={() => setIsFlipped(false)}
      style={{
        perspective: '1000px',
        transformStyle: 'preserve-3d',
        height: '480px',
        cursor: 'pointer'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
        }}
      >
        {/* 앞면 - 강사 프로필 */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '24px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: `
              0 20px 40px rgba(0, 0, 0, 0.1),
              0 8px 32px rgba(0, 122, 255, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.3),
              inset 0 -1px 0 rgba(0, 0, 0, 0.1)
            `,
            overflow: 'hidden'
          }}
        >
          {/* 배경 그라디언트 */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '60%',
              background: `linear-gradient(135deg,
                rgba(0, 122, 255, 0.1) 0%,
                rgba(0, 198, 255, 0.05) 50%,
                transparent 100%)`
            }}
          />

          {/* 강사 이미지 */}
          <div
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #007AFF, #00C6FF)',
              margin: '40px auto 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '3rem',
              position: 'relative',
              boxShadow: '0 8px 32px rgba(0, 122, 255, 0.3)'
            }}
          >
            👨‍🏫
            {/* 반짝이는 효과 */}
            <motion.div
              animate={{
                opacity: [0, 1, 0],
                scale: [1, 1.2, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
                pointerEvents: 'none'
              }}
            />
          </div>

          {/* 강사 정보 */}
          <div style={{ padding: '0 24px', textAlign: 'center' }}>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '800',
              color: '#FFFFFF',
              marginBottom: '8px',
              letterSpacing: '-0.02em'
            }}>
              {instructor.name}
            </h3>

            <p style={{
              fontSize: '1rem',
              color: '#007AFF',
              fontWeight: '600',
              marginBottom: '16px'
            }}>
              {instructor.title}
            </p>

            {/* 과목 태그 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              justifyContent: 'center',
              marginBottom: '20px'
            }}>
              {instructor.subject.map((subj, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '4px 12px',
                    background: 'rgba(0, 122, 255, 0.2)',
                    border: '1px solid rgba(0, 122, 255, 0.3)',
                    borderRadius: '100px',
                    fontSize: '0.75rem',
                    color: '#00C6FF',
                    fontWeight: '600'
                  }}
                >
                  {subj}
                </span>
              ))}
            </div>

            {/* 평점 */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', gap: '2px' }}>
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    style={{
                      color: i < Math.floor(instructor.satisfaction) ? '#FFD700' : '#666',
                      fill: i < Math.floor(instructor.satisfaction) ? '#FFD700' : 'none'
                    }}
                  />
                ))}
              </div>
              <span style={{
                fontSize: '0.875rem',
                color: '#FFFFFF',
                fontWeight: '600'
              }}>
                {instructor.satisfaction}
              </span>
            </div>

            {/* 간단 통계 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              marginTop: '20px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  color: '#FFFFFF'
                }}>
                  {instructor.experience}년
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  경력
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '800',
                  color: '#FFFFFF'
                }}>
                  {instructor.students.toLocaleString()}
                </div>
                <div style={{
                  fontSize: '0.75rem',
                  color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  수강생
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 뒷면 - 상세 이력 */}
        <div
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            background: 'linear-gradient(145deg, rgba(0, 122, 255, 0.1), rgba(0, 198, 255, 0.05))',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            borderRadius: '24px',
            border: '1px solid rgba(0, 122, 255, 0.3)',
            boxShadow: `
              0 20px 40px rgba(0, 122, 255, 0.2),
              inset 0 1px 0 rgba(255, 255, 255, 0.3)
            `,
            transform: 'rotateY(180deg)',
            padding: '24px',
            overflow: 'hidden'
          }}
        >
          {/* 헤더 */}
          <div style={{
            textAlign: 'center',
            marginBottom: '24px',
            paddingBottom: '16px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            <h4 style={{
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: '4px'
            }}>
              {instructor.name}
            </h4>
            <p style={{
              fontSize: '0.875rem',
              color: '#00C6FF'
            }}>
              상세 이력
            </p>
          </div>

          {/* 학력 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <GraduationCap size={16} style={{ color: '#007AFF' }} />
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#007AFF'
              }}>
                학력
              </span>
            </div>
            {instructor.education.map((edu, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.8125rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginLeft: '24px',
                  marginBottom: '4px'
                }}
              >
                • {edu}
              </div>
            ))}
          </div>

          {/* 주요 성과 */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <Medal size={16} style={{ color: '#FFD700' }} />
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#FFD700'
              }}>
                주요 성과
              </span>
            </div>
            {instructor.achievements.slice(0, 3).map((achievement, idx) => (
              <div
                key={idx}
                style={{
                  fontSize: '0.8125rem',
                  color: 'rgba(255, 255, 255, 0.8)',
                  marginLeft: '24px',
                  marginBottom: '4px'
                }}
              >
                • {achievement}
              </div>
            ))}
          </div>

          {/* 전문 분야 */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <Award size={16} style={{ color: '#00C6FF' }} />
              <span style={{
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#00C6FF'
              }}>
                전문 분야
              </span>
            </div>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
              marginLeft: '24px'
            }}>
              {instructor.specialties.map((specialty, idx) => (
                <span
                  key={idx}
                  style={{
                    padding: '2px 8px',
                    background: 'rgba(0, 198, 255, 0.2)',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    color: '#00C6FF'
                  }}
                >
                  {specialty}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// 강사 카드 캐러셀 컴포넌트
const InstructorCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isInView, setIsInView] = useState(false)
  const sectionRef = useRef<HTMLDivElement>(null)
  const viewRef = useInView(sectionRef, { once: true, margin: "-20%" })

  // 강사 데이터 (기존 instructorsData에서 가져오기)
  const featuredInstructors = instructorsData.slice(0, 6)

  useEffect(() => {
    if (viewRef) {
      setIsInView(true)
    }
  }, [viewRef])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredInstructors.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [featuredInstructors.length])

  const getVisibleCards = () => {
    const visible = []
    const totalCards = 5
    const radius = 300 // 반원의 반지름

    for (let i = 0; i < totalCards; i++) {
      const index = (currentIndex + i - 2 + featuredInstructors.length) % featuredInstructors.length
      const angle = (i - 2) * (Math.PI / 6) // -60도부터 60도까지 균등 분배
      const x = Math.sin(angle) * radius
      const z = Math.cos(angle) * radius
      const rotateY = -angle * (180 / Math.PI) // 라디안을 도로 변환

      visible.push({
        ...featuredInstructors[index],
        position: i - 2,
        isCenter: i === 2,
        x: x,
        z: z,
        rotateY: rotateY
      })
    }
    return visible
  }

  return (
    <section
      ref={sectionRef}
      style={{
        padding: '120px 0',
        background: `
          radial-gradient(ellipse at center, rgba(0, 122, 255, 0.15) 0%, transparent 70%),
          linear-gradient(135deg, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 1) 100%)
        `,
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 배경 이펙트 */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `
          radial-gradient(circle at 20% 80%, rgba(0, 122, 255, 0.1) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(0, 198, 255, 0.08) 0%, transparent 50%),
          radial-gradient(circle at 40% 40%, rgba(0, 122, 255, 0.05) 0%, transparent 50%)
        `,
        opacity: isInView ? 1 : 0,
        transition: 'opacity 2s ease-in-out'
      }} />

      {/* 네온 빛 효과 */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            opacity: [0.3, 0.8, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 4 + i,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 1.5
          }}
          style={{
            position: 'absolute',
            left: `${20 + i * 30}%`,
            top: `${30 + i * 20}%`,
            width: '200px',
            height: '200px',
            background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
            borderRadius: '50%',
            filter: 'blur(40px)',
            pointerEvents: 'none'
          }}
        />
      ))}

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 24px',
        position: 'relative',
        zIndex: 1
      }}>

        {/* 캐러셀 컨테이너 */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 100 }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            height: '500px',
            position: 'relative',
            perspective: '1500px',
            perspectiveOrigin: 'center center',
            marginBottom: '120px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transformStyle: 'preserve-3d'
          }}
        >
          {getVisibleCards().map((instructor, index) => (
            <motion.div
              key={instructor.id}
              animate={{
                x: `${instructor.x}px`,
                z: instructor.z,
                scale: instructor.isCenter ? 1.1 : 0.85,
                opacity: Math.abs(instructor.position) <= 1 ? 1 : 0.4,
                rotateY: instructor.rotateY
              }}
              transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
              whileHover={instructor.isCenter ? {
                scale: 1.15,
                rotateY: 0,
                z: instructor.z + 50
              } : {}}
              style={{
                position: 'absolute',
                width: '280px',
                height: '380px',
                borderRadius: '24px',
                background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))',
                backdropFilter: 'blur(25px) saturate(180%)',
                WebkitBackdropFilter: 'blur(25px) saturate(180%)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                boxShadow: instructor.isCenter
                  ? `
                    0 25px 80px rgba(0, 0, 0, 0.3),
                    0 10px 40px rgba(0, 122, 255, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.1)
                  `
                  : `
                    0 15px 40px rgba(0, 0, 0, 0.2),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2)
                  `,
                overflow: 'hidden',
                cursor: instructor.isCenter ? 'pointer' : 'default',
                transformStyle: 'preserve-3d',
                transform: `translateZ(${instructor.z}px)`
              }}
            >
              {/* 카드 배경 그라디언트 */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '60%',
                  background: `linear-gradient(135deg,
                    rgba(0, 122, 255, 0.15) 0%,
                    rgba(0, 198, 255, 0.08) 50%,
                    transparent 100%)`
                }}
              />

              {/* 강사 아바타 */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 24px',
                height: '100%',
                position: 'relative',
                zIndex: 1
              }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '20px',
                    background: 'linear-gradient(135deg, #007AFF, #00C6FF)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    marginBottom: '24px',
                    position: 'relative',
                    boxShadow: '0 10px 40px rgba(0, 122, 255, 0.3)'
                  }}
                >
                  👨‍🏫
                  {/* 반짝이는 효과 */}
                  <motion.div
                    animate={{
                      opacity: [0, 1, 0],
                      scale: [1, 1.1, 1]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    style={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      borderRadius: '20px',
                      background: 'radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%)',
                      pointerEvents: 'none'
                    }}
                  />
                </div>

                {/* 강사 정보 */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: '800',
                  color: '#FFFFFF',
                  marginBottom: '8px',
                  letterSpacing: '-0.02em',
                  textAlign: 'center'
                }}>
                  {instructor.name}
                </h3>

                <p style={{
                  fontSize: '1rem',
                  color: '#007AFF',
                  fontWeight: '600',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  {instructor.title}
                </p>

                {/* 과목 태그 */}
                <div style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '8px',
                  justifyContent: 'center',
                  marginBottom: '20px'
                }}>
                  {instructor.subject.map((subj, idx) => (
                    <span
                      key={idx}
                      style={{
                        padding: '4px 12px',
                        background: 'rgba(0, 122, 255, 0.2)',
                        border: '1px solid rgba(0, 122, 255, 0.3)',
                        borderRadius: '100px',
                        fontSize: '0.75rem',
                        color: '#00C6FF',
                        fontWeight: '600'
                      }}
                    >
                      {subj}
                    </span>
                  ))}
                </div>

                {/* 평점 */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        size={16}
                        style={{
                          color: i < Math.floor(instructor.satisfaction) ? '#FFD700' : '#666',
                          fill: i < Math.floor(instructor.satisfaction) ? '#FFD700' : 'none'
                        }}
                      />
                    ))}
                  </div>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#FFFFFF',
                    fontWeight: '600'
                  }}>
                    {instructor.satisfaction}
                  </span>
                </div>

                {/* 간단 통계 */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-around',
                  width: '100%',
                  marginTop: 'auto'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      color: '#FFFFFF'
                    }}>
                      {instructor.experience}년
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      경력
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      color: '#FFFFFF'
                    }}>
                      {instructor.students.toLocaleString()}
                    </div>
                    <div style={{
                      fontSize: '0.75rem',
                      color: 'rgba(255, 255, 255, 0.6)'
                    }}>
                      수강생
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* About the instructors 섹션 */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 50 }}
          transition={{ duration: 1, delay: 0.3 }}
          style={{
            textAlign: 'center',
            maxWidth: '900px',
            margin: '0 auto'
          }}
        >
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '24px',
            letterSpacing: '-0.02em',
            lineHeight: 1.2
          }}>
            About the{' '}
            <span style={{
              background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              instructors
            </span>
          </h2>

          <p style={{
            fontSize: '1.375rem',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.6,
            fontFamily: 'Pretendard, Inter, sans-serif',
            fontWeight: '400',
            letterSpacing: '-0.01em'
          }}>
            We bring together the nation's top educators — masters of reasoning, logic, and innovation.
          </p>
        </motion.div>
      </div>
    </section>
  )
}

// 메인 페이지 컴포넌트
export default function InstructorsPage() {
  const [selectedSubject, setSelectedSubject] = useState("all")

  // 필터링된 강사 목록
  const filteredInstructors = useMemo(() => {
    if (selectedSubject === "all") return instructorsData
    return instructorsData.filter(instructor =>
      instructor.subject.includes(selectedSubject)
    )
  }, [selectedSubject])

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000'
    }}>
      {/* 시네마틱 히어로 섹션 */}
      <section style={{
        paddingTop: '140px',
        paddingBottom: '100px',
        background: `
          radial-gradient(ellipse at top, rgba(0, 122, 255, 0.15) 0%, transparent 60%),
          radial-gradient(ellipse at bottom right, rgba(0, 198, 255, 0.1) 0%, transparent 50%)
        `,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 배경 파티클 효과 */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none'
        }}>
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              animate={{
                y: [0, -100, 0],
                opacity: [0.3, 0.8, 0.3],
                scale: [0.8, 1.2, 0.8]
              }}
              transition={{
                duration: 8 + Math.random() * 4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: Math.random() * 5
              }}
              style={{
                position: 'absolute',
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                width: '4px',
                height: '4px',
                background: '#007AFF',
                borderRadius: '50%',
                boxShadow: '0 0 20px #007AFF'
              }}
            />
          ))}
        </div>

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '0 24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1
        }}>
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* 메인 타이틀 */}
            <h1 style={{
              fontSize: 'clamp(3rem, 8vw, 6rem)',
              fontWeight: '900',
              marginBottom: '2rem',
              letterSpacing: '-0.04em',
              lineHeight: 0.9
            }}>
              <span style={{
                background: 'linear-gradient(135deg, #FFFFFF 0%, rgba(255, 255, 255, 0.7) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'block',
                marginBottom: '16px'
              }}>
                LEGENDARY
              </span>
              <span style={{
                background: 'linear-gradient(135deg, #007AFF 0%, #00C6FF 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'block'
              }}>
                INSTRUCTORS
              </span>
            </h1>

            <p style={{
              fontSize: '1.5rem',
              color: 'rgba(255, 255, 255, 0.7)',
              maxWidth: '600px',
              margin: '0 auto 3rem',
              lineHeight: 1.5,
              letterSpacing: '-0.01em'
            }}>
              압도적인 실력과 경험을 자랑하는<br />
              최고의 강사진을 만나보세요
            </p>

          </motion.div>
        </div>
      </section>

      {/* 강사 카드 캐러셀 섹션 */}
      <InstructorCarousel />

      {/* 과목 필터 섹션 */}
      <section style={{
        padding: '40px 24px',
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(20px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        position: 'sticky',
        top: '112px',
        zIndex: 40
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <div style={{
            display: 'flex',
            gap: '16px',
            flexWrap: 'wrap',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '12px',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
          }}>
            {subjects.map((subject) => (
              <motion.button
                key={subject.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedSubject(subject.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  background: selectedSubject === subject.id
                    ? 'linear-gradient(135deg, #007AFF, #00C6FF)'
                    : 'rgba(255, 255, 255, 0.05)',
                  border: selectedSubject === subject.id
                    ? '1px solid rgba(0, 122, 255, 0.5)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: selectedSubject === subject.id ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <subject.icon size={18} />
                {subject.label}
                {selectedSubject === subject.id && (
                  <span style={{
                    padding: '2px 8px',
                    background: 'rgba(255, 255, 255, 0.2)',
                    borderRadius: '100px',
                    fontSize: '0.75rem'
                  }}>
                    {filteredInstructors.length}
                  </span>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      {/* 강사 카드 그리드 */}
      <section style={{
        padding: '40px 24px 120px',
        background: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.9), rgba(0, 0, 0, 1))'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto'
        }}>

          <AnimatePresence mode="wait">
            <motion.div
              key={selectedSubject}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                gap: '32px',
                justifyItems: 'center'
              }}
            >
              {filteredInstructors.map((instructor, index) => (
                <InstructorCard
                  key={instructor.id}
                  instructor={instructor}
                  index={index}
                />
              ))}
            </motion.div>
          </AnimatePresence>

          {/* 결과 없음 상태 */}
          {filteredInstructors.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                textAlign: 'center',
                padding: '80px 24px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '24px',
                border: '1px solid rgba(255, 255, 255, 0.05)'
              }}
            >
              <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🔍</div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '12px'
              }}>
                해당 과목의 강사를 찾을 수 없습니다
              </h3>
              <p style={{
                fontSize: '1rem',
                color: 'rgba(255, 255, 255, 0.6)'
              }}>
                다른 과목을 선택해보세요
              </p>
            </motion.div>
          )}
        </div>
      </section>
    </div>
  )
}