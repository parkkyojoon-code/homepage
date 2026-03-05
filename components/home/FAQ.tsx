"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"
import { ChevronDown } from "lucide-react"

const faqData = [
  {
    question: "수리논술, 내신 3등급 이하인데 높은 대학 가능할까요?",
    answer: `가능합니다. 일부 유튜브 상담이나 주변에서 "3등급이면 절대 안 된다"고 말하더라도, 그들은 수리논술 전문가가 아닙니다.

제 학생들은 실제로 내신 3~4등급, 심지어 7등급대인 학생도 연고대, 서성한, 이대 등 상위 10위권 이내 대학들에 합격했습니다. 내신 성적으로 포기하는건 정말 바보같은 짓입니다.

논술은 다릅니다. 수학 실력만 있으면, 내신과 상관없이 충분히 가능합니다. 그동안 상위권 대학에 합격한 제 학생들은 3등급 대 이상을 받은 학생들이 오히려 드뭅니다. 애초에 대부분 제 학생들 내신이 3등급 이하니까요.

내신이 3등급 이상이었다면? 애초에 논술을 고민하지 않았겠죠. 제 학생들로 한정짓지 않아도 이건 내신 등급별 수시 지원 비율 데이터에서도 이미 증명되고 있는 사실입니다. 그런 학생들은 학종이나 교과를 씁니다.`
  },
  {
    question: "정말 최종 수학 2등급만 나오면 90% 합격하나요?",
    answer: `네. 맞습니다. 지난 17년간 데이터로 확인된 통계입니다.

박교준 선생님이 17년간 가르친 학생 중, 최종 수능 수학 2등급 이상이었던 학생은 매해 90% 이상 합격을 이뤄냈습니다.`
  },
  {
    question: "왜 그렇게 수리논술 합격률이 높아요?",
    answer: `오직 결과로 증명해온 커리큘럼 & 강의 노하우 덕분입니다.

지난 해 기준, 상위 12개 대학(연고/서성한/중경외시/건동홍) 합격 건수만 1,000건 이상. 현장에서 18년을 뛰며 쌓인, "대학별 출제 경향"과 "학생별 맞춤 학습" 노하우가 합격률을 견인합니다.`
  },
  {
    question: "수능 공부랑 같이하기 너무 벅차지 않을까요?",
    answer: `오히려 수능 수학 실력이 크게 성장합니다.

수리논술 70%는 교과 범위(수능형) 재구성 문제이기에, 논술 대비 = 수능 대비 효과가 있습니다. 문제 해결 과정에서 "왜 이렇게 접근했는지"를 명확히 훈련하니, 수능에서 실수 줄이고, 사고력도 상승.

과거 수강생 다수는 "논술 준비 덕분에 수능 수학 점수가 오히려 급상승했다"고 이야기를 많이 해줬습니다.`
  },
  {
    question: "그냥 기출이나 풀면서 독학해도 되지 않나요?",
    answer: `어려우실 겁니다. 수리논술은 어떤 조건, 상황이 나오는지 학생이 캐치하기 어렵기 때문입니다.

수학 공부는 내가 반응하지 못하는 조건, 상황에 반응하도록 만드는 "발상 훈련" 입니다. 수능이나 내신은 문제도 짧고 비슷한 문제가 이미 많이 만들어져 있어 독학으로도 이런 훈련이 어렵지 않습니다.

하지만, 수리논술은 한 시험에 등장하는 문제 수가 적은 데다 나오는 형태는 수능/내신보다 훨씬 다양해 어느 조건, 상황이 반복해서 등장하는지 학생들 입장에서는 캐치하는 것이 매우 어렵습니다.

심지어 수리논술은 문제가 길기 때문에, 학생들 입장에서 단기간에 많은 기출문제를 보기 어렵습니다. 이 때문에 독학을 하는 학생들 입장에서는 "수리논술은 매번 문제가 다 다르게 나오는 거 아냐?" 라고 느껴질 정도입니다.

이 때문에, 지난 10여 년간 모든 대학의 기출 문제들을 알고 있는 강사와 같은 전문가가 아닌 이상 무엇을 공부해야 하는지조차 알기 어렵습니다. 다른 시험보다도 수리논술이 특히, 독학이 어렵고 강사의 도움이 필요한 시험인 이유입니다.`
  },
  {
    question: "오프라인·온라인 수업 어떤 차이가 있나요?",
    answer: `집중도와 진행 방식 정도의 차이입니다.

오프라인: 강사와 실시간 호흡, 즉각적 질의응답, 현장 몰입감 극대화.

온라인: 시간·장소 제약 없이 수강, 반복 학습(녹화 강의) 가능, 동일 커리큘럼+첨삭 시스템 제공.

관리와 커리큘럼은 동일하니, 본인 학습 스타일에 맞춰 선택하시면 됩니다. 가능하다면, 학생이 상황이 된다면 오프라인 수업을 추천하기는 합니다. 누적된 학생들의 과제 수행을 보았을 때, 아무래도 강제성이 있는 오프라인 수업에 참여하는 학생들이 수업도 밀리지 않고 더 나은 과제 수행도를 보입니다.`
  },
  {
    question: "수강하면 정말 지금보다 더 높은 대학 갈 수 있나요?",
    answer: `"높은 대학" 노리는 학생을 위해 탄생한 수업입니다.

내신 망쳤다, 모의고사 성적 안 나온다 → "수능 정시 파이터" 되기에는 위험 부담이 크다면, 논술 카드가 해답입니다.

박교준 수리논술을 거쳐, 본인 예상점수보다 훨씬 높은 대학에 합격한 학생이 매년 속출하고 있습니다.

특히나, 의·치·약대를 노리는 지방의 학생들은 "지역인재전형"의 존재로 인해, 수리논술을 하지 않는 것이 이상할 지경이고 말도 안되는 성적으로 의치대로 들어가는 역전 성공 사례가 꾸준히 늘고 있습니다.`
  },
  {
    question: "수능에서 실패하면 결국 재수해야 하는 거 아닌가요?",
    answer: `플랜 B로 수리논술을 준비하세요.

수능 날 컨디션·돌발변수로 한두 과목만 삐끗해도 원하는 대학을 놓칠 수 있습니다. 하지만 수능과 병행 준비해둔 수리논술이 있다면, 합격 기회를 한 번 더 잡을 수 있습니다.

실제로, 수능 망쳤다고 눈물 흘리던 학생이 논술 합격 문자 받고 역전한 사례가 매년 등장합니다.`
  },
  {
    question: "수업을 들으려면, 어느 정도 수학 실력이 필요한가요?",
    answer: `범위로는 수2까지 배운 상태라면 수업을 들을 수 있습니다 :D 미적분까지 학습한 상태라면 더욱 좋습니다.

수학 실력은 어떤 상태라도 수강이 가능합니다. 다만 수업이 쉽다는 의미가 아닙니다. 이 수리논술 수업은 수학 성적이 좋은 학생도 어려워하고, 나쁜 학생도 어려워하는 수업입니다.

다만, 매주 나가는 수업의 양이 매우 적기 때문에 마음만 먹는다면 얼마든지 그 주의 내용을 익힐 수 있습니다. 따라서 학생의 실력보다는 배움의 자세가 중요합니다.

어떤 학생은 본인이 이미 다 알고 있는 내용을 다루는 수업을 좋아합니다. 어떤 학생은 본인이 전혀 모르는 내용을 다루는 수업을 듣고 싶어합니다. 참된 공부의 자세는 후자라고 할 수 있습니다. 그런 마음만 있다면 수학 실력과는 상관없이 수강이 가능한 수업입니다.`
  }
]

