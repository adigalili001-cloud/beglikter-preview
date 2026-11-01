import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import {
  sb, loadAll, saveWork, deleteWork, uploadImage, removeImage, publicImage, imageSize, slugify, explain, emptyWork,
  type Work, type Category,
} from './api';
import { FRAMES, FOCUSES, WORKS_BUCKET, cardImageHeight, type Frame, type Focus } from '../lib/supabase-config';

/* ============================== root: auth gate ============================== */

export default function AdminApp() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div class="center muted">טוען…</div>;
  if (!session) return <Login />;
  if (recovery || session.user.user_metadata?.must_change_password)
    return <SetPassword first={!recovery} onDone={() => setRecovery(false)} />;
  return <Shell session={session} />;
}

/* ============================== login ============================== */

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  async function submit(e: Event) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    setBusy(false);
    if (error) setMsg({ kind: 'error', text: explain(error) });
  }

  async function forgot() {
    if (!email) { setMsg({ kind: 'error', text: 'הקלידי קודם את כתובת המייל.' }); return; }
    const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${location.origin}/admin` });
    setMsg(error ? { kind: 'error', text: explain(error) } : { kind: 'info', text: 'אם הכתובת רשומה, נשלח אליה קישור לאיפוס סיסמה.' });
  }

  return (
    <div class="center">
      <form class="card auth" onSubmit={submit}>
        <p class="eyebrow">Etamar Beglikter</p>
        <h1>ממשק ניהול</h1>
        <label>מייל<input type="email" dir="ltr" autocomplete="username" required value={email} onInput={(e) => setEmail(e.currentTarget.value)} /></label>
        <label>סיסמה<input type="password" dir="ltr" autocomplete="current-password" required value={password} onInput={(e) => setPassword(e.currentTarget.value)} /></label>
        {msg && <p class={msg.kind === 'error' ? 'error' : 'note'}>{msg.text}</p>}
        <button class="btn primary" disabled={busy}>{busy ? 'מתחבר…' : 'כניסה'}</button>
        <button type="button" class="link" onClick={forgot}>שכחתי סיסמה</button>
      </form>
    </div>
  );
}

function SetPassword({ first, onDone }: { first: boolean; onDone: () => void }) {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    if (a.length < 10) return setErr('לפחות 10 תווים.');
    if (a !== b) return setErr('שתי הסיסמאות לא זהות.');
    setBusy(true);
    const { error } = await sb.auth.updateUser({ password: a, data: { must_change_password: false } });
    setBusy(false);
    if (error) return setErr(explain(error));
    onDone();
  }

  return (
    <div class="center">
      <form class="card auth" onSubmit={submit}>
        <h1>{first ? 'בחירת סיסמה' : 'סיסמה חדשה'}</h1>
        {first && <p class="note">זו הכניסה הראשונה. בחרי סיסמה אישית במקום הזמנית — לפחות 10 תווים. מומלץ לשמור אותה במנהל הסיסמאות.</p>}
        <label>סיסמה חדשה<input type="password" dir="ltr" autocomplete="new-password" value={a} onInput={(e) => setA(e.currentTarget.value)} /></label>
        <label>שוב, לאימות<input type="password" dir="ltr" autocomplete="new-password" value={b} onInput={(e) => setB(e.currentTarget.value)} /></label>
        {err && <p class="error">{err}</p>}
        <button class="btn primary" disabled={busy}>שמירה והמשך</button>
      </form>
    </div>
  );
}

/* ============================== shell ============================== */

type Tab = 'works' | 'categories' | 'leads' | 'donors';
type Toast = { text: string; kind?: 'error' } | null;

function Shell({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('works');
  const [works, setWorks] = useState<Work[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

  const notify = (text: string, kind?: 'error') => {
    setToast({ text, kind });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind ? 7000 : 4000);
  };

  async function refresh() {
    try {
      const d = await loadAll();
      setWorks(d.works); setCategories(d.categories);
    } catch (e) { notify(explain(e), 'error'); }
    setLoading(false);
  }
  useEffect(() => { refresh(); }, []);

  const name = session.user.user_metadata?.name ?? session.user.email;
  const tabs: [Tab, string, boolean][] = [
    ['works', 'עבודות', true], ['categories', 'קטגוריות', true], ['leads', 'לידים', false], ['donors', 'תורמים · V4V', false],
  ];

  return (
    <div class="shell">
      <header class="topbar">
        <div class="brand"><span dir="ltr">Etamar Beglikter</span> · ממשק ניהול</div>
        <div class="who">
          <a class="link" href="/works" target="_blank">לאתר ↗</a>
          <span class="muted">{name}</span>
          <button class="link" onClick={() => sb.auth.signOut()}>יציאה</button>
        </div>
      </header>
      <nav class="tabs">
        {tabs.map(([id, label, enabled]) => (
          <button class={`tab ${tab === id ? 'active' : ''}`} disabled={!enabled} onClick={() => setTab(id)} title={enabled ? '' : 'בהמשך'}>
            {label}{!enabled && <span class="soon">בהמשך</span>}
          </button>
        ))}
      </nav>
      <main class="content">
        {loading ? <p class="muted">טוען…</p> :
          tab === 'works' ? <WorksTab works={works} categories={categories} refresh={refresh} notify={notify} /> :
          tab === 'categories' ? <CategoriesTab categories={categories} works={works} refresh={refresh} notify={notify} /> : null}
      </main>
      {toast && <div class={`toast ${toast.kind ?? ''}`} role="status">{toast.text}</div>}
    </div>
  );
}

const SAVED = 'נשמר. האתר יתעדכן תוך כדקה.';

/* ============================== works tab ============================== */

type TabProps = { works: Work[]; categories: Category[]; refresh: () => Promise<void>; notify: (t: string, k?: 'error') => void };

function WorksTab({ works, categories, refresh, notify }: TabProps) {
  const [editing, setEditing] = useState<Work | null>(null);
  const [order, setOrder] = useState<Work[]>(works);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft'>('all');
  useEffect(() => setOrder(works), [works]);

  const catLabel = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c.label])), [categories]);
  const shown = order.filter((w) => filter === 'all' || (filter === 'published') === w.published);

  /* drag to reorder (whole list only, so positions stay unambiguous) */
  const dragId = useRef<string | null>(null);
  function onDrop(targetId: string) {
    const from = order.findIndex((w) => w.id === dragId.current);
    const to = order.findIndex((w) => w.id === targetId);
    dragId.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const next = [...order];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setOrder(next);
    sb.rpc('reorder_works', { ids: next.map((w) => w.id) }).then(({ error }) => {
      if (error) { notify(explain(error), 'error'); setOrder(works); } else { notify('הסדר עודכן. האתר יתעדכן תוך כדקה.'); refresh(); }
    });
  }

  async function togglePublished(w: Work) {
    if (!w.published && !w.image_path) return notify('אי אפשר לפרסם עבודה בלי תמונה.', 'error');
    try { await saveWork({ ...w, published: !w.published }); notify(SAVED); refresh(); }
    catch (e) { notify(explain(e), 'error'); }
  }

  if (editing) {
    return <WorkEditor initial={editing} categories={categories} notify={notify}
      onClose={async (changed) => { setEditing(null); if (changed) await refresh(); }} />;
  }

  return (
    <section>
      <SeedImport works={works} notify={notify} />
      <div class="toolbar">
        <h2>עבודות <span class="muted">({works.length})</span></h2>
        <div class="seg">
          {([['all', 'הכל'], ['published', 'מפורסמות'], ['draft', 'טיוטות']] as const).map(([k, l]) => (
            <button class={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <button class="btn primary" onClick={() => setEditing(emptyWork())}>+ עבודה חדשה</button>
      </div>
      <p class="hint">גררי שורה כדי לשנות את הסדר בגלריה באתר (מימין = ראשונה). {filter !== 'all' && 'שינוי סדר אפשרי רק בתצוגת "הכל".'}</p>
      {shown.length === 0 && <p class="empty">אין כאן עבודות עדיין.</p>}
      <ul class="rows">
        {shown.map((w) => (
          <li class="row" key={w.id}
            draggable={filter === 'all'}
            onDragStart={() => (dragId.current = w.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(w.id!)}>
            {filter === 'all' && <span class="handle" aria-hidden="true">⋮⋮</span>}
            <div class="thumb">{w.image_path && <img src={publicImage(w.image_path)!} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />}</div>
            <div class="row-main" dir="ltr">
              <strong>{w.title}</strong>
              <span class="muted">{w.year} · {w.medium}</span>
            </div>
            <div class="row-cats">{w.categories.map((c) => <span class="pill" dir="ltr">{catLabel[c] ?? c}</span>)}</div>
            <button class={`status ${w.published ? 'on' : ''}`} onClick={() => togglePublished(w)}
              title={w.published ? 'לחיצה תסתיר מהאתר' : 'לחיצה תפרסם באתר'}>
              {w.published ? 'מפורסם' : 'טיוטה'}
            </button>
            <button class="btn" onClick={() => setEditing(w)}>עריכה</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** One-time: copies the five original photos from the site into the admin's image storage. */
function SeedImport({ works, notify }: { works: Work[]; notify: TabProps['notify'] }) {
  const seeds = works.filter((w) => w.image_path?.startsWith('seed/'));
  const [missing, setMissing] = useState<Work[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!seeds.length) return setMissing([]);
    sb.storage.from(WORKS_BUCKET).list('seed', { limit: 100 }).then(({ data }) => {
      const have = new Set((data ?? []).map((o) => `seed/${o.name}`));
      setMissing(seeds.filter((w) => !have.has(w.image_path!)));
    });
  }, [works]);

  if (!missing?.length) return null;

  async function run() {
    setBusy(true);
    try {
      for (const w of missing!) {
        const blob = await (await fetch(`/${w.image_path}`)).blob();
        const { error } = await sb.storage.from(WORKS_BUCKET).upload(w.image_path!, blob, { contentType: 'image/jpeg', upsert: true });
        if (error) throw error;
      }
      // touch one row so the site rebuilds with the images
      const first = missing![0];
      await sb.from('works').update({ alt: first.alt }).eq('id', first.id!);
      setMissing([]);
      notify('התמונות יובאו. האתר יתעדכן תוך כדקה.');
    } catch (e) { notify(explain(e), 'error'); }
    setBusy(false);
  }

  return (
    <div class="banner">
      <span>{missing.length} תמונות של העבודות הקיימות עוד לא הועברו לממשק הניהול.</span>
      <button class="btn primary" disabled={busy} onClick={run}>{busy ? 'מייבא…' : 'ייבוא עכשיו'}</button>
    </div>
  );
}

/* ============================== work editor ============================== */

function WorkEditor({ initial, categories, notify, onClose }: {
  initial: Work; categories: Category[]; notify: TabProps['notify']; onClose: (changed: boolean) => void;
}) {
  const isNew = !initial.id;
  const [w, setW] = useState<Work>({ ...initial, categories: [...initial.categories] });
  const [file, setFile] = useState<{ blob: Blob; ext: string; url: string } | null>(null);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Work>(k: K, v: Work[K]) => setW((p) => ({ ...p, [k]: v }));
  useEffect(() => { if (!slugTouched) set('slug', slugify(w.title)); }, [w.title]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(file.url); }, [file]);

  async function pick(f: File | undefined) {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return notify('רק JPG, PNG או WEBP.', 'error');
    if (f.size > 20 * 1024 * 1024) return notify('הקובץ גדול מדי (עד 20MB).', 'error');
    const { width, height } = await imageSize(f);
    setFile({ blob: f, ext: f.type.split('/')[1].replace('jpeg', 'jpg'), url: URL.createObjectURL(f) });
    setW((p) => ({ ...p, image_width: width, image_height: height }));
  }

  function validate(next: Work) {
    const e: Record<string, string> = {};
    if (!next.title.trim()) e.title = 'חובה';
    if (!next.year || next.year < 1900 || next.year > 2100) e.year = 'שנה בין 1900 ל־2100';
    if (!next.slug) e.slug = 'חובה — אותיות לטיניות, ספרות ומקפים';
    if (next.published && !next.image_path && !file) e.image = 'כדי לפרסם צריך תמונה';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    const next = { ...w, title: w.title.trim(), medium: w.medium.trim(), note: w.note.trim(), alt: w.alt.trim() };
    if (!validate(next)) return;
    setBusy(true);
    let uploaded: string | null = null;
    try {
      if (file) uploaded = await uploadImage(file.blob, file.ext);
      const old = initial.image_path;
      await saveWork({ ...next, image_path: uploaded ?? next.image_path });
      if (uploaded && old) await removeImage(old);
      notify(next.published ? SAVED : 'נשמר כטיוטה. לא יופיע באתר עד שתפרסמי.');
      onClose(true);
    } catch (e) {
      if (uploaded) await removeImage(uploaded);
      notify(explain(e), 'error');
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`למחוק את "${w.title}"? אי אפשר לבטל.`)) return;
    setBusy(true);
    try { await deleteWork(w); notify('העבודה נמחקה.'); onClose(true); }
    catch (e) { notify(explain(e), 'error'); setBusy(false); }
  }

  const previewSrc = file?.url ?? publicImage(w.image_path);
  const imgH = cardImageHeight(w.frame, w.image_width, w.image_height);

  return (
    <section class="editor">
      <div class="toolbar">
        <button class="link" onClick={() => onClose(false)}>→ חזרה לרשימה</button>
        <h2>{isNew ? 'עבודה חדשה' : w.title || 'עריכת עבודה'}</h2>
        <div class="actions">
          {!isNew && <button class="btn danger" disabled={busy} onClick={remove}>מחיקה</button>}
          <button class="btn primary" disabled={busy} onClick={save}>{busy ? 'שומר…' : 'שמירה'}</button>
        </div>
      </div>

      <div class="editor-grid">
        <div class="form">
          <fieldset>
            <legend>פרטים</legend>
            <Field label="כותרת" error={errors.title}>
              <input dir="ltr" value={w.title} onInput={(e) => set('title', e.currentTarget.value)} />
            </Field>
            <div class="two">
              <Field label="שנה" error={errors.year}>
                <input dir="ltr" type="number" inputMode="numeric" value={w.year} onInput={(e) => set('year', e.currentTarget.value === '' ? '' : Number(e.currentTarget.value))} />
              </Field>
              <Field label="חומר / טכניקה">
                <input dir="ltr" value={w.medium} onInput={(e) => set('medium', e.currentTarget.value)} />
              </Field>
            </div>
            <Field label="הערה" hint="לא חובה. שורה שלישית מתחת לכרטיס, למשל Variations, commission">
              <input dir="ltr" value={w.note} onInput={(e) => set('note', e.currentTarget.value)} />
            </Field>
          </fieldset>

          <fieldset>
            <legend>תמונה</legend>
            <div class={`drop ${dragOver ? 'over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); pick(e.dataTransfer?.files[0]); }}
              onClick={() => fileInput.current?.click()}>
              {previewSrc ? <img src={previewSrc} alt="" /> : null}
              <span>{previewSrc ? 'החלפת תמונה — גררי לכאן או לחצי' : 'גררי תמונה לכאן או לחצי לבחירה'}</span>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => pick(e.currentTarget.files?.[0])} />
            </div>
            {errors.image && <p class="error">{errors.image}</p>}
            {w.image_width && <p class="hint">{w.image_width}×{w.image_height} פיקסלים. אפשר להעלות את הצילום המקורי — האתר מכין גרסה קלה לבד.</p>}
            <Field label="תיאור התמונה (לנגישות ולגוגל)" hint="משפט קצר באנגלית: מה רואים בתמונה">
              <input dir="ltr" value={w.alt} onInput={(e) => set('alt', e.currentTarget.value)} />
            </Field>
          </fieldset>

          <fieldset>
            <legend>תצוגה בגלריה</legend>
            <Field label="מסגור" hint="רוחב הכרטיס קבוע. המסגור קובע את הגובה; 'מקורי' שומר על פרופורציות הצילום.">
              <div class="seg wrap">
                {(Object.keys(FRAMES) as Frame[]).map((k) => (
                  <button type="button" class={w.frame === k ? 'on' : ''} onClick={() => set('frame', k)}>{FRAMES[k].label}</button>
                ))}
              </div>
            </Field>
            {w.frame !== 'original' && (
              <Field label="פוקוס" hint="איזה חלק של התמונה נשאר כשהמסגור חותך">
                <div class="seg wrap">
                  {(Object.keys(FOCUSES) as Focus[]).map((k) => (
                    <button type="button" class={w.focus === k ? 'on' : ''} onClick={() => set('focus', k)}>{FOCUSES[k]}</button>
                  ))}
                </div>
              </Field>
            )}
          </fieldset>

          <fieldset>
            <legend>קטגוריות</legend>
            {categories.length === 0 && <p class="hint">אין קטגוריות עדיין — מוסיפים בטאב "קטגוריות".</p>}
            <div class="checks">
              {categories.map((c) => (
                <label class="check" dir="ltr">
                  <input type="checkbox" checked={w.categories.includes(c.id)}
                    onChange={(e) => set('categories', e.currentTarget.checked ? [...w.categories, c.id] : w.categories.filter((x) => x !== c.id))} />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend>פרסום</legend>
            <label class="switch">
              <input type="checkbox" checked={w.published} onChange={(e) => set('published', e.currentTarget.checked)} />
              <span>{w.published ? 'מפורסם באתר' : 'טיוטה — לא מופיע באתר'}</span>
            </label>
            <details>
              <summary>מתקדם</summary>
              <Field label="כתובת (slug)" error={errors.slug} hint="משמש בכתובת של דף העבודה. נוצר אוטומטית מהכותרת.">
                <input dir="ltr" value={w.slug} onInput={(e) => { setSlugTouched(true); set('slug', slugify(e.currentTarget.value)); }} />
              </Field>
            </details>
          </fieldset>
        </div>

        <aside class="preview">
          <p class="eyebrow">תצוגה מקדימה של הכרטיס</p>
          <article class="work-card" dir="ltr">
            <div class="work-image" style={`aspect-ratio: 300 / ${imgH}`}>
              {previewSrc && <img src={previewSrc} alt="" style={`object-position:${w.focus}`} />}
            </div>
            <div class="work-caption">
              <h3 class="t-work-title">{w.title || 'Title'}</h3>
              <p class="t-work-meta">{w.year}<br />{w.medium || 'Medium'}{w.note && <><br />{w.note}</>}</p>
            </div>
          </article>
        </aside>
      </div>
    </section>
  );
}

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: any }) {
  return (
    <label class={`field ${error ? 'invalid' : ''}`}>
      <span class="label">{label}</span>
      {children}
      {error ? <span class="error">{error}</span> : hint ? <span class="hint">{hint}</span> : null}
    </label>
  );
}

