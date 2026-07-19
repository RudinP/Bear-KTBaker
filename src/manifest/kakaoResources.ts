export type ResourceRenderMode = 'contain' | 'cover' | 'top-center-crop' | 'top-center-cover' | 'center-crop' | 'stretch';

interface ResourceRenderRule {
  mode: ResourceRenderMode;
  iosStretchPoint?: readonly [number, number];
  iosContentInsets?: readonly [number, number, number, number];
  minimumDp?: number;
}

export interface PlatformResourceBinding {
  files: string[];
  css?: { block: string; property: string };
  colorResource?: string;
  ninePatch?: boolean;
  outputSize?: readonly [number, number];
  sampleIncluded?: boolean;
  samplePixelSize?: readonly [number, number];
  sampleContentSize?: readonly [number, number];
  sampleLogicalSize?: readonly [number, number];
}

export interface KakaoResourceSlot {
  id: string;
  label: string;
  screen: 'common' | 'main' | 'chatroom' | 'passcode' | 'splash';
  render: ResourceRenderRule;
  ios?: PlatformResourceBinding;
  android?: PlatformResourceBinding;
}

const iosFiles = (base: string, scales: readonly number[]) => scales.map((scale) => `Images/${base}${scale === 1 ? '' : `@${scale}x`}.png`);
const androidFiles = (name: string, directories: readonly string[]) => directories.map((directory) => `src/main/theme/${directory}/${name}.png`);
const xxhdpi = ['drawable-xxhdpi'] as const;
const phoneAndTablet = ['drawable-xxhdpi', 'drawable-sw600dp'] as const;

const slots: KakaoResourceSlot[] = [
  {
    id: 'common.theme-icon', label: '테마 목록 아이콘', screen: 'common', render: { mode: 'contain' },
    ios: { files: iosFiles('commonIcoTheme', [1]) },
    android: { files: [
      'src/main/ic_launcher-web.png',
      ...['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'].flatMap((density) => [
      `src/main/res/mipmap-${density}/ic_launcher.png`,
      `src/main/res/mipmap-${density}/ic_launcher_round.png`,
      ]),
    ] },
  },
  {
    id: 'common.app-icon.foreground', label: 'Android 적응형 아이콘 전경', screen: 'common', render: { mode: 'contain' },
    android: { files: ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
      .map((density) => `src/main/res/mipmap-${density}/ic_launcher_foreground.png`) },
  },
  {
    id: 'common.app-icon.background', label: 'Android 적응형 아이콘 배경', screen: 'common', render: { mode: 'cover' },
    android: { files: ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
      .map((density) => `src/main/res/mipmap-${density}/ic_launcher_background.png`) },
  },
  {
    id: 'main.background', label: '메인 배경', screen: 'main', render: { mode: 'top-center-crop' },
    ios: { files: iosFiles('mainBgImage', [3]), samplePixelSize: [1125, 2250], sampleLogicalSize: [375, 750], css: { block: 'MainViewStyle-Primary', property: '-ios-background-image' } },
    android: { files: androidFiles('theme_background_image', phoneAndTablet), samplePixelSize: [1440, 2880], sampleLogicalSize: [480, 960], colorResource: 'theme_background_color' },
  },
  {
    id: 'main.tab.background', label: '하단 탭 배경', screen: 'main', render: { mode: 'center-crop' },
    ios: { files: iosFiles('maintabBgImage', [2, 3]), samplePixelSize: [1410, 147], sampleContentSize: [1410, 147], sampleLogicalSize: [470, 49], css: { block: 'TabBarStyle-Main', property: '-ios-background-image' } },
    android: { files: androidFiles('theme_maintab_cell_image.9', phoneAndTablet), samplePixelSize: [1442, 214], sampleContentSize: [1440, 212], sampleLogicalSize: [360, 53], colorResource: 'theme_maintab_cell_color', ninePatch: true },
  },
  {
    id: 'main.add-friend.normal', label: '친구 추가 버튼', screen: 'main', render: { mode: 'contain' },
    ios: { files: iosFiles('findBtnAddFriend', [2, 3]), css: { block: 'ButtonStyle-AddFriend', property: '-ios-image' } },
    android: { files: androidFiles('theme_find_add_friend_button_image', xxhdpi) },
  },
  {
    id: 'main.add-friend.pressed', label: '친구 추가 버튼 눌림', screen: 'main', render: { mode: 'contain' },
    android: { files: androidFiles('theme_find_add_friend_button_pressed_image', xxhdpi) },
  },
  {
    id: 'chat.background', label: '채팅방 배경', screen: 'chatroom', render: { mode: 'top-center-crop' },
    ios: { files: iosFiles('chatroomBgImage', [3]), samplePixelSize: [1125, 2250], sampleLogicalSize: [375, 750], css: { block: 'BackgroundStyle-ChatRoom', property: '-ios-background-image' } },
    android: { files: androidFiles('theme_chatroom_background_image', phoneAndTablet), samplePixelSize: [1440, 2880], sampleLogicalSize: [480, 960], colorResource: 'theme_chatroom_background_color' },
  },
  {
    id: 'passcode.background', label: '잠금화면 배경', screen: 'passcode', render: { mode: 'center-crop' },
    ios: { files: iosFiles('passcodeBgImage', [3]), samplePixelSize: [1200, 1200], sampleLogicalSize: [400, 400], css: { block: 'BackgroundStyle-Passcode', property: '-ios-background-image' } },
    android: { files: androidFiles('theme_passcode_background_image', phoneAndTablet), samplePixelSize: [1440, 1440], sampleLogicalSize: [480, 480], colorResource: 'theme_passcode_background_color' },
  },
  {
    id: 'passcode.keypad.pressed', label: '키패드 눌림', screen: 'passcode', render: { mode: 'contain' },
    ios: { files: iosFiles('passcodeKeypadPressed', [3]), css: { block: 'PasscodeStyle', property: '-ios-keypad-number-highlighted-image' } },
    android: { files: [], colorResource: 'theme_passcode_keypad_pressed_background_color' },
  },
];

