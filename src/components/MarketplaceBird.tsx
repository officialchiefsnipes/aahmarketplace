import bird from '@/assets/marketplace-bird.png.asset.json';

export function MarketplaceBird({ loading = false, compact = false, label = 'Loading' }: { loading?: boolean; compact?: boolean; label?: string }) {
  return (
    <span className={`am-bird ${loading ? 'am-bird-loading' : ''} ${compact ? 'am-bird-compact' : ''}`}
      role={loading ? 'status' : undefined} aria-label={loading ? label : undefined}>
      <img src={bird.url} alt={loading ? '' : 'Abdulsalami bird'} width="112" height="112" />
    </span>
  );
}