# 설계 요구 추적

| 설계 범위 | 구현 경로 | 확인 |
| --- | --- | --- |
| 원천자료·17종·준비 상태 | data/, scripts/import-sources.mjs, src/content/, src/main.tsx | 카탈로그 검사와 브라우저 17종 |
| 공통 플레이어·반응형·수업 화면 | src/components/Player.tsx, src/style.css | 브라우저 단계·수업 모드 |
| 리깅·자산·시간 | assets-source/, src/qa/, src/engine/transport.ts, src/engine/sample.ts | GLB 자산·시간 회귀 |
| 시점·궤적·접지·지도 | src/engine/Scene.tsx, SoftwareScene.tsx, src/components/MovementMap.tsx | 브라우저 측면·연결 지도 |
| 품새 연결·순서 | /lab, src/components/Player.tsx | 모드·순서 문제, 태극1장 자료와 분리 |
| 문제·기록·이어하기 | src/components/Player.tsx, src/storage/progress.ts | 정답 저장·복원 |
| 공개 검사·배포 준비 | scripts/validate.ts, start_preview.py | 빌드·QA 제외 검사 |
