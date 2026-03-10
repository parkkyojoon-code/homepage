"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import { CheckCircle, ArrowLeft, Loader2, MapPin, BookOpen, AlertCircle } from "lucide-react"
import Link from "next/link"
import Script from "next/script"

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: {
          zonecode: string
          address: string
          addressType: string
          bname: string
          buildingName: string
        }) => void
      }) => { open: () => void }
    }
  }
}

const CAMPUS_OPTIONS = [
  { value: "온라인", label: "🖥️ 온라인" },
  { value: "서울 대치", label: "📍 서울 대치" },
  { value: "인천 송도", label: "📍 인천 송도" },
  { value: "부산 센텀", label: "📍 부산 센텀" },
]

const TEXTBOOK_OPTIONS = [
  {
    value: "mibbun",
    label: "미분과 부등식",
    price: "교재비 38,000원",
    description: "10주차~ 미분과 부등식 정규 수업",
    color: "#0066FF",
  },
  {
    value: "mibbun-hwakto",
    label: "미분 + 확통",
    price: "교재비 76,000원",
    description: "미분과 부등식 + 확통과 경우의 수",
    badge: "확통 특강 무료",
    color: "#8B5CF6",
  },
]

export default function Week10ApplyPage() {
  const [isMobile, setIsMobile] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isComplete, setIsComplete] = useState(false)
  const [daumLoaded, setDaumLoaded] = useState(false)

  const [formData, setFormData] = useState({
    campus: "",
    textbookOption: "",
    studentName: "",
    studentPhone: "",
    parentPhone: "",
    zipCode: "",
    address: "",
    addressDetail: "",
    confirmPayment: false,
    agreePrivacy: false,
  })

  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [duplicateCheck, setDuplicateCheck] = useState<{ checking: boolean; isDuplicate: boolean; message: string }>({
    checking: false,
    isDuplicate: false,
    message: "",
  })
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  const checkDuplicate = (phone: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    const normalized = phone.replace(/\D/g, "")
    if (normalized.length < 10) {
      setDuplicateCheck({ checking: false, isDuplicate: false, message: "" })
      return
    }
    setDuplicateCheck({ checking: true, isDuplicate: false, message: "" })
    debounceTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/check-duplicate?phone=${encodeURIComponent(phone)}&type=nextcurriculum`)
        const data = await res.json()
        setDuplicateCheck({
          checking: false,
          isDuplicate: data.duplicate,
          message: data.duplicate ? data.message : "✓ 확인되었습니다.",
        })
      } catch {
        setDuplicateCheck({ checking: false, isDuplicate: false, message: "" })
      }
    }, 600)
  }

  const openAddressSearch = () => {
    if (!daumLoaded || typeof window.daum === "undefined") {
      alert("주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.")
      return
    }
    new window.daum.Postcode({
      oncomplete: (data) => {
        let fullAddress = data.address
        let extraAddress = ""
        if (data.addressType === "R") {
          if (data.bname !== "") extraAddress += data.bname
          if (data.buildingName !== "") {
            extraAddress += extraAddress !== "" ? `, ${data.buildingName}` : data.buildingName
          }
          if (extraAddress !== "") fullAddress += ` (${extraAddress})`
        }
        setFormData((prev) => ({
          ...prev,
          zipCode: data.zonecode,
          address: fullAddress,
          addressDetail: "",
        }))
        setErrors((prev) => ({ ...prev, address: "", zipCode: "" }))
      },
    }).open()
  }

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    if (!formData.campus) newErrors.campus = "캠퍼스를 선택해주세요"
    if (!formData.textbookOption) newErrors.textbookOption = "교재 옵션을 선택해주세요"
    if (!formData.studentName.trim()) newErrors.studentName = "학생 이름을 입력해주세요"
    if (!formData.studentPhone.trim()) {
      newErrors.studentPhone = "학생 연락처를 입력해주세요"
    } else if (!/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(formData.studentPhone.replace(/-/g, ""))) {
      newErrors.studentPhone = "올바른 연락처 형식이 아닙니다"
    }
    if (!formData.parentPhone.trim()) {
      newErrors.parentPhone = "학부모님 연락처를 입력해주세요"
    } else if (!/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(formData.parentPhone.replace(/-/g, ""))) {
      newErrors.parentPhone = "올바른 연락처 형식이 아닙니다"
    } else if (duplicateCheck.isDuplicate) {
      newErrors.parentPhone = "이미 교재 신청이 완료된 번호입니다."
    }
    if (!formData.zipCode) newErrors.address = "주소 검색을 통해 주소를 입력해주세요"
    if (!formData.addressDetail.trim()) newErrors.addressDetail = "상세주소를 입력해주세요"
    if (!formData.confirmPayment) newErrors.confirmPayment = "원비 안내 확인에 동의해주세요"
    if (!formData.agreePrivacy) newErrors.agreePrivacy = "개인정보 수집에 동의해주세요"
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return
    setIsSubmitting(true)

    const textbookLabel =
      formData.textbookOption === "mibbun"
        ? "미분과 부등식 (교재비 38,000원)"
        : "미분 + 확통과 경우의 수 (교재비 76,000원)"

    const courseTypeValue =
      formData.campus === "온라인"
        ? `surinonseul-week10-online-${formData.textbookOption}`
        : `surinonseul-week10-offline-${formData.textbookOption}`

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userType: "학생",
          studentName: formData.studentName,
          parentPhone: formData.parentPhone,
          studentPhone: formData.studentPhone,
          birthYear: "",
          courseType: courseTypeValue,
          campus: formData.campus,
          confirmPayment: formData.confirmPayment,
          agreePrivacy: formData.agreePrivacy,
          // 추가 필드
          textbookOption: textbookLabel,
          zipCode: formData.zipCode,
          address: formData.address,
          addressDetail: formData.addressDetail,
          timestamp: new Date().toISOString(),
        }),
      })
      if (response.ok || response.status >= 400) {
        setIsComplete(true)
      }
    } catch {
      setIsComplete(true)
    }

    setIsSubmitting(false)
  }

  const inputStyle = (hasError: boolean) => ({
    width: "100%",
    padding: "1rem",
    background: "rgba(255, 255, 255, 0.05)",
    border: hasError ? "1px solid #FF4444" : "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "12px",
    color: "#FFFFFF",
    fontSize: "1rem",
    outline: "none",
    boxSizing: "border-box" as const,
  })

  const labelStyle = {
    display: "block" as const,
    fontSize: "0.875rem",
    fontWeight: "600" as const,
    color: "#FFFFFF",
    marginBottom: "0.5rem",
  }

  const fieldWrap = { marginBottom: "1.5rem" }

  if (isComplete) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#000000",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem",
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          style={{
            background: "linear-gradient(135deg, rgba(0, 102, 255, 0.1) 0%, rgba(139, 92, 246, 0.05) 100%)",
            border: "1px solid rgba(0, 102, 255, 0.2)",
            borderRadius: "24px",
            padding: isMobile ? "3rem 2rem" : "4rem",
            textAlign: "center",
            maxWidth: "500px",
            width: "100%",
          }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            style={{
              width: "80px",
              height: "80px",
              background: "linear-gradient(135deg, #0066FF, #8B5CF6)",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 2rem",
              boxShadow: "0 0 40px rgba(0, 102, 255, 0.4)",
            }}
          >
            <CheckCircle size={40} color="white" />
          </motion.div>

          <h1
            style={{
              fontSize: isMobile ? "1.75rem" : "2rem",
              fontWeight: "800",
              color: "#FFFFFF",
              marginBottom: "1rem",
            }}
          >
            신청이 완료되었습니다
          </h1>

          <p
            style={{
              fontSize: "1rem",
              color: "#B0B0B0",
              lineHeight: 1.9,
              marginBottom: "2rem",
            }}
          >
            학부모님 번호로{" "}
            <strong style={{ color: "#FFFFFF" }}>카카오 알림톡</strong>을 통해
            <br />
            결제 안내가 자동 발송됩니다.
            <br />
            <br />
            <span style={{ fontSize: "0.875rem", color: "#A0A0A0" }}>
              📖 1주차 자료는 LMS 채널 내에서 확인 가능합니다.
              <br />
              📦 교재 배송은 결제 확인 후 이번 주 ~ 다음 주 초 발송됩니다.
            </span>
          </p>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "1rem 2rem",
              background: "rgba(255, 255, 255, 0.1)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              borderRadius: "100px",
              color: "#FFFFFF",
              fontSize: "1rem",
              fontWeight: "600",
              textDecoration: "none",
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
    <>
      <Script
        src="//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        onLoad={() => setDaumLoaded(true)}
      />

      <div
        style={{
          minHeight: "100vh",
          background: "#000000",
          paddingTop: "140px",
          paddingBottom: "5rem",
        }}
      >
        <div
          style={{
            maxWidth: "620px",
            margin: "0 auto",
            padding: "0 1.5rem",
          }}
        >
          {/* 뒤로가기 */}
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: "rgba(255, 255, 255, 0.5)",
              textDecoration: "none",
              fontSize: "0.875rem",
              marginBottom: "2rem",
            }}
          >
            <ArrowLeft size={16} />
            홈으로 돌아가기
          </Link>

          {/* 헤더 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: "2rem" }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.375rem 1rem",
                background: "rgba(0, 102, 255, 0.15)",
                borderRadius: "100px",
                marginBottom: "1rem",
              }}
            >
              <BookOpen size={14} color="#0099FF" />
              <span style={{ fontSize: "0.875rem", fontWeight: "600", color: "#0099FF" }}>
                수리논술 · 10주차 교재 신청
              </span>
            </div>

            <h1
              style={{
                fontSize: isMobile ? "1.75rem" : "2.25rem",
                fontWeight: "800",
                color: "#FFFFFF",
                marginBottom: "0.75rem",
                lineHeight: 1.3,
              }}
            >
              미분과 부등식
              <br />
              <span style={{ color: "#0099FF" }}>+ 확통과 경우의 수</span>
            </h1>

            {/* 일정 안내 배너 */}
            <div
              style={{
                padding: "1.25rem 1.5rem",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: "14px",
                fontSize: "0.875rem",
                color: "#A0A0A0",
                lineHeight: 2,
              }}
            >
              <p style={{ color: "#FFFFFF", fontWeight: "700", fontSize: "0.95rem", marginBottom: "0.75rem" }}>
                📚 수리논술 10주차 교재 신청 안내
              </p>
              이번 주, <strong style={{ color: "#FFFFFF" }}>수열과 규칙성</strong> 단원이 마무리되며,
              10주차부터 <strong style={{ color: "#0099FF" }}>「미분과 부등식」</strong> 단원이 시작됩니다.
              <br />
              또한 선택 수업으로 <strong style={{ color: "#8B5CF6" }}>「확통과 경우의 수」 특강</strong>을 함께 수강할 수 있습니다.
              <span style={{ color: "#808080", fontSize: "0.82rem" }}> (확통 교재 신청 시에만 특강 수강 가능)</span>
              <br /><br />
              <strong style={{ color: "#FFFFFF" }}>■ 교재 안내</strong>
              <br />
              미분과 부등식 교재: <strong style={{ color: "#0099FF" }}>38,000원</strong>
              <br />
              미분 + 확통 교재: <strong style={{ color: "#8B5CF6" }}>76,000원</strong>
              <br /><br />
              <span style={{ color: "#808080", fontSize: "0.82rem" }}>
                ※ 확통 특강 수업은 무료 제공되며, 교재비만 별도입니다.
                <br />
                ※ 확통 교재를 신청하지 않을 경우 특강 수강은 제공되지 않습니다.
              </span>
              <br /><br />
              신청 후 <strong style={{ color: "#FFFFFF" }}>학생 연락처 / 학부모 연락처</strong>(결제 안내 번호) / <strong style={{ color: "#FFFFFF" }}>배송 주소</strong>를
              입력해 주시면 교재 발송 및 결제 안내가 진행됩니다.
            </div>
          </motion.div>

          {/* 폼 */}
          <motion.form
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            onSubmit={handleSubmit}
            style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              borderRadius: "20px",
              padding: isMobile ? "1.5rem" : "2rem",
            }}
          >
            {/* ── 캠퍼스 선택 ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                캠퍼스 선택 <span style={{ color: "#FF4444" }}>*</span>
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                {CAMPUS_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.875rem 1rem",
                      background:
                        formData.campus === opt.value
                          ? "rgba(0, 102, 255, 0.2)"
                          : "rgba(255, 255, 255, 0.04)",
                      border:
                        formData.campus === opt.value
                          ? "1px solid rgba(0, 102, 255, 0.5)"
                          : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "10px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="radio"
                      name="campus"
                      value={opt.value}
                      checked={formData.campus === opt.value}
                      onChange={(e) =>
                        setFormData({ ...formData, campus: e.target.value })
                      }
                      style={{ accentColor: "#0066FF" }}
                    />
                    <span style={{ color: "#FFFFFF", fontSize: "0.9rem", fontWeight: "500" }}>
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.campus && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.campus}
                </p>
              )}
            </div>

            {/* ── 교재 선택 ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                교재 선택 <span style={{ color: "#FF4444" }}>*</span>
              </label>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {TEXTBOOK_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "1rem",
                      padding: "1.25rem",
                      background:
                        formData.textbookOption === opt.value
                          ? `rgba(${opt.value === "mibbun" ? "0, 102, 255" : "139, 92, 246"}, 0.15)`
                          : "rgba(255, 255, 255, 0.04)",
                      border:
                        formData.textbookOption === opt.value
                          ? `1px solid rgba(${opt.value === "mibbun" ? "0, 102, 255" : "139, 92, 246"}, 0.5)`
                          : "1px solid rgba(255, 255, 255, 0.08)",
                      borderRadius: "14px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  >
                    <input
                      type="radio"
                      name="textbookOption"
                      value={opt.value}
                      checked={formData.textbookOption === opt.value}
                      onChange={(e) =>
                        setFormData({ ...formData, textbookOption: e.target.value })
                      }
                      style={{ accentColor: opt.color, marginTop: "3px" }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          marginBottom: "0.25rem",
                          flexWrap: "wrap" as const,
                        }}
                      >
                        <span
                          style={{ color: "#FFFFFF", fontSize: "1rem", fontWeight: "700" }}
                        >
                          {opt.label}
                        </span>
                        {opt.badge && (
                          <span
                            style={{
                              padding: "0.2rem 0.6rem",
                              background: "rgba(0, 221, 136, 0.15)",
                              border: "1px solid rgba(0, 221, 136, 0.3)",
                              borderRadius: "100px",
                              fontSize: "0.75rem",
                              fontWeight: "600",
                              color: "#00DD88",
                            }}
                          >
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ color: "#808080", fontSize: "0.85rem", margin: 0 }}>
                        {opt.description}
                      </p>
                      <p
                        style={{
                          color: opt.color,
                          fontSize: "0.95rem",
                          fontWeight: "700",
                          margin: "0.25rem 0 0",
                        }}
                      >
                        {opt.price}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              {errors.textbookOption && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.textbookOption}
                </p>
              )}
            </div>

            {/* 구분선 */}
            <div
              style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "2rem 0" }}
            />

            {/* ── 학생 이름 ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                학생 이름 <span style={{ color: "#FF4444" }}>*</span>
              </label>
              <input
                type="text"
                value={formData.studentName}
                onChange={(e) => setFormData({ ...formData, studentName: e.target.value })}
                placeholder="학생 이름을 입력해주세요"
                style={inputStyle(!!errors.studentName)}
              />
              {errors.studentName && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.studentName}
                </p>
              )}
            </div>

            {/* ── 학생 연락처 ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                학생 연락처 <span style={{ color: "#FF4444" }}>*</span>
              </label>
              <input
                type="tel"
                value={formData.studentPhone}
                onChange={(e) => setFormData({ ...formData, studentPhone: e.target.value })}
                placeholder="010-0000-0000"
                style={inputStyle(!!errors.studentPhone)}
              />
              {errors.studentPhone && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.studentPhone}
                </p>
              )}
            </div>

            {/* ── 학부모 연락처 ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                학부모님 연락처{" "}
                <span style={{ color: "#FF4444" }}>*</span>
                <span
                  style={{
                    fontWeight: "400",
                    color: "#808080",
                    fontSize: "0.8rem",
                    marginLeft: "0.5rem",
                  }}
                >
                  (교재비 결제 안내 받으실 번호)
                </span>
              </label>
              <input
                type="tel"
                value={formData.parentPhone}
                onChange={(e) => {
                  setFormData({ ...formData, parentPhone: e.target.value })
                  checkDuplicate(e.target.value)
                }}
                placeholder="010-0000-0000"
                style={inputStyle(!!errors.parentPhone || duplicateCheck.isDuplicate)}
              />
              {/* 중복 확인 상태 표시 */}
              {duplicateCheck.checking && (
                <p style={{ color: "#808080", fontSize: "0.8rem", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} />
                  확인 중...
                </p>
              )}
              {!duplicateCheck.checking && duplicateCheck.isDuplicate && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <AlertCircle size={13} />
                  {duplicateCheck.message}
                </p>
              )}
              {!duplicateCheck.checking && !duplicateCheck.isDuplicate && duplicateCheck.message && (
                <p style={{ color: "#00DD88", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {duplicateCheck.message}
                </p>
              )}
              {errors.parentPhone && !duplicateCheck.isDuplicate && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.parentPhone}
                </p>
              )}
            </div>

            {/* ── 주소 (교재 배송용) ── */}
            <div style={fieldWrap}>
              <label style={labelStyle}>
                교재 배송 주소 <span style={{ color: "#FF4444" }}>*</span>
              </label>

              {/* 우편번호 + 주소 검색 */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <input
                  type="text"
                  value={formData.zipCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6)
                    setFormData({ ...formData, zipCode: val })
                  }}
                  placeholder="우편번호"
                  maxLength={6}
                  inputMode="numeric"
                  style={{
                    ...inputStyle(!!errors.address),
                    width: "120px",
                    flex: "0 0 120px",
                  }}
                />
                <button
                  type="button"
                  onClick={openAddressSearch}
                  style={{
                    flex: 1,
                    padding: "1rem",
                    background: "rgba(0, 102, 255, 0.2)",
                    border: "1px solid rgba(0, 102, 255, 0.4)",
                    borderRadius: "12px",
                    color: "#0099FF",
                    fontSize: "0.9rem",
                    fontWeight: "600",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  <MapPin size={16} />
                  주소 검색
                </button>
              </div>

              {/* 기본 주소 */}
              <input
                type="text"
                value={formData.address}
                readOnly
                placeholder="주소 검색 버튼을 눌러주세요"
                style={{
                  ...inputStyle(!!errors.address),
                  marginBottom: "0.5rem",
                  background: "rgba(255,255,255,0.03)",
                  cursor: "default",
                }}
              />

              {/* 상세주소 */}
              <input
                type="text"
                value={formData.addressDetail}
                onChange={(e) =>
                  setFormData({ ...formData, addressDetail: e.target.value })
                }
                placeholder="상세주소 (동/호수 등)"
                style={inputStyle(!!errors.addressDetail)}
              />

              {errors.address && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.address}
                </p>
              )}
              {errors.addressDetail && (
                <p style={{ color: "#FF4444", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  {errors.addressDetail}
                </p>
              )}
            </div>

            {/* 구분선 */}
            <div
              style={{ height: "1px", background: "rgba(255,255,255,0.08)", margin: "2rem 0" }}
            />

            {/* ── 원비 확인 체크박스 ── */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.confirmPayment}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPayment: e.target.checked })
                  }
                  style={{ width: "20px", height: "20px", marginTop: "2px", accentColor: "#0066FF" }}
                />
                <span style={{ fontSize: "0.9rem", color: "#B0B0B0", lineHeight: 1.8 }}>
                  교재비 납부 완료 후 배송이 시작됩니다.
                  <br />위 내용 확인하셨나요?{" "}
                  <span style={{ color: "#FF4444" }}>*</span>
                </span>
              </label>
              {errors.confirmPayment && (
                <p
                  style={{
                    color: "#FF4444",
                    fontSize: "0.8rem",
                    marginTop: "0.5rem",
                    marginLeft: "2rem",
                  }}
                >
                  {errors.confirmPayment}
                </p>
              )}
            </div>

            {/* ── 개인정보 동의 ── */}
            <div style={{ marginBottom: "2rem" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={formData.agreePrivacy}
                  onChange={(e) =>
                    setFormData({ ...formData, agreePrivacy: e.target.checked })
                  }
                  style={{ width: "20px", height: "20px", marginTop: "2px", accentColor: "#0066FF" }}
                />
                <span style={{ fontSize: "0.9rem", color: "#B0B0B0", lineHeight: 1.6 }}>
                  개인정보 수집 동의 <span style={{ color: "#FF4444" }}>*</span>
                </span>
              </label>

              <div
                style={{
                  marginTop: "0.75rem",
                  marginLeft: "2rem",
                  padding: "1rem",
                  background: "rgba(255, 255, 255, 0.03)",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  color: "#808080",
                  lineHeight: 1.7,
                }}
              >
                <strong style={{ color: "#B0B0B0" }}>[개인정보 제공 내역]</strong>
                <br />
                • 제공받는 자: 박교준입시연구소
                <br />
                • 제공 목적: 수업 / 교재 발송 / 학습 상담 안내
                <br />
                • 제공 항목: 이름, 연락처, 주소
                <br />
                • 보유 및 이용 기간: 동의일로부터 3년간 보관 후 즉시 파기
                <br />
                <br />
                <span style={{ fontSize: "0.78rem" }}>
                  ※ 교재 배송을 위해 위 내용에 필수적으로 동의하셔야 합니다.
                </span>
              </div>
              {errors.agreePrivacy && (
                <p
                  style={{
                    color: "#FF4444",
                    fontSize: "0.8rem",
                    marginTop: "0.5rem",
                    marginLeft: "2rem",
                  }}
                >
                  {errors.agreePrivacy}
                </p>
              )}
            </div>

            {/* ── 제출 버튼 ── */}
            <motion.button
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              style={{
                width: "100%",
                padding: "1.25rem",
                background: isSubmitting
                  ? "rgba(0, 102, 255, 0.5)"
                  : "linear-gradient(135deg, #0066FF, #0044CC)",
                border: "none",
                borderRadius: "14px",
                color: "#FFFFFF",
                fontSize: "1.1rem",
                fontWeight: "700",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                boxShadow: "0 8px 32px rgba(0, 102, 255, 0.3)",
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2
                    size={22}
                    style={{ animation: "spin 1s linear infinite" }}
                  />
                  신청 중...
                </>
              ) : (
                "교재 신청하기"
              )}
            </motion.button>
          </motion.form>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        input::placeholder {
          color: rgba(255, 255, 255, 0.25);
        }
      `}</style>
    </>
  )
}
