import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';

import PlayingCard from './PlayingCard.vue';

describe('PlayingCard', () => {
  it('announces and selects a number card through its public interface', async () => {
    const wrapper = mount(PlayingCard, {
      props: {
        card: { id: 'seven', kind: 'number', value: 7 },
      },
    });

    expect(wrapper.get('button').attributes('aria-label')).toBe('Number 7');
    await wrapper.get('button').trigger('click');
    expect(wrapper.emitted('select')).toEqual([['seven']]);
  });

  it('does not emit selection while staged or otherwise disabled', async () => {
    const wrapper = mount(PlayingCard, {
      props: {
        card: { id: 'wild', kind: 'wild', lockedValue: 4 },
        disabled: true,
        groupLabel: 'SET',
      },
    });

    await wrapper.get('button').trigger('click');
    expect(wrapper.text()).toContain('SET');
    expect(wrapper.emitted('select')).toBeUndefined();
  });
});
