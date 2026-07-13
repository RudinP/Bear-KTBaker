# 카카오톡 26.5 공식 색상 감사

## 감사 범위와 결론

- 기준 문서: `카카오톡 사용자 테마 제작가이드_26.5.0_iOS.pdf` 전체 23쪽, `카카오톡 사용자 테마 제작가이드_26.5.0_Android.pdf` 전체 20쪽
- 보조 기준: 저장소에 반영된 iOS/Android 공식 샘플 색상 선언. iOS 샘플은 25.8 기반이므로 26.5 가이드에만 추가된 선언도 별도로 포함했다.
- iOS: 색상 47개(샘플 44개 + 26.5 가이드 전용 3개), 별도 alpha 5개. 47개 모두 매니페스트·Inspector·가져오기/내보내기에 연결됐다.
- Android: AARRGGBB 포함 색상 44개. 44개 모두 매니페스트·Inspector·가져오기/내보내기에 연결됐다.
- 앱의 의미 색상 슬롯은 총 56개다. iOS 색상은 46개 슬롯에 47개 키가 연결되고, Android는 44개 슬롯에 44개 키가 연결된다. iOS 섹션 제목/설명 두 선언은 같은 의미 슬롯에서 함께 변경된다.
- 공식 키 중 중복 매핑과 미매핑은 0개다. `npm run audit:theme`이 샘플·26.5 가이드 전용·alpha 선언을 함께 검사한다.

## 동기화 규칙

Inspector에서 iOS 또는 Android의 공통 의미 색상을 변경하면 두 OS의 대응 RGB를 함께 변경한다. 다만 OS별 투명도 표현은 독립적으로 보존한다.

- iOS는 6자리 RGB와 별도 `*-alpha` 선언을 유지한다.
- Android는 `#AARRGGBB` 값이면 앞의 `AA`를 유지하고 RGB만 동기화한다.
- 투명도 슬라이더는 현재 선택한 OS만 변경한다. iOS alpha를 바꿔도 Android `AA`가 바뀌지 않고, Android `AA`를 바꿔도 iOS alpha가 바뀌지 않는다.
- 한 OS에만 존재하는 키는 반대 OS에 가짜 키를 만들지 않는다.

## 미리보기 상태 표기

- **상시**: 해당 공식 화면에서 바로 확인 가능
- **눌림**: 목록·말풍선·입력 버튼·키패드 등을 누르는 동안만 확인 가능
- **상태 전환**: 미리보기 위의 공식 상태 선택 버튼으로만 표시
- **Inspector/export 전용**: 정확한 공식 대상 화면을 현재 단순화된 PhonePreview가 제공하지 않아 가짜 UI를 그리지 않음. 값 편집과 패키지 입출력은 지원

## iOS 키 47개

