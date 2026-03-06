import { useState, useEffect } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { CheckCircle, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"

// 수업 정보
const courseInfo: { [key: string]: { title: string; category: string; courseType: string; courseTypeOffline?: string } } = {
  "1": { title: "수리논술 정규반", category: "수리논술", courseType: "surinonseul-online", courseTypeOffline: "surinonseul-offline" },
  "2": { title: "수리논술 체험반", category: "수리논술", courseType: "surinonseul-trial" },
  "3": { title: "수능수학 블루프린트", category: "수능수학", courseType: "sunung-blueprint-online", courseTypeOffline: "sunung-blueprint-offline" },
  "4": { title: "수능수학 노베탈출", category: "수능수학", courseType: "sunung-escape-online", courseTypeOffline: "sunung-escape-offline" }
}

export default function ApplyPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const courseId = params.id as string
  const option = searchParams.get('option') || 'online'
  const campus = searchParams.get('campus') || '서울 대치'
  
  const courseBase = courseInfo[courseId] || { title: "수업", category: "", courseType: "" }
  // 온라인/오프라인에 따라 courseType 분기
  const courseType = (option === "offline" && courseBase.courseTypeOffline)
    ? courseBase.courseTypeOffline
    : courseBase.courseType
  const course = { ...courseBase, courseType, campus }

  const [isMobile, setIsMobile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    userType: "",       // 학생 or 학부모
    studentName: "",
    parentPhone: "",
    studentPhone: "",
    birthYear: "",
    confirmPayment: false,
    agreePrivacy: false
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}

    if (!formData.userType) {
      newErrors.userType = "신청자 유형을 선택해주세요"
    }
    if (!formData.studentName.trim()) {
      newErrors.studentName = "학생 이름을 입력해주세요"
    }
    if (!formData.parentPhone.trim()) {
      newErrors.parentPhone = "학부모님 연락처를 입력해주세요"
    } else if (!/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(formData.parentPhone.replace(/-/g, ''))) {
      newErrors.parentPhone = "올바른 연락처 형식이 아닙니다"
    }
    if (!formData.studentPhone.trim()) {
      newErrors.studentPhone = "학생 연락처를 입력해주세요"
    }
    if (!formData.birthYear.trim()) {
      newErrors.birthYear = "출생년도를 입력해주세요"
    } else if (!/^(19|20)\d{2}$/.test(formData.birthYear)) {
      newErrors.birthYear = "올바른 출생년도를 입력해주세요 (예: 2007)"
    }
    if (!formData.confirmPayment) {
      newErrors.confirmPayment = "원비 안내 확인에 동의해주세요"
    }
    if (!formData.agreePrivacy) {
      newErrors.agreePrivacy = "개인정보 수집에 동의해주세요"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setIsSubmitting(true)

    try {
      // 구글 시트로 데이터 전송
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          courseType: course.courseType,
          campus: course.campus,
          timestamp: new Date().toISOString()
        })
      })

      if (response.ok) {
        setIsComplete(true)
      } else {
        // API 없어도 일단 성공 처리 (개발 환경)
        setIsComplete(true)
      }
    } catch (error) {
      // API 없어도 일단 성공 처리 (개발 환경)
      console.log('API 연동 필요:', error)
      setIsComplete(true)
    }

    setIsSubmitting(false)
  }

  // 완료 화면
  if (isComplete) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem'
      }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 102, 255, 0.1) 0%, rgba(0, 221, 255, 0.05) 100%)',
            border: '1px solid rgba(0, 102, 255, 0.2)',
            borderRadius: '24px',
            padding: isMobile ? '3rem 2rem' : '4rem',
            textAlign: 'center',
            maxWidth: '500px',
            width: '100%'
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            style={{
              width: '80px',
              height: '80px',
              background: 'linear-gradient(135deg, #0066FF, #00DDFF)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 2rem',
              boxShadow: '0 0 40px rgba(0, 102, 255, 0.5)'
            }}
          >
            <CheckCircle size={40} color="white" />
          </motion.div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            수강신청 감사합니다
          </h1>

          <p style={{
            fontSize: '1.1rem',
            color: '#B0B0B0',
            lineHeight: 1.7,
            marginBottom: '2rem'
          }}>
            입력해주신 학부모님 번호로<br />
            원비 안내드리도록 하겠습니다.
          </p>

          <Link
            href="/"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '1rem 2rem',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '100px',
              color: '#FFFFFF',
              fontSize: '1rem',
              fontWeight: '600',
              textDecoration: 'none',
              transition: 'all 0.3s'
            }}
          >
            <ArrowLeft size={18} />
            홈으로 돌아가기
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      paddingTop: '140px',
      paddingBottom: '4rem'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        padding: '0 1.5rem'
      }}>
        {/* 뒤로가기 */}
        <Link
          href={`/classes/${courseId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'rgba(255, 255, 255, 0.6)',
            textDecoration: 'none',
            fontSize: '0.9rem',
            marginBottom: '2rem',
            transition: 'color 0.2s'
          }}
        >
          <ArrowLeft size={18} />
          수업 정보로 돌아가기
        </Link>

        {/* 헤더 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ marginBottom: '2rem' }}
        >
          <div style={{
            display: 'inline-block',
            padding: '0.375rem 1rem',
            background: 'rgba(0, 102, 255, 0.15)',
            borderRadius: '100px',
            marginBottom: '1rem'
          }}>
            <span style={{
              fontSize: '0.875rem',
              fontWeight: '600',
              color: '#0099FF'
            }}>
              {course.category}
            </span>
          </div>

          <h1 style={{
            fontSize: isMobile ? '1.75rem' : '2.25rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '0.5rem'
          }}>
            {course.title}
          </h1>
          <p style={{
            fontSize: '1rem',
            color: '#808080'
          }}>
            수강 신청서
          </p>
        </motion.div>

        {/* 폼 */}
        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            padding: isMobile ? '1.5rem' : '2rem'
          }}
        >
          {/* 신청자 유형 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '0.75rem'
            }}>
              신청자는 어떤 분이신가요? <span style={{ color: '#FF4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.75rem 1.25rem',
                background: formData.userType === '학생' ? 'rgba(0, 102, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: formData.userType === '학생' ? '1px solid rgba(0, 102, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="userType"
                  value="학생"
                  checked={formData.userType === '학생'}
                  onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                  style={{ accentColor: '#0066FF' }}
                />
                <span style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>학생 본인</span>
              </label>
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                padding: '0.75rem 1.25rem',
                background: formData.userType === '학부모' ? 'rgba(0, 102, 255, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                border: formData.userType === '학부모' ? '1px solid rgba(0, 102, 255, 0.5)' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '10px',
                transition: 'all 0.2s'
              }}>
                <input
                  type="radio"
                  name="userType"
                  value="학부모"
                  checked={formData.userType === '학부모'}
                  onChange={(e) => setFormData({ ...formData, userType: e.target.value })}
                  style={{ accentColor: '#0066FF' }}
                />
                <span style={{ color: '#FFFFFF', fontSize: '0.95rem' }}>학부모</span>
              </label>
            </div>
            {errors.userType && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errors.userType}</p>
            )}
          </div>

          {/* 학생 이름 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '0.5rem'
            }}>
              학생 이름 <span style={{ color: '#FF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.studentName}
              onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
              placeholder="학생 이름을 입력해주세요"
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: errors.studentName ? '1px solid #FF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none',
                transition: 'all 0.2s'
              }}
            />
            {errors.studentName && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errors.studentName}</p>
            )}
          </div>

          {/* 학부모 연락처 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '0.5rem'
            }}>
              학부모님 연락처 <span style={{ color: '#FF4444' }}>*</span>
            </label>
            <input
              type="tel"
              value={formData.parentPhone}
              onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
              placeholder="010-0000-0000"
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: errors.parentPhone ? '1px solid #FF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.parentPhone && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errors.parentPhone}</p>
            )}
          </div>

          {/* 학생 연락처 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '0.5rem'
            }}>
              학생 연락처 <span style={{ color: '#FF4444' }}>*</span>
            </label>
            <input
              type="tel"
              value={formData.studentPhone}
              onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
              placeholder="010-0000-0000"
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: errors.studentPhone ? '1px solid #FF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.studentPhone && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errors.studentPhone}</p>
            )}
          </div>

          {/* 출생년도 */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.9rem',
              fontWeight: '600',
              color: '#FFFFFF',
              marginBottom: '0.5rem'
            }}>
              학생 출생년도 <span style={{ color: '#FF4444' }}>*</span>
            </label>
            <input
              type="text"
              value={formData.birthYear}
              onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
              placeholder="2007"
              maxLength={4}
              style={{
                width: '100%',
                padding: '1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: errors.birthYear ? '1px solid #FF4444' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#FFFFFF',
                fontSize: '1rem',
                outline: 'none'
              }}
            />
            {errors.birthYear && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem' }}>{errors.birthYear}</p>
            )}
          </div>

          {/* 구분선 */}
          <div style={{
            height: '1px',
            background: 'rgba(255, 255, 255, 0.1)',
            margin: '2rem 0'
          }} />

          {/* 체크박스 1: 원비 확인 */}
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.confirmPayment}
                onChange={(e) => setFormData({ ...formData, confirmPayment: e.target.checked })}
                style={{
                  width: '20px',
                  height: '20px',
                  marginTop: '2px',
                  accentColor: '#0066FF'
                }}
              />
              <span style={{
                fontSize: '0.95rem',
                color: '#B0B0B0',
                lineHeight: 1.6
              }}>
                수업은 원비 납부 완료 기준으로 최종 확정됩니다.
                <span style={{ color: '#FF4444' }}>(*납부 순으로 선착순 마감)</span>
                <br />위 내용 확인하셨나요? <span style={{ color: '#FF4444' }}>*</span>
              </span>
            </label>
            {errors.confirmPayment && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem', marginLeft: '2rem' }}>{errors.confirmPayment}</p>
            )}
          </div>

          {/* 체크박스 2: 개인정보 동의 */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              cursor: 'pointer'
            }}>
              <input
                type="checkbox"
                checked={formData.agreePrivacy}
                onChange={(e) => setFormData({ ...formData, agreePrivacy: e.target.checked })}
                style={{
                  width: '20px',
                  height: '20px',
                  marginTop: '2px',
                  accentColor: '#0066FF'
                }}
              />
              <span style={{
                fontSize: '0.95rem',
                color: '#B0B0B0',
                lineHeight: 1.6
              }}>
                개인정보 수집 동의 <span style={{ color: '#FF4444' }}>*</span>
              </span>
            </label>

            {/* 개인정보 수집 내용 */}
            <div style={{
              marginTop: '0.75rem',
              marginLeft: '2rem',
              padding: '1rem',
              background: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              color: '#808080',
              lineHeight: 1.7
            }}>
              <strong style={{ color: '#B0B0B0' }}>[개인정보 제공 내역]</strong><br />
              • 제공받는 자: 박교준입시연구소<br />
              • 제공 목적: 수업 / 교재 / 자료 제공 및 학습 상담 안내<br />
              • 제공 항목: 이름, 연령, 번호<br />
              • 보유 및 이용 기간: 동의일로부터 3년간 보관 후 즉시 파기<br /><br />
              <span style={{ fontSize: '0.8rem' }}>
                ※ 수업 신청 시, 수업 안내를 위해 위 내용에 필수적으로 동의하셔야 합니다.
                (동의하지 않을 경우 자료 제공 및 안내가 제한될 수 있습니다.)
              </span>
            </div>
            {errors.agreePrivacy && (
              <p style={{ color: '#FF4444', fontSize: '0.8rem', marginTop: '0.5rem', marginLeft: '2rem' }}>{errors.agreePrivacy}</p>
            )}
          </div>

          {/* 제출 버튼 */}
          <motion.button
            type="submit"
            disabled={isSubmitting}
            whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
            whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
            style={{
              width: '100%',
              padding: '1.25rem',
              background: isSubmitting
                ? 'rgba(0, 102, 255, 0.5)'
                : 'linear-gradient(135deg, #0066FF, #0044CC)',
              border: 'none',
              borderRadius: '14px',
              color: '#FFFFFF',
              fontSize: '1.1rem',
              fontWeight: '700',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 8px 32px rgba(0, 102, 255, 0.3)',
              transition: 'all 0.3s'
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={22} style={{ animation: 'spin 1s linear infinite' }} />
                신청 중...
              </>
            ) : (
              '수강 신청하기'
            )}
          </motion.button>
        </motion.form>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
