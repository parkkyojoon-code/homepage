export default function TermsPage() {
  return (
    <main style={{
      minHeight: '100vh',
      background: '#0D0D0D',
      color: '#E0E0E0',
      padding: '6rem 1rem 4rem'
    }}>
      <div style={{
        maxWidth: '800px',
        margin: '0 auto'
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '700',
          color: '#FFFFFF',
          marginBottom: '2rem'
        }}>
          박교준 수리논술 이용약관
        </h1>
        
        <div style={{
          lineHeight: 1.8,
          fontSize: '0.95rem'
        }}>
          <p style={{ marginBottom: '2rem', color: '#B0B0B0' }}>
            박교준 입시연구소(이하 &quot;회사&quot;)가 제공하는 박교준 수리논술(이하 &quot;서비스&quot;)를 이용해 주셔서 감사합니다. 본 약관은 학생 및 학부모가 서비스를 이용하는 과정에서의 권리, 의무, 결제 및 환불 정책, 그리고 강의 이용 조건을 규정합니다. 본 서비스는 회원가입 없이 비회원 결제로 제공되며, 학원 서비스는 4주 단위로 판매됩니다.
          </p>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            1. 서비스의 소개 및 이용 방식
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.5rem' }}>본 서비스는 학생 및 학부모가 온라인 및 오프라인 강의 정보를 확인하고, 결제를 진행할 수 있는 수리논술 학원 서비스입니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>웹사이트와 모바일 환경에서 최적화된 인터페이스를 제공하며, 사용 편의성에 중점을 두고 있습니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>학원 서비스는 4주 단위로 판매되며, 결제 완료 후 해당 기간 동안 강의 이용권이 제공됩니다.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            2. 결제 및 환불 정책
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.5rem' }}>모든 결제는 비회원 결제 방식으로 진행되며, 결제 완료 시 강의 이용권이 발급됩니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>결제 전 제공되는 강의 정보 및 이용 기간(4주)을 반드시 확인해 주시기 바랍니다.</li>
          </ul>

          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '1.5rem' }}>
            강의 환불 규정
          </h3>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 1조 (목적)
          </h4>
          <p style={{ marginBottom: '1rem', color: '#B0B0B0' }}>
            본 규정은 박교준 입시연구소(이하 &quot;회사&quot;)의 교습비 반환에 관한 사항을 규정함을 목적으로 하며, 학원의 설립·운영 및 과외교습에 관한 법률 시행령 [별표 4]의 교습비 반환 기준(제18조 제3항)을 준수합니다.
          </p>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 2조 (환불 신청 및 기준)
          </h4>
          
          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>1. 기본 원칙</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>수업 시작 전: 전액 환불</li>
            <li style={{ marginBottom: '0.25rem' }}>수업 시작 후: 아래 제시된 환불 기준에 따름</li>
            <li style={{ marginBottom: '0.25rem' }}>개별 수업: 수업 예정 시간 24시간 전까지 취소 시 1회분 환불 가능</li>
            <li style={{ marginBottom: '0.25rem' }}>수업 예정 시간 24시간 이내 취소: 해당 회차 차감 및 환불 불가</li>
          </ul>

          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>2. 수업 경과 기준</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>수업 시작 후 1/3 경과 전: 실 결제 금액 – 수강료 1/3 금액 환불</li>
            <li style={{ marginBottom: '0.25rem' }}>수업 시작 후 1/2 경과 전: 실 결제 금액 – 수강료 1/2 금액 환불</li>
            <li style={{ marginBottom: '0.25rem' }}>수업 시작 후 1/2 초과 시: 환불 불가</li>
          </ul>

          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>3. 강의 중 일시정지</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>일시정지 일을 포함한 기간이 기본 수강 기간(4주)의 1/2 초과 시: 환불 불가</li>
            <li style={{ marginBottom: '0.25rem' }}>일시정지 일을 포함한 기간이 기본 수강 기간(4주)의 1/2 미만 시: 수강료 1/2 금액 환불</li>
          </ul>

          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>4. 환불 제한 사항</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>첫 수업이 24시간 이내에 예정된 경우: 해당 수업 1회 차감 후 환불</li>
            <li style={{ marginBottom: '0.25rem' }}>수업 예정 시간 24시간 이내 취소: 해당 회차 차감 및 환불 불가</li>
            <li style={{ marginBottom: '0.25rem' }}>수강 종료 후 환불은 불가</li>
          </ul>
          <p style={{ marginBottom: '1rem', color: '#808080', fontSize: '0.9rem' }}>
            ※ 환불 기준이 되는 진도는 수강생 개별 진도율이 아닌, 학생 수업 시작일 기준으로 진행되는 공통 커리큘럼 진도를 기준으로 산정됩니다.
          </p>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 3조 (환불 금액 산정)
          </h4>
          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>1. 기준 금액</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수리논술 온라인 정규 과정 (4주): ₩360,000</li>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수리논술 온라인 정규 주 2회 과정 (4주): ₩578,000</li>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수리논술 온라인 정규 주 3회 과정｜12주 코스 (4주): ₩650,000</li>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수리논술 오프라인 과정 (4주): ₩800,000</li>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수능 수학 추월반 패스 (4주): ₩300,000</li>
            <li style={{ marginBottom: '0.25rem' }}>박교준 수능 수학 단과 과정 (4주): ₩200,000</li>
          </ul>

          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>2. 산정 기준</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>학생에게 제공된 1:1 관리 서비스 (카카오톡 1:1 관리방 개설, 수업 피드백, 과제 첨삭 등)은 &apos;이미 제공된 서비스&apos;로 간주되며, 해당 분량은 환불 금액 산정 시 제외됩니다.</li>
            <li style={{ marginBottom: '0.25rem' }}>고객의 자의적 수강 포기에 대한 환불은, 제2조(환불 신청 및 기준)의 반환 규정에 따라 처리됩니다.</li>
            <li style={{ marginBottom: '0.25rem' }}>환불은 &apos;수업 기간(4주 단위)&apos;을 기준으로 산정되며, 수강생의 개별 진도율과 무관하게 수업 시작일 기준 경과 기간에 따라 「학원의 설립·운영 및 과외교습에 관한 법률 시행령 [별표 4]」 기준에 따라 계산됩니다.</li>
            <li style={{ marginBottom: '0.25rem' }}>소수점은 버림 처리하며, 환불은 실제 결제 금액을 기준으로 진행됩니다.</li>
          </ul>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 4조 (환불 처리 기한 및 방식)
          </h4>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>환불 요청 승인 시, 영업일 기준 7일 이내에 환불 처리</li>
            <li style={{ marginBottom: '0.25rem' }}>환불은 원 결제 수단으로 진행</li>
            <li style={{ marginBottom: '0.25rem' }}>필요한 정보 미제공 또는 기타 사유로 환불 처리 지연 시 별도 안내</li>
          </ul>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 5조 (환불 불가 조건)
          </h4>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>수업 이용 기간 종료 (수업 이용 기간은 결제일로부터 1개월)</li>
            <li style={{ marginBottom: '0.25rem' }}>무단 결석, 24시간 이내 수업 취소 등 고객 귀책 사유로 인해 수업이 진행된 경우</li>
            <li style={{ marginBottom: '0.25rem' }}>약관 위반으로 인해 서비스가 중단된 경우</li>
          </ul>

          <h4 style={{ fontSize: '1rem', fontWeight: '600', color: '#E0E0E0', marginBottom: '0.75rem', marginTop: '1.5rem' }}>
            제 6조 (특수 상황 처리)
          </h4>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>회사 귀책 사유로 서비스 제공이 불가능한 경우, 진행되지 않은 수업에 대해 1회 수업 기준으로 환불 또는 대체 수업 제공</li>
            <li style={{ marginBottom: '0.25rem' }}>천재지변, 시스템 장애 등 불가항력적 사유로 서비스가 중단된 경우, 고객과 협의하여 대체 수업 또는 잔여 금액 환불 진행</li>
          </ul>

          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            📦 교재 환불 규정
          </h3>
          
          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>교재 출고 전</p>
          <p style={{ marginBottom: '1rem', color: '#B0B0B0' }}>
            출고 전일 경우, 박교준 입시연구소 카카오채널을 통해 환불 신청 시 전액 환불
          </p>

          <p style={{ fontWeight: '600', color: '#FFFFFF', marginBottom: '0.5rem' }}>교재 출고 후</p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.25rem' }}>교재 수령 후 10일 이내, 카카오채널을 통해 반품 접수 및 반품 완료된 경우 환불 가능</li>
            <li style={{ marginBottom: '0.25rem' }}>교재 훼손(낙서, 구김, 필기, 성명 기입, 포장 훼손 등) 없어야 함</li>
            <li style={{ marginBottom: '0.25rem' }}>배송 시 포장 상태가 유지되어야 함</li>
            <li style={{ marginBottom: '0.25rem' }}>고객 변심으로 인한 반품 시 배송비(왕복 8,000원)는 고객 부담</li>
            <li style={{ marginBottom: '0.25rem' }}>회차별로 구성된 상품은 부분 환불이 불가</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            3. 이용자의 의무
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.5rem' }}>이용자는 결제 및 강의 이용과 관련된 모든 정보의 정확성을 유지해야 하며, 부정확한 정보 제공으로 인한 문제에 대해 책임을 집니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>제공되는 강의 자료 및 정보는 개인적인 학습 목적으로만 사용되며, 무단 복제 및 배포를 금지합니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>강의 이용 중 부정행위나 허위 결제 등이 적발될 경우, 관련 법률에 따라 조치될 수 있습니다.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            4. 지식재산권
          </h2>
          <p style={{ marginBottom: '1.5rem', color: '#B0B0B0' }}>
            본 서비스 내의 모든 콘텐츠, 강의 자료, 이미지 및 기타 자료에 대한 저작권과 지식재산권은 회사에 귀속됩니다. 이용자는 서비스 이용 범위 내에서만 자료를 열람 및 사용해야 하며, 무단 복제 및 배포를 엄격히 금지합니다.
          </p>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            5. 면책조항 및 책임 제한
          </h2>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem', color: '#B0B0B0' }}>
            <li style={{ marginBottom: '0.5rem' }}>본 서비스는 &quot;있는 그대로&quot; 제공되며, 회사는 서비스 이용 중 발생한 직간접적 손해에 대한 책임을 제한합니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>단, 회사의 고의 또는 중대한 과실에 의한 손해에 대해서는 예외가 적용됩니다.</li>
            <li style={{ marginBottom: '0.5rem' }}>시스템 장애나 기술적 문제 등 불가항력적인 사유로 인한 서비스 중단에 대해서는 회사가 책임을 지지 않습니다.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            6. 준거법 및 분쟁 해결
          </h2>
          <p style={{ marginBottom: '1.5rem', color: '#B0B0B0' }}>
            본 약관은 대한민국 법률에 따라 해석되며, 본 서비스 이용과 관련된 모든 분쟁은 회사 소재지를 관할하는 법원의 전속 관할에 따릅니다.
          </p>

          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#FFFFFF', marginBottom: '1rem', marginTop: '2rem' }}>
            7. 기타 및 회사 연락처
          </h2>
          <p style={{ marginBottom: '1rem', color: '#B0B0B0' }}>
            본 약관의 일부 조항이 무효이거나 시행 불가능한 경우에도, 나머지 조항은 계속 유효합니다.
          </p>
          <p style={{ marginBottom: '1rem', color: '#B0B0B0' }}>
            서비스 이용 관련 문의 사항은 아래 이메일로 연락 주시기 바랍니다: <a href="mailto:parkkyojoon@gmail.com" style={{ color: '#0099FF' }}>parkkyojoon@gmail.com</a>
          </p>
        </div>
      </div>
    </main>
  )
}
