# 릴리스

Bear KTBaker의 버전별 설치 파일입니다. 각 파일은 [GitHub Releases](https://github.com/RudinP/Bear-KTBaker/releases)에서도 동일하게 받을 수 있습니다.

macOS 빌드는 Apple Silicon과 Intel을 모두 지원하는 유니버설 바이너리이며, Windows 빌드는 64-bit(NSIS 설치형)입니다. 모두 코드 서명 없이 배포되므로 최초 실행 시 나타나는 운영체제 경고 해결 방법은 [README의 설치 안내](README.md#설치-안내)를 참고해 주세요.

> ⚠️ **v0.1.7 이전 버전에는 아래에 표시된 것과 같은 버그가 있었습니다.** 특별히 이전 버전이 필요한 경우가 아니라면 최신 버전(v0.1.11) 사용을 권장합니다.

---

## v0.1.11 — 2026-09-19 (최신)

**이 버전에서 수정:** 테마 이름 끝의 공백이 APK 생성 과정에서 제거되어 메타데이터 검증에 실패하던 문제를 수정했습니다. 이름의 앞뒤·연속 공백과 특수문자를 그대로 보존합니다.

| 플랫폼 | 파일 |
| --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.11-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.11/Bear.KTBaker-0.1.11-universal.dmg) |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.11-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.11/Bear.KTBaker-0.1.11-universal-mac.zip) |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.11.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.11/Bear.KTBaker.Setup.0.1.11.exe) |

SHA256: [SHA256SUMS-0.1.11.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.11/SHA256SUMS-0.1.11.txt) · [변경 이력 (v0.1.10...v0.1.11)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.10...v0.1.11)

## v0.1.10 — 2026-09-19

**이 버전에서 수정:** 250204 공식 가이드·샘플에 맞춰 구형 오픈채팅 아이콘 연결을 수정했습니다. Android의 `open_chat`·`view` 선택자와 iOS의 `openchats`·`view` 선언을 지원합니다. 구형 아이콘 가져오기를 보완하고, Piccoma 탭과 이미지가 충돌해 APK 검증에 실패하던 문제를 수정했습니다. Windows의 한글 작업 경로에서는 영문 임시 폴더에서 APK를 빌드하도록 수정하고, APK 오류도 검증 항목별로 구분합니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.10-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.10/Bear.KTBaker-0.1.10-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.10-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.10/Bear.KTBaker-0.1.10-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.10.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.10/Bear.KTBaker.Setup.0.1.10.exe) | 127.6 MB |

SHA256: [SHA256SUMS-0.1.10.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.10/SHA256SUMS-0.1.10.txt) · [변경 이력 (v0.1.9...v0.1.10)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.9...v0.1.10)

## v0.1.9 — 2026-09-14

**이 버전에서 변경:** 구형 오픈채팅 이미지와 선택자 생성을 추가했습니다. 이후 확인된 선택자 이름 오류와 Piccoma 이미지 충돌은 v0.1.10에서 수정했습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.9-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.9/Bear.KTBaker-0.1.9-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.9-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.9/Bear.KTBaker-0.1.9-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.9.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.9/Bear.KTBaker.Setup.0.1.9.exe) | 127.5 MB |

SHA256: [SHA256SUMS-0.1.9.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.9/SHA256SUMS-0.1.9.txt) · [변경 이력 (v0.1.8...v0.1.9)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.8...v0.1.9)

## v0.1.8 — 2026-09-13

**이 버전에서 변경:** 오픈채팅 탭 호환 처리를 추가하고 Windows x64 NSIS 설치 파일을 제공했습니다. 당시 Piccoma를 오픈채팅 별칭으로 처리한 오류는 v0.1.10에서 수정했습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.8-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.8/Bear.KTBaker-0.1.8-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.8-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.8/Bear.KTBaker-0.1.8-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.8.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.8/Bear.KTBaker.Setup.0.1.8.exe) | 127.5 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.8/SHA256SUMS-0.1.8.txt) · [변경 이력 (v0.1.7...v0.1.8)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.7...v0.1.8)

## v0.1.7 — 2026-08-08

**이 버전에서 수정:** macOS에서 iOS 말풍선 영역 편집 후 완료 버튼의 클릭 범위가 작아 누르기 어렵던 문제를 수정했습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.7-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.7/Bear.KTBaker-0.1.7-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.7-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.7/Bear.KTBaker-0.1.7-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.7.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.7/Bear.KTBaker.Setup.0.1.7.exe) | 127.5 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.7/SHA256SUMS-0.1.7.txt) · [변경 이력 (v0.1.6...v0.1.7)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.6...v0.1.7)

## v0.1.6 — 2026-07-28

**이 버전에서 수정:** Windows 계정명이 한글이어도 APK가 정상적으로 생성되도록 처리했습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.6-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.6/Bear.KTBaker-0.1.6-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.6-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.6/Bear.KTBaker-0.1.6-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.6.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.6/Bear.KTBaker.Setup.0.1.6.exe) | 127.5 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.6/SHA256SUMS-0.1.6.txt) · [변경 이력 (v0.1.5...v0.1.6)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.5...v0.1.6)

## v0.1.5 — 2026-07-20

**이 버전에서 개선:** 말풍선(채팅 버블) 관련 구조를 개선했습니다. (v0.1.4~v0.1.5에 걸쳐 진행)

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.5-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.5/Bear.KTBaker-0.1.5-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.5-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.5/Bear.KTBaker-0.1.5-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.5.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.5/Bear.KTBaker.Setup.0.1.5.exe) | 127.5 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.5/SHA256SUMS-0.1.5.txt) · [변경 이력 (v0.1.4...v0.1.5)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.4...v0.1.5)

## v0.1.4 — 2026-07-19

**이 버전에서 개선:** 말풍선(채팅 버블) 관련 구조를 개선했습니다. (v0.1.4~v0.1.5에 걸쳐 진행)

> 이 버전은 Windows 설치 파일이 제공되지 않습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.4-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.4/Bear.KTBaker-0.1.4-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.4-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.4/Bear.KTBaker-0.1.4-universal-mac.zip) | 244.9 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.4/SHA256SUMS-0.1.4.txt) · [변경 이력 (v0.1.3...v0.1.4)](https://github.com/RudinP/Bear-KTBaker/compare/v0.1.3...v0.1.4)

## v0.1.3 — 2026-07-19

**이 버전에서 수정:** 유효한 9-patch 이미지를 손상된 파일로 잘못 판단하던 파서 문제를 수정했습니다.

| 플랫폼 | 파일 | 크기 |
| --- | --- | --- |
| 🍎 macOS (.dmg) | [Bear KTBaker-0.1.3-universal.dmg](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.3/Bear.KTBaker-0.1.3-universal.dmg) | 244.9 MB |
| 🍎 macOS (.zip) | [Bear KTBaker-0.1.3-universal-mac.zip](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.3/Bear.KTBaker-0.1.3-universal-mac.zip) | 244.9 MB |
| 🪟 Windows (.exe) | [Bear KTBaker Setup 0.1.3.exe](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.3/Bear.KTBaker.Setup.0.1.3.exe) | 127.5 MB |

SHA256: [SHA256SUMS.txt](https://github.com/RudinP/Bear-KTBaker/releases/download/v0.1.3/SHA256SUMS-0.1.3.txt)
