"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import ClassCard from "@/components/classes/ClassCard"
import {
  Grid3X3, Grid2X2, Search, ChevronDown,
  X, Sparkles, BookOpen,
  Clock, TrendingUp
} from "lucide-react"

// Component Types
interface TabButtonProps {
  isActive: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  children: React.ReactNode
  ariaLabel: string
  className?: string
}

// Reusable Tab Button Component
const TabButton = React.memo<TabButtonProps>(({
  isActive,
  onClick,
  onKeyDown,
  children,
  ariaLabel,
  className
}) => (
  <motion.button
    whileHover={{
      scale: 1.02,
      boxShadow: !isActive
        ? '0 4px 20px rgba(255, 255, 255, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        : undefined
    }}
    whileTap={{
      scale: 0.98,
      boxShadow: isActive
        ? 'inset 0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
    }}
    onClick={onClick}
    onKeyDown={onKeyDown}
    role="tab"
    aria-selected={isActive}
    aria-label={ariaLabel}
    tabIndex={0}
    className={className}
    style={{
      padding: '16px 32px',
      background: isActive
        ? 'linear-gradient(145deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))'
        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
      border: isActive
        ? '1px solid rgba(255, 255, 255, 0.3)'
        : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: isActive ? '#0D0D0D' : 'rgba(255, 255, 255, 0.8)',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      letterSpacing: '-0.01em',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      outline: 'none'
    }}
  >
    {isActive && (
      <motion.div
        layoutId="activeTabIndicator"
        initial={false}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
          duration: 0.3,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.8), transparent)',
          borderRadius: '2px',
          filter: 'blur(1px)'
        }}
      />
    )}
    {children}
  </motion.button>
))

TabButton.displayName = 'TabButton'

// Premium Tab Button Component
const PremiumTabButton = React.memo<TabButtonProps>(({
  isActive,
  onClick,
  onKeyDown,
  children,
  ariaLabel,
  className
}) => (
  <motion.button
    whileHover={{
      scale: 1.02,
      boxShadow: !isActive
        ? '0 4px 20px rgba(0, 122, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : undefined
    }}
    whileTap={{
      scale: 0.98,
      boxShadow: isActive
        ? 'inset 0 2px 8px rgba(0, 122, 255, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        : 'inset 0 2px 4px rgba(0, 0, 0, 0.1)'
    }}
    onClick={onClick}
    onKeyDown={onKeyDown}
    role="tab"
    aria-selected={isActive}
    aria-label={ariaLabel}
    tabIndex={0}
    className={className}
    style={{
      padding: '16px 32px',
      background: isActive
        ? 'linear-gradient(145deg, rgba(0, 122, 255, 0.9), rgba(0, 100, 220, 0.8))'
        : 'linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.04))',
      border: isActive
        ? '1px solid rgba(0, 122, 255, 0.5)'
        : '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '12px',
      color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.8)',
      fontSize: '1rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      letterSpacing: '-0.01em',
      position: 'relative',
      overflow: 'hidden',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      outline: 'none'
    }}
  >
    {isActive && (
      <motion.div
        layoutId="activePremiumTabIndicator"
        initial={false}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
          duration: 0.3,
          ease: "easeInOut"
        }}
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: '2px',
          background: 'linear-gradient(90deg, transparent, rgba(0, 198, 255, 0.8), transparent)',
          borderRadius: '2px',
          filter: 'blur(1px)'
        }}
      />
    )}
    {children}
  </motion.button>
))

PremiumTabButton.displayName = 'PremiumTabButton'

// Sub Tab Button Component (for Premium Categories)
interface SubTabButtonProps {
  isActive: boolean
  onClick: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  children: React.ReactNode
  ariaLabel: string
}

