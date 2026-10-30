/* Homebrew: import / add / remove custom species, backgrounds, classes, feats, spells, items, languages.
   Stored in localStorage and merged into window.DATA before the engine runs. */
(function () {
  'use strict';
  const D = window.DATA, KEY = 'charbuilder.' + D.edition + '.homebrew', OFF = KEY + '.off';
  const TYPES = { species: 'Species', backgrounds: 'Backgrounds', classes: 'Classes', feats: 'Feats', spells: 'Spells', weapons: 'Weapons', armor: 'Armor', gear: 'Gear', tools: 'Tools', languages: 'Languages' };
  const BASE = {}; Object.keys(TYPES).forEach(t => BASE[t] = t === 'languages' ? D.languages.rare.slice() : D[t].slice());
  const A = v => Array.isArray(v) ? v : [], S = (v, n) => String(v == null ? '' : v).slice(0, n || 4000);
  const N = (v, d) => (v !== '' && v != null && Number.isFinite(+v)) ? +v : d;
  const SA = v => A(v).map(x => S(x, 200));
  const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const pick = (v, list, d) => list.includes(v) ? v : d;
  const paras = d => (typeof d === 'string' ? d.split(/\n+/) : A(d)).map(x => S(x, 3000)).filter(Boolean);
  const EFF = ['save', 'skill', 'tool', 'weapon', 'armor', 'language', 'speed', 'speedBase', 'sense', 'resist', 'hp', 'init', 'initProf', 'acBase', 'acBonus', 'atkBonus', 'ability', 'abilityCap', 'spell'];
  const KINDS = ['options', 'skills', 'expertise', 'tools', 'skilltool', 'abilitypick', 'languages', 'feat', 'spell', 'weaponMastery'];

  function effects(l) {
    return A(l).filter(e => e && EFF.includes(e.t)).map(e => {
      const o = {}; Object.keys(e).forEach(k => { const v = e[k]; if (Array.isArray(v)) o[k] = SA(v); else if (typeof v === 'number' || typeof v === 'boolean') o[k] = v; else if (typeof v === 'string') o[k] = S(v, 200); });
      if (['save', 'skill', 'tool', 'weapon', 'armor', 'language', 'resist'].includes(o.t) && !Array.isArray(o.v)) o.v = [];
      if (o.t === 'acBase' && !Array.isArray(o.abilities)) o.abilities = [];
      return o;
    });
  }
  function choices(l) {
    return A(l).filter(c => c && KINDS.includes(c.kind)).map((c, i) => {
      const o = { id: slug(c.id || 'c' + i) || 'c' + i, label: S(c.label || c.id || 'Choice', 120), kind: c.kind, count: Array.isArray(c.count) ? c.count.map(x => N(x, 0)) : N(c.count, 1) };
      ['from', 'fromSkills', 'fromTools'].forEach(k => { if (c[k]) o[k] = SA(c[k]); });
      ['cat', 'filter', 'listName', 'listFrom', 'abilityFrom', 'classKey'].forEach(k => { if (typeof c[k] === 'string') o[k] = S(c[k], 80); });
      if (c.level != null) o.level = N(c.level, 0); if (c.bonus != null) o.bonus = N(c.bonus, 1);
      if (c.kind === 'options') o.options = A(c.options).filter(x => x && x.name).map(x => ({ key: slug(x.key || x.name), name: S(x.name, 120), desc: paras(x.desc), effects: effects(x.effects) }));
      return o;
    });
  }
  function uses(u) {
    if (!u || u.max == null) return undefined;
    const m = u.max, ok = typeof m === 'string' && (m === 'prof' || /^(str|dex|con|int|wis|cha)Mod(\+1)?$/.test(m));
    return { max: Array.isArray(m) ? m.map(x => N(x, 0)) : ok ? m : N(m, 1), per: S(u.per || 'Long Rest', 40) };
  }
  function feature(f, i, lvl) {
    f = f || {}; const o = { id: slug(f.id || f.name || 'f' + i) || 'f' + i, name: S(f.name || 'Feature', 120), desc: paras(f.desc), effects: effects(f.effects), choices: choices(f.choices) };
    if (f.level != null || lvl) o.level = N(f.level, lvl || 1); if (f.hidden) o.hidden = true; if (f.firstOnly) o.firstOnly = true;
    const u = uses(f.uses); if (u) o.uses = u; return o;
  }
  const items = l => A(l).map(x => Array.isArray(x) ? [S(x[0], 100), Math.max(1, N(x[1], 1))] : [S(x, 100), 1]).filter(x => x[0]);
  const profFeature = (skills, tools) => (skills.length || tools.length) ? [{ name: 'Background Proficiencies', desc: ['Skills: ' + skills.join(', ') + (tools.length ? '. Tools: ' + tools.join(', ') + '.' : '.')], effects: effects([{ t: 'skill', v: skills }, { t: 'tool', v: tools }]), choices: [] }] : [];
  const skillKeys = D.skills.map(s => s.key), validSkills = l => SA(l).map(x => slug(x)).filter(x => skillKeys.includes(x));

  const NORM = {
    species(r) { return { name: S(r.name, 100), size: Array.isArray(r.size) ? r.size.map(x => pick(x, ['Tiny', 'Small', 'Medium', 'Large'], 'Medium')) : pick(r.size, ['Tiny', 'Small', 'Medium', 'Large'], 'Medium'), speed: N(r.speed, 30), features: A(r.features).map((f, i) => feature(f, i)) }; },
    backgrounds(r) {
      const skills = validSkills(r.skills), tools = SA(r.tools), ft = D.feats.find(f => f.key === r.feat);
      return { name: S(r.name, 100), blurb: S(r.blurb, 400), abilities: SA(r.abilities).filter(a => ABIL.includes(a)).slice(0, 3), feat: ft ? ft.key : '', featName: ft ? ft.name : '',
        features: A(r.features).map((f, i) => feature(f, i)).concat(A(r.features).length ? [] : profFeature(skills, tools).map((f, i) => feature(f, i))), equipA: items(r.equipA || r.equip), goldA: N(r.goldA, 0), goldB: N(r.goldB, 50) };
    },
    classes(r) {
      const p = r.profs || {}, mp = r.multiProfs || {}, feats = A(r.features).map((f, i) => feature(f, i, 1));
      const sk = r.skills && validSkills(r.skills.from); let skillsLine = S(r.skillsLine, 300);
      if (sk && sk.length) { const n = Math.min(N(r.skills.count, 2), sk.length); feats.unshift({ id: 'class-skills', name: 'Skill Proficiencies', level: 1, firstOnly: true, hidden: true, desc: [], effects: [], choices: [{ id: 'skills', label: 'Class skill proficiencies', kind: 'skills', count: n, from: sk }] }); skillsLine = 'Choose ' + n + ': ' + sk.map(k => D.skills.find(s => s.key === k).name).join(', '); }
      const o = { name: S(r.name, 100), hitDie: pick(N(r.hitDie, 8), [6, 8, 10, 12], 8), primary: pick(r.primary, ABIL, 'str'),
        profs: { saves: SA(p.saves).filter(a => ABIL.includes(a)).slice(0, 2), armor: SA(p.armor).filter(a => ['light', 'medium', 'heavy', 'shield'].includes(a)), weapons: SA(p.weapons).filter(a => ['simple', 'martial'].includes(a)) },
        multiProfs: { armor: SA(mp.armor).filter(a => ['light', 'medium', 'heavy', 'shield'].includes(a)), weapons: SA(mp.weapons).filter(a => ['simple', 'martial'].includes(a)) },
        skillsLine, equip: { A: items(A(r.equip && r.equip.A)), goldA: N(r.equip && r.equip.goldA, 0), goldB: N(r.equip && r.equip.goldB, 100) },
        asiLevels: A(r.asiLevels).length ? A(r.asiLevels).map(x => N(x, 4)) : [4, 8, 12, 16, 19], features: feats,
        subclassLevel: N(r.subclassLevel, 3), subclasses: A(r.subclasses).filter(s => s && s.name).map((s, i) => ({ key: slug(s.key || s.name).replace(/^hb-/, ''), name: S(s.name, 100), features: A(s.features).map((f, j) => feature(f, j, N(r.subclassLevel, 3))) })) };
      if (r.spell && r.spell.caster) {
        const s = r.spell, c = N(Array.isArray(s.cantrips) ? 0 : s.cantrips, 0);
        o.spell = { ability: pick(s.ability, ABIL, 'int'), caster: pick(s.caster, ['full', 'half', 'pact'], 'full'), kind: pick(s.kind, ['prepared', 'known', 'book'], 'prepared'),
          cantrips: Array.isArray(s.cantrips) && s.cantrips.length === 20 ? s.cantrips.map(x => N(x, 0)) : Array.from({ length: 20 }, (_, i) => c ? c + (i >= 3 ? 1 : 0) + (i >= 9 ? 1 : 0) : 0),
          preparedFormula: pick(s.preparedFormula, ['mod+level', 'mod+halflevel'], 'mod+level'), list: S(s.list || r.name, 100) };
        if (Array.isArray(s.known) && s.known.length === 20) o.spell.known = s.known.map(x => N(x, 0));
        if (o.spell.kind === 'book') o.spell.book = { start: N(s.book && s.book.start, 6), perLevel: N(s.book && s.book.perLevel, 2) };
      }
      return o;
    },
    feats(r) { const o = { name: S(r.name, 100), category: pick(r.category, ['Origin', 'General', 'Fighting Style', 'Epic Boon'], 'General'), prereq: S(r.prereq, 100), desc: paras(r.desc), effects: effects(r.effects), choices: choices(r.choices) };
      const asi = SA(r.asi).filter(a => ABIL.includes(a)); if (asi.length) { o.asi = asi; o.asiAmount = N(r.asiAmount, 1); } const u = uses(r.uses); if (u) o.uses = u; return o; },
    spells(r) { const c = r.components || {}, ct = S(r.castingTime || 'Action', 60);
      return { name: S(r.name, 100), level: Math.min(9, Math.max(0, N(r.level, 1))), school: pick(r.school, D.schools, 'Evocation'), classes: SA(r.classes), castingTime: ct, castShort: ct, ritual: !!r.ritual, range: S(r.range || 'Self', 60),
        components: typeof c === 'string' ? S(c, 200) : { v: !!c.v, s: !!c.s, m: !!c.m, material: S(c.material, 200) }, duration: S(r.duration || 'Instantaneous', 60), concentration: !!r.concentration, desc: paras(r.desc) }; },
    weapons(r) { const props = S(r.props, 200); return { name: S(r.name, 100), category: pick(r.category, ['simple', 'martial'], 'simple'), kind: pick(r.kind, ['melee', 'ranged'], 'melee'), damage: S(r.damage || '1d6', 20), damageType: S(r.damageType || 'Slashing', 40), props, propList: A(r.propList).length ? SA(r.propList) : props.split(',').map(x => x.trim()).filter(Boolean), mastery: D.mastery[r.mastery] ? r.mastery : '', weight: S(r.weight, 20), cost: S(r.cost, 30) }; },
    armor(r) { return { name: S(r.name, 100), category: pick(r.category, ['light', 'medium', 'heavy', 'shield'], 'light'), ac: N(r.ac, 11), dex: pick(r.dex, ['full', 'max2', 'none'], 'none'), strReq: N(r.strReq, null), stealthDis: !!r.stealthDis, weight: S(r.weight, 20), cost: S(r.cost, 30) }; },
    gear(r) { return { name: S(r.name, 100), weight: S(r.weight, 20), cost: S(r.cost, 30) }; },
    tools(r) { return { name: S(r.name, 100), cat: S(r.cat || 'Other Tools', 60), cost: S(r.cost, 30) }; },
  };
  function norm(type, raw, taken) {
    if (type === 'languages') { const n = S(raw && raw.name || raw, 60).trim(); if (!n) throw new Error('A language needs a name.'); return n; }
    if (!raw || typeof raw !== 'object' || !S(raw.name).trim()) throw new Error('Every entry needs a "name".');
    const o = NORM[type](raw); let k = 'hb-' + (slug(raw.key || raw.name).replace(/^hb-/, '') || 'entry'), n = 2, base = k;
    while (taken.has(k)) k = base + '-' + n++; o.key = k; o.custom = true; return o;
  }
  let store = (() => { try { const o = JSON.parse(localStorage.getItem(KEY) || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } })();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { return false; } apply(); return true; };
  const off = () => localStorage.getItem(OFF) === '1';
  function apply() {
    Object.keys(TYPES).forEach(t => {
      const l = off() ? [] : A(store[t]);
      if (t === 'languages') { D.languages.rare = BASE.languages.concat(l.filter(x => !BASE.languages.includes(x) && !D.languages.standard.includes(x))); return; }
      const arr = BASE[t].concat(l); if (['species', 'backgrounds', 'classes', 'feats', 'spells'].includes(t)) arr.sort((a, b) => a.name.localeCompare(b.name)); D[t] = arr;
    });
  }
  function add(type, raw) {
    const list = A(store[type]), keyOf = x => x.key || x;
    if (type !== 'languages') { const taken = new Set(BASE[type].map(x => x.key).concat(list.filter(x => raw.key !== x.key).map(x => x.key))); const e = norm(type, raw, taken); const i = list.findIndex(x => x.key === e.key); if (i >= 0) list[i] = e; else list.push(e); }
    else { const e = norm(type, raw); if (!list.includes(e)) list.push(e); }
    store[type] = list; return keyOf;
  }
  function importPack(p) {
    const res = { added: 0, errors: [] };
    if (!p || typeof p !== 'object') throw new Error('Not a homebrew pack.');
    Object.keys(TYPES).forEach(t => A(p[t]).forEach(r => { try { add(t, r); res.added++; } catch (e) { res.errors.push(TYPES[t] + ': ' + e.message); } }));
    if (!save()) res.errors.push('Could not save (storage full or disabled).');
    return res;
  }
  const TPL = {
    species: { name: 'Stoneborn', size: 'Medium', speed: 30, features: [{ name: 'Darkvision', desc: 'You have Darkvision with a range of 60 feet.', effects: [{ t: 'sense', name: 'Darkvision', range: 60 }] }, { name: 'Stone Endurance', desc: 'Reduce damage you take once per Long Rest.', uses: { max: 'prof', per: 'Long Rest' } }] },
    backgrounds: { name: 'Lighthouse Keeper', blurb: 'You kept the lamps lit for passing ships.', abilities: ['con', 'wis', 'cha'], feat: 'alert', skills: ['perception', 'survival'], tools: ['Navigator’s Tools'], equip: [['Lantern', 1], ['Rope', 1]], goldA: 10, goldB: 50 },
    classes: { name: 'Wayfinder', hitDie: 8, primary: 'dex', profs: { saves: ['dex', 'wis'], armor: ['light'], weapons: ['simple', 'martial'] }, skills: { count: 2, from: ['acrobatics', 'nature', 'perception', 'stealth', 'survival'] }, equip: { A: [['Shortbow', 1], ['Arrow', 20]], goldA: 10, goldB: 100 }, subclassLevel: 3, features: [{ name: 'Trailcraft', level: 1, desc: 'Describe the feature here.' }], subclasses: [{ name: 'Pathfinder', features: [{ name: 'Keen Trail', level: 3, desc: 'Describe it here.' }] }], spell: { ability: 'wis', caster: 'half', kind: 'prepared', cantrips: 0, preparedFormula: 'mod+halflevel', list: 'Ranger' } },
    feats: { name: 'Iron Will', category: 'General', desc: 'You gain the following benefits.', asi: ['wis', 'con'], effects: [{ t: 'save', v: ['wis'] }] },
    spells: { name: 'Ember Ward', level: 1, school: 'Abjuration', classes: ['Wizard', 'Cleric'], castingTime: 'Action', range: 'Self', components: { v: true, s: true }, duration: '1 hour', concentration: false, ritual: false, desc: 'Describe the spell here.' },
    weapons: { name: 'Glaive-Axe', category: 'martial', kind: 'melee', damage: '1d10', damageType: 'Slashing', props: 'Heavy, Reach, Two-Handed', mastery: 'Cleave', weight: '8', cost: '30 GP' },
    armor: { name: 'Scale Vest', category: 'light', ac: 12, dex: 'full', stealthDis: false, weight: '6', cost: '40 GP' },
    gear: { name: 'Signal Whistle', weight: '—', cost: '5 SP' }, tools: { name: 'Cartographer’s Tools', cat: 'Artisan’s Tools', cost: '15 GP' }, languages: { name: 'Ancient Dwarvish' },
  };
  const pack = () => Object.assign({ format: 'charbuilder-homebrew', edition: D.edition }, store);
  const dl = (name, obj) => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };

  let ctx = null, notes = [];
  function view(app, esc, toast) {
    ctx = { app, esc, toast };
    const total = Object.keys(TYPES).reduce((n, t) => n + A(store[t]).length, 0);
    app.innerHTML = `<div class="wrap prose"><h1>Homebrew</h1>
      <p>Add your own species, backgrounds, classes, feats, spells, weapons, armor, gear, tools and languages. Upload a pack (a JSON file), or paste a single entry below. Everything stays on this device and shows up in the builder and the Spells and Equipment browsers.</p>
      <div class="card"><h3>Upload a pack</h3><div class="row"><label class="btn pri">Choose JSON file<input type="file" id="hbfile" accept=".json,application/json" hidden></label>
        <button class="btn" data-hb="tpl-pack">Download example pack</button><button class="btn" data-hb="export" ${total ? '' : 'disabled'}>Export my homebrew</button></div>
        ${notes.length ? `<ul class="errs">${notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}</div>
      <div class="card"><h3>Add one entry</h3><div class="row"><select id="hbtype">${Object.keys(TYPES).map(t => `<option value="${t}">${TYPES[t]}</option>`).join('')}</select><button class="btn" data-hb="tpl">Insert example</button></div>
        <label class="fld"><span>Entry as JSON. Using an existing homebrew key replaces that entry.</span><textarea id="hbjson" spellcheck="false"></textarea></label><button class="btn pri" data-hb="add">Add entry</button></div>
      <div class="card"><h3>Your homebrew</h3><label class="opt"><input type="checkbox" data-hb="toggle" ${off() ? '' : 'checked'}> Homebrew enabled</label>
        ${total ? Object.keys(TYPES).filter(t => A(store[t]).length).map(t => `<h4>${TYPES[t]}</h4>${store[t].map(e => `<div class="line"><span>${esc(e.name || e)}</span><button class="btn sm danger" data-hb="rm" data-t="${t}" data-k="${esc(e.key || e)}">Remove</button></div>`).join('')}`).join('') + '<p><button class="btn sm danger" data-hb="clear">Remove all homebrew</button></p>' : '<p class="muted">Nothing yet.</p>'}</div></div>`;
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-hb]'); if (!t || t.tagName === 'INPUT') return; const a = t.dataset.hb, $ = s => document.querySelector(s);
    if (a === 'off') { localStorage.setItem(OFF, '1'); location.hash = '#/'; location.reload(); return; }
    if (!ctx) return; const again = () => view(ctx.app, ctx.esc, ctx.toast);
    if (a === 'tpl') { const ty = $('#hbtype').value; $('#hbjson').value = JSON.stringify(TPL[ty], null, 2); }
    else if (a === 'tpl-pack') { const p = { format: 'charbuilder-homebrew', edition: D.edition }; Object.keys(TPL).forEach(k => p[k] = [TPL[k]]); dl('homebrew-example-pack.json', p); }
    else if (a === 'export') dl('my-homebrew.json', pack());
    else if (a === 'add') { try { const r = JSON.parse($('#hbjson').value); add($('#hbtype').value, r); if (!save()) throw new Error('Could not save (storage full or disabled).'); notes = []; ctx.toast('Entry added'); again(); } catch (err) { ctx.toast(err.message.length > 90 ? 'That isn’t valid JSON.' : err.message); } }
    else if (a === 'rm') { store[t.dataset.t] = A(store[t.dataset.t]).filter(x => (x.key || x) !== t.dataset.k); save(); again(); }
    else if (a === 'clear') { if (confirm('Remove all homebrew content? Characters using it will lose those choices.')) { store = {}; save(); again(); } }
  });
  document.addEventListener('change', e => {
    const t = e.target; if (!ctx) return;
    if (t.id === 'hbfile' && t.files[0]) { const rd = new FileReader(); rd.onload = () => { try { const r = importPack(JSON.parse(rd.result)); notes = r.errors; ctx.toast('Imported ' + r.added + ' entr' + (r.added === 1 ? 'y' : 'ies')); } catch (err) { notes = [err.message]; } view(ctx.app, ctx.esc, ctx.toast); }; rd.readAsText(t.files[0]); }
    else if (t.dataset.hb === 'toggle') { localStorage.setItem(OFF, t.checked ? '0' : '1'); apply(); view(ctx.app, ctx.esc, ctx.toast); }
  });
  apply();
  window.Homebrew = { view, importPack, apply };
})();
