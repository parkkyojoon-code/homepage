"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { Play, ExternalLink, MessageCircle } from "lucide-react"

const videos = [
  {
    id: "Vt-tvpLHjF8",
    title: "수학 5등급에서 1등급 찍는 '미친' 수학 공부법",
    views: "조회수 52만",
    duration: "24:35"
  },
  {
    id: "jwqGhBunZ4g",
    title: "수능 수학 만점 전략 - 킬러문항 완벽 분석",
    views: "조회수 38만",
    duration: "18:20"
  },
  {
    id: "4JxGN2_Vxpk",
    title: "수리논술 합격의 핵심 비법 공개",
    views: "조회수 29만",
    duration: "15:45"
  },
  {
    id: "uBQYI9OP_2M",
    title: "6등급→1등급 실제 성공 사례",
    views: "조회수 21만",
    duration: "12:30"
  }
]

export default function MediaSection() {
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
            fontSize: isMobile ? '1.75rem' : '2.25rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            언론이 주목한 <span style={{ color: '#0099FF' }}>박교준</span>
          </h2>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
          gap: '1.5rem',
          marginBottom: '3rem'
        }}>
          {videos.map((video, index) => (
            <motion.a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
                textDecoration: 'none',
                display: 'block'
              }}
            >
              <div style={{
                position: 'relative',
                paddingTop: '56.25%',
                background: '#111'
              }}>
                <img
                  src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
                  alt={video.title}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(255, 0, 0, 0.9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Play size={24} style={{ color: '#FFFFFF', marginLeft: '3px' }} />
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: '10px',
                  right: '10px',
                  background: 'rgba(0, 0, 0, 0.8)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  color: '#FFFFFF'
                }}>
                  {video.duration}
                </div>
              </div>
              <div style={{ padding: '1rem' }}>
                <h4 style={{
                  fontSize: '1rem',
                  fontWeight: '600',
                  color: '#FFFFFF',
                  marginBottom: '0.5rem',
                  lineHeight: 1.4
                }}>
                  {video.title}
                </h4>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.5)'
                }}>
                  {video.views}
                </p>
              </div>
            </motion.a>
          ))}
        </div>

        {/* CTA Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <a
            href="http://pf.kakao.com/_YFDjn/chat"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
              border: 'none',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '700',
              textDecoration: 'none'
            }}
          >
            <MessageCircle size={20} />
            수업 상담하기
          </a>
          <a
            href="https://www.youtube.com/@parkkyojoon"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '600',
              textDecoration: 'none'
            }}
          >
            <ExternalLink size={20} />
            YouTube 채널
          </a>
        </div>
      </div>
    </section>
  )
}
