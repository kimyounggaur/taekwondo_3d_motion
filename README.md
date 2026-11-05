# 모션 도장

한국어 태권도 3D 학습 웹앱 개발판입니다. **개발 미리보기에는 기본동작 10개와 좌우·지르기 변형, 연속 이동 테스트를 합쳐 21개 GLB 클립이 있습니다.** 모든 제작 모션은 지도자 검수 전입니다.

## 바로 실행

ZIP을 풀고 Windows에서 `START_WINDOWS.cmd`를 엽니다. Python 3가 필요합니다. macOS·Linux에서는 같은 폴더에서 다음 명령을 실행합니다.

```sh
python3 start_preview.py
```

브라우저가 열리면 **앞서기**부터 볼 수 있습니다. 서버는 현재 기기의 루프백 주소에서 실행됩니다. 종료하려면 실행 창을 닫거나 Ctrl+C를 누릅니다. 공개용 자료 카탈로그 빌드는 `python3 start_preview.py --public`으로 엽니다.

## 개발

Node.js 24.22.1과 npm 11.9.0에서 확인했습니다. 잠금 파일이 포함되어 있습니다.

```sh
npm ci
npm run dev:qa
```

| 명령 | 동작 |
| --- | --- |
| `npm run dev:qa` | 개발 미리보기 |
| `npm run dev:public` | 승인 데이터만 읽는 개발 모드 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` | 코드 검사 |
| `npm run content:validate` | 17종 원천 출처와 공개 매니페스트 검사 |
| `npm run assets:validate` | GLB, 리그, 애니메이션 길이와 해시 검사 |
| `npm run test:unit` | 시간, 반복, 구령, 검수 상태, 실제 GLB 샘플링 회귀 검사 |
| `npm run build:qa` | 개발 미리보기 빌드 `dist-qa/` |
| `npm run build` | 공개용 자료 빌드 `dist/` |
| `npm run release:check` | B00~B09·태극1장 공개 승인과 의존 자산 검사 |

`release:check`는 현재 필수 검수 자산 부재로 종료 코드 2를 반환합니다. 공개용 빌드의 자료 목록은 열 수 있습니다.

## 제작 자산

`assets-source/dojo-rig.blend`에서 본과 21개 NLA 트랙을 편집할 수 있습니다. `build_rig.py`에는 모델 생성, 스키닝, 발 앵커, 모션 키프레임과 내보내기 절차가 들어 있습니다. Blender 4.3.2에서 다음 명령으로 재생성합니다.

```sh
blender -b --python-exit-code 1 --python assets-source/build_rig.py
node scripts/index-clips.mjs
npm run assets:validate
```

브라우저는 가능한 경우 WebGL을 사용합니다. WebGL을 사용할 수 없으면 동일한 스킨드 GLB를 Canvas 호환 3D 경로로 렌더링합니다. 2D 관찰을 선택하면 같은 모션 시각에서 추출한 관절을 볼 수 있습니다.

## 검수와 다음 자산 연결

태극 1장 상세에 국기원 원문과 영상 후보를 연결했습니다. `/lab`의 이동·연결 테스트는 시퀀스 기능을 검증하는 별도 자산입니다. 태극 1장 전체 시범·전사표·검수는 `docs/content-gap-register.md`와 `docs/taegeuk-01-review.csv`에서 이어갈 수 있습니다. 승인된 자산의 버전·해시·근거를 기록한 뒤에만 `src/content/release-manifest.json`으로 연결합니다.

- `docs/verification-log.md` — 실행한 검사와 제약
- `docs/requirements-traceability.md` — 설계와 구현의 대응
- `docs/handoff.md` — 작업 재개와 자산 인수
