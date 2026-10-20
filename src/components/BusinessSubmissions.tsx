import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Plus, X, RefreshCw, MessageCircle, Check, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MarketplaceBird } from './MarketplaceBird';
import { businessSubmissionSchema, submissionWhatsAppLink, type PendingBusiness } from '@/lib/business-submissions';
import { submitBusiness, listBusinessSubmissions, reviewBusinessSubmission } from '@/lib/business-submissions.functions';

export function BusinessSubmissionEntry() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: '', room: '', phone: '' });
  const [saved, setSaved] = useState<{ id: string; link: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = useServerFn(submitBusiness);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = businessSubmissionSchema.safeParse(form);
    if (!result.success) { setError(result.error.issues[0]?.message ?? 'Check your details.'); return; }
    setBusy(true); setError('');
    try {
      const response = await submit({ data: result.data });
      setSaved({ id: response.id, link: submissionWhatsAppLink(result.data, response.id) });
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not submit your business.'); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="ghost" className="am-owner-entry" onClick={() => { setOpen(true); setSaved(null); setError(''); }}>
      <Plus size={14} /> Add your business
    </Button>
    {open && <div className="am-overlay"><div className="am-panel" role="dialog" aria-modal="true" aria-label="Submit your business">
      <div className="am-panel-head"><h2>Add your business</h2><Button variant="ghost" size="icon" className="am-icon-btn" aria-label="Close submission" onClick={() => setOpen(false)} disabled={busy}><X size={18} /></Button></div>
      {saved ? <div className="am-form">
        <p className="am-ok" role="status">Your details are saved for review. Your business will appear after admin approval.</p>
        <p className="am-panel-note">Send the saved copy to the marketplace owner on WhatsApp for verification.</p>
        <Button asChild className="am-submit"><a href={saved.link} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Send copy on WhatsApp</a></Button>
      </div> : <form className="am-form" onSubmit={save}>
        {[['name', 'Business name', 120], ['category', 'Nature of business', 80], ['room', 'Room information', 120], ['phone', 'WhatsApp phone number', 30]].map(([key, label, limit]) => {
          const field = key as keyof typeof form;
          return <div className="am-field" key={field}><label htmlFor={`owner-${field}`}>{label}</label><input id={`owner-${field}`} required maxLength={Number(limit)} type={field === 'phone' ? 'tel' : 'text'} placeholder={field === 'phone' ? '08012345678 or +2348012345678' : undefined} value={form[field]} onChange={e => setForm(previous => ({ ...previous, [field]: e.target.value }))} /></div>;
        })}
        {error && <p className="am-error" role="alert">{error}</p>}
        <Button type="submit" className="am-submit" disabled={busy}>{busy ? <><MarketplaceBird loading compact label="Submitting business" /> Submitting…</> : 'Submit for approval'}</Button>
      </form>}
    </div></div>}
  </>;
}

export function BusinessSubmissionReview({ onApproved }: { onApproved: () => Promise<void> }) {
  const list = useServerFn(listBusinessSubmissions);
  const review = useServerFn(reviewBusinessSubmission);
  const [rows, setRows] = useState<PendingBusiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function refresh() {
    setLoading(true); setError('');
    try { setRows(await list()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load submissions.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function decide(row: PendingBusiness, decision: 'approved' | 'rejected') {
    if (!window.confirm(`${decision === 'approved' ? 'Publish' : 'Reject'} "${row.name}"?`)) return;
    setBusy(row.id); setError(''); setNotice('');
    try {
      await review({ data: { id: row.id, decision, verified: Boolean(verified[row.id]) } });
      setRows(previous => previous.filter(item => item.id !== row.id));
      setNotice(`${row.name} ${decision === 'approved' ? 'is now published' : 'was rejected'}.`);
      if (decision === 'approved') await onApproved();
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not review submission.'); }
    finally { setBusy(null); }
  }
  return <section className="am-review-section" aria-label="Business submissions">
    <div className="am-panel-head"><h2>Pending submissions ({rows.length})</h2><Button variant="ghost" size="icon" aria-label="Refresh submissions" title="Refresh submissions" onClick={refresh} disabled={loading || busy !== null}><RefreshCw size={16} /></Button></div>
    {loading && <div className="am-loading"><MarketplaceBird loading label="Loading submissions" /></div>}
    {error && <p className="am-error" role="alert">{error}</p>}
    {notice && <p className="am-ok" role="status">{notice}</p>}
    {!loading && !error && rows.length === 0 && <p className="am-panel-note">No submissions awaiting review.</p>}
    <div className="am-review-list">{rows.map(row => <article className="am-review-item" key={row.id}>
      <h3>{row.name}</h3><dl><dt>Nature of business</dt><dd>{row.category}</dd><dt>Room information</dt><dd>{row.room}</dd><dt>Phone</dt><dd>+{row.phone}</dd></dl>
      <small className="am-review-reference">Reference: {row.id}</small>
      <Button asChild variant="outline"><a href={submissionWhatsAppLink(row, row.id)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Review copy on WhatsApp</a></Button>
      <label className="am-verify"><input type="checkbox" checked={Boolean(verified[row.id])} onChange={e => setVerified(previous => ({ ...previous, [row.id]: e.target.checked }))} /> I have verified these details against the WhatsApp copy.</label>
      <div className="am-review-actions"><Button className="am-submit" disabled={busy !== null || !verified[row.id]} onClick={() => decide(row, 'approved')}><Check size={16} /> Approve</Button><Button variant="outline" disabled={busy !== null} onClick={() => decide(row, 'rejected')}><Ban size={16} /> Reject</Button>{busy === row.id && <MarketplaceBird loading compact label="Reviewing submission" />}</div>
    </article>)}</div>
  </section>;
}