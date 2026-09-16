import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateCanvasUrl, isPrivateOrReservedIp } from '../ssrf';

describe('SSRF Protection & Canvas URL Validation', () => {
  it('correctly identifies private and reserved IP addresses', () => {
    // IPv4 private & loopback
    assert.equal(isPrivateOrReservedIp('127.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('10.0.0.1'), true);
    assert.equal(isPrivateOrReservedIp('172.16.0.1'), true);
    assert.equal(isPrivateOrReservedIp('172.31.255.255'), true);
    assert.equal(isPrivateOrReservedIp('192.168.1.1'), true);
    assert.equal(isPrivateOrReservedIp('169.254.169.254'), true); // Cloud metadata
    assert.equal(isPrivateOrReservedIp('0.0.0.0'), true);
    assert.equal(isPrivateOrReservedIp('255.255.255.255'), true);

    // IPv4 public
    assert.equal(isPrivateOrReservedIp('8.8.8.8'), false);
    assert.equal(isPrivateOrReservedIp('1.1.1.1'), false);
    assert.equal(isPrivateOrReservedIp('157.181.0.1'), false); // ELTE range

    // IPv6 private & loopback
    assert.equal(isPrivateOrReservedIp('::1'), true);
    assert.equal(isPrivateOrReservedIp('fe80::1'), true);
  });

  it('rejects invalid or dangerous schemes', async () => {
    const resHttp = await validateCanvasUrl('http://insecure-canvas.example.com');
    assert.equal(resHttp.valid, false);
    assert.match(resHttp.error || '', /HTTPS/i);

    const resFtp = await validateCanvasUrl('ftp://canvas.example.com');
    assert.equal(resFtp.valid, false);
  });

  it('rejects private IPv4 addresses directly in URL', async () => {
    const res127 = await validateCanvasUrl('https://127.0.0.1');
    assert.equal(res127.valid, false);

    const resMeta = await validateCanvasUrl('https://169.254.169.254');
    assert.equal(resMeta.valid, false);

    const res10 = await validateCanvasUrl('https://10.0.0.5');
    assert.equal(res10.valid, false);

    const res192 = await validateCanvasUrl('https://192.168.1.50');
    assert.equal(res192.valid, false);
  });

  it('rejects internal and local hostnames', async () => {
    const resLocal = await validateCanvasUrl('https://service.internal');
    assert.equal(resLocal.valid, false);

    const resDotLocal = await validateCanvasUrl('https://my-server.local');
    assert.equal(resDotLocal.valid, false);
  });

  it('rejects non-standard ports', async () => {
    const resPort = await validateCanvasUrl('https://canvas.example.com:8443');
    assert.equal(resPort.valid, false);
    assert.match(resPort.error || '', /port 443/i);
  });

  it('normalizes and validates standard public Canvas URLs', async () => {
    const resElte = await validateCanvasUrl('canvas.elte.hu');
    assert.equal(resElte.valid, true);
    assert.equal(resElte.normalizedUrl, 'https://canvas.elte.hu');

    const resInstructure = await validateCanvasUrl('https://canvas.instructure.com/');
    assert.equal(resInstructure.valid, true);
    assert.equal(resInstructure.normalizedUrl, 'https://canvas.instructure.com');
  });
});
