"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Clock, Users, Star, CheckCircle, PlayCircle, BookOpen,
  MessageSquare, Calendar, User, Shield, ChevronDown, ChevronUp,
  Award, Target, Zap, TrendingUp, Gift, Timer, AlertCircle,
  Download, Video, FileText, Headphones, ArrowRight
} from "lucide-react"

// Class data interface
interface ClassDetail {
  id: string
  category: string
  title: string
  instructor: string
  description: string
  longDescription: string
  thumbnail: string
  price: number
  originalPrice: number
  duration: string
  level: string
  students: number
  rating: number
  features: string[]
  badge?: string
  curriculum: CurriculumItem[]
  reviews: Review[]
  faqs: FAQ[]
  instructorInfo: InstructorInfo
  refundPolicy: string
  classType: "live" | "vod" | "hybrid"
  startDate?: string
  schedule?: string
  totalLectures: number
  totalHours: number
  benefits: string[]
}

interface CurriculumItem {
  week: number
  title: string
  topics: string[]
  duration: string
}

interface Review {
  id: string
  author: string
  rating: number
  date: string
  content: string
  verified: boolean
}

interface FAQ {
  question: string
  answer: string
}

interface InstructorInfo {
  name: string
  title: string
  bio: string
  experience: string
  achievements: string[]
  image: string
}