for (let index = 1; index <= 3; index += 1) {
  const number = String(index).padStart(2, '0');
  slots.push({
    id: `main.profile.${number}`,
    label: `${index}번 기본 프로필`,
    screen: 'main',
    render: { mode: 'cover' },
    ios: index === 1
      ? { files: iosFiles('profileImg01', [3]), samplePixelSize: [360, 360], sampleLogicalSize: [120, 120], css: { block: 'DefaultProfileStyle', property: '-ios-profile-images' } }
      : { files: iosFiles(`profileImg0${index}`, [3]), outputSize: [120, 120], sampleIncluded: false, css: { block: 'DefaultProfileStyle', property: '-ios-profile-images' } },
    android: {
      files: androidFiles(`theme_profile_${number}_image`, xxhdpi),
      outputSize: [220, 220],
      sampleIncluded: index === 1,
      ...(index === 1 ? { samplePixelSize: [240, 240] as const, sampleLogicalSize: [80, 80] as const } : {}),
    },
  });
  slots.push({
    id: `main.profile.${number}.full`,
    label: `${index}번 프로필 상세`,
    screen: 'main',
    render: { mode: 'cover' },
    android: {
      files: androidFiles(`theme_profile_${number}_image_full`, ['drawable-nodpi']),
      outputSize: [320, 320],
      sampleIncluded: false,
    },
  });
}

const tabDefinitions = [
  ['friends', 'Friends', 'friends', true], ['chats', 'Chats', 'chats', true], ['now', 'Now', 'now', true],
  ['shopping', 'Shopping', 'shopping', true], ['more', 'More', 'more', true], ['piccoma', 'Piccoma', 'piccoma', false], ['call', 'Call', 'call', true],
] as const;

for (const [id, iosName, androidName, iosSampleHasFiles] of tabDefinitions) {
  for (const selected of [false, true]) {
    const state = selected ? 'selected' : 'normal';
    slots.push({
      id: `main.tab.${id}.${state}`,
      label: `${id} 탭 ${selected ? '선택' : '기본'}`,
      screen: 'main',
      render: { mode: 'contain', minimumDp: 56 },
      ios: {
        files: iosFiles(`maintabIco${iosName}${selected ? 'Selected' : ''}`, [2, 3]),
        ...(iosSampleHasFiles ? { samplePixelSize: [114, 114] as const, sampleLogicalSize: [38, 38] as const } : {}),
        outputSize: iosSampleHasFiles ? undefined : [38, 38],
        sampleIncluded: iosSampleHasFiles,
        css: { block: 'TabBarStyle-Main', property: `-ios-${id === 'now' ? 'now' : id}-${selected ? 'selected' : 'normal'}-icon-image` },
      },
      android: { files: androidFiles(`theme_maintab_ico_${androidName}${selected ? '_focused' : ''}_image`, phoneAndTablet), ...(iosSampleHasFiles ? { samplePixelSize: [114, 114] as const, sampleLogicalSize: [38, 38] as const } : {}) },
    });
  }
}

