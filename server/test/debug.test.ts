import { monitorUsers } from '../src/debug';

describe('Debug', () => {
  it('monitor users should be a function', () => {
    expect(monitorUsers).toStrictEqual(expect.any(Function));
  });
});
