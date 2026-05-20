alter table public.family_accounts
  add column if not exists shared boolean not null default false;

update public.family_accounts
set shared = true
where shared = false
  and (
    owner in ('共同', '共用')
    or name ~* '(家庭|共同|共用|房地產|房貸|車子|車輛|代刷墊|E-Tag|全聯|PCHome|Momo|新光禮卷|中油pay|奶奶|爸爸|陳媽|國安街|US現金|T-嘉信|401K|Tesla|LineBank|星展房貸|大苑子|富邦人壽房貸)'
  );