// Mock data - would come from API
const getClassDetail = (id: string): ClassDetail | null => {
  const classDetails: Record<string, ClassDetail> = {
    "1": {
      id: "1",
      category: "수리논술",
      title: "수리논술 오페론",
      instructor: "박교준",
      description: "최상위 대학 수리논술 완벽 대비 프로그램",
      longDescription: "서울대, 연세대, 고려대를 비롯한 최상위 대학 수리논술 합격을 목표로 하는 최강 프로그램입니다. 10년간의 노하우와 데이터를 바탕으로 설계된 커리큘럼으로 수리논술의 정점을 경험하세요.",
      thumbnail: "/images/suri.jpg",
      price: 400000,           // 온라인 가격
      originalPrice: 800000,   // 오프라인 가격
      duration: "1개월 주1회 3시간",
      level: "고3, N수생",
      students: 89,
      rating: 5.0,
      features: ["대학별 맞춤", "논술 첨삭", "합격 보장제"],
      badge: "BEST",
      classType: "hybrid",
      startDate: "2025-03-01",
      schedule: "매주 토요일 14:00-18:00",
      totalLectures: 24,
      totalHours: 96,
      benefits: [
        "전 수업 녹화본 제공",
        "1:1 맞춤 첨삭 지도",
        "대학별 기출 문제 분석"
      ],
      curriculum: [
        {
          week: 1,
          title: "수리논술 기초 다지기",
          topics: ["논술의 기본 구조", "수학적 사고력 훈련", "논증 방법론"],
          duration: "4시간"
        },
        {
          week: 2,
          title: "대학별 출제 경향 분석",
          topics: ["서울대 수리논술 특징", "연세대 수리논술 특징", "고려대 수리논술 특징"],
          duration: "4시간"
        },
        {
          week: 3,
          title: "실전 문제 풀이",
          topics: ["기출 문제 분석", "풀이 전략 수립", "시간 관리법"],
          duration: "4시간"
        }
      ],
      reviews: [
        {
          id: "r1",
          author: "김*준",
          rating: 5,
          date: "2024-12-15",
          content: "서울대 수리논술 합격했습니다! 박교준 선생님 덕분에 논술에 자신감이 생겼어요.",
          verified: true
        },
        {
          id: "r2",
          author: "이*민",
          rating: 5,
          date: "2024-12-10",
          content: "체계적인 커리큘럼과 꼼꼼한 첨삭이 정말 도움이 많이 되었습니다.",
          verified: true
        }
      ],
      faqs: [
        {
          question: "수리논술, 내신 3등급 이하인데 높은 대학 가능할까요?",
          answer: "가능합니다. 제 학생들은 실제로 내신 3~4등급, 심지어 7등급대인 학생도 연고대, 서성한, 이대 등 상위 10위권 이내 대학들에 합격했습니다. 논술은 수학 실력만 있으면, 내신과 상관없이 충분히 가능합니다."
        },
        {
          question: "정말 최종 수학 2등급만 나오면 90% 합격하나요?",
          answer: "네. 맞습니다. 지난 17년간 데이터로 확인된 통계입니다. 박교준 선생님이 17년간 가르친 학생 중, 최종 수능 수학 2등급 이상이었던 학생은 매해 90% 이상 합격을 이뤄냈습니다."
        },
        {
          question: "왜 그렇게 수리논술 합격률이 높아요?",
          answer: "오직 결과로 증명해온 커리큘럼 & 강의 노하우 덕분입니다. 지난 해 기준, 상위 12개 대학(연고/서성한/중경외시/건동홍) 합격 건수만 1,000건 이상. 현장에서 18년을 뛰며 쌓인 노하우가 합격률을 견인합니다."
        },
        {
          question: "수능 공부랑 같이하기 너무 벅차지 않을까요?",
          answer: "오히려 수능 수학 실력이 크게 성장합니다. 수리논술 70%는 교과 범위(수능형) 재구성 문제이기에, 논술 대비 = 수능 대비 효과가 있습니다. 과거 수강생 다수는 논술 준비 덕분에 수능 수학 점수가 오히려 급상승했다고 이야기해줬습니다."
        },
        {
          question: "그냥 기출이나 풀면서 독학해도 되지 않나요?",
          answer: "어려우실 겁니다. 수리논술은 어떤 조건, 상황이 나오는지 학생이 캐치하기 어렵기 때문입니다. 지난 10여 년간 모든 대학의 기출 문제들을 알고 있는 강사와 같은 전문가가 아닌 이상 무엇을 공부해야 하는지조차 알기 어렵습니다."
        },
        {
          question: "오프라인·온라인 수업 어떤 차이가 있나요?",
          answer: "집중도와 진행 방식 정도의 차이입니다. 오프라인은 강사와 실시간 호흡, 즉각적 질의응답이 가능하고, 온라인은 시간·장소 제약 없이 수강, 반복 학습이 가능합니다. 관리와 커리큘럼은 동일합니다."
        },
        {
          question: "수업을 들으려면, 어느 정도 수학 실력이 필요한가요?",
          answer: "범위로는 수2까지 배운 상태라면 수업을 들을 수 있습니다. 매주 나가는 수업의 양이 매우 적기 때문에 마음만 먹는다면 얼마든지 그 주의 내용을 익힐 수 있습니다. 학생의 실력보다는 배움의 자세가 중요합니다."
        }
      ],
      instructorInfo: {
        name: "박교준",
        title: "수리논술 전문가",
        bio: "서울대학교 수학교육과 졸업, 전 대치동 1타 강사",
        experience: "15년",
        achievements: [
          "2024 수리논술 합격률 87%",
          "누적 수강생 5,000명 이상",
          "저서 '수리논술의 정석' 베스트셀러"
        ],
        image: "/images/parkkyojoon.jpeg"
      },
      refundPolicy: "수업 시작 전 100% 환불, 1주차 80%, 2주차 60%, 3주차 40%, 4주차 이후 환불 불가"
    },
    "2": {
      id: "2",
      category: "수능수학",
      title: "수능수학 추월반",
      instructor: "박교준",
      description: "수능 만점을 목표로 하는 최상위권 수학 완성 프로그램",
      longDescription: "수능 수학 1등급, 나아가 만점을 목표로 하는 학생들을 위한 최상위권 프로그램입니다. 개념부터 심화까지 체계적인 학습으로 수학 실력을 완성합니다.",
      thumbnail: "/images/suneung.jpg",
      price: 280000,           // 온라인 가격
      originalPrice: 400000,   // 오프라인 가격
      duration: "1개월 주1회 3시간",
      level: "고3, N수생",
      students: 234,
      rating: 4.9,
      features: ["매일 1:1 피드백", "맞춤형 문제", "실전 모의고사"],
      badge: "HOT",
      classType: "vod",
      totalLectures: 36,
      totalHours: 144,
      benefits: [
        "평생 소장 가능한 VOD",
        "매일 문제 풀이 피드백",
        "주간 모의고사 제공"
      ],
      curriculum: [
        {
          week: 1,
          title: "수능 수학 개념 총정리",
          topics: ["미적분 핵심 개념", "확률과 통계", "기하"],
          duration: "12시간"
        },
        {
          week: 2,
          title: "유형별 문제 풀이",
          topics: ["킬러 문항 공략", "준킬러 정복", "시간 단축 전략"],
          duration: "12시간"
        }
      ],
      reviews: [
        {
          id: "r3",
          author: "박*서",
          rating: 5,
          date: "2024-12-20",
          content: "6월 모평 3등급에서 수능 1등급 받았습니다!",
          verified: true
        }
      ],
      faqs: [
        {
          question: "수능 공부랑 같이하기 너무 벅차지 않을까요?",
          answer: "오히려 수능 수학 실력이 크게 성장합니다. 문제 해결 과정에서 '왜 이렇게 접근했는지'를 명확히 훈련하니, 수능에서 실수 줄이고, 사고력도 상승합니다."
        },
        {
          question: "오프라인·온라인 수업 어떤 차이가 있나요?",
          answer: "집중도와 진행 방식 정도의 차이입니다. 오프라인은 강사와 실시간 호흡, 즉각적 질의응답이 가능하고, 온라인은 시간·장소 제약 없이 수강, 반복 학습이 가능합니다."
        },
        {
          question: "수강하면 정말 지금보다 더 높은 대학 갈 수 있나요?",
          answer: "'높은 대학' 노리는 학생을 위해 탄생한 수업입니다. 박교준 수리논술을 거쳐, 본인 예상점수보다 훨씬 높은 대학에 합격한 학생이 매년 속출하고 있습니다."
        },
        {
          question: "수능에서 실패하면 결국 재수해야 하는 거 아닌가요?",
          answer: "플랜 B로 수리논술을 준비하세요. 수능과 병행 준비해둔 수리논술이 있다면, 합격 기회를 한 번 더 잡을 수 있습니다. 실제로, 수능 망쳤다고 눈물 흘리던 학생이 논술 합격 문자 받고 역전한 사례가 매년 등장합니다."
        },
        {
          question: "수업을 들으려면, 어느 정도 수학 실력이 필요한가요?",
          answer: "범위로는 수2까지 배운 상태라면 수업을 들을 수 있습니다. 수학 실력은 어떤 상태라도 수강이 가능합니다. 학생의 실력보다는 배움의 자세가 중요합니다."
        }
      ],
      instructorInfo: {
        name: "박교준",
        title: "수능 수학 전문가",
        bio: "서울대학교 수학교육과 졸업, EBS 수능 출제위원",
        experience: "15년",
        achievements: [
          "2024 수능 만점자 23명 배출",
          "평균 등급 상승 2.3등급",
          "EBS 수능특강 집필진"
        ],
        image: "/images/parkkyojoon.jpeg"
      },
      refundPolicy: "VOD 특성상 시청 시작 후 7일 이내 50%, 이후 환불 불가"
    },
    "3": {
      id: "3",
      category: "과학",
      title: "쌩노베 통합과학",
      instructor: "황윤지",
      description: "기초부터 시작하는 통합과학 완벽 마스터",
      longDescription: "과학이 어려운 학생들을 위한 기초부터 차근차근 시작하는 프로그램입니다. 통합과학의 모든 영역을 쉽고 재미있게 학습합니다.",
      thumbnail: "/images/class-main-3.jpg",
      price: 990000,
      originalPrice: 1490000,
      duration: "2개월",
      level: "고1-2",
      students: 450,
      rating: 4.8,
      features: ["기초부터", "예제 중심", "단계별 학습"],
      badge: "PREMIUM",
      classType: "live",
      startDate: "2025-03-01",
      schedule: "매주 화,목 19:00-21:00",
      totalLectures: 16,
      totalHours: 32,
      benefits: [
        "실시간 질의응답",
        "수업 자료 PDF 제공",
        "단원별 정리 노트",
        "실험 영상 자료",
        "기초 보충 자료"
      ],
      curriculum: [
        {
          week: 1,
          title: "물질과 규칙성",
          topics: ["물질의 구성", "화학 결합", "물질의 변화"],
          duration: "4시간"
        },
        {
          week: 2,
          title: "시스템과 상호작용",
          topics: ["역학적 시스템", "전기와 자기", "열과 에너지"],
          duration: "4시간"
        }
      ],
      reviews: [
        {
          id: "r4",
          author: "정*아",
          rating: 5,
          date: "2024-12-18",
          content: "과학 포기자였는데 이제는 과학이 재미있어요!",
          verified: true
        }
      ],
      faqs: [
        {
          question: "정말 기초가 없어도 들을 수 있나요?",
          answer: "네! 중학교 과학 개념부터 차근차근 복습하며 진행합니다."
        }
      ],
      instructorInfo: {
        name: "황윤지",
        title: "통합과학 전문 강사",
        bio: "연세대학교 생명과학과 졸업, 과학 교육 전문가",
        experience: "8년",
        achievements: [
          "유튜브 구독자 10만명",
          "과학 기초반 만족도 98%",
          "저서 '쌩노베도 할 수 있는 과학'"
        ],
        image: "/images/instructor-2.jpg"
      },
      refundPolicy: "수업 시작 전 100% 환불, 1주차 70%, 2주차 50%, 3주차 이후 환불 불가"
    }
  }

  return classDetails[id] || null
}