export default function FAQ() {
  const [isMobile, setIsMobile] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleQuestion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section style={{
      padding: isMobile ? '4rem 1rem' : '6rem 1rem',
      background: '#000000',
      position: 'relative'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto'
      }}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          style={{
            textAlign: 'center',
            marginBottom: '3rem'
          }}
        >
          <h2 style={{
            fontSize: isMobile ? '2rem' : '2.5rem',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            자주 묻는 질문
          </h2>
          <p style={{
            fontSize: '1rem',
            color: 'rgba(255, 255, 255, 0.5)'
          }}>
            학부모님들과 학생들이 자주 문의하시는 내용들을 모았습니다.
          </p>
        </motion.div>

        {/* FAQ List */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0'
        }}>
          {faqData.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              style={{
                borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Question */}
              <button
                onClick={() => toggleQuestion(index)}
                style={{
                  width: '100%',
                  padding: isMobile ? '1.25rem 0' : '1.5rem 0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left'
                }}
              >
                <span style={{
                  fontSize: isMobile ? '1rem' : '1.125rem',
                  fontWeight: '600',
                  color: openIndex === index ? '#FFFFFF' : 'rgba(255, 255, 255, 0.8)',
                  lineHeight: 1.5,
                  transition: 'color 0.3s'
                }}>
                  {faq.question}
                </span>
                <motion.div
                  animate={{ rotate: openIndex === index ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  style={{
                    flexShrink: 0
                  }}
                >
                  <ChevronDown 
                    size={24} 
                    style={{ 
                      color: openIndex === index ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)'
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
                    style={{
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{
                      paddingBottom: isMobile ? '1.25rem' : '1.5rem',
                      fontSize: isMobile ? '0.9rem' : '1rem',
                      color: 'rgba(255, 255, 255, 0.7)',
                      lineHeight: 1.8,
                      whiteSpace: 'pre-line'
                    }}>
                      {faq.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
