import dns from 'dns';
import { promisify } from 'util';
import net from 'net';

const lookupAsync = promisify(dns.lookup);

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or reserved range.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    const [b0, b1] = parts;

    // 0.0.0.0/8 (Current network)
    if (b0 === 0) return true;

    // 10.0.0.0/8 (Private)
    if (b0 === 10) return true;

    // 127.0.0.0/8 (Loopback)
    if (b0 === 127) return true;

    // 169.254.0.0/16 (Link-local / Cloud metadata AWS/GCP/Azure)
    if (b0 === 169 && b1 === 254) return true;

    // 172.16.0.0/12 (Private)
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

    // 192.168.0.0/16 (Private)
    if (b0 === 192 && b1 === 168) return true;

    // 224.0.0.0/4 (Multicast)
    if (b0 >= 224 && b0 <= 239) return true;

    // 240.0.0.0/4 (Reserved)
    if (b0 >= 240) return true;

    // 255.255.255.255 (Broadcast)
    if (ip === '255.255.255.255') return true;

    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    // ::1 (Loopback)
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
    // :: (Unspecified)
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;
    // fe80::/10 (Link-local)
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
    // fc00::/7 (Unique local address)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

    return false;
  }

  return false;
}

export interface CanvasUrlValidationResult {
  valid: boolean;
  error?: string;
  normalizedUrl?: string;
}

/**
 * Validates a user-provided Canvas LMS instance URL against SSRF attacks.
 * Enforces HTTPS, non-internal hostnames, valid ports, and resolves DNS to ensure
 * destination IP is not in a private or reserved network.
 */
export async function validateCanvasUrl(rawUrl: string): Promise<CanvasUrlValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Instance URL cannot be empty' };
  }

  let trimmed = rawUrl.trim().replace(/\/+$/, '');
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `https://${trimmed}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // Allow localhost only when explicitly enabled for local mock servers in development
  const allowLocal = process.env.NODE_ENV !== 'production' && process.env.CANVAS_ALLOW_LOCAL_MOCK === 'true';
  if (allowLocal && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
    return {
      valid: true,
      normalizedUrl: parsed.origin,
    };
  }

  // Strictly enforce HTTPS in production and general usage
  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Canvas LMS requires a secure HTTPS connection' };
  }

  // Reject standard internal hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, error: 'Local and internal addresses are prohibited' };
  }

  // Only allow standard HTTPS port (443) or default
  if (parsed.port && parsed.port !== '443') {
    return { valid: false, error: 'Only standard HTTPS port 443 is permitted' };
  }

  // If hostname is directly an IP address
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      return { valid: false, error: 'Connecting to private or internal IP addresses is prohibited' };
    }
  } else {
    // Perform DNS lookup to check resolved IP addresses
    try {
      const lookupResult = await lookupAsync(hostname, { all: true });
      for (const entry of lookupResult) {
        if (isPrivateOrReservedIp(entry.address)) {
          return {
            valid: false,
            error: 'Host resolves to a private or internal IP address',
          };
        }
      }
    } catch (dnsErr) {
      return {
        valid: false,
        error: `Could not resolve hostname "${hostname}". Please check that the URL is correct.`,
      };
    }
  }

  return {
    valid: true,
    normalizedUrl: parsed.origin,
  };
}