| 공식 키 | 의미 슬롯 | PhonePreview 연결 |
| --- | --- | --- |
| `HeaderStyle-Main|-ios-text-color` | `main.header.foreground` | 상시: 메인/채팅 헤더 제목·아이콘 |
| `HeaderStyle-Main|-ios-tab-text-color` | `main.header.tab.normal` | 상시: 더보기 서비스 그리드의 기본 페이지 점 |
| `HeaderStyle-Main|-ios-tab-highlighted-text-color` | `main.header.tab.selected` | Inspector/export 전용: 26.5 번호 표시에 독립 대상이 없는 샘플 선언 |
| `MainViewStyle-Primary|background-color` | `main.background` | 상시: 친구·채팅·더보기 기본 배경 |
| `MainViewStyle-Primary|-ios-text-color` | `main.title.normal` | 상시: 목록 제목, 더보기 서비스 아이콘·레이블 |
| `MainViewStyle-Primary|-ios-highlighted-text-color` | `main.title.pressed` | 눌림: 목록 제목 |
| `MainViewStyle-Primary|-ios-description-text-color` | `main.description.normal` | 상시: 상태 메시지 |
| `MainViewStyle-Primary|-ios-description-highlighted-text-color` | `main.description.pressed` | 눌림: 상태 메시지 |
| `MainViewStyle-Primary|-ios-paragraph-text-color` | `main.paragraph.normal` | 상시: 채팅 목록 마지막 메시지 |
| `MainViewStyle-Primary|-ios-paragraph-highlighted-text-color` | `main.paragraph.pressed` | 눌림: 채팅 목록 마지막 메시지 |
| `MainViewStyle-Primary|-ios-normal-background-color` | `main.cell.normal` | 상시: 목록 셀; 별도 alpha 합성 |
| `MainViewStyle-Primary|-ios-selected-background-color` | `main.cell.pressed` | 눌림: 목록 셀; 별도 alpha 합성 |
| `MainViewStyle-Secondary|background-color` | `main.secondary.background` | 상시: 지금 탭 보조 콘텐츠 배경 |
| `MainViewStyle-Secondary|-ios-text-color` | `main.secondary.foreground` | 상시: 지금 탭 보조 콘텐츠 글자; 26.5 가이드 전용 |
| `SectionTitleStyle-Main|border-color` | `main.section.border` | Inspector/export 전용: 단순 목록의 제목 밑줄이 아닌 공식 콘텐츠 경계선 |
| `SectionTitleStyle-Main|-ios-text-color` | `main.section.foreground` | 상시: 섹션 제목 |
| `SectionTitleStyle-Main|-ios-description-text-color` | `main.section.foreground` | 상시: 같은 섹션 의미 슬롯과 동기화; 26.5 가이드 전용 |
| `FeatureStyle-Primary|-ios-text-color` | `feature.primary.normal` | Inspector/export 전용: 친구 화면의 별도 서비스 버튼 화면은 현재 미리보기에 없음 |
| `TabBarStyle-Main|background-color` | `main.tab.background` | 상시: 하단 탭 배경 이미지가 없을 때의 배경; 26.5 가이드 전용 |
| `BottomBannerStyle|background-color` | `main.banner.dark` | 상태 전환: iOS 채팅 탭의 `어두운 배너` |
| `BottomBannerStyle-Light|background-color` | `main.banner.light` | 상태 전환: iOS 채팅 탭의 `밝은 배너`; 공식 샘플 선언 |
| `BackgroundStyle-ChatRoom|background-color` | `chat.background` | 상시: 채팅방 배경 |
| `MessageCellStyle-Send|-ios-text-color` | `chat.bubble.me.text` | 상시: 보낸 말풍선 글자 |
| `MessageCellStyle-Send|-ios-selected-text-color` | `chat.bubble.me.text.pressed` | 눌림: 보낸 말풍선 글자 |
| `MessageCellStyle-Send|-ios-unread-text-color` | `chat.unread` | 상시: 보낸 메시지 안 읽은 숫자 |
| `MessageCellStyle-Receive|-ios-text-color` | `chat.bubble.you.text` | 상시: 받은 말풍선 글자 |
| `MessageCellStyle-Receive|-ios-selected-text-color` | `chat.bubble.you.text.pressed` | 눌림: 받은 말풍선 글자 |
| `MessageCellStyle-Receive|-ios-unread-text-color` | `chat.unread.received` | 상시: 받은 메시지 안 읽은 숫자 |
| `InputBarStyle-Chat|background-color` | `chat.input.background` | 상시: 채팅 입력바 배경 |
| `InputBarStyle-Chat|-ios-send-normal-background-color` | `chat.input.send.background` | 상시: 보내기 버튼 배경 |
| `InputBarStyle-Chat|-ios-send-normal-foreground-color` | `chat.input.send.icon` | 상시: 보내기 아이콘 |
| `InputBarStyle-Chat|-ios-send-highlighted-background-color` | `chat.input.send.background.pressed` | 눌림: 보내기 버튼 배경 |
| `InputBarStyle-Chat|-ios-send-highlighted-foreground-color` | `chat.input.send.icon.pressed` | 눌림: 보내기 아이콘 |
| `InputBarStyle-Chat|-ios-button-normal-foreground-color` | `chat.input.menu.icon` | 상시: 메뉴 아이콘 |
| `InputBarStyle-Chat|-ios-button-highlighted-foreground-color` | `chat.input.menu.icon.pressed` | 눌림: 메뉴 아이콘 |
| `InputBarStyle-Chat|-ios-button-text-color` | `chat.input.text` | 상시: 입력 글자 |
| `InputBarStyle-Chat|-ios-button-normal-background-color` | `chat.input.menu.background` | 상시: 메뉴 버튼 배경; 별도 alpha 합성 |
| `BackgroundStyle-Passcode|background-color` | `passcode.background` | 상시: 잠금화면 배경 |
| `LabelStyle-PasscodeTitle|-ios-text-color` | `passcode.foreground` | 상시: 잠금화면 제목·설명 |
| `PasscodeStyle|-ios-keypad-background-color` | `passcode.keypad.background` | 상시: 키패드 영역 배경 |
| `PasscodeStyle|-ios-keypad-text-normal-color` | `passcode.keypad.text` | 상시: 숫자 키패드 글자 |
| `BackgroundStyle-MessageNotificationBar|background-color` | `notification.background` | 상태 전환: 메시지 알림 |
| `LabelStyle-MessageNotificationBarName|-ios-text-color` | `notification.title` | 상태 전환: 메시지 알림 이름 |
| `LabelStyle-MessageNotificationBarMessage|-ios-text-color` | `notification.message` | 상태 전환: 메시지 알림 본문 |
| `BackgroundStyle-DirectShareBar|background-color` | `direct-share.background` | 상태 전환: 전달 완료 배너 |
| `LabelStyle-DirectShareBarName|-ios-text-color` | `direct-share.title` | 상태 전환: 전달 완료 이름 |
| `LabelStyle-DirectShareBarMessage|-ios-text-color` | `direct-share.message` | 상태 전환: 전달 완료 본문 |

