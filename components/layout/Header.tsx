"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const menuItems = [
    { label: "커리큘럼", href: "/curriculum" },
    { label: "수업 신청", href: "/classes" }
  ]

  return (
    <header style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '80px',
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
      <div style={{
        maxWidth: '1200px',
        height: '100%',
        margin: '0 auto',
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Logo */}
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
