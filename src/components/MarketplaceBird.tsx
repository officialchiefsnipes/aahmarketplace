const BIRD_SRC = 'https://i.postimg.cc/jSh5qkW5/marketplace-bird.png';

export function MarketplaceBird({ loading = false, compact = false, label = 'Loading' }: { loading?: boolean; compact?: boolean; label?: string }) {
  const className = ['am-bird', loading && 'am-bird-loading', compact && 'am-bird-compact'].filter(Boolean).join(' ');
  return (
    <span className={className}
      role={loading ? 'status' : undefined} aria-label={loading ? label : undefined}>
      <img src={BIRD_SRC} alt={loading ? '' : 'Abdulsalami bird'} width="112" height="112" />
    </span>
  );
}
