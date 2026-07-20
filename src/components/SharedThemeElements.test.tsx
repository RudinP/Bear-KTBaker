// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { PNG } from 'pngjs';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../domain/theme/defaults';
import type {
  EditableElementId,
  Platform,
  ScreenId,
  ThemeProject,
} from '../domain/theme/model';
import { KAKAO_COLOR_SLOTS } from '../manifest/kakaoColors';
import { Inspector } from './Inspector';
import { PhonePreview } from './preview/PhonePreview';

function imageFile(
  name: string,
  color: readonly [number, number, number, number],
) {
  const png = new PNG({ width: 1, height: 1 });
  png.data.set(color);
  const bytes = PNG.sync.write(png);
  return {
    file: new File([Uint8Array.from(bytes)], name, { type: 'image/png' }),
    base64: bytes.toString('base64'),
  };
}

const sharedInputSlotIds = [
  'chat.input.text',
  'chat.input.background',
  'chat.input.menu.icon',
  'chat.input.menu.icon.pressed',
  'chat.input.menu.background',
  'chat.input.send.icon',
  'chat.input.send.icon.pressed',
  'chat.input.send.background',
  'chat.input.send.background.pressed',
] as const;

function SharedElementHarness({ platform }: { platform: Platform }) {
  const [project, setProject] = useState<ThemeProject>(() => createDefaultTheme());
  const [activeScreen, setActiveScreen] = useState<ScreenId>('friends');
  const [selected, setSelected] = useState<EditableElementId>('screen-background');

  const show = (next: ScreenId) => {
    setActiveScreen(next);
    setSelected('screen-background');
  };

  return <>
    <button type="button" onClick={() => show('friends')}>친구 화면 보기</button>
    <button type="button" onClick={() => show('chatroom')}>채팅방 화면 보기</button>
    <button type="button" onClick={() => show('notification')}>알림 화면 보기</button>
    <PhonePreview project={project} platform={platform} screen={activeScreen} selected={selected} onSelect={setSelected} />
    <Inspector project={project} platform={platform} screen={activeScreen} selected={selected} onProject={setProject} onNinePatch={vi.fn()} />
  </>;
}

