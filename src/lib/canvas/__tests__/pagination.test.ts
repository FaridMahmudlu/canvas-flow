import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseLinkHeader } from '../client';

describe('Canvas Pagination & Link Headers', () => {
  it('parses standard Canvas Link headers accurately', () => {
    const header =
      '<https://canvas.elte.hu/api/v1/courses?page=1&per_page=10>; rel="current",' +
      '<https://canvas.elte.hu/api/v1/courses?page=2&per_page=10>; rel="next",' +
      '<https://canvas.elte.hu/api/v1/courses?page=1&per_page=10>; rel="first",' +
      '<https://canvas.elte.hu/api/v1/courses?page=5&per_page=10>; rel="last"';

    const links = parseLinkHeader(header);
    assert.equal(links.current, 'https://canvas.elte.hu/api/v1/courses?page=1&per_page=10');
    assert.equal(links.next, 'https://canvas.elte.hu/api/v1/courses?page=2&per_page=10');
    assert.equal(links.first, 'https://canvas.elte.hu/api/v1/courses?page=1&per_page=10');
    assert.equal(links.last, 'https://canvas.elte.hu/api/v1/courses?page=5&per_page=10');
    assert.equal(links.prev, undefined);
  });

  it('handles last page without next link', () => {
    const header =
      '<https://canvas.elte.hu/api/v1/courses?page=5&per_page=10>; rel="current",' +
      '<https://canvas.elte.hu/api/v1/courses?page=4&per_page=10>; rel="prev",' +
      '<https://canvas.elte.hu/api/v1/courses?page=1&per_page=10>; rel="first",' +
      '<https://canvas.elte.hu/api/v1/courses?page=5&per_page=10>; rel="last"';

    const links = parseLinkHeader(header);
    assert.equal(links.next, undefined);
    assert.equal(links.prev, 'https://canvas.elte.hu/api/v1/courses?page=4&per_page=10');
  });

  it('safely handles empty, null, or malformed Link headers', () => {
    assert.deepEqual(parseLinkHeader(null), {});
    assert.deepEqual(parseLinkHeader(''), {});
    assert.deepEqual(parseLinkHeader('malformed-header-without-angles'), {});
  });
});
