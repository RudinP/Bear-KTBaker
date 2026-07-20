// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('forwards document, history, and file commands without owning state', () => {
    const onNameChange = vi.fn();
    const onUndo = vi.fn();
    const onRedo = vi.fn();
    const onOpen = vi.fn();
    const onSave = vi.fn();
    const onFinish = vi.fn();

    render(
      <AppHeader
        documentName="복숭아"
        isMac
        canUndo
        canRedo={false}
        onNameChange={onNameChange}
        onUndo={onUndo}
        onRedo={onRedo}
        onOpen={onOpen}
        onSave={onSave}
        onFinish={onFinish}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', {
      name: '상단 테마 이름',
    }), { target: { value: '자두' } });
    fireEvent.click(screen.getByRole('button', { name: '실행 취소' }));
    fireEvent.click(screen.getByRole('button', { name: '불러오기' }));
    fireEvent.click(screen.getByRole('button', { name: '프로젝트 저장' }));
    fireEvent.click(screen.getByRole('button', { name: '테마 완성하기' }));

    expect(onNameChange).toHaveBeenCalledWith('자두');
    expect(onUndo).toHaveBeenCalledOnce();
    expect(screen.getByRole('button', { name: '다시 실행' })).toBeDisabled();
    expect(onRedo).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenCalledOnce();
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
