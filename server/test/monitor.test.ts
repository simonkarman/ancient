import { monitorUsers } from '../src/monitor';

describe('Monitor', () => {
  it('monitor users should be a function', () => {
    expect(monitorUsers).toStrictEqual(expect.any(Function));
  });
});
