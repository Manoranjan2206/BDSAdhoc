// Centralized tenant definitions and resolution utilities

export const KNOWN_TENANTS = [
  'AlphaCorp',
  'BetaSolutions',
  'GammaIndustries',
  'DeltaEnterprises',
];

export const TENANT_ID_MAP = {
  1: 'AlphaCorp',
  2: 'BetaSolutions',
  3: 'GammaIndustries',
  4: 'DeltaEnterprises',
};

export const TENANT_METADATA = {
  AlphaCorp: {
    id: 1,
    name: 'AlphaCorp',
    industry: 'Enterprise Software & Cloud',
    baseRevenue: '4.85M',
    growth: '+18.4%',
    contactsCount: 340,
    supportCount: 14,
    schedulesCount: 12,
    keyAccounts: ['Nexus Group', 'Acme Corp', 'Horizon Labs'],
  },
  BetaSolutions: {
    id: 2,
    name: 'BetaSolutions',
    industry: 'Financial Technology & Payments',
    baseRevenue: '3.20M',
    growth: '+14.2%',
    contactsCount: 280,
    supportCount: 9,
    schedulesCount: 8,
    keyAccounts: ['Sterling Financial', 'Crestview Labs', 'Orion Logistics'],
  },
  GammaIndustries: {
    id: 3,
    name: 'GammaIndustries',
    industry: 'Heavy Manufacturing & IoT',
    baseRevenue: '6.10M',
    growth: '+22.8%',
    contactsCount: 410,
    supportCount: 19,
    schedulesCount: 15,
    keyAccounts: ['Vanguard Heavy', 'Euro Logistics', 'Tokyo Energy'],
  },
  DeltaEnterprises: {
    id: 4,
    name: 'DeltaEnterprises',
    industry: 'Global Retail & Commerce',
    baseRevenue: '5.40M',
    growth: '+16.5%',
    contactsCount: 390,
    supportCount: 11,
    schedulesCount: 9,
    keyAccounts: ['Pacific Freightways', 'Atlas Global Shipping', 'Beacon Hubs Ltd'],
  },
};

export function getTenantNameFromId(tenantId) {
  const numericId = typeof tenantId === 'string' ? parseInt(tenantId, 10) : tenantId;
  return TENANT_ID_MAP[numericId] || 'AlphaCorp';
}

export function inferTenantFromEmail(email) {
  if (!email || typeof email !== 'string') return 'AlphaCorp';
  const lower = email.toLowerCase();
  if (lower.includes('alpha')) return 'AlphaCorp';
  if (lower.includes('beta')) return 'BetaSolutions';
  if (lower.includes('gamma')) return 'GammaIndustries';
  if (lower.includes('delta')) return 'DeltaEnterprises';
  return 'AlphaCorp';
}
