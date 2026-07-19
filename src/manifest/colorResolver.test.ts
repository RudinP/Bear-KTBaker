import { describe, expect, it } from 'vitest';
import { createDefaultTheme } from '../domain/theme/defaults';
import { colorAlpha, colorValue, cssColor, setColorSlot, setColorSlotAlpha } from './colorResolver';

describe('semantic Kakao color slots', () => {
  it('updates corresponding iOS and Android official keys together without legacy overrides', () => {
    const original = createDefaultTheme();
    const project = setColorSlot(original, 'ios', 'main.header.foreground', '#123456');

    expect(project.colorValues.ios['HeaderStyle-Main|-ios-text-color']).toBe('#123456');
    expect(project.colorValues.android.theme_header_color).toBe('#123456');
    expect(project.colors.header).toBe(original.colors.header);
    expect(colorValue(project, 'android', 'main.header.foreground')).toBe('#123456');
  });

  it('keeps an OS-only key on that OS when there is no corresponding mapping', () => {
    const original = createDefaultTheme();
    const project = setColorSlot(original, 'ios', 'main.header.tab.normal', '#123456');

    expect(project.colorValues.ios['HeaderStyle-Main|-ios-tab-text-color']).toBe('#123456');
    expect(project.colorValues.android).toEqual(original.colorValues.android);
  });

  it('converts Android AARRGGBB colors to CSS RRGGBBAA', () => {
    expect(cssColor('#0A000000')).toBe('#0000000A');
  });

  it('preserves the Android AARRGGBB alpha while synchronizing a corresponding RGB edit', () => {
    const original = createDefaultTheme();
    const project = setColorSlot(original, 'ios', 'chat.input.menu.background', '#123456');

    expect(project.colorValues.ios['InputBarStyle-Chat|-ios-button-normal-background-color']).toBe('#123456');
    expect(project.colorValues.android.theme_chatroom_input_bar_menu_button_color).toBe('#0A123456');
    expect(colorAlpha(project, 'android', 'chat.input.menu.background')).toBeCloseTo(10 / 255, 5);
  });

  it('edits Android alpha without overwriting the corresponding iOS alpha declaration', () => {
    const original = createDefaultTheme();
    const project = setColorSlotAlpha(original, 'android', 'chat.input.menu.background', 0.5);

    expect(project.colorValues.android.theme_chatroom_input_bar_menu_button_color).toBe('#80000000');
    expect(project.colorValues.ios['InputBarStyle-Chat|-ios-button-normal-background-alpha']).toBe('0.04');
  });

  it('composes the separate iOS CSS alpha property without making sample cells opaque', () => {
    const project = createDefaultTheme();
    expect(colorValue(project, 'ios', 'main.cell.normal')).toBe('#00F66C6C');
    expect(cssColor(colorValue(project, 'ios', 'main.cell.normal'))).toBe('#F66C6C00');
    const changed = setColorSlotAlpha(project, 'ios', 'main.cell.normal', 0.25);
    expect(colorAlpha(changed, 'ios', 'main.cell.normal')).toBe(0.25);
    expect(colorValue(changed, 'ios', 'main.cell.normal')).toBe('#40F66C6C');
  });
});
