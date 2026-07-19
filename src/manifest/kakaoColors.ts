type KakaoColorTarget =
  | 'screen-background' | 'header' | 'tabbar' | 'bubble-me' | 'bubble-you'
  | 'inputbar' | 'inputbar-field' | 'inputbar-menu' | 'inputbar-send'
  | 'passcode-keypad' | 'notification' | 'direct-share' | 'content';

export interface KakaoColorSlot {
  id: string;
  label: string;
  screens: string[];
  targets: KakaoColorTarget[];
  ios: string[];
  iosAlpha?: string;
  android: string[];
}

export const ANDROID_SAMPLE_COLORS: Record<string, string> = {
  theme_header_color: '#664242',
  theme_section_title_color: '#F66C6C',
  theme_title_color: '#664242',
  theme_title_pressed_color: '#B06B6B',
  theme_paragraph_color: '#805959',
  theme_paragraph_pressed_color: '#B06B6B',
  theme_description_color: '#805959',
  theme_description_pressed_color: '#B06B6B',
  theme_feature_primary_color: '#805959',
  theme_feature_primary_pressed_color: '#B06B6B',
  theme_feature_browse_tab_color: '#D49B9B',
  theme_feature_browse_tab_focused_color: '#664242',
  theme_background_color: '#FFDEDE',
  theme_chatroom_background_color: '#FFDEDE',
  theme_passcode_background_color: '#FCC5C5',
  theme_header_cell_color: '#FFDEDE',
  theme_body_cell_color: '#00FFDEDE',
  theme_body_cell_pressed_color: '#FFB3B3',
  theme_body_cell_border_color: '#26664242',
  theme_body_secondary_cell_color: '#FFDEDE',
  theme_maintab_cell_color: '#00FFFFFF',
  theme_tab_lightbannerbadge_background_color: '#664242',
  theme_tab_bannerbadge_background_color: '#664142',
  theme_direct_share_color: '#664242',
  theme_direct_share_button_color: '#E87D7D',
  theme_direct_share_background_color: '#FFF2F2',
  theme_notification_color: '#664242',
  theme_notification_background_color: '#FFD4D4',
  theme_notification_background_pressed_color: '#FFB3B3',
  theme_passcode_color: '#664242',
  theme_passcode_keypad_color: '#664242',
  theme_passcode_keypad_pressed_color: '#CCB8B8',
  theme_passcode_keypad_background_color: '#FFF2F2',
  theme_passcode_keypad_pressed_background_color: '#99FFDEDE',
  theme_passcode_pattern_line_color: '#FCC5C5',
  theme_chatroom_bubble_me_color: '#FFFFFF',
  theme_chatroom_bubble_you_color: '#4D4D4D',
  theme_chatroom_unread_count_color: '#FF7F7F',
  theme_chatroom_input_bar_color: '#191919',
  theme_chatroom_input_bar_background_color: '#FFFFFF',
  theme_chatroom_input_bar_menu_icon_color: '#E86464',
  theme_chatroom_input_bar_menu_button_color: '#0A000000',
  theme_chatroom_input_bar_send_icon_color: '#FFFFFF',
  theme_chatroom_input_bar_send_button_color: '#FF7F7F',
};

