import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultTheme } from '../../domain/theme/defaults';
import {
  ColorHotspot, Editable, ElementHotspot, ProfileHotspot,
} from './PreviewHotspots';

describe('preview editing hotspots', () => {
  it('selects an editable button without bubbling the click', () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    render(<div onClick={onParentClick}><Editable id="header" selected="header" label="위쪽 바" onSelect={onSelect}><span>내용</span></Editable></div>);

    const editable = screen.getByRole('button', { name: '위쪽 바 꾸미기' });
    expect(editable).toHaveProperty('tabIndex', 0);
    expect(editable).toHaveAttribute('data-selected', 'true');
    fireEvent.click(editable);
    expect(onSelect).toHaveBeenCalledWith('header');
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('selects a color hotspot on keyboard activation', () => {
    const onSelect = vi.fn();
    render(<ColorHotspot slotId="main.header.foreground" selected="header" onSelect={onSelect}><span>내용</span></ColorHotspot>);

    const hotspot = screen.getByRole('button', { name: '헤더 제목·아이콘 색상 편집' });
    expect(hotspot).toHaveAttribute('data-selected', 'false');
    fireEvent.keyDown(hotspot, { key: 'Enter' });
    fireEvent.keyDown(hotspot, { key: ' ' });
    expect(onSelect).toHaveBeenNthCalledWith(1, 'color:main.header.foreground');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'color:main.header.foreground');
  });

  it('selects a profile hotspot on keyboard activation', () => {
    const onSelect = vi.fn();
    render(<ProfileHotspot project={createDefaultTheme()} platform="ios" selected="profile" onSelect={onSelect} />);

    const hotspot = screen.getByRole('button', { name: '기본 프로필 꾸미기' });
    expect(hotspot).toHaveAttribute('data-selected', 'true');
    fireEvent.keyDown(hotspot, { key: 'Enter' });
    fireEvent.keyDown(hotspot, { key: ' ' });
    expect(onSelect).toHaveBeenNthCalledWith(1, 'profile');
    expect(onSelect).toHaveBeenNthCalledWith(2, 'profile');
  });

  it('selects an element hotspot without bubbling its click', () => {
    const onSelect = vi.fn();
    const onParentClick = vi.fn();
    render(<div onClick={onParentClick}><ElementHotspot id="inputbar-send" label="보내기 버튼" selected="inputbar-field" onSelect={onSelect}><span>보내기</span></ElementHotspot></div>);

    const hotspot = screen.getByRole('button', { name: '보내기 버튼 꾸미기' });
    fireEvent.click(hotspot);
    expect(onSelect).toHaveBeenCalledWith('inputbar-send');
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
