"use client"

import { Youtube, ArrowUpRight, MessageCircle, Mail } from "lucide-react"
import Link from "next/link"

export default function Footer() {
  return (
    <footer style={{
      background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
      color: '#B0B0B0',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(0, 102, 255, 0.02) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0, 102, 255, 0.02) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px',
        opacity: 0.5
      }} />

      {/* Gradient Line Top */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '1px',
        background: 'linear-gradient(90deg, transparent, #0066FF, transparent)'
      }} />

      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '4rem 1rem 2rem',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '3rem',
          marginBottom: '3rem'
        }}>
          {/* Company Info */}
          <div>
            <h3 style={{
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: '1.5rem',
              fontSize: '1.1rem',
              letterSpacing: '-0.01em'
            }}>
              박교준 수리논술
            </h3>
            <div style={{
              fontSize: '0.85rem',
              color: '#808080',
              lineHeight: 1.8,
              letterSpacing: '-0.01em'
            }}>
              <p style={{ marginBottom: '0.5rem' }}>상호명: 박교준 입시연구소</p>
              <p style={{ marginBottom: '0.5rem' }}>사업자번호: 255-97-01477</p>
              <p style={{ marginBottom: '0.5rem' }}>대표자명: 박교준</p>
              <p style={{ marginBottom: '0.5rem' }}>주소: 인천광역시 연수구 해돋이로 120번길 23, 6층 608호 (송도동, 아크리아 빌딩2)</p>
              <p>이메일: parkkyojoon@gmail.com</p>
            </div>
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              marginTop: '1.5rem'
            }}>
              <a
                href="https://youtube.com/channel/UCBM-oZPd4yv9TYrv5QN7-Wg?si=0hVIWOq14It047bO"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255, 0, 0, 0.1)',
                  border: '1px solid rgba(255, 0, 0, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 0, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 0, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 0, 0, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(255, 0, 0, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <Youtube size={18} style={{ color: '#FF0000' }} />
              </a>
              <a
                href="http://pf.kakao.com/_YFDjn/chat"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(254, 229, 0, 0.1)',
                  border: '1px solid rgba(254, 229, 0, 0.2)',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(254, 229, 0, 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(254, 229, 0, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(254, 229, 0, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(254, 229, 0, 0.2)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <MessageCircle size={18} style={{ color: '#FEE500' }} />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 style={{
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '1.5rem',
              fontSize: '1rem',
              letterSpacing: '-0.01em'
            }}>
              바로가기
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {[
                { href: '/curriculum', label: '커리큘럼' },
                { href: '/classes', label: '수업 신청' },
                { href: 'https://m.blog.naver.com/PostView.naver?blogId=kseede&logNo=223160015159&referrerCode=0&searchKeyword=%EB%85%B8%EB%8B%B5%20%EC%9E%AC%EC%88%98%EC%83%9D', label: '합격 후기', external: true }
              ].map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    target={link.external ? '_blank' : undefined}
                    rel={link.external ? 'noopener noreferrer' : undefined}
                    style={{
                      color: '#808080',
                      textDecoration: 'none',
                      fontSize: '0.9rem',
                      transition: 'all 0.2s',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#0099FF';
                      e.currentTarget.style.transform = 'translateX(3px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#808080';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Programs */}
          <div>
            <h3 style={{
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '1.5rem',
              fontSize: '1rem',
              letterSpacing: '-0.01em'
            }}>
              프로그램
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              <li>
                <Link
                  href="/classes?category=수리논술"
                  style={{
                    color: '#808080',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0099FF';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#808080';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  수리논술
                </Link>
              </li>
              <li>
                <Link
                  href="/classes?category=수능수학"
                  style={{
                    color: '#808080',
                    textDecoration: 'none',
                    fontSize: '0.9rem',
                    transition: 'all 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#0099FF';
                    e.currentTarget.style.transform = 'translateX(3px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#808080';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  수능수학
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 style={{
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '1.5rem',
              fontSize: '1rem',
              letterSpacing: '-0.01em'
            }}>
              문의하기
            </h3>
            <ul style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem'
            }}>
              <li>
                <a
                  href="http://pf.kakao.com/_YFDjn/chat"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    textDecoration: 'none'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'rgba(254, 229, 0, 0.1)',
                    border: '1px solid rgba(254, 229, 0, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <MessageCircle size={14} style={{ color: '#FEE500' }} />
                  </div>
                  <div>
                    <p style={{
                      fontWeight: '600',
                      color: '#FFFFFF',
                      fontSize: '0.95rem',
                      marginBottom: '0.25rem',
                      letterSpacing: '-0.01em'
                    }}>카카오톡 상담</p>
                    <p style={{
                      fontSize: '0.85rem',
                      color: '#606060'
                    }}>클릭하여 상담하기</p>
                  </div>
                </a>
              </li>
              <li style={{
                display: 'flex',
                alignItems: 'start',
                gap: '0.75rem'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  background: 'rgba(0, 102, 255, 0.1)',
                  border: '1px solid rgba(0, 102, 255, 0.2)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '2px'
                }}>
                  <Mail size={14} style={{ color: '#0099FF' }} />
                </div>
                <span style={{
                  fontSize: '0.9rem',
                  color: '#808080',
                  lineHeight: 1.5
                }}>
                  parkkyojoon@gmail.com
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div style={{
          marginTop: '3rem',
          paddingTop: '2rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)'
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            <p style={{
              fontSize: '0.85rem',
              color: '#606060'
            }}>
              © 2025 박교준 입시연구소. All rights reserved.
            </p>
            <div style={{
              display: 'flex',
              gap: '2rem',
              fontSize: '0.85rem'
            }}>
              <Link
                href="/terms"
                target="_blank"
                style={{
                  color: '#606060',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#0099FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#606060';
                }}
              >
                이용약관(환불정책 포함)
              </Link>
              <Link
                href="/privacy"
                target="_blank"
                style={{
                  color: '#606060',
                  textDecoration: 'none',
                  transition: 'color 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#0099FF';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#606060';
                }}
              >
                개인정보처리방침
              </Link>
            </div>
          </div>
        </div>

        {/* Scroll to Top Button */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '50px',
            height: '50px',
            background: 'linear-gradient(135deg, #0066FF 0%, #0099FF 100%)',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0, 102, 255, 0.5)',
            transition: 'all 0.3s',
            zIndex: 1000
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 102, 255, 0.7)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 102, 255, 0.5)';
          }}
        >
          <ArrowUpRight size={24} style={{ color: '#FFFFFF' }} />
        </button>
      </div>
    </footer>
  )
}