const bubbleDefinitions = [
  ['me', 'Send', 'me', 17, 17, [10, 11, 7, 17]],
  ['you', 'Receive', 'you', 22, 17, [10, 17, 7, 11]],
] as const;

for (const [side, iosDirection, androidDirection, stretchX, stretchY, insets] of bubbleDefinitions) {
  for (const grouped of [false, true]) {
    for (const pressed of [false, true]) {
      const sequence = grouped ? 'grouped' : 'first';
      const state = pressed ? 'pressed' : 'normal';
      const number = grouped ? '02' : '01';
      const prefix = grouped ? '-ios-group' : '-ios';
      slots.push({
        id: `chat.bubble.${side}.${sequence}.${state}`,
        label: `${side === 'me' ? '보낸' : '받은'} ${grouped ? '연속' : '첫'} 말풍선${pressed ? ' 눌림' : ''}`,
        screen: 'chatroom',
        render: { mode: 'stretch', iosStretchPoint: [stretchX, stretchY], iosContentInsets: insets },
        ios: {
          files: iosFiles(`chatroomBubble${iosDirection}${number}${pressed ? 'Selected' : ''}`, [2, 3]),
          samplePixelSize: side === 'you' && pressed ? [121, 105] : [120, 105],
          sampleContentSize: side === 'you' && pressed ? [121, 105] : [120, 105],
          sampleLogicalSize: side === 'you' && pressed ? [121 / 3, 35] : [40, 35],
          css: { block: `MessageCellStyle-${iosDirection}`, property: `${prefix}${pressed ? '-selected' : ''}-background-image` },
        },
        android: pressed ? undefined : {
          files: androidFiles(`theme_chatroom_bubble_${androidDirection}_${number}_image.9`, xxhdpi),
          samplePixelSize: [124, 114], sampleContentSize: [122, 112], sampleLogicalSize: [122 / 3, 112 / 3],
          ninePatch: true,
        },
      });
    }
  }
}

const bulletOrdinals = ['first', 'second', 'third', 'fourth'] as const;
for (let index = 1; index <= 4; index += 1) {
  for (const selected of [false, true]) {
    const state = selected ? 'selected' : 'normal';
    slots.push({
      id: `passcode.bullet.${index}.${state}`,
      label: `잠금 불릿 ${index} ${selected ? '선택' : '기본'}`,
      screen: 'passcode', render: { mode: 'contain' },
      ios: {
        files: iosFiles(`passcodeImgCode0${index}${selected ? 'Selected' : ''}`, [3]),
        samplePixelSize: [132, 132], sampleLogicalSize: [44, 44],
        css: { block: 'PasscodeStyle', property: `-ios-bullet-${selected ? 'selected-' : ''}${bulletOrdinals[index - 1]}-image` },
      },
      android: { files: androidFiles(`theme_passcode_0${index}${selected ? '_checked' : ''}_image`, xxhdpi), samplePixelSize: [132, 132], sampleLogicalSize: [44, 44] },
    });
  }
}

slots.push({
  id: 'splash.image', label: '시작 이미지', screen: 'splash', render: { mode: 'center-crop' },
  android: {
    files: androidFiles('theme_splash_image', [
      'drawable-xhdpi', 'drawable-xxhdpi', 'drawable-land-xhdpi', 'drawable-land-xxhdpi',
      'drawable-sw600dp', 'drawable-sw600dp-land',
    ]),
  },
});

export const KAKAO_RESOURCE_SLOTS: readonly KakaoResourceSlot[] = slots;

export function getResourceSlot(id: string): KakaoResourceSlot {
  const slot = KAKAO_RESOURCE_SLOTS.find((candidate) => candidate.id === id);
  if (!slot) throw new Error(`알 수 없는 카카오톡 테마 리소스: ${id}`);
  return slot;
}