// Section Navigation Component
const SectionNav = ({ activeSection, onSectionChange }: {
  activeSection: string
  onSectionChange: (section: string) => void
}) => {
  const sections = [
    { id: "overview", label: "클래스 소개" },
    { id: "faq", label: "FAQ" },
    { id: "refund", label: "환불 정책" }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        marginBottom: '60px',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)'
      }}
    >
      {/* Modern Navigation Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        padding: '6px',
        background: 'rgba(15, 15, 15, 0.6)',
        backdropFilter: 'blur(60px) saturate(250%)',
        WebkitBackdropFilter: 'blur(60px) saturate(250%)',
        border: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '0 16px 64px rgba(0, 0, 0, 0.4), inset 0 2px 0 rgba(255, 255, 255, 0.2), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
        borderRadius: '14px',
        width: '100%'
      }}>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => onSectionChange(section.id)}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeSection === section.id ? '#007AFF' : 'transparent',
              border: 'none',
              borderRadius: '10px',
              color: activeSection === section.id ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.9rem',
              fontWeight: activeSection === section.id ? '600' : '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              textAlign: 'center'
            }}
          >
            {section.label}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

// Purchase Options Component
const PurchaseOptions = ({ classDetail }: { classDetail: ClassDetail }) => {
  const searchParams = useSearchParams()
  const initialOption = searchParams.get('option') as 'online' | 'offline' || 'online'
  
  const [selectedOption, setSelectedOption] = useState<'online' | 'offline'>(initialOption)
  const router = useRouter()

  // 수리논술: 온라인 40만, 오프라인 80만 / 수능수학: 온라인 28만, 오프라인 40만
  const onlinePrice = classDetail.price
  const offlinePrice = classDetail.originalPrice
  const textbookPrice = 38000
  
  // 수리논술은 교재 필수
  const isSuriNonsul = classDetail.category === "수리논술"

  const calculateTotal = () => {
    const packagePrice = selectedOption === 'online' ? onlinePrice : offlinePrice
    // 수리논술은 교재 필수 포함
    if (isSuriNonsul) {
      return packagePrice + textbookPrice
    }
    return packagePrice
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'sticky',
        top: '20px',
        background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.2), rgba(20, 20, 30, 0.3))',
        backdropFilter: 'blur(100px) saturate(350%)',
        WebkitBackdropFilter: 'blur(100px) saturate(350%)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        borderRadius: '24px',
        padding: '0',
        boxShadow: '0 40px 120px rgba(0, 0, 0, 0.6), inset 0 2px 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 rgba(255, 255, 255, 0.05)',
        maxHeight: 'calc(100vh - 40px)',
        overflowY: 'auto',
        overflow: 'hidden'
      }}
    >
      {/* Hero Section */}
      <div style={{
        padding: '24px 24px 20px',
        background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(138, 43, 226, 0.1))',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(circle at 70% 30%, rgba(0, 122, 255, 0.15), transparent 60%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(20px)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              marginBottom: '16px'
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#00FF88',
              animation: 'pulse 2s infinite'
            }} />
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: '#FFFFFF' }}>
              LIVE
            </span>
          </motion.div>

          <h2 style={{
            fontSize: '1.4rem',
            fontWeight: '800',
            marginBottom: '8px',
            color: '#FFFFFF',
            lineHeight: '1.3',
            letterSpacing: '-0.02em'
          }}>
            {classDetail.title}
          </h2>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <span style={{
              fontSize: '2.2rem',
              fontWeight: '900',
              background: 'linear-gradient(135deg, #007AFF, #0056CC)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em'
            }}>
              {Math.floor(onlinePrice / 10000)}만원~
            </span>
          </div>

        </div>
      </div>

      {/* Package Selection */}
      <div style={{ padding: '20px 24px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '16px'
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedOption('online')}
            style={{
              padding: '16px 12px',
              background: selectedOption === 'online'
                ? 'linear-gradient(135deg, rgba(0, 122, 255, 0.8), rgba(0, 198, 255, 0.6))'
                : 'rgba(255, 255, 255, 0.05)',
              border: selectedOption === 'online'
                ? '2px solid rgba(0, 122, 255, 0.8)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px' }}>
                온라인
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {Math.floor(onlinePrice / 10000)}만원
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedOption('offline')}
            style={{
              padding: '16px 12px',
              background: selectedOption === 'offline'
                ? 'linear-gradient(135deg, rgba(138, 43, 226, 0.8), rgba(147, 51, 234, 0.6))'
                : 'rgba(255, 255, 255, 0.05)',
              border: selectedOption === 'offline'
                ? '2px solid rgba(138, 43, 226, 0.8)'
                : '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              color: '#FFFFFF',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              backdropFilter: 'blur(20px)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', marginBottom: '4px' }}>
                오프라인
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                {Math.floor(offlinePrice / 10000)}만원
              </div>
            </div>
          </motion.button>
        </div>

        {/* Textbook - 수리논술은 필수 포함 */}
        {isSuriNonsul ? (
        <div style={{
          padding: '20px',
          background: 'rgba(0, 122, 255, 0.1)',
          backdropFilter: 'blur(50px) saturate(200%)',
          WebkitBackdropFilter: 'blur(50px) saturate(200%)',
          border: '1px solid rgba(0, 122, 255, 0.3)',
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          marginBottom: '16px',
          position: 'relative',
          zIndex: 1000
        }}>
          <div style={{
            marginBottom: '16px'
          }}>
            <div style={{
              fontSize: '1rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '4px'
            }}>
              교재 포함
            </div>
            <div style={{
              fontSize: '0.8rem',
              color: '#007AFF'
            }}>
              필수 포함 사항
            </div>
          </div>

          <div
            style={{
              width: '100%',
              padding: '16px 20px',
              background: 'rgba(0, 122, 255, 0.2)',
              border: '1px solid rgba(0, 122, 255, 0.4)',
              borderRadius: '12px',
              color: '#FFFFFF',
              fontSize: '0.95rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              textAlign: 'left'
            }}
          >
            <div>
              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                오페론 자체 교재
              </div>
              <div style={{ fontSize: '0.8rem', opacity: 0.7 }}>
                교재 1권 + 과제장 1권
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ 
                color: '#007AFF', 
                fontWeight: '600' 
              }}>
                {textbookPrice.toLocaleString()}원
              </span>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '4px',
                border: '2px solid #007AFF',
                background: '#007AFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <CheckCircle size={14} style={{ color: '#FFFFFF' }} />
              </div>
            </div>
          </div>
        </div>
        ) : (
        <div style={{
          padding: '20px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '16px',
          marginBottom: '16px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '0.9rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            교재 선택 없음
          </div>
        </div>
        )}

        {/* Price Breakdown */}
        <motion.div
          key={selectedOption}
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          style={{
            padding: '20px',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.03))',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: '20px',
            position: 'relative',
            zIndex: 1
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                {selectedOption === 'online' ? '온라인 수업' : '오프라인 수업'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                {selectedOption === 'online'
                  ? `${Math.floor(onlinePrice / 10000)}만원`
                  : `${Math.floor(offlinePrice / 10000)}만원`
                }
              </span>
            </div>
            {isSuriNonsul && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '6px'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                오페론 자체 교재 (필수)
              </span>
              <span style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.7)' }}>
                38,000원
              </span>
            </div>
            )}
            <div style={{
              height: '1px',
              background: 'rgba(255, 255, 255, 0.1)',
              marginBottom: '12px'
            }} />
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '8px' }}>
              최종 결제 금액
            </div>
            <div style={{
              fontSize: '1.4rem',
              fontWeight: '700',
              color: '#FFFFFF',
              marginBottom: '4px',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: '4px'
            }}>
              <span>
                {calculateTotal() >= 10000 
                  ? `${Math.floor(calculateTotal() / 10000)}만 ${(calculateTotal() % 10000).toLocaleString()}원`
                  : `${calculateTotal().toLocaleString()}원`
                }
              </span>
            </div>
          </div>
        </motion.div>

        {/* Benefits */}
        <div style={{
          padding: '16px',
          background: 'rgba(0, 255, 136, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 255, 136, 0.2)',
          borderRadius: '12px',
          marginBottom: '20px'
        }}>
          <div style={{
            fontSize: '0.8rem',
            fontWeight: '600',
            color: '#00FF88',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span>✨</span> 포함 혜택
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {classDetail.benefits.slice(0, 3).map((benefit, index) => (
              <div key={index} style={{
                fontSize: '0.8rem',
                color: 'rgba(255, 255, 255, 0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{
                  width: '4px',
                  height: '4px',
                  borderRadius: '50%',
                  background: '#00FF88'
                }} />
                {benefit}
              </div>
            ))}
          </div>
        </div>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <motion.button
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(`/apply/${classDetail.id}`)}
            style={{
              width: '100%',
              padding: '18px',
              background: 'linear-gradient(135deg, #007AFF, #0056CC)',
              border: 'none',
              borderRadius: '16px',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.3s ease',
              boxShadow: '0 8px 32px rgba(0, 122, 255, 0.4)',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
              animation: 'shimmer 2s infinite'
            }} />
            지금 수강 신청하기
          </motion.button>

          <button
            style={{
              width: '100%',
              padding: '14px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '12px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '0.9rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(10px)'
            }}
          >
            ♡ 관심 목록에 추가
          </button>
        </div>

      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
        @keyframes shimmer {
          0% { left: -100%; }
          100% { left: 100%; }
        }
      `}</style>
    </motion.div>
  )
}

// Add missing imports
import { ShoppingCart, Heart } from "lucide-react"

export default function ClassDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [activeSection, setActiveSection] = useState('overview')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  const classDetail = getClassDetail(params.id as string)

  if (!classDetail) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>클래스를 찾을 수 없습니다</h1>
          <button
            onClick={() => router.push('/classes')}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              cursor: 'pointer'
            }}
          >
            클래스 목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D0D0D',
      color: '#FFFFFF'
    }}>
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '40px 20px',
        display: 'grid',
        gridTemplateColumns: '1fr 380px',
        gap: '60px',
        alignItems: 'start'
      }}>
        {/* Left Section - Class Details */}
        <div>
          {/* Hero Image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              width: '100%',
              height: '400px',
              background: `linear-gradient(180deg, transparent, rgba(0,0,0,0.8)), url(${classDetail.thumbnail})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              borderRadius: '20px',
              marginBottom: '60px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            {classDetail.badge && (
              <div style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                padding: '8px 16px',
                background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
                borderRadius: '30px',
                fontWeight: '600',
                fontSize: '0.9rem'
              }}>
                {classDetail.badge}
              </div>
            )}

            <div style={{
              position: 'absolute',
              bottom: '20px',
              left: '20px',
              right: '20px'
            }}>
              <h1 style={{
                fontSize: '2.5rem',
                fontWeight: '800',
                marginBottom: '8px'
              }}>
                {classDetail.title}
              </h1>
              <p style={{
                fontSize: '1.1rem',
                color: 'rgba(255, 255, 255, 0.9)'
              }}>
                {classDetail.description}
              </p>
            </div>
          </motion.div>

          {/* Section Navigation */}
          <SectionNav activeSection={activeSection} onSectionChange={setActiveSection} />

          {/* Content Sections */}
          <AnimatePresence mode="wait">
            {activeSection === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                style={{ marginBottom: '80px' }}
              >
                {/* Flowing Title */}
                <motion.div
                  initial={{ opacity: 0, x: -30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  style={{
                    marginBottom: '40px',
                    position: 'relative'
                  }}
                >
                  <motion.div
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                    }}
                    transition={{
                      duration: 8,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(0, 122, 255, 0.1), transparent)',
                      backgroundSize: '200% 100%',
                      borderRadius: '12px'
                    }}
                  />
                  <h2 style={{
                    fontSize: '2.5rem',
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #FFFFFF, rgba(0, 122, 255, 0.9))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                    marginBottom: '16px',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    클래스 소개
                  </h2>
                </motion.div>

                {/* Flowing Description */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  style={{
                    marginBottom: '60px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '-20px',
                    right: '-20px',
                    bottom: '-20px',
                    background: 'radial-gradient(circle at 50% 50%, rgba(0, 122, 255, 0.05), transparent 70%)',
                    borderRadius: '24px'
                  }} />
                  <p style={{
                    fontSize: '1.2rem',
                    lineHeight: '1.8',
                    color: 'rgba(255, 255, 255, 0.9)',
                    textAlign: 'center',
                    maxWidth: '800px',
                    margin: '0 auto',
                    position: 'relative',
                    zIndex: 1
                  }}>
                    {classDetail.longDescription}
                  </p>
                </motion.div>

                {/* Floating Features */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  marginBottom: '60px'
                }}>
                  {classDetail.features.map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      whileHover={{
                        scale: 1.02,
                        x: index % 2 === 0 ? 10 : -10
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '20px',
                        padding: '24px 32px',
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                        backdropFilter: 'blur(40px) saturate(200%)',
                        WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '20px',
                        boxShadow: '0 16px 64px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        position: 'relative',
                        overflow: 'hidden',
                        cursor: 'pointer'
                      }}
                    >
                      <motion.div
                        animate={{
                          scale: [1, 1.2, 1],
                          rotate: [0, 180, 360]
                        }}
                        transition={{
                          duration: 4,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.5
                        }}
                        style={{
                          padding: '12px',
                          background: 'linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(0, 198, 255, 0.1))',
                          borderRadius: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <CheckCircle size={24} style={{ color: '#00C6FF' }} />
                      </motion.div>
                      <span style={{
                        fontSize: '1.1rem',
                        fontWeight: '500',
                        color: 'rgba(255, 255, 255, 0.9)'
                      }}>
                        {feature}
                      </span>
                      <motion.div
                        animate={{
                          x: [-100, 300],
                          opacity: [0, 0.5, 0]
                        }}
                        transition={{
                          duration: 3,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.8
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100px',
                          height: '100%',
                          background: 'linear-gradient(90deg, transparent, rgba(0, 122, 255, 0.1), transparent)',
                          pointerEvents: 'none'
                        }}
                      />
                    </motion.div>
                  ))}
                </div>

                {/* Flowing Stats */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '24px',
                    position: 'relative'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    inset: '-20px',
                    background: 'radial-gradient(ellipse at center, rgba(0, 122, 255, 0.05), transparent 70%)',
                    borderRadius: '24px'
                  }} />
                  {[
                    { value: classDetail.totalLectures, label: '총 강의 수', color: '#007AFF' },
                    { value: classDetail.totalHours, label: '총 시간', color: '#00C6FF' },
                    { value: classDetail.students, label: '수강생', color: '#00FF7F' },
                    { value: classDetail.rating, label: '평점', color: '#FFD700' }
                  ].map((stat, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: 1.2 + index * 0.1 }}
                      whileHover={{
                        scale: 1.05,
                        y: -5
                      }}
                      style={{
                        textAlign: 'center',
                        padding: '32px 20px',
                        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                        backdropFilter: 'blur(30px) saturate(180%)',
                        WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                        borderRadius: '20px',
                        position: 'relative',
                        zIndex: 1,
                        cursor: 'pointer'
                      }}
                    >
                      <motion.div
                        animate={{
                          scale: [1, 1.1, 1]
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: index * 0.3
                        }}
                        style={{
                          fontSize: '2.5rem',
                          fontWeight: '800',
                          background: `linear-gradient(135deg, ${stat.color}, ${stat.color}80)`,
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          backgroundClip: 'text',
                          marginBottom: '8px'
                        }}
                      >
                        {stat.value}
                      </motion.div>
                      <div style={{
                        fontSize: '0.95rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontWeight: '500'
                      }}>
                        {stat.label}
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </motion.div>
            )}


            {activeSection === 'faq' && (
              <motion.div
                key="faq"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>
                  자주 묻는 질문
                </h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {classDetail.faqs.map((faq, index) => (
                    <motion.div
                      key={index}
                      style={{
                        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                        backdropFilter: 'blur(25px) saturate(150%)',
                        WebkitBackdropFilter: 'blur(25px) saturate(150%)',
                        borderRadius: '16px',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                        style={{
                          width: '100%',
                          padding: '20px 24px',
                          background: 'transparent',
                          border: 'none',
                          color: '#FFFFFF',
                          fontSize: '1.05rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          textAlign: 'left'
                        }}
                      >
                        {faq.question}
                        <motion.div
                          animate={{ rotate: expandedFaq === index ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <ChevronDown size={20} />
                        </motion.div>
                      </button>
                      <AnimatePresence>
                        {expandedFaq === index && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{
                              borderTop: '1px solid rgba(255, 255, 255, 0.1)'
                            }}
                          >
                            <div style={{
                              padding: '20px 24px',
                              fontSize: '1rem',
                              lineHeight: '1.6',
                              color: 'rgba(255, 255, 255, 0.8)'
                            }}>
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeSection === 'refund' && (
              <motion.div
                key="refund"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <h2 style={{ fontSize: '1.8rem', fontWeight: '700', marginBottom: '20px' }}>
                  환불 정책
                </h2>
                <div style={{
                  padding: '28px',
                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
                  backdropFilter: 'blur(30px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(30px) saturate(180%)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                }}>
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <Shield size={24} style={{ color: '#4CAF50' }} />
                      <h3 style={{ fontSize: '1.2rem', fontWeight: '600' }}>강의 환불 규정</h3>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: '#FFFFFF' }}>기본 원칙</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.8', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <li>수업 시작 전: 전액 환불</li>
                        <li>개별 수업: 수업 예정 시간 24시간 전까지 취소 시 1회분 환불 가능</li>
                        <li>수업 예정 시간 24시간 이내 취소: 해당 회차 차감 및 환불 불가</li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: '#FFFFFF' }}>수업 경과 기준</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.8', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <li>수업 시작 후 1/3 경과 전: 실 결제 금액 – 수강료 1/3 금액 환불</li>
                        <li>수업 시작 후 1/2 경과 전: 실 결제 금액 – 수강료 1/2 금액 환불</li>
                        <li>수업 시작 후 1/2 초과 시: 환불 불가</li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: '#FFFFFF' }}>기준 금액</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.8', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <li>박교준 수리논술 온라인 정규 과정 (4주): ₩400,000</li>
                        <li>박교준 수리논술 온라인 정규 주 2회 과정 (4주): ₩600,000</li>
                        <li>박교준 수리논술 온라인 정규 주 3회 과정｜12주 코스 (4주): ₩800,000</li>
                        <li>박교준 수리논술 오프라인 과정 (4주): ₩800,000</li>
                        <li>박교준 수능 수학 추월반 패스 (4주): ₩300,000</li>
                        <li>박교준 수능 수학 단과 과정 (4주): ₩280,000</li>
                      </ul>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '12px', color: '#FFFFFF' }}>환불 처리</h4>
                      <ul style={{ paddingLeft: '20px', fontSize: '0.95rem', lineHeight: '1.8', color: 'rgba(255, 255, 255, 0.8)' }}>
                        <li>환불 요청 승인 시, 영업일 기준 7일 이내에 환불 처리</li>
                        <li>환불은 원 결제 수단으로 진행</li>
                      </ul>
                    </div>
                  </div>

                  <div style={{
                    padding: '16px',
                    background: 'rgba(255, 203, 5, 0.1)',
                    border: '1px solid rgba(255, 203, 5, 0.3)',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <AlertCircle size={20} style={{ color: '#FFCB05', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ fontSize: '0.95rem', lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.9)' }}>
                        환불 기준이 되는 진도는 수강생 개별 진도율이 아닌, 학생 수업 시작일 기준으로 진행되는 공통 커리큘럼 진도를 기준으로 산정됩니다. 
                        문의: parkkyojoon@gmail.com
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Section - Purchase Options */}
        <div>
          <PurchaseOptions classDetail={classDetail} />
        </div>
      </div>
    </div>
  )
}