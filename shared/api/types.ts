export type ListPage<T> = {
  items: T[];
  total: number;
  skip: number;
  limit: number;
};
