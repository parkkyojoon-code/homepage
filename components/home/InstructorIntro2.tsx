"use client"

import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import Image from "next/image"

export default function InstructorIntro2() {
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
      minHeight: '100vh',
      background: '#050505',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Gradient Mesh Background */}
      <div style={{
        position: 'absolute',
        inset: 0,
        opacity: 0.3
      }}>
        <div style={{
          position: 'absolute',
          top: '-40%',
          right: '-20%',
          width: '60%',
          height: '60%',
          background: 'radial-gradient(circle, #1a1a2e 0%, transparent 70%)',
          filter: 'blur(100px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-30%',
          left: '-20%',
          width: '50%',
          height: '50%',
          background: 'radial-gradient(circle, #16213e 0%, transparent 70%)',
          filter: 'blur(100px)'
        }} />
      </div>

      <div style={{
        position: 'relative',
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? '4rem 1rem' : '8rem 2rem',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? '4rem' : '6rem',
        alignItems: 'center',
        minHeight: '100vh'
      }}>

        {/* Left Side - Content with Photo */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isMobile ? 'center' : 'flex-start'
          }}
        >
          {/* Title Above Photo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            style={{
              marginBottom: '2rem',
              textAlign: isMobile ? 'center' : 'left'
            }}
          >
            <p style={{
              fontSize: isMobile ? '0.875rem' : '1rem',
              color: '#666',
              marginBottom: '1rem',
              letterSpacing: '0.2em',
              textTransform: 'uppercase'
            }}>
              Since 2006
            </p>
            <h1 style={{
              fontSize: isMobile ? '3.5rem' : '5rem',
              fontWeight: '800',
              color: '#FFFFFF',
              lineHeight: 0.9,
              marginBottom: '1rem',
              letterSpacing: '-0.03em'
            }}>
              박교준
            </h1>
            <p style={{
              fontSize: isMobile ? '1.25rem' : '1.5rem',
              color: '#FFFFFF',
              fontWeight: '300',
              lineHeight: 1.4
            }}>
              19년간 국내 최고 합격률<br />
              대한민국 수리논술의 기준
            </p>
          </motion.div>

          {/* Photo */}
          <div style={{
            position: 'relative',
            width: isMobile ? '280px' : '400px',
            height: isMobile ? '350px' : '500px',
            marginBottom: '2rem'
          }}>
            {/* Background Shape */}
            <div style={{
              position: 'absolute',
              inset: '-20px',
              background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, transparent 100%)',
              borderRadius: '30px',
              transform: 'rotate(3deg)'
            }} />

            {/* Main Photo */}
            <div style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              borderRadius: '20px',
              overflow: 'hidden',
              background: '#0A0A0A'
            }}>
              <Image
                src="/instructor.png"
                alt="박교준"
                fill
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center'
                }}
                priority
              />

              {/* Gradient Overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, transparent 50%, rgba(0, 0, 0, 0.8) 100%)'
              }} />

              {/* Text Overlay */}
              <div style={{
                position: 'absolute',
                bottom: '2rem',
                left: '2rem',
                right: '2rem'
              }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.6)',
                  marginBottom: '0.5rem'
                }}>
                  수리논술 국내최고합격률
                </p>
                <p style={{
                  fontSize: '1.125rem',
                  color: '#FFFFFF',
                  fontWeight: '600'
                }}>
                  수학천재 박교준
                </p>
              </div>
            </div>
          </div>

          {/* Stats Below Photo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            style={{
              display: 'flex',
              gap: '3rem'
            }}
          >
            <div>
              <div style={{
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.25rem'
              }}>
                1,987+
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                letterSpacing: '0.05em'
              }}>
                합격생 배출
              </div>
            </div>
            <div>
              <div style={{
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.25rem'
              }}>
                92%
              </div>
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                letterSpacing: '0.05em'
              }}>
                평균 합격률
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Right Content - Education & Career */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 1 }}
        >

          {/* Education & Career List */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.6 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}
          >
            {/* Education Section */}
            <p style={{
              fontSize: '0.75rem',
              color: '#FFFFFF',
              marginBottom: '0.5rem',
              marginTop: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              학력
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                인천과학고 수석 졸업
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                서울대학교 자연대학 생명과학 수석 졸업
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                서울대학원 공과대학 기술경영 박사 수료
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                수능 수학 만점 · 수능 전국 300등
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                천문학 올림피아드 금상
              </span>
            </div>

            {/* Career Section */}
            <p style={{
              fontSize: '0.75rem',
              color: '#FFFFFF',
              marginBottom: '0.5rem',
              marginTop: '2rem',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              경력
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                대치 하이퍼논술 수리논술 전임강사
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                이투스NEO 최상위권 전담 수학강사
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                청솔학원 최상위권 미적분 강사
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                포엠학원 의치대반 수능·수리논술 전임강사
              </span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0',
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <div style={{
                width: '4px',
                height: '4px',
                background: '#FFFFFF',
                borderRadius: '50%'
              }} />
              <span style={{
                color: '#FFFFFF',
                fontSize: isMobile ? '2rem' : '2.5rem',
                fontWeight: '700'
              }}>
                대치 현상훈 수학학원 수리논술 전임강사
              </span>
            </div>
          </motion.div>
        </motion.div>
      </div>

    </section>
  )
}