const SubTabButton = React.memo<SubTabButtonProps>(({
  isActive,
  onClick,
  onKeyDown,
  children,
  ariaLabel
}) => (
  <motion.button
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    onKeyDown={onKeyDown}
    role="tab"
    aria-selected={isActive}
    aria-label={ariaLabel}
    tabIndex={0}
    style={{
      padding: '8px 4px',
      background: 'transparent',
      border: 'none',
      color: isActive ? '#00C6FF' : 'rgba(255, 255, 255, 0.6)',
      fontSize: '0.9375rem',
      fontWeight: '600',
      cursor: 'pointer',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      letterSpacing: '-0.01em',
      position: 'relative',
      zIndex: 1,
      outline: 'none'
    }}
  >
    {children}
    {isActive && (
      <motion.div
        layoutId="activeSubTabIndicator"
        initial={false}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 30,
          duration: 0.3
        }}
        style={{
          position: 'absolute',
          bottom: '-2px',
          left: '0',
          right: '0',
          height: '3px',
          background: 'linear-gradient(90deg, transparent, #00C6FF, transparent)',
          borderRadius: '3px',
          filter: 'blur(1px)',
          boxShadow: '0 0 8px rgba(0, 198, 255, 0.5)'
        }}
      />
    )}
  </motion.button>
))

SubTabButton.displayName = 'SubTabButton'

// Error Boundary Component
interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Classes page error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>⚠️</div>
          <h2 style={{
            color: '#FFFFFF',
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '0.5rem'
          }}>
            문제가 발생했습니다
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '1rem',
            marginBottom: '1.5rem'
          }}>
            페이지를 새로고침하거나 잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(145deg, rgba(0, 122, 255, 0.9), rgba(0, 100, 220, 0.8))',
              border: '1px solid rgba(0, 122, 255, 0.5)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            페이지 새로고침
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

// Loading Spinner Component
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const LoadingSpinner = React.memo<LoadingSpinnerProps>(({
  size = 'md',
  color = '#007AFF'
}) => {
  const sizeMap = {
    sm: 16,
    md: 24,
    lg: 32
  }

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
      style={{
        width: sizeMap[size],
        height: sizeMap[size],
        border: `2px solid transparent`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%'
      }}
    />
  )
})

LoadingSpinner.displayName = 'LoadingSpinner'

// Loading State Component
interface LoadingStateProps {
  message?: string
}

const LoadingState = React.memo<LoadingStateProps>(({
  message = '로딩 중...'
}) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '400px',
      gap: '1rem'
    }}
  >
    <LoadingSpinner size="lg" />
    <p style={{
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '1rem',
      fontWeight: '500'
    }}>
      {message}
    </p>
  </motion.div>
))

LoadingState.displayName = 'LoadingState'

// Search Highlight Component
interface SearchHighlightProps {
  text: string
  searchTerm: string
  className?: string
}

const SearchHighlight = React.memo<SearchHighlightProps>(({
  text,
  searchTerm,
  className
}) => {
  if (!searchTerm) return <span className={className}>{text}</span>

  const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'))

  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.toLowerCase() === searchTerm.toLowerCase() ? (
          <mark
            key={index}
            style={{
              background: 'linear-gradient(135deg, #FFE066, #FFD700)',
              color: '#000',
              borderRadius: '2px',
              padding: '0 2px',
              fontWeight: '600'
            }}
          >
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </span>
  )
})

SearchHighlight.displayName = 'SearchHighlight'

// URL state management hook for deep linking
const useURLState = () => {
  const updateURL = useCallback((params: Record<string, string>) => {
    const url = new URL(window.location.href)
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        url.searchParams.set(key, value)
      } else {
        url.searchParams.delete(key)
      }
    })
    window.history.replaceState({}, '', url.toString())
  }, [])

  const getURLParams = useCallback(() => {
    const url = new URL(window.location.href)
    return {
      type: url.searchParams.get('type') || 'free',
      category: url.searchParams.get('category') || 'all',
      search: url.searchParams.get('search') || '',
      sort: url.searchParams.get('sort') || 'popular',
      page: url.searchParams.get('page') || '1'
    }
  }, [])

  return { updateURL, getURLParams }
}