### iOS 별도 alpha 5개

| 공식 키 | 의미 슬롯 | 처리 |
| --- | --- | --- |
| `MainViewStyle-Primary|-ios-normal-background-alpha` | `main.cell.normal` | 목록 셀 RGB에 합성, iOS 전용 저장 |
| `MainViewStyle-Primary|-ios-selected-background-alpha` | `main.cell.pressed` | 눌림 셀 RGB에 합성, iOS 전용 저장 |
| `SectionTitleStyle-Main|border-alpha` | `main.section.border` | 공식 경계선 값으로 저장·내보내기 |
| `SectionTitleStyle-Main|-ios-text-alpha` | `main.section.foreground` | 섹션 제목 RGB에 합성 |
| `InputBarStyle-Chat|-ios-button-normal-background-alpha` | `chat.input.menu.background` | 메뉴 버튼 RGB에 합성, iOS 전용 저장 |

## Android 키 44개

| 공식 키 | 의미 슬롯 | PhonePreview 연결 |
| --- | --- | --- |
| `theme_header_color` | `main.header.foreground` | 상시: 메인/채팅 헤더 제목·아이콘 |
| `theme_background_color` | `main.background` | 상시: 친구·채팅·더보기 기본 배경 |
| `theme_header_cell_color` | `main.header.background` | 상시: 메인 헤더 배경 |
| `theme_body_secondary_cell_color` | `main.secondary.background` | 상시: 지금 탭 배경 |
| `theme_title_color` | `main.title.normal` | 상시: 목록 제목, 더보기 서비스 아이콘·레이블 |
| `theme_title_pressed_color` | `main.title.pressed` | 눌림: 목록 제목 |
| `theme_description_color` | `main.description.normal` | 상시: 상태 메시지 |
| `theme_description_pressed_color` | `main.description.pressed` | 눌림: 상태 메시지 |
| `theme_paragraph_color` | `main.paragraph.normal` | 상시: 채팅 목록 마지막 메시지 |
| `theme_paragraph_pressed_color` | `main.paragraph.pressed` | 눌림: 채팅 목록 마지막 메시지 |
| `theme_body_cell_color` | `main.cell.normal` | 상시: 목록 셀; AARRGGBB alpha 적용 |
| `theme_body_cell_pressed_color` | `main.cell.pressed` | 눌림: 목록 셀; AARRGGBB alpha 적용 |
| `theme_body_cell_border_color` | `main.cell.border` | Inspector/export 전용: 현재 단순 목록에 정확한 공식 콘텐츠 경계가 없음 |
| `theme_section_title_color` | `main.section.foreground` | 상시: 섹션 제목 |
| `theme_feature_primary_color` | `feature.primary.normal` | Inspector/export 전용: 별도 서비스 버튼 화면을 더보기 그리드로 오인하지 않음 |
| `theme_feature_primary_pressed_color` | `feature.primary.pressed` | Inspector/export 전용: 위 서비스 버튼의 눌림 상태 |
| `theme_feature_browse_tab_color` | `feature.browse.normal` | 상시: 더보기 기본 탭 |
| `theme_feature_browse_tab_focused_color` | `feature.browse.focused` | 상시: 더보기 선택 탭 |
| `theme_maintab_cell_color` | `main.tab.background` | 상시: 하단 탭 배경 이미지가 없을 때의 배경 |
| `theme_tab_lightbannerbadge_background_color` | `main.banner.light` | 상태 전환: Android 지금 탭의 `밝은 배너` |
| `theme_tab_bannerbadge_background_color` | `main.banner.dark` | 상태 전환: Android 지금 탭의 `어두운 배너` |
| `theme_chatroom_background_color` | `chat.background` | 상시: 채팅방 배경 |
| `theme_chatroom_bubble_me_color` | `chat.bubble.me.text` | 상시: 보낸 말풍선 글자 |
| `theme_chatroom_bubble_you_color` | `chat.bubble.you.text` | 상시: 받은 말풍선 글자 |
| `theme_chatroom_unread_count_color` | `chat.unread` | 상시: 안 읽은 숫자 |
| `theme_chatroom_input_bar_color` | `chat.input.text` | 상시: 입력 글자 |
| `theme_chatroom_input_bar_background_color` | `chat.input.background` | 상시: 채팅 입력바 배경 |
| `theme_chatroom_input_bar_menu_icon_color` | `chat.input.menu.icon` | 상시: 메뉴 아이콘 |
| `theme_chatroom_input_bar_menu_button_color` | `chat.input.menu.background` | 상시: 메뉴 버튼 배경; AARRGGBB alpha 적용 |
| `theme_chatroom_input_bar_send_icon_color` | `chat.input.send.icon` | 상시: 보내기 아이콘 |
| `theme_chatroom_input_bar_send_button_color` | `chat.input.send.background` | 상시: 보내기 버튼 배경 |
| `theme_passcode_background_color` | `passcode.background` | 상시: 잠금화면 배경 |
| `theme_passcode_color` | `passcode.foreground` | 상시: 잠금화면 제목·설명 |
| `theme_passcode_keypad_color` | `passcode.keypad.text` | 상시: 숫자 키패드 글자 |
| `theme_passcode_keypad_pressed_color` | `passcode.keypad.text.pressed` | 눌림: 숫자 키패드 글자 |
| `theme_passcode_keypad_background_color` | `passcode.keypad.background` | 상시: 키패드 영역 배경 |
| `theme_passcode_keypad_pressed_background_color` | `passcode.keypad.background.pressed` | 눌림: 키패드 키 배경 |
| `theme_passcode_pattern_line_color` | `passcode.pattern.line` | Inspector/export 전용: 패턴 잠금 화면은 현재 미리보기 대상에서 제외 |
| `theme_notification_color` | `notification.title` | 상태 전환: Android 공식 단일 알림 글자 키가 이름과 본문에 함께 적용 |
| `theme_notification_background_color` | `notification.background` | 상태 전환: 메시지 알림 기본 배경 |
| `theme_notification_background_pressed_color` | `notification.background.pressed` | 상태 전환: `알림 눌림` |
| `theme_direct_share_color` | `direct-share.title` | 상태 전환: 전달 완료 문구 |
| `theme_direct_share_button_color` | `direct-share.button` | 상태 전환: 채팅방 이동 버튼 |
| `theme_direct_share_background_color` | `direct-share.background` | 상태 전환: 전달 완료 배너 배경 |

