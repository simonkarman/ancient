import { hasExpectedQueryParams, ExpectedQueryParams } from '../src/utils';

describe('Karmax Utils - hasExpectedQueryParams', () => {
  const scenarios: readonly (string | undefined)[] = [
    undefined,
    '',
    '/',
    '?karmax',
    '/?karmax',
    '/abc?karmax',
    '/abc?karmax=no',
    '/abc?karmax=no&another=hello',
    '/abc?karmax=yes',
    '/abc?karmax=yes&another=hello',
  ];

  it('should always return true when expected query params is empty', () => {
    const params: ExpectedQueryParams = {};
    for (let i = 0; i < scenarios.length; i++) {
      expect(hasExpectedQueryParams(params, scenarios[i])).toBe(true);
    }
  });
  it('should return true for first three scenarios with expected value of false', () => {
    const params: ExpectedQueryParams = { karmax: false };
    for (let i = 0; i < scenarios.length; i++) {
      expect(hasExpectedQueryParams(params, scenarios[i])).toBe(i < 3);
    }
  });
  it('should return true for all except the first three scenarios with expected value of true', () => {
    const params: ExpectedQueryParams = { karmax: true };
    for (let i = 0; i < scenarios.length; i++) {
      expect(hasExpectedQueryParams(params, scenarios[i])).toBe(i >= 3);
    }
  });
  it('should return true for the last two scenarios with expected value of \'yes\'', () => {
    const params: ExpectedQueryParams = { karmax: 'yes' };
    for (let i = 0; i < scenarios.length; i++) {
      console.info('checking', scenarios[i]);
      expect(hasExpectedQueryParams(params, scenarios[i])).toBe(i >= scenarios.length - 2);
    }
  });
  it('should return true for the last two scenarios with expected value of a function expecting \'yes\'', () => {
    const params: ExpectedQueryParams = { karmax: (value: string) => value === 'yes' };
    for (let i = 0; i < scenarios.length; i++) {
      console.info('checking', scenarios[i]);
      expect(hasExpectedQueryParams(params, scenarios[i])).toBe(i >= scenarios.length - 2);
    }
  });
  it('should return true when multiple params are used', () => {
    const params: ExpectedQueryParams = {
      one: true,
      two: false,
      three: 'something',
      four: (value: string) => value.length === 4,
    };
    expect(hasExpectedQueryParams(params, '?one&three=something&four=1234')).toBe(true);
  });
});