/* ============================== categories tab ============================== */

function CategoriesTab({ categories, works, refresh, notify }: TabProps) {
  const [list, setList] = useState(categories);
  const [label, setLabel] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setList(categories), [categories]);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const w of works) for (const c of w.categories) m[c] = (m[c] ?? 0) + 1;
    return m;
  }, [works]);

  async function add(e: Event) {
    e.preventDefault();
    const l = label.trim();
    if (!l) return;
    let id = slugify(l) || `cat-${Date.now().toString(36)}`;
    let n = 2;
    while (list.some((c) => c.id === id)) id = `${slugify(l)}-${n++}`;
    setBusy(true);
    const { error } = await sb.from('categories').insert({ id, label: l, sort_order: list.length + 1 });
    setBusy(false);
    if (error) return notify(explain(error), 'error');
    setLabel(''); notify('הקטגוריה נוספה. היא תופיע באתר כשתשויך לעבודה מפורסמת.'); refresh();
  }

  async function rename(c: Category, next: string) {
    const l = next.trim();
    if (!l || l === c.label) return;
    const { error } = await sb.from('categories').update({ label: l }).eq('id', c.id);
    if (error) return notify(explain(error), 'error');
    notify(SAVED); refresh();
  }

  async function remove(c: Category) {
    const n = counts[c.id] ?? 0;
    if (!confirm(n ? `"${c.label}" משויכת ל־${n} עבודות. המחיקה תסיר אותה מהן. להמשיך?` : `למחוק את "${c.label}"?`)) return;
    const { error } = await sb.from('categories').delete().eq('id', c.id);
    if (error) return notify(explain(error), 'error');
    notify('הקטגוריה נמחקה.'); refresh();
  }

  const dragId = useRef<string | null>(null);
  function onDrop(targetId: string) {
    const from = list.findIndex((c) => c.id === dragId.current);
    const to = list.findIndex((c) => c.id === targetId);
    dragId.current = null;
    if (from < 0 || to < 0 || from === to) return;
    const next = [...list];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setList(next);
    sb.rpc('reorder_categories', { ids: next.map((c) => c.id) }).then(({ error }) => {
      if (error) { notify(explain(error), 'error'); setList(categories); } else { notify('הסדר עודכן.'); refresh(); }
    });
  }

  return (
    <section>
      <div class="toolbar"><h2>קטגוריות <span class="muted">({list.length})</span></h2></div>
      <p class="hint">אלה התגיות שמופיעות כפילטרים בעמוד Works. גררי לשינוי הסדר, לחצי על שם כדי לשנות אותו. פילטר מופיע באתר רק כשיש לו לפחות עבודה מפורסמת אחת.</p>
      <ul class="rows">
        {list.map((c) => (
          <li class="row" key={c.id} draggable onDragStart={() => (dragId.current = c.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(c.id)}>
            <span class="handle" aria-hidden="true">⋮⋮</span>
            <input class="inline" dir="ltr" value={c.label}
              onBlur={(e) => rename(c, e.currentTarget.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
            <span class="muted">{counts[c.id] ?? 0} עבודות</span>
            <button class="btn danger" onClick={() => remove(c)}>מחיקה</button>
          </li>
        ))}
      </ul>
      <form class="add" onSubmit={add}>
        <input dir="ltr" placeholder="New category, e.g. Prints" value={label} onInput={(e) => setLabel(e.currentTarget.value)} />
        <button class="btn primary" disabled={busy || !label.trim()}>+ הוספה</button>
      </form>
    </section>
  );
}