## PDF 화면별 대조 메모

- iOS 7–15쪽과 Android 7–13쪽의 메인 화면을 대조했다. 더보기 서비스 그리드의 아이콘·레이블은 양쪽 모두 `MainView` 제목 색상이다. `FeatureStyle-Primary`/`theme_feature_primary_color`를 그리드에 재사용하지 않는다.
- iOS 8쪽 및 Android 7쪽의 경계선 표시는 단순 섹션 제목 밑줄이 아니다. 따라서 친구 화면 `h5`나 모든 목록 행에 가짜 선을 상시 추가하지 않는다.
- iOS 16–18쪽과 Android 17–18쪽의 채팅방을 대조했다. iOS는 보냄/받음 안 읽은 숫자와 보냄/받음 선택 글자색이 각각 독립이고, 말풍선을 누를 때 선택 글자색을 표시한다. Android에는 대응하는 말풍선 선택 글자 키가 없다.
- iOS 19쪽과 Android 16쪽의 잠금화면을 대조했다. Android 숫자 키패드 눌림 색은 실제 포인터 눌림으로 표시한다. 패턴 선은 패턴 화면 자체가 없으므로 임의의 선을 그리지 않는다.
- iOS 20쪽과 Android 15쪽의 메시지 알림/전달 완료를 대조했다. iOS 이름·본문은 독립 색상이고 Android 알림 글자는 단일 키다. Android 전용 `채팅방 이동` 버튼을 iOS 전달 배너에 추가하지 않는다.
- iOS 21쪽과 Android 12쪽의 하단 배너를 대조했다. 기본 참조 화면은 그대로 두고, 문서에 나온 화면에서만 상태 전환 버튼으로 배너를 표시한다.

## 의도적으로 PhonePreview에서 제외한 대상

| 대상 | 이유 | 편집/내보내기 |
| --- | --- | --- |
| iOS `main.header.tab.selected` | 26.5 번호 표시에서 독립 렌더 대상이 확인되지 않는 공식 샘플 선언 | 지원 |
| iOS/Android `feature.primary.*` | 공식 별도 서비스 버튼 화면이 현재 단순 미리보기에 없고 더보기 그리드와 의미가 다름 | 지원 |
| iOS `main.section.border`, Android `main.cell.border` | 현재 목록에 공식 문서와 같은 콘텐츠 경계 구조가 없음 | 지원, alpha 포함 |
| Android `passcode.pattern.line` | 앱은 숫자 잠금화면만 미리보기함 | 지원 |

이 제외 항목들은 누락이 아니라 정확한 대상이 없는 패턴 화면이다. Inspector에서는 관련 영역을 선택해 값을 수정할 수 있고, 원본 공식 키 그대로 저장·가져오기·내보내기된다.