export const IOS_SAMPLE_COLORS: Record<string, string> = {
  'HeaderStyle-Main|-ios-text-color': '#664242',
  'HeaderStyle-Main|-ios-tab-text-color': '#B39898',
  'HeaderStyle-Main|-ios-tab-highlighted-text-color': '#664242',
  'MainViewStyle-Primary|background-color': '#FFDEDE',
  'MainViewStyle-Primary|-ios-text-color': '#664242',
  'MainViewStyle-Primary|-ios-highlighted-text-color': '#946C6C',
  'MainViewStyle-Primary|-ios-description-text-color': '#805959',
  'MainViewStyle-Primary|-ios-description-highlighted-text-color': '#946C6C',
  'MainViewStyle-Primary|-ios-paragraph-text-color': '#805959',
  'MainViewStyle-Primary|-ios-paragraph-highlighted-text-color': '#946C6C',
  'MainViewStyle-Primary|-ios-normal-background-color': '#F66C6C',
  'MainViewStyle-Primary|-ios-selected-background-color': '#664242',
  'MainViewStyle-Secondary|background-color': '#FFDEDE',
  'SectionTitleStyle-Main|border-color': '#F66C6C',
  'SectionTitleStyle-Main|-ios-text-color': '#F66C6C',
  'FeatureStyle-Primary|-ios-text-color': '#805959',
  'BackgroundStyle-ChatRoom|background-color': '#FFDEDE',
  'InputBarStyle-Chat|background-color': '#FFFFFF',
  'InputBarStyle-Chat|-ios-send-normal-background-color': '#FF7F7F',
  'InputBarStyle-Chat|-ios-send-normal-foreground-color': '#FFFFFF',
  'InputBarStyle-Chat|-ios-send-highlighted-background-color': '#F27979',
  'InputBarStyle-Chat|-ios-send-highlighted-foreground-color': '#FFDEDE',
  'InputBarStyle-Chat|-ios-button-normal-foreground-color': '#E86464',
  'InputBarStyle-Chat|-ios-button-highlighted-foreground-color': '#CB6F6F',
  'InputBarStyle-Chat|-ios-button-text-color': '#191919',
  'InputBarStyle-Chat|-ios-button-normal-background-color': '#000000',
  'MessageCellStyle-Send|-ios-text-color': '#FFFFFF',
  'MessageCellStyle-Send|-ios-selected-text-color': '#FFFFFF',
  'MessageCellStyle-Send|-ios-unread-text-color': '#FF7F7F',
  'MessageCellStyle-Receive|-ios-text-color': '#4D4D4D',
  'MessageCellStyle-Receive|-ios-selected-text-color': '#4D4D4D',
  'MessageCellStyle-Receive|-ios-unread-text-color': '#FF7F7F',
  'BackgroundStyle-Passcode|background-color': '#FFDEDE',
  'LabelStyle-PasscodeTitle|-ios-text-color': '#664242',
  'PasscodeStyle|-ios-keypad-background-color': '#FFF2F2',
  'PasscodeStyle|-ios-keypad-text-normal-color': '#664242',
  'BackgroundStyle-MessageNotificationBar|background-color': '#FCC5C5',
  'LabelStyle-MessageNotificationBarName|-ios-text-color': '#604242',
  'LabelStyle-MessageNotificationBarMessage|-ios-text-color': '#805959',
  'BackgroundStyle-DirectShareBar|background-color': '#FFFFFF',
  'LabelStyle-DirectShareBarName|-ios-text-color': '#B35959',
  'LabelStyle-DirectShareBarMessage|-ios-text-color': '#D47B82',
  'BottomBannerStyle|background-color': '#664142',
  'BottomBannerStyle-Light|background-color': '#664242',
};

export const IOS_SAMPLE_ALPHAS: Record<string, string> = {
  'MainViewStyle-Primary|-ios-normal-background-alpha': '0.0',
  'MainViewStyle-Primary|-ios-selected-background-alpha': '0.05',
  'SectionTitleStyle-Main|border-alpha': '0.09',
  'SectionTitleStyle-Main|-ios-text-alpha': '1.0',
  'InputBarStyle-Chat|-ios-button-normal-background-alpha': '0.04',
};

// The 26.5 guide documents these declarations, but the bundled official sample is 25.8
// and therefore does not contain them yet. They must still be writable by a new theme.
export const IOS_GUIDE_ONLY_COLORS: Record<string, string> = {
  'TabBarStyle-Main|background-color': '#FFFFFF',
  'MainViewStyle-Secondary|-ios-text-color': '#664242',
  'SectionTitleStyle-Main|-ios-description-text-color': '#F66C6C',
};

export const IOS_DEFAULT_COLORS: Record<string, string> = {
  ...IOS_SAMPLE_COLORS,
  ...IOS_GUIDE_ONLY_COLORS,
};

