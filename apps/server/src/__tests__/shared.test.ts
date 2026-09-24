import { describe, it, expect } from 'vitest';

import { SET_TYPES } from '@trainapp/shared';

describe('@trainapp/shared', () => {
  it('is importable from the server', () => {
    expect(SET_TYPES).toContain("working");
  });
});