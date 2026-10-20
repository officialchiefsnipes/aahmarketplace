<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Marketplace listings live in Lovable Cloud with public read and role-gated writes, so everyone sees the same catalog and browser storage cannot grant admin rights.
- Admin identity uses Cloud Auth with roles in a separate table, so signing in alone never confers admin access.
- Uploaded marketplace media is served through Lovable Assets pointers; backdrop styling uses global semantic tokens so uploaded photos stay out of the source tree and text remains readable.
- Use the shared MarketplaceBird component for branding and async loading indicators, with animation defined globally and reduced-motion support, so the same asset renders consistently before and after hydration.
- Keep anonymous business submissions separate from published businesses; validate public inserts in a server function, restrict inbox reads to admins, and approve through a role-checked transactional SQL function to prevent partial publication or duplicate approval.
- Use WhatsApp deep links for submission copies and admin review; opening a link is not proof of message delivery, so require explicit admin verification before approval.
