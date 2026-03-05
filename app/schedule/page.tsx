"use client"

import { motion } from "framer-motion"
import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, MessageCircle } from "lucide-react"

export default function SchedulePage() {
  const [selectedTab, setSelectedTab] = useState<"suri" | "suneung">("suri")

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      paddingTop: '100px'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        {/* Back Button */}
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

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: '800',
            marginBottom: '1rem',
            lineHeight: 1.2
          }}>
            <span style={{ color: '#FFFFFF' }}>수업 </span>
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>시간표</span>
          </h1>
          <p style={{
            color: '#808080',
            fontSize: '1.1rem'
          }}>
            박교준 수리논술 & 수능수학 수업 일정
          </p>
        </motion.div>

        {/* Tab Selector */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          marginBottom: '3rem'
        }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            padding: '6px'
          }}>
            <button
              onClick={() => setSelectedTab("suri")}
              style={{
                padding: '1rem 2.5rem',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '1rem',
                transition: 'all 0.3s',
                border: 'none',
                cursor: 'pointer',
                background: selectedTab === "suri"
                  ? 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)'
                  : 'transparent',
                color: selectedTab === "suri" ? '#FFFFFF' : '#808080',
                boxShadow: selectedTab === "suri" ? '0 0 20px rgba(0, 102, 255, 0.5)' : 'none'
              }}
            >
              수리논술 시간표
            </button>
            <button
              onClick={() => setSelectedTab("suneung")}
              style={{
                padding: '1rem 2.5rem',
                borderRadius: '12px',
                fontWeight: '700',
                fontSize: '1rem',
                transition: 'all 0.3s',
                border: 'none',
                cursor: 'pointer',
                background: selectedTab === "suneung"
                  ? 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)'
                  : 'transparent',
                color: selectedTab === "suneung" ? '#FFFFFF' : '#808080',
                boxShadow: selectedTab === "suneung" ? '0 0 20px rgba(0, 102, 255, 0.5)' : 'none'
              }}
            >
              수능수학 시간표
            </button>
          </div>
        </div>

        {/* Schedule Image */}
        <motion.div
          key={selectedTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            maxWidth: '1000px',
            margin: '0 auto',
            marginBottom: '4rem'
          }}
        >
          <div style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            overflow: 'hidden',
            padding: '2rem'
          }}>
            <img
              src={selectedTab === "suri" ? "/images/schedule-suri.png" : "/images/schedule-suneung.png"}
              alt={selectedTab === "suri" ? "수리논술 시간표" : "수능수학 시간표"}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: '12px'
              }}
            />
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'rgba(0, 102, 255, 0.05)',
            border: '1px solid rgba(0, 102, 255, 0.1)',
            borderRadius: '24px',
            marginBottom: '4rem'
          }}
        >
          <h3 style={{
            fontSize: '1.5rem',
            fontWeight: '700',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            수업 신청 및 상담
          </h3>
          <p style={{
            fontSize: '1rem',
            color: '#808080',
            marginBottom: '2rem'
          }}>
            카카오톡으로 빠르게 상담받으세요
          </p>
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
              style={{ textDecoration: 'none' }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '1rem 2.5rem',
                  background: 'linear-gradient(135deg, #FEE500 0%, #E5CF00 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#000000',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  boxShadow: '0 4px 20px rgba(254, 229, 0, 0.3)'
                }}
              >
                <MessageCircle size={20} />
                카카오톡 상담하기
              </motion.button>
            </a>
            <Link href="/classes" style={{ textDecoration: 'none' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: '1rem 2.5rem',
                  background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(0, 102, 255, 0.3)'
                }}
              >
                수업 신청하기
              </motion.button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
