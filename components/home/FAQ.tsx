"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, HelpCircle } from "lucide-react"

interface FAQItem {
  question: string
  answer: string
}

const faqData: FAQItem[] = [
  {
    question: "수리논술, 내신 3등급 이하인데 높은 대학 가능할까요?",
    answer: "가능합니다. 일부 유튜브 상담이나 주변에서 \"3등급이면 절대 안 된다\"고 말하더라도, 그들은 수리논술 전문가가 아닙니다. 제 학생들은 실제로 내신 3~4등급, 심지어 7등급대인 학생도 연고대, 서성한, 이대 등 상위 10위권 이내 대학들에 합격했습니다. 논술은 다릅니다. 수학 실력만 있으면, 내신과 상관없이 충분히 가능합니다."
  },
  {
    question: "정말 최종 수학 2등급만 나오면 90% 합격하나요?",
    answer: "네, 맞습니다. 지난 17년간 데이터로 확인된 통계입니다. 박교준 선생님이 17년간 가르친 학생 중, 최종 수능 수학 2등급 이상이었던 학생은 매해 90% 이상 합격을 이뤄냈습니다."
  },
  {
    question: "왜 그렇게 수리논술 합격률이 높아요?",
    answer: "오직 결과로 증명해온 커리큘럼 & 강의 노하우 덕분입니다. 지난 해 기준, 상위 12개 대학(연고/서성한/중경외시/건동홍) 합격 건수만 1,000건 이상. 현장에서 18년을 뛰며 쌓인 \"대학별 출제 경향\"과 \"학생별 맞춤 학습\" 노하우가 합격률을 견인합니다."
  },
  {
    question: "수능 공부랑 같이하기 너무 벅차지 않을까요?",
    answer: "오히려 수능 수학 실력이 크게 성장합니다. 수리논술 70%는 교과 범위(수능형) 재구성 문제이기에, 논술 대비 = 수능 대비 효과가 있습니다. 문제 해결 과정에서 \"왜 이렇게 접근했는지\"를 명확히 훈련하니, 수능에서 실수 줄이고, 사고력도 상승합니다."
  },
  {
    question: "그냥 기출이나 풀면서 독학해도 되지 않나요?",
    answer: "어려우실 겁니다. 수리논술은 어떤 조건, 상황이 나오는지 학생이 캐치하기 어렵기 때문입니다. 수리논술은 한 시험에 등장하는 문제 수가 적은 데다 나오는 형태는 수능/내신보다 훨씬 다양해 어느 조건, 상황이 반복해서 등장하는지 캐치하는 것이 매우 어렵습니다. 지난 10여 년간 모든 대학의 기출 문제들을 알고 있는 전문가의 도움이 필요한 시험입니다."
  },
  {
    question: "오프라인·온라인 수업 어떤 차이가 있나요?",
    answer: "집중도와 진행 방식 정도의 차이입니다. 오프라인은 강사와 실시간 호흡, 즉각적 질의응답, 현장 몰입감 극대화. 온라인은 시간·장소 제약 없이 수강, 반복 학습(녹화 강의) 가능, 동일 커리큘럼+첨삭 시스템 제공. 관리와 커리큘럼은 동일하니, 본인 학습 스타일에 맞춰 선택하시면 됩니다."
  },
  {
    question: "수강하면 정말 지금보다 더 높은 대학 갈 수 있나요?",
    answer: "\"높은 대학\" 노리는 학생을 위해 탄생한 수업입니다. 내신 망쳤다, 모의고사 성적 안 나온다 → \"수능 정시 파이터\" 되기에는 위험 부담이 크다면, 논술 카드가 해답입니다. 박교준 수리논술을 거쳐, 본인 예상점수보다 훨씬 높은 대학에 합격한 학생이 매년 속출하고 있습니다."
  },
  {
    question: "수능에서 실패하면 결국 재수해야 하는 거 아닌가요?",
    answer: "플랜 B로 수리논술을 준비하세요. 수능 날 컨디션·돌발변수로 한두 과목만 삐끗해도 원하는 대학을 놓칠 수 있습니다. 하지만 수능과 병행 준비해둔 수리논술이 있다면, 합격 기회를 한 번 더 잡을 수 있습니다. 실제로, 수능 망쳤다고 눈물 흘리던 학생이 논술 합격 문자 받고 역전한 사례가 매년 등장합니다."
  },
  {
    question: "수업을 들으려면, 어느 정도 수학 실력이 필요한가요?",
    answer: "범위로는 수2까지 배운 상태라면 수업을 들을 수 있습니다. 미적분까지 학습한 상태라면 더욱 좋습니다. 수학 실력은 어떤 상태라도 수강이 가능합니다. 매주 나가는 수업의 양이 매우 적기 때문에 마음만 먹는다면 얼마든지 그 주의 내용을 익힐 수 있습니다. 학생의 실력보다는 배움의 자세가 중요합니다."
  }
]

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section style={{
      padding: '6rem 1rem',
      background: '#000000',
      position: 'relative'
    }}>
      {/* Background Effect */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(0, 102, 255, 0.03) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1
      }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            background: 'rgba(0, 102, 255, 0.1)',
            border: '1px solid rgba(0, 102, 255, 0.2)',
            borderRadius: '100px',
            marginBottom: '1.5rem'
          }}>
            <HelpCircle size={16} style={{ color: '#0099FF' }} />
            <span style={{ color: '#0099FF', fontSize: '0.85rem', fontWeight: '600' }}>FAQ</span>
          </div>
          
          <h2 style={{
            fontSize: 'clamp(1.8rem, 4vw, 2.5rem)',
            fontWeight: '800',
            marginBottom: '1rem',
            lineHeight: 1.3
          }}>
            <span style={{ color: '#FFFFFF' }}>자주 묻는 </span>
            <span style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #00DDFF 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>질문</span>
          </h2>
          <p style={{
            color: '#808080',
            fontSize: '1.1rem'
          }}>
            학부모님들과 학생들이 자주 문의하시는 내용들을 모았습니다
          </p>
        </motion.div>

        {/* FAQ List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {faqData.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
            >
              <div
                style={{
                  background: openIndex === index 
                    ? 'linear-gradient(135deg, rgba(0, 102, 255, 0.1), rgba(0, 102, 255, 0.05))'
                    : 'rgba(255, 255, 255, 0.02)',
                  border: openIndex === index 
                    ? '1px solid rgba(0, 102, 255, 0.3)'
                    : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Question */}
                <button
                  onClick={() => toggleFAQ(index)}
                  style={{
                    width: '100%',
                    padding: '1.25rem 1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <span style={{
                    color: openIndex === index ? '#FFFFFF' : 'rgba(255, 255, 255, 0.9)',
                    fontSize: '1.05rem',
                    fontWeight: '600',
                    paddingRight: '1rem'
                  }}>
                    {faq.question}
                  </span>
                  <motion.div
                    animate={{ rotate: openIndex === index ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ flexShrink: 0 }}
                  >
                    <ChevronDown 
                      size={22} 
                      style={{ 
                        color: openIndex === index ? '#0099FF' : 'rgba(255, 255, 255, 0.5)' 
                      }} 
                    />
                  </motion.div>
                </button>

                {/* Answer */}
                <AnimatePresence>
                  {openIndex === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div style={{
                        padding: '0 1.5rem 1.25rem 1.5rem',
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.95rem',
                        lineHeight: 1.7,
                        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                        paddingTop: '1rem',
                        marginTop: '-0.25rem'
                      }}>
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ textAlign: 'center', marginTop: '3rem' }}
        >
          <p style={{
            color: '#808080',
            fontSize: '0.95rem',
            marginBottom: '1rem'
          }}>
            더 궁금한 점이 있으신가요?
          </p>
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
                padding: '0.875rem 2rem',
                background: 'linear-gradient(135deg, #FEE500 0%, #E5CF00 100%)',
                border: 'none',
                borderRadius: '12px',
                color: '#000000',
                fontSize: '0.95rem',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(254, 229, 0, 0.3)'
              }}
            >
              카카오톡으로 문의하기
            </motion.button>
          </a>
        </motion.div>
      </div>
    </section>
  )
}