// Responsive design hook
const useResponsive = () => {
  const [breakpoint, setBreakpoint] = useState<'mobile' | 'tablet' | 'desktop'>('desktop')

  useEffect(() => {
    const checkBreakpoint = () => {
      const width = window.innerWidth
      if (width < 768) {
        setBreakpoint('mobile')
      } else if (width < 1024) {
        setBreakpoint('tablet')
      } else {
        setBreakpoint('desktop')
      }
    }

    checkBreakpoint()
    window.addEventListener('resize', checkBreakpoint)
    return () => window.removeEventListener('resize', checkBreakpoint)
  }, [])

  const isMobile = breakpoint === 'mobile'
  const isTablet = breakpoint === 'tablet'
  const isDesktop = breakpoint === 'desktop'
  const isMobileOrTablet = isMobile || isTablet

  return {
    breakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isMobileOrTablet
  }
}

// Responsive grid configuration
const getResponsiveConfig = (breakpoint: 'mobile' | 'tablet' | 'desktop') => {
  switch (breakpoint) {
    case 'mobile':
      return {
        columns: 1,
        gap: '16px',
        padding: '16px',
        tabGap: '8px',
        fontSize: {
          hero: 'clamp(2rem, 8vw, 3rem)',
          title: '1.25rem',
          body: '0.875rem'
        }
      }
    case 'tablet':
      return {
        columns: 2,
        gap: '20px',
        padding: '20px',
        tabGap: '16px',
        fontSize: {
          hero: 'clamp(3rem, 6vw, 4rem)',
          title: '1.5rem',
          body: '1rem'
        }
      }
    case 'desktop':
    default:
      return {
        columns: 3,
        gap: '24px',
        padding: '24px',
        tabGap: '32px',
        fontSize: {
          hero: 'clamp(3rem, 7vw, 5rem)',
          title: '1.75rem',
          body: '1rem'
        }
      }
  }
}

// 클래스 데이터 타입
interface Class {
  id: string
  type: 'free' | 'premium'
  category: '수능수학' | '수리논술'
  title: string
  instructor: string
  description: string
  thumbnail: string
  price: number
  originalPrice: number
  duration: string
  level: '고1' | '고2' | '고3' | '고1-2'
  students: number
  rating: number
  features: string[]
  badge?: 'BEST' | 'HOT' | 'PREMIUM'
  popular?: boolean
  soldOut?: boolean
}

// 필터링 및 정렬 타입
type SortOption = 'popular' | 'price-low' | 'price-high' | 'rating'
type ViewMode = 'grid' | 'list'
type ClassType = 'free' | 'premium'

// 카테고리 타입
interface CategoryOption {
  id: string
  label: string
}

// 클래스 데이터 - API에서 로드
const premiumCategories: CategoryOption[] = [
  { id: "all", label: "전체" },
  { id: "수리논술", label: "수리논술" },
  { id: "수능수학", label: "수능수학" }
]

