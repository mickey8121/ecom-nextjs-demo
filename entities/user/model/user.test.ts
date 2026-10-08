import { describe, expect, it } from 'vitest';

import { toUserDto } from './user';

const user = {
  id: 1,
  username: 'emilys',
  firstName: 'Emily',
  lastName: 'Johnson',
  email: 'emily.johnson@x.dummyjson.com',
  image: 'https://dummyjson.com/icon/emilys/128',
};

describe('toUserDto', () => {
  it('keeps only the DTO fields of a /auth/me payload', () => {
    const payload = { ...user, age: 28, password: 'emilyspass', role: 'admin' };

    expect(toUserDto(payload)).toEqual(user);
  });

  it('drops the tokens of a login-shaped payload', () => {
    const payload = {
      ...user,
      gender: 'female',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    const dto = toUserDto(payload);

    expect(dto).toEqual(user);
    expect(dto).not.toHaveProperty('accessToken');
    expect(dto).not.toHaveProperty('refreshToken');
  });
});
