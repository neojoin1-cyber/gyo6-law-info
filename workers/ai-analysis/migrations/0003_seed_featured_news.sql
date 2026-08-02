INSERT INTO consultations (
  room, author_uid, author_email, author_name, anonymous_name, title, body,
  status, created_at, updated_at
)
SELECT
  'promotion',
  'system:featured-news',
  'admin@gyo6.kr',
  '유한회사 설탕과소금',
  '설탕과소금',
  '교육의 다음 장을 함께 만들 전문가를 기다립니다',
  '[[image:assets/news/education-experts-invitation.png|교육전문가 검수·자문 인력풀 초대 안내]]

교육현장 경험을 다음 세대의 기회로 연결할 전문가를 기다립니다.

- 참여 분야: 공무원·임용 핵심노트 및 모의고사
- 주요 역할: 사실·정답 전수 검증, 출제 경향 분석, 핵심노트·예상문제 검수
- 협업 방식: 재택 중심 온라인 협업, 비대면 면담과 프로젝트별 온보딩
- 운영 원칙: 위촉 계약, 비밀유지협약, 저작권과 정산 기준 사전 확정
- 함께할 분: 교육 경력을 의미 있게 이어갈 은퇴·시니어 전문가와 현장 교육전문가
- 참여 문의: 소식·문의 화면의 협업문의에서 남겨 주세요.',
  'open',
  '2026-07-20T11:16:00.000Z',
  '2026-07-20T11:16:00.000Z'
WHERE NOT EXISTS (
  SELECT 1 FROM consultations
  WHERE room = 'promotion'
    AND title = '교육의 다음 장을 함께 만들 전문가를 기다립니다'
);
