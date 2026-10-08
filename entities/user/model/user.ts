export type UserDto = {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  image: string;
};

export function toUserDto(payload: UserDto & Record<string, unknown>): UserDto {
  const { id, username, firstName, lastName, email, image } = payload;
  return { id, username, firstName, lastName, email, image };
}
