import dns from 'node:dns/promises';
import { isIP } from 'node:net';

export const warnings = [];
export function warn(msg) {
  if (warnings.length < 500) warnings.push(msg);
}

export async function validateUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Unsupported protocol: ' + parsed.protocol);
    }
    const host = parsed.hostname;
    // Resolve DNS
    const addresses = await dns.resolve(host).catch(() => []);
    if (isIP(host)) {
      addresses.push(host);
    }
    
    // Check if any address is private
    for (const ip of addresses) {
      if (
        ip === '127.0.0.1' ||
        ip === '::1' ||
        ip === '169.254.169.254' ||
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        (ip.startsWith('172.') && parseInt(ip.split('.')[1], 10) >= 16 && parseInt(ip.split('.')[1], 10) <= 31)
      ) {
        throw new Error('SSRF Blocked: Private IP address detected: ' + ip);
      }
    }
    return true;
  } catch (e) {
    throw new Error(`SSRF Blocked: Invalid or unsafe URL (${urlStr}). Details: ${e.message}`);
  }
}

export async function safeFetch(url, options) {
  await validateUrl(url);
  return fetch(url, options);
}

export function escX(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
export function cdX(s) { return '<![CDATA[' + String(s == null ? '' : s).replace(/]]>/g, ']]&gt;') + ']]>'; }
export function ancestorsOf(id, catById) { const out = []; let c = catById[id]; while (c && c.parentId) { const p = catById[c.parentId]; if (!p) break; out.push(p); c = p; } return out; }

const BRAND_PARAM_NAMES_SRV = new Set(['бренд','brand','торгова марка','торговая марка','виробник','производитель','марка']);
export function getOfferBrand(o, defaultBrand) {
  const bp = (o.params || []).find(pm => BRAND_PARAM_NAMES_SRV.has((pm.name || '').toLowerCase()));
  return (bp && bp.value) || defaultBrand || '';
}

export function withBrandSrv(name, brand) {
  if (!brand || !name) return name;
  if (name.toLowerCase().includes(brand.toLowerCase())) return name;
  return name + ' ' + brand;
}

const DEFAULT_FILL_SRV = [
  { name: 'Розмір', value: '-' },
  { name: 'Колір', value: 'Комбінований' },
  { name: 'Вага', value: '-' },
  { name: 'Стан', value: 'Новий' },
];
export function fillDefaultParamsSrv(params) {
  if ((params || []).length >= 3) return params;
  const result = [...(params || [])];
  const existing = new Set(result.map(p => (p.name || '').toLowerCase()));
  for (const dp of DEFAULT_FILL_SRV) {
    if (result.length >= 4) break;
    if (!existing.has(dp.name.toLowerCase())) { result.push({ ...dp }); existing.add(dp.name.toLowerCase()); }
  }
  return result;
}

export function deEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
}
