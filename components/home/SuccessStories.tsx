"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronLeft, ChevronRight, Star, TrendingUp } from "lucide-react"

const stories = [
  {
    id: 1,
    name: "김민수",
    beforeGrade: 6,
    afterGrade: 1,
    university: "서울대학교",
    testimonial: "포기하려던 순간 만난 기적. 박교준 선생님 덕분에 불가능이 가능이 되었습니다.",
    image: "https://i.pravatar.cc/150?img=1"
  },
  {
    id: 2,
    name: "이서연",
    beforeGrade: 5,
    afterGrade: 1,
    university: "연세대학교",
    testimonial: "수학이 이렇게 쉬워질 줄 몰랐어요. 체계적인 커리큘럼이 정말 놀라웠습니다.",
    image: "https://i.pravatar.cc/150?img=2"
  },
  {
    id: 3,
    name: "박준혁",
    beforeGrade: 4,
    afterGrade: 1,
    university: "고려대학교",
    testimonial: "체계적인 커리큘럼과 1:1 관리 시스템. 수학에 자신감이 생겼습니다.",
    image: "https://i.pravatar.cc/150?img=3"
  },
  {
    id: 4,
    name: "최지윤",
    beforeGrade: 5,
    afterGrade: 1,
    university: "서울대학교 의대",
    testimonial: "의대 합격의 꿈을 이뤄주신 박교준 선생님께 감사드립니다.",
    image: "https://i.pravatar.cc/150?img=4"
  },
  {
    id: 5,
    name: "정현우",
    beforeGrade: 6,
    afterGrade: 2,
    university: "카이스트",
    testimonial: "수포자에서 이과 최상위권으로. 인생이 바뀌었습니다.",
    image: "https://i.pravatar.cc/150?img=5"
  }
]

export default function SuccessStories() {
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % stories.length)
  }

  const prevSlide = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + stories.length) % stories.length)
  }

  return (
    <section style={{
      padding: '6rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Glow */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(0, 102, 255, 0.05) 0%, transparent 70%)',
        pointerEvents: 'none'
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
            style={{
              display: 'inline-block',
              padding: '6px 16px',
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              borderRadius: '100px',
              marginBottom: '1.5rem'
            }}
          >
            <span style={{ color: '#FFD700', fontSize: '12px', fontWeight: '700', letterSpacing: '1px' }}>
              SUCCESS STORIES
            </span>
          </motion.div>

          <h2 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: '900',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            <span style={{ color: '#FFFFFF' }}>실제 학생들의</span>
            <br />
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>놀라운 변화</span>
          </h2>
          <p style={{ color: '#808080', fontSize: '1.2rem' }}>
            박교준과 함께한 성공 스토리
          </p>
        </motion.div>

        <div style={{ position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -300 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '2rem'
              }}
            >
              {stories.slice(currentIndex, currentIndex + 3).concat(
                stories.slice(0, Math.max(0, currentIndex + 3 - stories.length))
              ).slice(0, 3).map((story) => (
                <motion.div
                  key={story.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '20px',
                    padding: '2rem',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  {/* Success Badge */}
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
                    borderRadius: '100px',
                    padding: '4px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <Star size={12} style={{ color: '#000' }} />
                    <span style={{ color: '#000', fontSize: '11px', fontWeight: '700' }}>SUCCESS</span>
                  </div>

                  {/* Profile */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                    <img
                      src={story.image}
                      alt={story.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '100%',
                        border: '2px solid rgba(0, 102, 255, 0.3)'
                      }}
                    />
                    <div>
                      <h3 style={{ color: '#FFFFFF', fontSize: '1.2rem', fontWeight: '700' }}>
                        {story.name}
                      </h3>
                      <p style={{
                        color: '#0099FF',
                        fontSize: '0.9rem',
                        fontWeight: '600'
                      }}>
                        {story.university}
                      </p>
                    </div>
                  </div>

                  {/* Grade Change */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2rem',
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: 'rgba(0, 102, 255, 0.05)',
                    borderRadius: '15px'
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '2.5rem',
                        fontWeight: '900',
                        color: '#808080'
                      }}>
                        {story.beforeGrade}
                      </div>
                      <div style={{ color: '#606060', fontSize: '0.8rem' }}>등급</div>
                    </div>
                    <TrendingUp size={32} style={{ color: '#00FF88' }} />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        fontSize: '2.5rem',
                        fontWeight: '900',
                        background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}>
                        {story.afterGrade}
                      </div>
                      <div style={{ color: '#0099FF', fontSize: '0.8rem' }}>등급</div>
                    </div>
                  </div>

                  {/* Testimonial */}
                  <p style={{
                    color: '#B0B0B0',
                    fontSize: '0.95rem',
                    fontStyle: 'italic',
                    lineHeight: 1.6
                  }}>
                    "{story.testimonial}"
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <button
            onClick={prevSlide}
            style={{
              position: 'absolute',
              left: '-60px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 102, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <ChevronLeft size={24} style={{ color: '#FFFFFF' }} />
          </button>
          <button
            onClick={nextSlide}
            style={{
              position: 'absolute',
              right: '-60px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '48px',
              height: '48px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 102, 255, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <ChevronRight size={24} style={{ color: '#FFFFFF' }} />
          </button>
        </div>

        {/* Dots Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '8px',
          marginTop: '3rem'
        }}>
          {Array.from({ length: Math.ceil(stories.length / 3) }).map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index * 3)}
              style={{
                width: Math.floor(currentIndex / 3) === index ? '24px' : '8px',
                height: '8px',
                background: Math.floor(currentIndex / 3) === index
                  ? 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)'
                  : 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '100px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}