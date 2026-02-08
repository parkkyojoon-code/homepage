"use client"

import { motion } from "framer-motion"
import { Clock, Users, Star, Heart, ArrowRight } from "lucide-react"
import { useState } from "react"
import Image from "next/image"

interface ClassCardProps {
  class: {
    id: string
    category: string
    title: string
    instructor: string
    description: string
    thumbnail: string
    price: number
    originalPrice: number
    duration: string
    level: string
    students: number
    rating: number
    features: string[]
    badge?: string
    popular?: boolean
    soldOut?: boolean
  }
  viewMode?: 'grid' | 'list'
}

export default function ClassCard({ class: cls, viewMode = 'grid' }: ClassCardProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  const discountRate = cls.originalPrice > cls.price ?
    Math.round((1 - cls.price / cls.originalPrice) * 100) : 0

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ko-KR').format(price)
  }

  const handleBuyNow = () => {
    // 클래스 상세 페이지로 이동
    window.location.href = `/classes/${cls.id}`
  }

  if (viewMode === 'list') {
    return (
      <motion.div
        whileHover={{ x: 4 }}
        style={{
          display: 'flex',
          gap: '1.5rem',
          padding: '1.5rem',
          background: isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
          borderRadius: '12px',
          transition: 'all 0.2s',
          cursor: 'pointer',
          position: 'relative'
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleBuyNow}
      >
        {/* List View Thumbnail */}
        <div style={{
          width: '180px',
          height: '120px',
          flexShrink: 0,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #1a1a1a, #2a2a2a)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '2rem',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {cls.badge && (
            <div style={{
              position: 'absolute',
              top: '0.5rem',
              left: '0.5rem',
              padding: '0.25rem 0.5rem',
              background: cls.badge === 'BEST' ? '#0066FF' : '#FF3333',
              borderRadius: '4px',
              fontSize: '0.625rem',
              fontWeight: '700',
              color: '#FFFFFF',
              letterSpacing: '0.05em'
            }}>
              {cls.badge}
            </div>
          )}
          📚
        </div>

        {/* List View Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '0.5rem'
          }}>
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '0.25rem'
              }}>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#0099FF',
                  fontWeight: '600'
                }}>
                  {cls.category}
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  color: '#666666'
                }}>
                  {cls.level}
                </span>
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: '700',
                color: '#FFFFFF',
                marginBottom: '0.25rem'
              }}>
                {cls.title}
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: '#808080'
              }}>
                {cls.instructor}
              </p>
            </div>

            {/* List View Price */}
            <div style={{
              textAlign: 'right',
              minWidth: '120px'
            }}>
              {discountRate > 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: '0.5rem',
                  marginBottom: '0.25rem'
                }}>
                  <span style={{
                    fontSize: '0.875rem',
                    color: '#606060',
                    textDecoration: 'line-through'
                  }}>
                    ₩{formatPrice(cls.originalPrice)}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: '#FF3333'
                  }}>
                    {discountRate}%
                  </span>
                </div>
              )}
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '800',
                color: '#FFFFFF'
              }}>
                ₩{formatPrice(cls.price)}
              </div>
            </div>
          </div>

          <p style={{
            fontSize: '0.875rem',
            color: '#808080',
            marginBottom: '0.75rem',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {cls.description}
          </p>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{
              display: 'flex',
              gap: '1rem'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Clock size={14} style={{ color: '#666666' }} />
                <span style={{ fontSize: '0.8125rem', color: '#808080' }}>
                  {cls.duration}
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Users size={14} style={{ color: '#666666' }} />
                <span style={{ fontSize: '0.8125rem', color: '#808080' }}>
                  {cls.students.toLocaleString()}명
                </span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}>
                <Star size={14} style={{ color: '#FFD700', fill: '#FFD700' }} />
                <span style={{ fontSize: '0.8125rem', color: '#808080' }}>
                  {cls.rating}
                </span>
              </div>
            </div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                color: '#0099FF',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              자세히 보기 <ArrowRight size={16} />
            </motion.div>
          </div>
        </div>
      </motion.div>
    )
  }

  // Grid View (Premium Glass Style)
  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        borderRadius: '24px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        border: '1px solid',
        borderColor: isHovered ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
        boxShadow: isHovered
          ? '0 32px 64px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          : '0 8px 32px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.03)'
      }}
    >

      {/* Glass Shimmer Effect */}
      <motion.div
        initial={{ opacity: 0, x: -100 }}
        animate={{
          opacity: isHovered ? [0, 1, 0] : 0,
          x: isHovered ? [-100, 400] : -100
        }}
        transition={{
          duration: isHovered ? 1.2 : 0,
          ease: 'easeInOut',
          delay: 0.1
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100px',
          height: '100%',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent)',
          pointerEvents: 'none',
          zIndex: 3
        }}
      />

      {/* Glass Morphism Gradient */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isHovered ? 1 : 0
        }}
        transition={{
          duration: 0.4,
          ease: [0.4, 0, 0.2, 1]
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '60%',
          background: 'linear-gradient(to top, rgba(0, 122, 255, 0.12) 0%, rgba(0, 198, 255, 0.06) 40%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />

      {/* Premium Glass Border */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{
          opacity: isHovered ? 1 : 0
        }}
        transition={{
          duration: 0.3,
          ease: 'easeOut'
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '2px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(0, 122, 255, 0.6) 30%, rgba(0, 198, 255, 0.8) 50%, rgba(0, 122, 255, 0.6) 70%, transparent 100%)',
          pointerEvents: 'none',
          zIndex: 2
        }}
      />

      {/* Frosted Glass Overlay */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.01) 50%, rgba(255, 255, 255, 0.02) 100%)',
          pointerEvents: 'none',
          zIndex: 1
        }}
      />
      {/* Badge with Glass Effect */}
      {cls.badge && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          style={{
            position: 'absolute',
            top: '1rem',
            left: '1rem',
            padding: '6px 14px',
            background: cls.badge === 'BEST'
              ? 'linear-gradient(135deg, #007AFF, #0051D5)'
              : cls.badge === 'HOT'
              ? 'linear-gradient(135deg, #FF3B30, #FF2D55)'
              : 'linear-gradient(135deg, #AF52DE, #8E44AD)',
            borderRadius: '100px',
            fontSize: '0.6875rem',
            fontWeight: '700',
            color: '#FFFFFF',
            zIndex: 10,
            letterSpacing: '0.08em',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
          }}>
          {cls.badge}
        </motion.div>
      )}

      {/* Like Button with Glass Effect */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={(e) => {
          e.stopPropagation()
          setIsLiked(!isLiked)
        }}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          width: '40px',
          height: '40px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <Heart
          size={18}
          style={{
            color: isLiked ? '#FF3B30' : 'rgba(255, 255, 255, 0.8)',
            fill: isLiked ? '#FF3B30' : 'none',
            filter: isLiked ? 'drop-shadow(0 0 8px rgba(255, 59, 48, 0.5))' : 'none'
          }}
        />
      </motion.button>

      {/* Thumbnail with Premium Gradient */}
      <div style={{
        position: 'relative',
        paddingTop: '56.25%',
        background: `linear-gradient(135deg,
          rgba(0, 122, 255, 0.1) 0%,
          rgba(0, 198, 255, 0.05) 50%,
          rgba(13, 13, 13, 0.9) 100%)`,
        overflow: 'hidden'
      }}>
        {/* Animated Background Pattern */}
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
            ease: 'linear'
          }}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              rgba(0, 122, 255, 0.03) 10px,
              rgba(0, 122, 255, 0.03) 20px
            )`,
            backgroundSize: '200% 200%'
          }}
        />

        {/* Thumbnail Image */}
        <div style={{
          position: 'absolute',
          inset: 0
        }}>
          <Image
            src={cls.thumbnail}
            alt={cls.title}
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            style={{
              objectFit: 'cover',
              transition: 'transform 0.4s ease'
            }}
          />
        </div>

        {/* Sold Out Overlay */}
        {cls.soldOut && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <div style={{
              padding: '0.5rem 1.5rem',
              background: 'rgba(255, 51, 51, 0.15)',
              border: '1px solid rgba(255, 51, 51, 0.5)',
              borderRadius: '6px',
              fontSize: '0.875rem',
              fontWeight: '700',
              color: '#FF3333',
              letterSpacing: '0.05em'
            }}>
              마감
            </div>
          </div>
        )}

        {/* Hover Overlay */}
        <motion.div
          animate={{
            opacity: isHovered && !cls.soldOut ? 1 : 0
          }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, transparent 50%)',
            pointerEvents: 'none'
          }}
        />
      </div>

      {/* Content with Glass Overlay */}
      <div style={{ padding: '1.5rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Category & Level Pills */}
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '12px'
        }}>
          <span style={{
            padding: '4px 10px',
            background: 'rgba(0, 122, 255, 0.1)',
            border: '1px solid rgba(0, 122, 255, 0.2)',
            borderRadius: '100px',
            fontSize: '0.75rem',
            color: '#007AFF',
            fontWeight: '600',
            letterSpacing: '0.03em'
          }}>
            {cls.category}
          </span>
          <span style={{
            padding: '4px 10px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '100px',
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            letterSpacing: '0.03em'
          }}>
            {cls.level}
          </span>
        </div>

        {/* Title */}
        <h3 style={{
          fontSize: '1rem',
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: '0.375rem',
          lineHeight: 1.3,
          letterSpacing: '-0.02em'
        }}>
          {cls.title}
        </h3>

        {/* Instructor */}
        <p style={{
          fontSize: '0.8125rem',
          color: '#666666',
          marginBottom: '0.625rem'
        }}>
          {cls.instructor}
        </p>

        {/* Description */}
        <p style={{
          fontSize: '0.8125rem',
          color: '#808080',
          marginBottom: '0.875rem',
          lineHeight: 1.4,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {cls.description}
        </p>

        {/* Duration Only */}
        <div style={{
          display: 'flex',
          gap: '0.875rem',
          marginBottom: '1.25rem',
          paddingBottom: '0.875rem',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem'
          }}>
            <Clock size={14} style={{ color: '#007AFF' }} />
            <span style={{ fontSize: '0.875rem', color: '#FFFFFF', fontWeight: '500' }}>
              {cls.duration}
            </span>
          </div>
        </div>

        {/* Trendy Price */}
        <div style={{ marginBottom: '1rem' }}>
          {discountRate > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.4)',
                textDecoration: 'line-through'
              }}>
                ₩{formatPrice(cls.originalPrice)}
              </span>
              <span style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: '#FF3B30',
                background: 'rgba(255, 59, 48, 0.1)',
                padding: '2px 6px',
                borderRadius: '4px'
              }}>
                -{discountRate}%
              </span>
            </div>
          )}
          <div style={{
            fontSize: '1.375rem',
            fontWeight: '700',
            color: '#FFFFFF',
            letterSpacing: '-0.02em'
          }}>
            ₩{formatPrice(cls.price)}
          </div>
        </div>

        {/* CTA Button with Premium Style */}
        <div style={{ marginTop: 'auto' }}>
          <motion.button
            whileHover={cls.soldOut ? {} : { scale: 1.02, y: -2 }}
            whileTap={cls.soldOut ? {} : { scale: 0.98 }}
            onClick={cls.soldOut ? undefined : handleBuyNow}
            disabled={cls.soldOut}
            style={{
              width: '100%',
              padding: '14px',
              background: cls.soldOut
                ? 'rgba(255, 255, 255, 0.03)'
                : isHovered
                ? 'linear-gradient(145deg, rgba(0, 122, 255, 0.95), rgba(0, 100, 220, 0.85))'
                : 'linear-gradient(145deg, rgba(0, 122, 255, 0.85), rgba(0, 100, 220, 0.75))',
              backdropFilter: cls.soldOut ? 'none' : 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: cls.soldOut ? 'none' : 'blur(20px) saturate(180%)',
              border: '1px solid',
              borderColor: cls.soldOut
                ? 'rgba(255, 255, 255, 0.06)'
                : isHovered
                ? 'rgba(0, 198, 255, 0.5)'
                : 'rgba(0, 122, 255, 0.3)',
              borderRadius: '12px',
              color: cls.soldOut ? 'rgba(255, 255, 255, 0.3)' : '#FFFFFF',
              fontSize: '0.9375rem',
              fontWeight: '600',
              cursor: cls.soldOut ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              letterSpacing: '-0.01em',
              boxShadow: cls.soldOut
                ? 'none'
                : isHovered
                ? `
                    0 12px 32px rgba(0, 122, 255, 0.4),
                    0 4px 16px rgba(0, 122, 255, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.1),
                    0 0 0 1px rgba(0, 122, 255, 0.2)
                  `
                : `
                    0 6px 20px rgba(0, 122, 255, 0.2),
                    0 2px 8px rgba(0, 122, 255, 0.15),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2),
                    inset 0 -1px 0 rgba(0, 0, 0, 0.05)
                  `,
              position: 'relative',
              zIndex: 10,
              overflow: 'hidden'
            }}
          >
            {/* Glass Shine Effect */}
            {!cls.soldOut && (
              <motion.div
                initial={{ opacity: 0, x: -100 }}
                animate={{
                  opacity: isHovered ? [0, 1, 0] : 0,
                  x: isHovered ? [-100, 150] : -100
                }}
                transition={{
                  duration: isHovered ? 0.8 : 0,
                  ease: 'easeInOut',
                  delay: 0.1
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '60px',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                  pointerEvents: 'none'
                }}
              />
            )}
            {cls.soldOut ? '마감' : '수강 신청'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}