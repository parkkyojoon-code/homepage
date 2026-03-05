"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function PrivacyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      paddingTop: '100px',
      paddingBottom: '4rem'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        padding: '0 1rem'
      }}>
        {/* Back Button */}
        <Link href="/" style={{ textDecoration: 'none' }}>
          <motion.div
            whileHover={{ x: -5 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.9rem',
              marginBottom: '2rem',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={18} />
            홈으로 돌아가기
          </motion.div>
        </Link>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: '3rem' }}
        >
          <h1 style={{
            fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
            fontWeight: '800',
            color: '#FFFFFF',
            marginBottom: '1rem'
          }}>
            개인정보 처리방침
          </h1>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontSize: '0.95rem',
            color: 'rgba(255, 255, 255, 0.8)',
            lineHeight: 1.8
          }}
        >
          <p style={{ marginBottom: '2rem' }}>
            박교준입시연구소(이하 '회사'라 한다)는 개인정보 보호법 제30조에 따라 정보 주체의 개인정보를 보호하고, 관련 고충을 신속하며 원활하게 처리할 수 있도록 하기 위하여 아래와 같이 개인정보 처리지침을 수립, 공개합니다.
          </p>

          <Section title="제1조 (개인정보의 처리목적)">
            <p style={{ marginBottom: '1rem' }}>
              회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리 중인 개인정보는 별도의 동의 없이 다른 용도로 이용되지 않으며, 이용 목적 변경 시 개인정보보호법 제18조에 따라 필요한 조치를 이행합니다.
            </p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>서비스 제공:</strong> 수업 신청 및 관리, 상담 서비스 제공, 콘텐츠 제공, 맞춤서비스 제공, 서비스 부정 이용 방지, 각종 고지·통지, 고충 처리 등
              </li>
              <li style={{ marginBottom: '0.5rem' }}>
                <strong>고충 처리:</strong> 학생 및 학부모의 신원 확인, 문의사항 확인, 사실조사를 위한 연락·통지, 처리 결과 통보 등
              </li>
            </ul>
          </Section>

          <Section title="제2조 (개인정보의 처리 및 보유기간)">
            <p style={{ marginBottom: '0.5rem' }}>① 회사는 법령 또는 정보주체 동의에 따라 정해진 기간 동안 개인정보를 처리 및 보유합니다.</p>
            <p style={{ marginBottom: '1rem' }}>② 수집된 개인정보는 수집·이용 목적이 달성된 후에는 지체 없이 파기됩니다. 다만, 관계 법령에 따라 보존할 필요가 있는 경우에는 해당 기간 동안 보존합니다.</p>
          </Section>

          <Section title="제3조 (정보주체 및 법정대리인의 권리와 그 행사 방법)">
            <p style={{ marginBottom: '0.5rem' }}>① 정보주체는 회사에 대해 다음의 개인정보 보호 관련 권리를 행사할 수 있습니다.</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li>개인정보 열람 요구</li>
              <li>오류 발생 시 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
            <p style={{ marginBottom: '0.5rem' }}>② 권리 행사는 서면, 전화, 전자우편, 모사전송(FAX) 등을 통해 가능하며, 회사는 지체 없이 조치합니다.</p>
            <p style={{ marginBottom: '0.5rem' }}>③ 정정 또는 삭제 요구 시 완료될 때까지 해당 개인정보는 이용 또는 제공되지 않습니다.</p>
            <p style={{ marginBottom: '0.5rem' }}>④ 권리 행사는 법정대리인이나 위임 받은 자를 통해 가능하며, 위임장 제출이 필요합니다.</p>
            <p style={{ marginBottom: '1rem' }}>⑤ 정보주체는 개인정보 보호법 등 관련 법령을 위반하여 개인정보 및 사생활을 침해할 수 없습니다.</p>
          </Section>

          <Section title="제4조 (처리하는 개인정보 항목)">
            <p style={{ marginBottom: '0.5rem' }}>회사가 처리하는 개인정보 항목은 다음과 같습니다.</p>
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>수업 신청 및 상담</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li><strong>필수항목:</strong> 학생 이름, 학생 생년월일, 거주 지역, 학생 연락처, 학부모 연락처, 최근 모의고사 수학 성적, 목표 대학</li>
            </ul>
          </Section>

          <Section title="제5조 (개인정보의 파기)">
            <p style={{ marginBottom: '0.5rem' }}>① 보유 기간 경과 또는 처리 목적 달성 등으로 불필요해진 개인정보는 지체 없이 파기합니다.</p>
            <p style={{ marginBottom: '0.5rem' }}>② 별도의 보존이 필요한 경우, 해당 개인정보는 별도의 데이터베이스(DB)나 보관장소로 이전됩니다.</p>
            <p style={{ marginBottom: '0.5rem' }}>③ 개인정보 파기 절차 및 방법:</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li style={{ marginBottom: '0.25rem' }}><strong>파기 절차:</strong> 파기 사유 발생 시, 개인정보 보호책임자의 승인을 받아 파기</li>
              <li><strong>파기 방법:</strong> 전자적 파일은 재생 불가능하게 파기하며, 종이 문서는 분쇄하거나 소각</li>
            </ul>
          </Section>

          <Section title="제6조 (개인정보의 안전성 확보조치)">
            <p style={{ marginBottom: '0.5rem' }}>회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li style={{ marginBottom: '0.25rem' }}><strong>관리적 조치:</strong> 내부관리계획 수립 및 시행, 정기적 직원 교육</li>
              <li style={{ marginBottom: '0.25rem' }}><strong>기술적 조치:</strong> 접근 권한 관리, 접근통제시스템 설치, 암호화, 보안프로그램 설치</li>
              <li><strong>물리적 조치:</strong> 전산실, 자료보관실 등의 접근 통제</li>
            </ul>
          </Section>

          <Section title="제7조 (개인정보 자동 수집 장치의 설치·운영 및 거부에 관한 사항)">
            <p style={{ marginBottom: '0.5rem' }}>① 맞춤 서비스 제공을 위해 '쿠키(cookie)'를 사용합니다.</p>
            <p style={{ marginBottom: '0.5rem' }}>② 쿠키는 서버가 이용자의 브라우저로 보내는 소량의 정보로, PC 또는 모바일에 저장됩니다.</p>
            <p style={{ marginBottom: '1rem' }}>③ 브라우저 옵션에서 쿠키 허용/차단 설정이 가능하며, 거부 시 맞춤 서비스 이용에 제한이 있을 수 있습니다.</p>
            
            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>웹 브라우저에서 쿠키 허용/차단</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li>크롬(Chrome): 설정 {'>'} 개인정보 보호 및 보안 {'>'} 인터넷 사용기록 삭제</li>
              <li>엣지(Edge): 설정 {'>'} 쿠키 및 사이트 권한 {'>'} 쿠키 및 사이트 데이터 관리 및 삭제</li>
            </ul>

            <p style={{ fontWeight: '600', marginBottom: '0.5rem' }}>모바일 브라우저에서 쿠키 허용/차단</p>
            <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem' }}>
              <li>크롬(Chrome): 설정 {'>'} 개인정보 보호 및 보안 {'>'} 인터넷 사용기록 삭제</li>
              <li>사파리(Safari): 설정 {'>'} 사파리 {'>'} 고급 {'>'} 모든 쿠키 차단</li>
              <li>삼성 인터넷: 설정 {'>'} 인터넷 사용 기록 {'>'} 인터넷 사용 기록 삭제</li>
            </ul>

            <p style={{ marginBottom: '1rem' }}>④ 방문한 서비스 및 웹 사이트의 이용 형태, 인기 검색어, 보안접속 여부 등을 분석하여 최적화된 정보 제공에 활용합니다.</p>
          </Section>

          <Section title="제8조 (개인정보 보호책임자)">
            <p style={{ marginBottom: '1rem' }}>① 회사는 개인정보 처리 업무를 총괄하며, 관련 불만 및 피해구제를 위해 아래와 같이 개인정보 보호책임자를 지정합니다.</p>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '1.5rem', 
              borderRadius: '12px',
              marginBottom: '1rem'
            }}>
              <p style={{ fontWeight: '700', marginBottom: '0.75rem', color: '#FFFFFF' }}>▶ 개인정보 보호책임자</p>
              <ul style={{ paddingLeft: '1rem', marginBottom: '1rem', listStyle: 'none' }}>
                <li>성명: 이연주</li>
                <li>직책: 담당자</li>
                <li>연락처: <a href="mailto:parkkyojoon@gmail.com" style={{ color: '#0099FF' }}>parkkyojoon@gmail.com</a></li>
              </ul>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255, 255, 255, 0.6)' }}>※ 개인정보 보호 담당부서로 연결</p>
            </div>

            <div style={{ 
              background: 'rgba(255, 255, 255, 0.05)', 
              padding: '1.5rem', 
              borderRadius: '12px',
              marginBottom: '1rem'
            }}>
              <p style={{ fontWeight: '700', marginBottom: '0.75rem', color: '#FFFFFF' }}>▶ 개인정보 보호 담당부서</p>
              <ul style={{ paddingLeft: '1rem', listStyle: 'none' }}>
                <li>부서명: 박교준입시연구소 팀</li>
                <li>연락처: <a href="mailto:parkkyojoon@gmail.com" style={{ color: '#0099FF' }}>parkkyojoon@gmail.com</a></li>
              </ul>
            </div>

            <p>② 개인정보 보호 관련 문의 및 불만은 위 책임자 또는 담당부서로 연락해 주시기 바랍니다.</p>
          </Section>

          <Section title="제9조 (개인정보 처리방침 시행 및 변경)">
            <p>이 개인정보 처리방침은 <strong>2025. 01. 17.</strong> 부터 적용됩니다.</p>
          </Section>
        </motion.div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2.5rem' }}>
      <h3 style={{
        fontSize: '1.25rem',
        fontWeight: '700',
        color: '#FFFFFF',
        marginBottom: '1rem',
        paddingBottom: '0.5rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}
