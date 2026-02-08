"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { ArrowRight, Search } from "lucide-react"
import Link from "next/link"
import { useRouter, usePathname } from "next/navigation"

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const handleContactClick = (e: React.MouseEvent) => {
    e.preventDefault()
    if (pathname === '/') {
      // 이미 홈페이지에 있으면 스크롤
      const contactSection = document.getElementById('contact')
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // 다른 페이지면 홈으로 이동 후 스크롤
      router.push('/#contact')
    }
  }

  const menuItems = [
    { label: "클래스", href: "/classes" },
    { label: "강사 라인업", href: "/instructors" },
    { label: "합격후기", href: "/success" },
    { label: "문의", href: "/#contact", onClick: handleContactClick }
  ]

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '115px',
      background: isScrolled
        ? 'linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.06))'
        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
      backdropFilter: 'blur(25px) saturate(150%)',
      WebkitBackdropFilter: 'blur(25px) saturate(150%)',
      border: '1px solid rgba(255, 255, 255, 0.15)',
      borderTop: 'none',
      zIndex: 50,
      transition: 'all 0.3s ease',
      boxShadow: isScrolled
        ? '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : '0 4px 20px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
    }}>
      {/* Top Row - Logo, Search & Login */}
      <div style={{
        maxWidth: '1200px',
        height: '62px',
        margin: '0 auto',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo & Search */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px'
        }}>
          <Link href="/" style={{
            display: 'flex',
            alignItems: 'center',
            textDecoration: 'none'
          }}>
            <img 
              src="/logo.png" 
              alt="박교준 수리논술" 
              style={{ 
                height: '40px',
                width: 'auto'
              }} 
            />
          </Link>

          {/* Search Bar */}
          <div style={{
            position: 'relative',
            width: '300px'
          }}>
            <input
              type="text"
              placeholder="강사, 클래스 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 40px 8px 14px',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '0.85rem',
                outline: 'none',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onBlur={(e) => {
                e.target.style.background = 'rgba(255, 255, 255, 0.1)';
                e.target.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            />
            <Search
              size={16}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.5)',
                pointerEvents: 'none'
              }}
            />
          </div>
        </div>

        {/* Login */}
        <div>
          <Link href="/login" style={{
            color: 'rgba(255, 255, 255, 0.9)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            fontWeight: '600',
            fontFamily: 'Pretendard, sans-serif',
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}>
            로그인
          </Link>
        </div>
      </div>

      {/* Bottom Row - Navigation */}
      <div style={{
        maxWidth: '1200px',
        height: '44px',
        margin: '0 auto',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {/* Navigation Menu */}
        <nav style={{
          display: 'flex',
          alignItems: 'center',
          gap: '40px'
        }}>
          {menuItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              onClick={item.onClick}
              style={{
                color: 'rgba(255, 255, 255, 0.8)',
                textDecoration: 'none',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'color 0.2s ease',
                letterSpacing: '-0.01em',
                fontFamily: 'Pretendard, sans-serif'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255, 255, 255, 0.8)';
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}