describe('shared theme elements', () => {
  it.each(['ios', 'android'] as const)('reflects %s profile 02 and 03 uploads immediately in their rows on one screen', async (platform) => {
    const { container } = render(<SharedElementHarness platform={platform} />);
    const profile02 = () => container.querySelector<HTMLElement>('.kt-friends-list .kt-list-avatar[data-resource-id="main.profile.02"]');
    const profile03 = () => container.querySelector<HTMLElement>('.kt-friends-list .kt-list-avatar[data-resource-id="main.profile.03"]');

    expect(profile02()).toBeInTheDocument();
    expect(profile03()).toBeInTheDocument();
    const profile01Source = container.querySelector<HTMLImageElement>('.kt-friends-list .kt-list-avatar[data-resource-id="main.profile.01"] img')?.getAttribute('src');
    expect(profile01Source).toBeTruthy();
    expect(profile02()?.querySelector('img')).toHaveAttribute('src', profile01Source);
    expect(profile03()?.querySelector('img')).toHaveAttribute('src', profile01Source);
    fireEvent.click(profile02()!);
    expect(screen.getByText('기본 프로필', { selector: '.inspector-title h2' })).toBeInTheDocument();

    const second = imageFile('second-profile.png', [255, 0, 0, 255]);
    fireEvent.change(screen.getByLabelText('2번 기본 프로필 이미지'), {
      target: { files: [second.file] },
    });
    await waitFor(() => expect(profile02()?.querySelector('img'))
      .toHaveAttribute('src', expect.stringContaining(second.base64)));

    const third = imageFile('third-profile.png', [0, 255, 0, 255]);
    fireEvent.change(screen.getByLabelText('3번 기본 프로필 이미지'), {
      target: { files: [third.file] },
    });
    await waitFor(() => {
      expect(profile02()?.querySelector('img')).toHaveAttribute('src', expect.stringContaining(second.base64));
      expect(profile03()?.querySelector('img')).toHaveAttribute('src', expect.stringContaining(third.base64));
    });
  });

  it.each(['ios', 'android'] as const)('shares one %s main.profile.01 asset between the friends list and chat room in both directions', async (platform) => {
    const { container } = render(<SharedElementHarness platform={platform} />);
    const friendsAvatar = container.querySelector<HTMLElement>('.kt-friends-list .kt-list-avatar');

    expect(friendsAvatar).toHaveAccessibleName('기본 프로필 꾸미기');
    expect(friendsAvatar).toHaveAttribute('data-resource-id', 'main.profile.01');
    fireEvent.click(friendsAvatar!);
    expect(screen.getByText('기본 프로필', { selector: '.inspector-title h2' })).toBeInTheDocument();

    const friends = imageFile('friends-profile.png', [0, 0, 255, 255]);
    fireEvent.change(screen.getByLabelText('1번 기본 프로필 이미지'), {
      target: { files: [friends.file] },
    });
    await waitFor(() => expect(container.querySelector('.kt-friends-list .kt-list-avatar img'))
      .toHaveAttribute('src', expect.stringContaining(friends.base64)));

    fireEvent.click(screen.getByRole('button', { name: '채팅방 화면 보기' }));
    const chatAvatar = container.querySelector<HTMLElement>('.kt-chat-avatar');
    expect(chatAvatar).toHaveAccessibleName('기본 프로필 꾸미기');
    expect(chatAvatar).toHaveAttribute('data-resource-id', 'main.profile.01');
    expect(chatAvatar?.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining(friends.base64),
    );

    fireEvent.click(chatAvatar!);
    const chat = imageFile('chat-profile.png', [255, 255, 0, 255]);
    fireEvent.change(screen.getByLabelText('1번 기본 프로필 이미지'), {
      target: { files: [chat.file] },
    });
    await waitFor(() => expect(container.querySelector('.kt-chat-avatar img'))
      .toHaveAttribute('src', expect.stringContaining(chat.base64)));

    fireEvent.click(screen.getByRole('button', { name: '친구 화면 보기' }));
    expect(container.querySelector('.kt-friends-list .kt-list-avatar img'))
      .toHaveAttribute('src', expect.stringContaining(chat.base64));
  });

  it.each(['ios', 'android'] as const)('lets every shared composer target on the %s notification screen open its Inspector controls', (platform) => {
    render(<SharedElementHarness platform={platform} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 화면 보기' }));

    fireEvent.click(screen.getByRole('textbox', { name: '메시지 입력 미리보기' }));
    expect(screen.getByLabelText('입력바 배경 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('입력바 글자 색상')).toBeInTheDocument();

    fireEvent.click(screen.getAllByLabelText('메뉴 버튼 꾸미기')[0]);
    expect(screen.getByLabelText('입력바 메뉴 배경 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('입력바 메뉴 아이콘 색상')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('보내기 버튼 꾸미기'));
    expect(screen.getByLabelText('보내기 버튼 색상')).toBeInTheDocument();
    expect(screen.getByLabelText('보내기 아이콘 색상')).toBeInTheDocument();
  });

  it.each(['ios', 'android'] as const)('reflects %s send-bar edits immediately from notification to chatroom and back', (platform) => {
    const { container } = render(<SharedElementHarness platform={platform} />);
    fireEvent.click(screen.getByRole('button', { name: '알림 화면 보기' }));
    fireEvent.click(screen.getByLabelText('보내기 버튼 꾸미기'));

    fireEvent.change(screen.getByLabelText('보내기 버튼 색상'), { target: { value: '#123456' } });
    expect(container.querySelector('.kt-chat-send')).toHaveStyle({ backgroundColor: '#123456' });

    fireEvent.click(screen.getByRole('button', { name: '채팅방 화면 보기' }));
    expect(container.querySelector('.kt-chat-send')).toHaveStyle({ backgroundColor: '#123456' });
    fireEvent.click(screen.getByLabelText('보내기 버튼 꾸미기'));
    fireEvent.change(screen.getByLabelText('보내기 버튼 색상'), { target: { value: '#654321' } });
    expect(container.querySelector('.kt-chat-send')).toHaveStyle({ backgroundColor: '#654321' });

    fireEvent.click(screen.getByRole('button', { name: '알림 화면 보기' }));
    expect(container.querySelector('.kt-chat-send')).toHaveStyle({ backgroundColor: '#654321' });
  });

  it('maps every composer color to both screens instead of keeping screen-specific copies', () => {
    for (const id of sharedInputSlotIds) {
      const slot = KAKAO_COLOR_SLOTS.find((candidate) => candidate.id === id);
      expect(slot?.screens, id).toEqual(expect.arrayContaining(['chatroom', 'notification']));
    }
  });
});
