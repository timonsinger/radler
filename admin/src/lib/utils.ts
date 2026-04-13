export function formatPrice(n: number): string {
  return n.toFixed(2).replace('.', ',') + ' €';
}

export function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateShort(d: string): string {
  return new Date(d).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
  });
}

export function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: 'Ausstehend',
    accepted: 'Angenommen',
    picked_up: 'Abgeholt',
    delivered: 'Zugestellt',
    cancelled: 'Storniert',
    expired: 'Abgelaufen',
  };
  return map[s] || s;
}

export function statusColor(s: string): string {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    accepted: 'bg-blue-100 text-blue-700',
    picked_up: 'bg-indigo-100 text-indigo-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
    expired: 'bg-gray-100 text-gray-500',
  };
  return map[s] || 'bg-gray-100 text-gray-500';
}

export function roleLabel(r: string): string {
  const map: Record<string, string> = { customer: 'Kunde', driver: 'Fahrer', admin: 'Admin' };
  return map[r] || r;
}

export function roleColor(r: string): string {
  const map: Record<string, string> = {
    customer: 'bg-blue-100 text-blue-700',
    driver: 'bg-green-100 text-green-700',
    admin: 'bg-purple-100 text-purple-700',
  };
  return map[r] || 'bg-gray-100 text-gray-500';
}
