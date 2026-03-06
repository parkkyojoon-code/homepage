"use client"

import Link from "next/link"

export default function Footer() {
  return (
    <footer style={{
      background: '#0a0a0a',
      borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      padding: '3rem 1rem 2rem',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {/* Company Info */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          marginBottom: '2rem'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem 2rem',
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.5)',
            lineHeight: 1.8
          }}>
            <span>상호명: 박교준 입시연구소</span>
            <span>사업자번호: 255-97-01477</span>
            <span>대표자명: 박교준</span>
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.5)',
            lineHeight: 1.8
          }}>
            주소: 인천광역시 연수구 해돋이로 120번길 23, 6층 608호 (송도동, 아크리아 빌딩2)
          </div>
          <div style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.5)',
            lineHeight: 1.8
          }}>
            이메일: <a 
              href="mailto:parkkyojoon@gmail.com" 
              style={{ 
                color: 'rgba(255, 255, 255, 0.5)', 
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
            >
              parkkyojoon@gmail.com
            </a>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          height: '1px',
          background: 'rgba(255, 255, 255, 0.08)',
          marginBottom: '1.5rem'
        }} />

        {/* Bottom Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Copyright */}
          <div style={{
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.4)'
          }}>
            © 2025 박교준 입시연구소. All rights reserved.
          </div>

          {/* Links */}
          <div style={{
            display: 'flex',
            gap: '2rem'
          }}>
            <Link 
              href="/terms" 
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.5)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
            >
              이용약관(환불정책 포함)
            </Link>
            <Link 
              href="/privacy" 
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255, 255, 255, 0.5)',
                textDecoration: 'none',
                transition: 'color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)'}
            >
              개인정보처리방침
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