const slot = (
  id: string, label: string, screens: string[], targets: KakaoColorTarget[],
  ios: string[] = [], android: string[] = [], iosAlpha?: string,
): KakaoColorSlot => ({ id, label, screens, targets, ios, android, iosAlpha });

export const KAKAO_COLOR_SLOTS: KakaoColorSlot[] = [
  slot('main.header.foreground', '헤더 제목·아이콘', ['friends', 'chats', 'now', 'more', 'chatroom', 'notification'], ['header'], ['HeaderStyle-Main|-ios-text-color'], ['theme_header_color']),
  slot('main.header.tab.normal', '상단 탭 기본', ['friends', 'chats', 'now', 'more'], ['header'], ['HeaderStyle-Main|-ios-tab-text-color']),
  slot('main.header.tab.selected', '상단 탭 선택', ['friends', 'chats', 'now', 'more'], ['header'], ['HeaderStyle-Main|-ios-tab-highlighted-text-color']),
  slot('main.background', '메인 배경', ['friends', 'chats', 'more'], ['screen-background'], ['MainViewStyle-Primary|background-color'], ['theme_background_color']),
  slot('main.header.background', '헤더 배경', ['friends', 'chats', 'now', 'more'], ['screen-background', 'header'], [], ['theme_header_cell_color']),
  slot('main.secondary.background', '보조 콘텐츠 배경', ['now'], ['screen-background', 'content'], ['MainViewStyle-Secondary|background-color'], ['theme_body_secondary_cell_color']),
  slot('main.secondary.foreground', '보조 콘텐츠 글자', ['now', 'more'], ['content'], ['MainViewStyle-Secondary|-ios-text-color']),
  slot('main.title.normal', '목록 제목', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-text-color'], ['theme_title_color']),
  slot('main.title.pressed', '목록 제목 누름', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-highlighted-text-color'], ['theme_title_pressed_color']),
  slot('main.description.normal', '상태 메시지', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-description-text-color'], ['theme_description_color']),
  slot('main.description.pressed', '상태 메시지 누름', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-description-highlighted-text-color'], ['theme_description_pressed_color']),
  slot('main.paragraph.normal', '마지막 메시지', ['chats', 'now'], ['content'], ['MainViewStyle-Primary|-ios-paragraph-text-color'], ['theme_paragraph_color']),
  slot('main.paragraph.pressed', '마지막 메시지 누름', ['chats', 'now'], ['content'], ['MainViewStyle-Primary|-ios-paragraph-highlighted-text-color'], ['theme_paragraph_pressed_color']),
  slot('main.cell.normal', '목록 셀', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-normal-background-color'], ['theme_body_cell_color'], 'MainViewStyle-Primary|-ios-normal-background-alpha'),
  slot('main.cell.pressed', '목록 셀 누름', ['friends', 'chats', 'now', 'more'], ['content'], ['MainViewStyle-Primary|-ios-selected-background-color'], ['theme_body_cell_pressed_color'], 'MainViewStyle-Primary|-ios-selected-background-alpha'),
  slot('main.cell.border', '목록 구분선', ['friends', 'chats', 'now', 'more'], ['content'], [], ['theme_body_cell_border_color']),
  slot('main.section.foreground', '섹션 제목', ['friends', 'chats', 'now', 'more'], ['content'], ['SectionTitleStyle-Main|-ios-text-color', 'SectionTitleStyle-Main|-ios-description-text-color'], ['theme_section_title_color'], 'SectionTitleStyle-Main|-ios-text-alpha'),
  slot('main.section.border', '섹션 제목 선', ['friends', 'chats', 'now', 'more'], ['content'], ['SectionTitleStyle-Main|border-color'], [], 'SectionTitleStyle-Main|border-alpha'),
  slot('feature.primary.normal', '서비스 버튼', ['friends', 'more'], ['content'], ['FeatureStyle-Primary|-ios-text-color'], ['theme_feature_primary_color']),
  slot('feature.primary.pressed', '서비스 버튼 누름', ['friends', 'more'], ['content'], [], ['theme_feature_primary_pressed_color']),
  slot('feature.browse.normal', '더보기 탭 기본', ['more'], ['content'], [], ['theme_feature_browse_tab_color']),
  slot('feature.browse.focused', '더보기 탭 선택', ['more'], ['content'], [], ['theme_feature_browse_tab_focused_color']),
  slot('main.tab.background', '하단 탭 배경', ['friends', 'chats', 'now', 'more'], ['tabbar'], ['TabBarStyle-Main|background-color'], ['theme_maintab_cell_color']),
  slot('main.banner', '탭 배너 배경', ['friends', 'chats', 'now', 'more'], ['tabbar'], ['BottomBannerStyle|background-color'], ['theme_tab_bannerbadge_background_color']),
  // The bundled 25.8 samples still contain these retired light-banner keys. Keep
  // them round-trippable, but do not expose them as a 26.5 editor state.
  slot('legacy.main.banner.light', '이전 밝은 탭 배너', [], [], ['BottomBannerStyle-Light|background-color'], ['theme_tab_lightbannerbadge_background_color']),
  slot('chat.background', '채팅방 배경', ['chatroom', 'notification'], ['screen-background'], ['BackgroundStyle-ChatRoom|background-color'], ['theme_chatroom_background_color']),
  slot('chat.bubble.me.text', '보낸 말풍선 글자', ['chatroom', 'notification'], ['bubble-me'], ['MessageCellStyle-Send|-ios-text-color'], ['theme_chatroom_bubble_me_color']),
  slot('chat.bubble.me.text.pressed', '보낸 말풍선 글자 누름', ['chatroom', 'notification'], ['bubble-me'], ['MessageCellStyle-Send|-ios-selected-text-color']),
  slot('chat.bubble.you.text', '받은 말풍선 글자', ['chatroom', 'notification'], ['bubble-you'], ['MessageCellStyle-Receive|-ios-text-color'], ['theme_chatroom_bubble_you_color']),
  slot('chat.bubble.you.text.pressed', '받은 말풍선 글자 누름', ['chatroom', 'notification'], ['bubble-you'], ['MessageCellStyle-Receive|-ios-selected-text-color']),
  slot('chat.unread', '보낸 안 읽은 숫자', ['chatroom', 'notification'], ['bubble-me'], ['MessageCellStyle-Send|-ios-unread-text-color'], ['theme_chatroom_unread_count_color']),
  slot('chat.unread.received', '받은 안 읽은 숫자', ['chatroom', 'notification'], ['bubble-you'], ['MessageCellStyle-Receive|-ios-unread-text-color']),
  slot('chat.input.text', '입력바 글자', ['chatroom', 'notification'], ['inputbar', 'inputbar-field'], ['InputBarStyle-Chat|-ios-button-text-color'], ['theme_chatroom_input_bar_color']),
  slot('chat.input.background', '입력바 배경', ['chatroom', 'notification'], ['inputbar', 'inputbar-field'], ['InputBarStyle-Chat|background-color'], ['theme_chatroom_input_bar_background_color']),
  slot('chat.input.menu.icon', '입력바 메뉴 아이콘', ['chatroom', 'notification'], ['inputbar', 'inputbar-menu'], ['InputBarStyle-Chat|-ios-button-normal-foreground-color'], ['theme_chatroom_input_bar_menu_icon_color']),
  slot('chat.input.menu.icon.pressed', '입력바 메뉴 아이콘 누름', ['chatroom', 'notification'], ['inputbar', 'inputbar-menu'], ['InputBarStyle-Chat|-ios-button-highlighted-foreground-color']),
  slot('chat.input.menu.background', '입력바 메뉴 배경', ['chatroom', 'notification'], ['inputbar', 'inputbar-menu'], ['InputBarStyle-Chat|-ios-button-normal-background-color'], ['theme_chatroom_input_bar_menu_button_color'], 'InputBarStyle-Chat|-ios-button-normal-background-alpha'),
  slot('chat.input.send.icon', '보내기 아이콘', ['chatroom', 'notification'], ['inputbar', 'inputbar-send'], ['InputBarStyle-Chat|-ios-send-normal-foreground-color'], ['theme_chatroom_input_bar_send_icon_color']),
  slot('chat.input.send.icon.pressed', '보내기 아이콘 누름', ['chatroom', 'notification'], ['inputbar', 'inputbar-send'], ['InputBarStyle-Chat|-ios-send-highlighted-foreground-color']),
  slot('chat.input.send.background', '보내기 버튼', ['chatroom', 'notification'], ['inputbar', 'inputbar-send'], ['InputBarStyle-Chat|-ios-send-normal-background-color'], ['theme_chatroom_input_bar_send_button_color']),
  slot('chat.input.send.background.pressed', '보내기 버튼 누름', ['chatroom', 'notification'], ['inputbar', 'inputbar-send'], ['InputBarStyle-Chat|-ios-send-highlighted-background-color']),
  slot('passcode.background', '잠금화면 배경', ['passcode'], ['screen-background'], ['BackgroundStyle-Passcode|background-color'], ['theme_passcode_background_color']),
  slot('passcode.foreground', '잠금화면 제목', ['passcode'], ['passcode-keypad'], ['LabelStyle-PasscodeTitle|-ios-text-color'], ['theme_passcode_color']),
  slot('passcode.keypad.text', '키패드 숫자', ['passcode'], ['passcode-keypad'], ['PasscodeStyle|-ios-keypad-text-normal-color'], ['theme_passcode_keypad_color']),
  slot('passcode.keypad.text.pressed', '키패드 숫자 누름', ['passcode'], ['passcode-keypad'], [], ['theme_passcode_keypad_pressed_color']),
  slot('passcode.keypad.background', '키패드 배경', ['passcode'], ['passcode-keypad'], ['PasscodeStyle|-ios-keypad-background-color'], ['theme_passcode_keypad_background_color']),
  slot('passcode.keypad.background.pressed', '키패드 배경 누름', ['passcode'], ['passcode-keypad'], [], ['theme_passcode_keypad_pressed_background_color']),
  slot('passcode.pattern.line', '잠금 패턴 선', ['passcode'], ['passcode-keypad'], [], ['theme_passcode_pattern_line_color']),
  slot('notification.background', '알림 배경', ['notification'], ['notification'], ['BackgroundStyle-MessageNotificationBar|background-color'], ['theme_notification_background_color']),
  slot('notification.background.pressed', '알림 배경 누름', ['notification'], ['notification'], [], ['theme_notification_background_pressed_color']),
  slot('notification.title', '알림 제목', ['notification'], ['notification'], ['LabelStyle-MessageNotificationBarName|-ios-text-color'], ['theme_notification_color']),
  slot('notification.message', '알림 메시지', ['notification'], ['notification'], ['LabelStyle-MessageNotificationBarMessage|-ios-text-color']),
  slot('direct-share.background', '전달 배너 배경', ['notification', 'direct-share'], ['direct-share'], ['BackgroundStyle-DirectShareBar|background-color'], ['theme_direct_share_background_color']),
  slot('direct-share.title', '전달 배너 제목', ['notification', 'direct-share'], ['direct-share'], ['LabelStyle-DirectShareBarName|-ios-text-color'], ['theme_direct_share_color']),
  slot('direct-share.message', '전달 배너 메시지', ['notification', 'direct-share'], ['direct-share'], ['LabelStyle-DirectShareBarMessage|-ios-text-color']),
  slot('direct-share.button', '전달 배너 버튼', ['notification', 'direct-share'], ['direct-share'], [], ['theme_direct_share_button_color']),
];

export function getColorSlot(id: string) {
  const result = KAKAO_COLOR_SLOTS.find((entry) => entry.id === id);
  if (!result) throw new Error(`알 수 없는 카카오 색상 슬롯: ${id}`);
  return result;
}
