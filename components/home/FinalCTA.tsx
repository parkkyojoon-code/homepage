"use client"

import { motion } from "framer-motion"
import { ArrowRight, MessageCircle } from "lucide-react"
import Link from "next/link"

export default function FinalCTA() {
  return (
    <section id="contact" style={{
      padding: '8rem 1rem',
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Subtle Background Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 50%, rgba(0, 102, 255, 0.1) 0%, transparent 50%)'
      }} />

      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center'
          }}
        >
          {/* Main Heading */}
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: '800',
            marginBottom: '1.5rem',
            lineHeight: 1.1,
            letterSpacing: '-0.03em'
          }}>
            <span style={{
              background: 'linear-gradient(180deg, #FFFFFF 0%, #808080 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              시작이 반입니다
            </span>
          </h2>

          {/* Subheading */}
          <p style={{
            fontSize: 'clamp(1.25rem, 2.5vw, 1.75rem)',
            color: '#808080',
            marginBottom: '3rem',
            lineHeight: 1.4,
            letterSpacing: '-0.02em'
          }}>
            지금 상담 신청하세요
          </p>

          {/* CTA Options - 카카오톡만 */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '3rem'
          }}>
            {/* Kakao Consultation */}
            <motion.a
              href="https://pf.kakao.com/_xnxaxmxj"
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ y: -4 }}
              style={{
                padding: '2rem 3rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                textDecoration: 'none',
                maxWidth: '350px',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 102, 255, 0.3)';
                e.currentTarget.style.background = 'rgba(0, 102, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
              }}
            >
              <MessageCircle size={32} style={{
                color: '#0099FF',
                marginBottom: '1rem'
              }} />
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.5rem'
              }}>
                카카오톡 상담
              </h3>
              <p style={{
                fontSize: '0.9375rem',
                color: '#808080',
                marginBottom: '1rem'
              }}>
                @박교준수학<br />
                실시간 답변 가능
              </p>
              <div style={{
                fontSize: '0.875rem',
                color: '#0099FF',
                fontWeight: '600'
              }}>
                채팅 시작 →
              </div>
            </motion.a>
          </div>

          {/* Primary CTA Button - 클래스로 이동 */}
          <Link href="/classes" style={{ textDecoration: 'none' }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                padding: '1.25rem 3rem',
                background: 'linear-gradient(90deg, #0066FF 0%, #0099FF 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '1.125rem',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                boxShadow: '0 20px 40px rgba(0, 102, 255, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.3s',
                letterSpacing: '-0.01em'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 20px 60px rgba(0, 102, 255, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(0, 102, 255, 0.3)';
              }}
            >
              지금 시작하기
              <ArrowRight size={20} />
            </motion.button>
          </Link>

          {/* Trust Elements */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            style={{
              marginTop: '3rem',
              paddingTop: '3rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '3rem',
              flexWrap: 'wrap'
            }}>
              <div style={{
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.25rem'
                }}>
                  100%
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#666666'
                }}>
                  환불 보장
                </div>
              </div>
              <div style={{
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.25rem'
                }}>
                  무료
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#666666'
                }}>
                  레벨 테스트
                </div>
              </div>
              <div style={{
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#FFFFFF',
                  marginBottom: '0.25rem'
                }}>
                  1:1
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: '#666666'
                }}>
                  맞춤 상담
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
