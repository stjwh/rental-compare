# 렌탈 비용 비교 웹앱 — 보안 강화판

- GitHub Pages: 프론트엔드
- Supabase: DB + 관리자 인증
- 게스트: 로그인 없이 공개 View 조회만 가능
- 관리자: 로그인 후 원본 테이블 추가/수정/삭제 가능
- 관리자 전용 메모는 게스트 View에서 제외됨

## 필수: 보안 SQL 적용
GitHub 파일 업데이트만으로 DB 정책은 바뀌지 않습니다.
Supabase > SQL Editor에서 저장소의 `supabase.sql` 전체를 다시 실행하세요.
기존 memo 데이터는 public_memo로 보존됩니다.

## 관리자 계정
Authentication > Users에서 관리자 계정을 만든 뒤 UUID를 확인하고:
```sql
insert into public.admin_users(user_id)
values ('관리자-USER-UUID')
on conflict (user_id) do nothing;
```

## Auth 설정 권장
Supabase > Authentication > Providers / Sign In 설정에서
개인용이라면 **새 사용자 Self sign-up을 비활성화**하세요.
관리자 계정은 Dashboard에서 직접 생성하는 방식이 안전합니다.

## 키
config.js에는 Project URL + publishable key만 사용합니다.
- 허용: sb_publishable_...
- 금지: sb_secret_..., service_role

## 공개/비공개 데이터
공개 View(rental_items_public):
브랜드, 제품명, 가격, 계약기간, 카드할인, 캐시백, 케어서비스, public_memo 등 비교에 필요한 정보만 제공.

원본 rental_items:
관리자만 접근하며 admin_memo 포함.

## 계산
- 총 렌탈료 = 월 렌탈료 × 전체 계약기간 + 등록/설치비 + 기타 초기비용
- 총 혜택 = 월 카드할인 × 할인 적용개월 + 캐시백 + 기타 혜택
- 실질 총비용 = 총 렌탈료 - 총 혜택
- 실질 월평균 = 실질 총비용 ÷ 전체 계약기간