export default function ClassesPage() {
  const { updateURL, getURLParams } = useURLState()
  const { breakpoint, isMobile, isTablet, isMobileOrTablet } = useResponsive()
  const responsiveConfig = getResponsiveConfig(breakpoint)

  const [classesData, setClassesData] = useState<Class[]>([])
  const [classType, setClassType] = useState<ClassType>("premium")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<SortOption>("popular")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [viewMode, setViewMode] = useState<ViewMode>("grid")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 9
  const [isLoading, setIsLoading] = useState(false)

  // Error handling state
  const [error, setError] = useState<string | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)

  // Initialize state from URL parameters on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = getURLParams()
      setClassType(urlParams.type as ClassType)
      setSelectedCategory(urlParams.category)
      setSearchQuery(urlParams.search)
      setSortBy(urlParams.sort as SortOption)
      setCurrentPage(parseInt(urlParams.page))
    }
  }, [getURLParams])

  // Update URL when state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      updateURL({
        type: classType,
        category: selectedCategory,
        search: searchQuery,
        sort: sortBy,
        page: currentPage.toString()
      })
    }
  }, [classType, selectedCategory, searchQuery, sortBy, currentPage, updateURL])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCategory, searchQuery, sortBy, classType])

  // API에서 수업 데이터 로드
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setIsInitialLoading(true)
        setError(null)

        const res = await fetch('/api/classes')
        if (!res.ok) throw new Error('수업 데이터를 불러오는데 실패했습니다.')
        const data = await res.json()

        // API 데이터를 Class 인터페이스 형식으로 변환
        const mapped: Class[] = data.map((cls: any) => ({
          id:           cls.id,
          type:         'premium' as const,
          category:     cls.category,
          title:        cls.name,
          instructor:   '박교준',
          description:  cls.description,
          thumbnail:    cls.image ? `/api/images/${cls.image}` : '/images/suri.jpg',
          price:        cls.modes?.online?.price ?? 0,
          originalPrice: cls.modes?.offline?.price ?? cls.modes?.online?.price ?? 0,
          duration:     '1개월 주1회 3시간',
          level:        '고3, N수생',
          students:     0,
          rating:       5.0,
          features:     cls.keywords ?? [],
          badge:        cls.badge || undefined,
          popular:      !!cls.badge,
        }))

        setClassesData(mapped)
        setIsInitialLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.')
        setIsInitialLoading(false)
      }
    }


    loadInitialData()
  }, [])

  // 메모이제이션된 필터링 및 검색
  const filteredClasses = useMemo(() => {
    return classesData.filter(cls => {
      const matchCategory = selectedCategory === "all" || cls.category === selectedCategory
      const matchSearch = cls.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          cls.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCategory && matchSearch
    })
  }, [selectedCategory, searchQuery])

  // 메모이제이션된 정렬
  const sortedClasses = useMemo(() => {
    return [...filteredClasses].sort((a, b) => {
      switch(sortBy) {
        case "price-low":
          return a.price - b.price
        case "price-high":
          return b.price - a.price
        case "rating":
          return b.rating - a.rating
        case "popular":
        default:
          return (b.popular ? 1 : 0) - (a.popular ? 1 : 0)
      }
    })
  }, [filteredClasses, sortBy])

  // 메모이제이션된 페이지네이션 로직
  const paginationData = useMemo(() => {
    const totalPages = Math.ceil(sortedClasses.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    const paginatedClasses = sortedClasses.slice(startIndex, endIndex)

    return {
      totalPages,
      startIndex,
      endIndex,
      paginatedClasses
    }
  }, [sortedClasses, currentPage, itemsPerPage])

  // 메모이제이션된 이벤트 핸들러들
  const loadMore = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Simulate API call for more data
      await new Promise(resolve => setTimeout(resolve, 600))

      // Simulate potential error (uncomment to test error handling)
      // if (Math.random() > 0.9) {
      //   throw new Error('더 많은 클래스를 불러오는데 실패했습니다.')
      // }

      setCurrentPage(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleClassTypeChange = useCallback((type: ClassType) => {
    setClassType(type)
    setSelectedCategory('all')
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  // 키보드 네비게이션 핸들러
  const handleMainTabKeyDown = useCallback((e: React.KeyboardEvent, tabType: ClassType) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClassTypeChange(tabType)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const newType = tabType === 'free' ? 'premium' : 'free'
      handleClassTypeChange(newType)
    }
  }, [handleClassTypeChange])

  const handleSubTabKeyDown = useCallback((e: React.KeyboardEvent, categoryId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelectedCategory(categoryId)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      const currentIndex = premiumCategories.findIndex(cat => cat.id === selectedCategory)
      let newIndex: number

      if (e.key === 'ArrowLeft') {
        newIndex = currentIndex > 0 ? currentIndex - 1 : premiumCategories.length - 1
      } else {
        newIndex = currentIndex < premiumCategories.length - 1 ? currentIndex + 1 : 0
      }

      setSelectedCategory(premiumCategories[newIndex].id)
    }
  }, [selectedCategory])

  const handleSortChange = useCallback((value: SortOption) => {
    setSortBy(value)
  }, [])

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode)
  }, [])

  const clearFilters = useCallback(() => {
    setSelectedCategory("all")
    setSearchQuery("")
  }, [])

  // Show initial loading state
  if (isInitialLoading) {
    return <LoadingState message="클래스 데이터를 불러오는 중..." />
  }

  // Show error state
  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        background: '#000000'
      }}>
        <div style={{
          maxWidth: '500px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1.5rem'
          }}>❌</div>
          <h2 style={{
            color: '#FFFFFF',
            fontSize: '1.5rem',
            fontWeight: '600',
            marginBottom: '1rem'
          }}>
            오류가 발생했습니다
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontSize: '1rem',
            marginBottom: '2rem',
            lineHeight: 1.6
          }}>
            {error}
          </p>
          <button
            onClick={() => {
              setError(null)
              setIsInitialLoading(true)
              // Retry loading
              setTimeout(() => setIsInitialLoading(false), 1000)
            }}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(145deg, rgba(0, 122, 255, 0.9), rgba(0, 100, 220, 0.8))',
              border: '1px solid rgba(0, 122, 255, 0.5)',
              borderRadius: '8px',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
    <div style={{
      minHeight: '100vh',
      background: '#000000'
    }}>
      {/* Hero Section - Premium Framer Style */}
      <section style={{
        paddingTop: '120px',
        paddingBottom: '80px',
        background: 'radial-gradient(ellipse at top, rgba(0, 122, 255, 0.08) 0%, transparent 50%)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Animated Background Elements */}
        <div style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none'
        }}>
          <motion.div
            animate={{
              opacity: [0.3, 0.6, 0.3],
              scale: [1, 1.2, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              top: '20%',
              right: '10%',
              width: '300px',
              height: '300px',
              background: 'radial-gradient(circle, rgba(0, 122, 255, 0.1) 0%, transparent 70%)',
              filter: 'blur(40px)',
              borderRadius: '50%'
            }}
          />
          <motion.div
            animate={{
              opacity: [0.2, 0.5, 0.2],
              scale: [1.2, 1, 1.2],
            }}
            transition={{
              duration: 10,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '5%',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(0, 255, 255, 0.05) 0%, transparent 70%)',
              filter: 'blur(60px)',
              borderRadius: '50%'
            }}
          />
        </div>

        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: `0 ${responsiveConfig.padding}`,
          position: 'relative',
          zIndex: 1
        }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            style={{ textAlign: 'center' }}
          >

          </motion.div>
        </div>
      </section>

      {/* Minimal Filter & Search Section */}
      <section style={{
        position: 'sticky',
        top: '56px',
        zIndex: 40,
        background: 'rgba(0, 0, 0, 0.98)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: responsiveConfig.padding
        }}>
          {/* Category Tabs Only */}
          <div style={{ marginBottom: '20px' }}>
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: '8px'
              }}
            >
              <div
                role="tablist"
                aria-label="강의 카테고리 선택"
                style={{
                display: 'flex',
                gap: responsiveConfig.tabGap,
                justifyContent: 'center',
                position: 'relative'
              }}>
                {premiumCategories.map((category) => (
                  <SubTabButton
                    key={category.id}
                    isActive={selectedCategory === category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    onKeyDown={(e) => handleSubTabKeyDown(e, category.id)}
                    ariaLabel={`${category.label} 카테고리 선택`}
                  >
                    {category.label}
                  </SubTabButton>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Search & View Mode */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: isMobileOrTablet ? '16px' : '32px',
            marginBottom: '24px',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            <div style={{ flex: 1 }}></div>

            {/* View Mode Right Side */}
            <div style={{
              display: 'flex',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              <button
                onClick={() => handleViewModeChange('grid')}
                style={{
                  padding: '8px 12px',
                  background: viewMode === 'grid'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: viewMode === 'grid' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => handleViewModeChange('list')}
                style={{
                  padding: '8px 12px',
                  background: viewMode === 'list'
                    ? 'rgba(255, 255, 255, 0.1)'
                    : 'transparent',
                  border: 'none',
                  borderRadius: '6px',
                  color: viewMode === 'list' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
              >
                <Grid2X2 size={16} />
              </button>
            </div>
          </div>

          {/* Search & Sort Bar */}
          <div style={{
            display: 'flex',
            gap: isMobileOrTablet ? '8px' : '12px',
            alignItems: 'center',
            flexDirection: isMobile ? 'column' : 'row'
          }}>
            {/* Search Input */}
            <div style={{
              flex: 1,
              position: 'relative',
              width: isMobile ? '100%' : 'auto'
            }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.3)'
              }} />
              <input
                type="text"
                placeholder="검색..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px 12px 44px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  color: '#FFFFFF',
                  fontSize: '0.9375rem',
                  outline: 'none',
                  transition: 'all 0.2s',
                  letterSpacing: '-0.01em'
                }}
                onFocus={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.1)'
                }}
                onBlur={(e) => {
                  e.target.style.background = 'rgba(255, 255, 255, 0.03)'
                  e.target.style.borderColor = 'rgba(255, 255, 255, 0.05)'
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => handleSearchChange('')}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '20px',
                    height: '20px',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: 'none',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <X size={12} style={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                </button>
              )}
            </div>

            {/* Sort Dropdown */}
            <div style={{
              position: 'relative',
              width: isMobile ? '100%' : 'auto'
            }}>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                style={{
                  padding: '12px 40px 12px 16px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '10px',
                  color: 'rgba(255, 255, 255, 0.8)',
                  fontSize: '0.9375rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  minWidth: isMobile ? '100%' : '140px',
                  transition: 'all 0.2s'
                }}
              >
                <option value="popular" style={{ background: '#000' }}>인기순</option>
                <option value="price-low" style={{ background: '#000' }}>낮은 가격순</option>
                <option value="price-high" style={{ background: '#000' }}>높은 가격순</option>
                <option value="rating" style={{ background: '#000' }}>평점순</option>
              </select>
              <ChevronDown size={16} style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(255, 255, 255, 0.3)',
                pointerEvents: 'none'
              }} />
            </div>
          </div>
        </div>
      </section>

      {/* Classes Section with Premium Glass Effect */}
      <section style={{
        padding: `40px ${responsiveConfig.padding} 120px`,
        minHeight: '80vh',
        position: 'relative'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto'
        }}>
          {/* Results Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexDirection: isMobile ? 'column' : 'row',
              gap: isMobile ? '16px' : '0',
              marginBottom: '48px',
              padding: responsiveConfig.padding,
              background: 'rgba(255, 255, 255, 0.04)',
              backdropFilter: 'blur(16px) saturate(150%)',
              WebkitBackdropFilter: 'blur(16px) saturate(150%)',
              borderRadius: '20px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              boxShadow: '0 8px 32px rgba(0, 122, 255, 0.06)'
            }}
          >
            <div>
              <h2 style={{
                fontSize: responsiveConfig.fontSize.title,
                fontWeight: '800',
                color: '#FFFFFF',
                marginBottom: '8px',
                letterSpacing: '-0.02em'
              }}>
                <span style={{
                  background: 'linear-gradient(135deg, #007AFF, #00C6FF)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  {sortedClasses.length}
                </span>
                <span style={{ color: 'rgba(255, 255, 255, 0.9)', marginLeft: '8px' }}>
                  Classes Found
                </span>
              </h2>
              <p style={{
                fontSize: responsiveConfig.fontSize.body,
                color: 'rgba(255, 255, 255, 0.5)'
              }}>
                수능수학 2등급 이상만 받아오면, 수강생 90% 합격 신화!
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
              justifyContent: isMobile ? 'center' : 'flex-start'
            }}>
              {selectedCategory !== "all" && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(0, 122, 255, 0.1)',
                    border: '1px solid rgba(0, 122, 255, 0.2)',
                    borderRadius: '100px',
                    color: '#007AFF',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  {premiumCategories.find(c => c.id === selectedCategory)?.label}
                </motion.span>
              )}
              {searchQuery && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    padding: '8px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '100px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Search size={14} />
                  "{searchQuery}"
                </motion.span>
              )}
            </div>
          </motion.div>

          {/* Classes Grid with Animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage + selectedCategory + sortBy + searchQuery}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{
                display: 'grid',
                gridTemplateColumns: viewMode === 'grid'
                  ? `repeat(${responsiveConfig.columns}, 1fr)`
                  : '1fr',
                gap: responsiveConfig.gap,
                marginBottom: '60px'
              }}
            >
              {paginationData.paginatedClasses.map((cls, index) => (
                <motion.div
                  key={cls.id}
                  initial={{ opacity: 0, y: 40, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{
                    delay: index * 0.08,
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <ClassCard class={cls} viewMode={viewMode} />
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>

          {/* Pagination or Load More */}
          {paginationData.totalPages > 1 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '24px',
                marginTop: '60px'
              }}
            >
              {currentPage < paginationData.totalPages ? (
                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={loadMore}
                  disabled={isLoading}
                  style={{
                    padding: '18px 48px',
                    background: isLoading
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'linear-gradient(135deg, #007AFF, #0051D5)',
                    border: 'none',
                    borderRadius: '100px',
                    color: '#FFFFFF',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: isLoading ? 'wait' : 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isLoading
                      ? 'none'
                      : '0 8px 32px rgba(0, 122, 255, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  {isLoading ? (
                    <>
                      <LoadingSpinner size="sm" color="#FFFFFF" />
                      로딩 중...
                    </>
                  ) : (
                    <>
                      더 보기
                      <span style={{
                        padding: '4px 12px',
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '100px',
                        fontSize: '0.875rem'
                      }}>
                        {sortedClasses.length - paginationData.endIndex} more
                      </span>
                    </>
                  )}
                </motion.button>
              ) : (
                <div style={{
                  padding: '16px 32px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: '100px',
                  color: 'rgba(255, 255, 255, 0.4)',
                  fontSize: '0.9375rem',
                  fontWeight: '600'
                }}>
                  모든 클래스를 확인했습니다 ✨
                </div>
              )}

              {/* Page Indicator */}
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                {Array.from({ length: paginationData.totalPages }, (_, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setCurrentPage(i + 1)}
                    style={{
                      width: currentPage === i + 1 ? '32px' : '8px',
                      height: '8px',
                      background: currentPage === i + 1
                        ? 'linear-gradient(135deg, #007AFF, #00C6FF)'
                        : 'rgba(255, 255, 255, 0.2)',
                      border: 'none',
                      borderRadius: '100px',
                      cursor: 'pointer',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* Empty State with Glass Effect */}
          {sortedClasses.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              style={{
                textAlign: 'center',
                padding: `60px ${responsiveConfig.padding}`,
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(12px)',
                borderRadius: '32px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                style={{
                  fontSize: '5rem',
                  marginBottom: '32px'
                }}
              >
                🔍
              </motion.div>
              <h3 style={{
                fontSize: '2rem',
                fontWeight: '800',
                color: '#FFFFFF',
                marginBottom: '16px',
                letterSpacing: '-0.02em'
              }}>
                클래스를 찾을 수 없습니다
              </h3>
              <p style={{
                fontSize: '1.125rem',
                color: 'rgba(255, 255, 255, 0.5)',
                marginBottom: '40px',
                maxWidth: '400px',
                margin: '0 auto 40px'
              }}>
                다른 카테고리나 검색어로
                <br />
                원하시는 클래스를 찾아보세요
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={clearFilters}
                style={{
                  padding: '16px 40px',
                  background: 'linear-gradient(135deg, #007AFF, #0051D5)',
                  border: 'none',
                  borderRadius: '100px',
                  color: '#FFFFFF',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(0, 122, 255, 0.25)',
                  transition: 'all 0.3s'
                }}
              >
                전체 클래스 보기
              </motion.button>
            </motion.div>
          )}
        </div>
      </section>
    </div>
    </ErrorBoundary>
  )
}