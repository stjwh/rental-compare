# 렌탈 비용 비교 웹앱

구조:
- GitHub Pages: 프론트엔드
- Supabase: DB + 관리자 로그인
- 게스트: 로그인 없이 조회/정렬/검색 가능
- 관리자: 이메일/비밀번호 로그인 후 추가/수정/삭제 가능

## 1) Supabase 프로젝트 생성
1. https://supabase.com 에서 무료 프로젝트 생성
2. SQL Editor에서 `supabase.sql` 전체 실행
3. Authentication > Users 에서 관리자 이메일 계정 생성
4. 생성한 관리자 User UUID 확인
5. SQL Editor에서 아래 실행
   `insert into public.admin_users(user_id) values ('관리자-USER-UUID');`

## 2) 프론트 연결값 입력
Supabase > Project Settings > API 에서:
- Project URL
- anon public key

`config.js`에 입력:
```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://xxxx.supabase.co",
  SUPABASE_ANON_KEY: "eyJ..."
};
```

※ service_role 키는 절대 넣지 마세요.

## 3) GitHub Pages 배포
1. GitHub에서 새 Public 저장소 생성 (예: `rental-compare`)
2. 이 폴더의 파일들을 저장소 루트에 업로드
3. Settings > Pages
4. Build and deployment:
   - Source: Deploy from a branch
   - Branch: main
   - Folder: /(root)
5. Save
6. 잠시 후 `https://아이디.github.io/rental-compare/` 주소로 접속

## 4) 동작
- 로그인 전: 전체 제품 조회/검색/정렬만 가능
- 우측 상단 관리자 로그인
- 관리자 로그인 성공 후:
  - + 제품 추가
  - 수정
  - 삭제 버튼 표시
- DB는 Supabase에 저장되므로 PC/휴대폰 어디서 접속해도 동일 데이터가 보임

## 무료 범위
개인용 소규모 앱이라면 GitHub Pages 무료 + Supabase Free 플랜으로 충분한 수준입니다.
무료 정책은 서비스 제공사 정책 변경 가능성이 있으므로 가입 시 현재 조건을 확인하세요.

## 주요 필드
- 구분 / 상태
- 브랜드 / 제품명 / 사이즈
- 월 렌탈료
- 의무기간 / 전체 계약기간
- 등록·설치비 / 초기비용
- 카드명 / 월 카드할인 / 할인 적용개월
- 캐시백 / 기타 혜택
- 케어서비스 / 케어주기
- 메모

## 자동 계산
- 총 렌탈료 = 월 렌탈료 × 전체 계약기간 + 등록/설치비 + 기타 초기비용
- 총 혜택 = 월 카드할인 × 할인 적용개월 + 캐시백 + 기타 혜택
- 실질 총비용 = 총 렌탈료 - 총 혜택
- 실질 월평균 = 실질 총비용 ÷ 전체 계약기간
