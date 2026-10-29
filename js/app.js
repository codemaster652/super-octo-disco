/* Character builder UI — plain JS, no dependencies. */
(function () {
  'use strict';
  const E = window.Engine, D = window.DATA, ED = D.edition;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const by = E.byKey, signed = E.signed;
  const ABIL = E.ABIL;
  const abName = k => by(D.abilities, k).name, abAbbr = k => by(D.abilities, k).abbr;
  const skName = k => (by(D.skills, k) || {}).name || k;
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const app = $('#app');
  const KEY = 'charbuilder.' + ED + '.chars';

  /* ---------- text markup: **bold**, _italic_, "|" table-ish rows, • bullets ---------- */
  function inline(s) {
    return esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[\s(])_(.+?)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  }
  function md(paras) {
    if (!paras) return '';
    if (typeof paras === 'string') paras = [paras];
    let out = '', rows = [];
    const flush = () => { if (rows.length) { out += '<div class="trows">' + rows.map(r => '<div>' + inline(r) + '</div>').join('') + '</div>'; rows = []; } };
    paras.forEach(p => {
      if (p.charAt(0) === '|') { rows.push(p.slice(1)); return; }
      flush();
      if (p.charAt(0) === '•') out += '<ul class="bul"><li>' + inline(p.replace(/^•\s*/, '')) + '</li></ul>';
      else out += '<p>' + inline(p) + '</p>';
    });
    flush(); return out.replace(/<\/ul><ul class="bul">/g, '');
  }

  /* ---------- storage ---------- */
  const Store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } },
    write(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { toast('Could not save (storage full or disabled).'); } },
    get(id) { return this.all().find(c => c.id === id); },
    save(c) { c.updated = Date.now(); const l = this.all(); const i = l.findIndex(x => x.id === c.id); if (i >= 0) l[i] = c; else l.push(c); this.write(l); },
    remove(id) { this.write(this.all().filter(c => c.id !== id)); },
  };
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

  /* ---------- state ---------- */
  let C = null, R = null, TAB = 'origin';
  function load(id) { C = Store.get(id); if (C) { C.choices = C.choices || {}; C.asi = C.asi || {}; C.spells = C.spells || {}; C.equipment = C.equipment || { items: [], cp: 0, sp: 0, gp: 0 }; C.play = C.play || { used: {}, slots: {}, hp: null, temp: 0 }; } return C; }
  function commit(rerender) {
    R = E.compute(C); Store.save(C);
    if (rerender !== false) { const y = window.scrollY; render(); window.scrollTo(0, y); }
    else renderSummary();
  }

  /* ---------- router ---------- */
  function route() {
    const h = location.hash.replace(/^#\/?/, '').split('/');
    $$('.nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#/' + (h[0] || '')));
    const v = h[0] || '';
    if (v === 'new') { const c = E.newCharacter(); c.play = { used: {}, slots: {}, hp: null, temp: 0 }; Store.save(c); location.hash = '#/edit/' + c.id + '/origin'; return; }
    if (v === 'edit' && load(h[1])) { TAB = h[2] || 'origin'; R = E.compute(C); render(); window.scrollTo(0, 0); return; }
    if (v === 'sheet' && load(h[1])) { R = E.compute(C); renderSheet(); window.scrollTo(0, 0); return; }
    if (v === 'spells') return viewSpells();
    if (v === 'equipment') return viewEquipment(h[1] || 'weapons');
    if (v === 'about') return viewAbout();
    viewHome();
  }
  window.addEventListener('hashchange', route);

  /* ---------- home ---------- */
  function summaryLine(c) {
    const sp = by(D.species, c.species), bg = by(D.backgrounds, c.background);
    const cls = c.classes.map(k => ((by(D.classes, k.key) || {}).name || '?') + ' ' + k.level).join(' / ');
    return [sp && sp.name, bg && bg.name, cls].filter(Boolean).join(' · ') || 'Not started';
  }
  function viewHome() {
    const list = Store.all().sort((a, b) => b.updated - a.updated);
    app.innerHTML = `<div class="wrap"><div class="hero"><h1>${esc(D.title)}</h1><p>${esc(D.short)}. Build characters step by step, keep them in your browser, and print a sheet. Nothing leaves your device.</p>
      <div class="row"><a class="btn pri" href="#/new">＋ New character</a><label class="btn">Import JSON<input type="file" id="imp" accept=".json,application/json" hidden></label></div></div>
      <h2>Your characters</h2>${list.length ? '<div class="cards">' + list.map(c => { const r = E.compute(c); return `<div class="card char"><div class="ct"><strong>${esc(c.name || 'Unnamed character')}</strong><span class="muted">${esc(summaryLine(c))}</span></div>
        <div class="mini"><span>HP <b>${r.hp}</b></span><span>AC <b>${r.ac}</b></span><span>Lvl <b>${r.total}</b></span></div>
        <div class="row"><a class="btn sm pri" href="#/edit/${c.id}/origin">Edit</a><a class="btn sm" href="#/sheet/${c.id}">Sheet</a><button class="btn sm" data-act="dup" data-id="${c.id}">Duplicate</button><button class="btn sm" data-act="export" data-id="${c.id}">Export</button><button class="btn sm danger" data-act="del" data-id="${c.id}">Delete</button></div></div>`; }).join('') + '</div>' : '<p class="muted">No characters yet. Create one to get started.</p>'}
      ${list.length ? '<p><button class="btn sm" data-act="exportall">Export all characters</button></p>' : ''}</div>`;
  }

  /* ---------- generic choice rendering ---------- */
  function listFor(ev) {
    const ch = ev.ch;
    let name = ch.listName;
    if (!name && ch.listFrom) { const v = E.firstSel(C, ev.fid + '#' + ch.listFrom); name = v ? cap(v) : null; }
    return name;
  }
  function choiceControl(ev) {
    const ch = ev.ch, cid = ev.cid, need = E.needCount(ch, C), sel = ev.sel;
    const box = (v, label, extra, dis) => `<label class="opt${dis ? ' dis' : ''}"><input type="checkbox" data-cid="${esc(cid)}" data-v="${esc(v)}" data-lim="${need}" ${sel.includes(v) ? 'checked' : ''}> <span>${label}${extra ? ' <small class="muted">' + extra + '</small>' : ''}</span></label>`;
    let body = '';
    if (ch.kind === 'options') {
      if (need <= 1) {
        body = `<select data-cid="${esc(cid)}"><option value="">— choose —</option>${ch.options.map(o => `<option value="${esc(o.key)}" ${sel[0] === o.key ? 'selected' : ''}>${esc(o.name)}</option>`).join('')}</select>`;
        const o = ch.options.find(x => x.key === sel[0]); if (o && o.desc) body += `<div class="optdesc">${md(o.desc)}</div>`;
      } else {
        body = '<div class="optgrid">' + ch.options.map(o => `<div class="optrow">${box(o.key, esc(o.name))}${o.desc ? `<details><summary>info</summary>${md(o.desc)}</details>` : ''}</div>`).join('') + '</div>';
      }
    } else if (ch.kind === 'skills') {
      const from = ch.from || D.skills.map(s => s.key);
      body = '<div class="optgrid cols">' + from.map(k => box(k, esc(skName(k)), abAbbr(by(D.skills, k).ability), R.prof.skills[k] && !sel.includes(k))).join('') + '</div>';
    } else if (ch.kind === 'expertise') {
      const base = Object.keys(R.prof.skills).filter(k => !ch.from || ch.from.includes(k));
      body = base.length ? '<div class="optgrid cols">' + base.map(k => box(k, esc(skName(k)))).join('') + '</div>' : '<p class="muted">Choose your skill proficiencies first.</p>';
    } else if (ch.kind === 'tools') {
      const from = ch.from || [];
      if (need <= 1) body = `<select data-cid="${esc(cid)}"><option value="">— choose —</option>${from.map(t => `<option ${sel[0] === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
      else body = '<div class="optgrid cols">' + from.map(t => box(t, esc(t))).join('') + '</div>';
    } else if (ch.kind === 'skilltool') {
      body = '<div class="optgrid cols">' + (ch.fromSkills || []).map(k => box(k, esc(skName(k)), 'skill')).join('') + (ch.fromTools || []).map(t => box(t, esc(t), 'tool')).join('') + '</div>';
    } else if (ch.kind === 'abilitypick') {
      body = '<div class="optgrid cols">' + (ch.from || E.ABIL).map(k => box(k, esc(abName(k)), '+' + (ch.bonus || 1))).join('') + '</div>';
    } else if (ch.kind === 'languages') {
      body = '<div class="optgrid cols">' + (ch.from || []).map(l => box(l, esc(l))).join('') + '</div>';
    } else if (ch.kind === 'feat') {
      const feats = D.feats.filter(f => f.category === ch.cat);
      body = `<select data-cid="${esc(cid)}"><option value="">— choose a ${esc(ch.cat)} feat —</option>${feats.map(f => `<option value="${esc(f.key)}" ${sel[0] === f.key ? 'selected' : ''}>${esc(f.name)}${f.prereq ? ' (' + esc(f.prereq) + ')' : ''}</option>`).join('')}</select>`;
      const f = by(D.feats, sel[0]); if (f) body += `<div class="optdesc">${md(f.desc)}</div>`;
    } else if (ch.kind === 'spell') {
      const ln = listFor(ev);
      if (!ln) body = '<p class="muted">Choose the spell list first.</p>';
      else {
        const sp = D.spells.filter(s => s.level === ch.level && s.classes.includes(ln));
        body = '<div class="optgrid cols">' + sp.map(s => box(s.key, esc(s.name), s.school)).join('') + '</div>';
      }
    } else if (ch.kind === 'weaponMastery') {
      const ws = D.weapons.filter(w => ch.filter === 'melee' ? w.kind === 'melee' : ch.filter === 'finesse-light' ? w.propList.some(p => /^(Finesse|Light)/.test(p)) : true).filter(w => w.mastery);
      body = '<div class="optgrid cols">' + ws.map(w => box(w.key, esc(w.name), w.mastery)).join('') + '</div>';
    }
    const done = sel.length >= need;
    return `<div class="choice ${done ? 'done' : 'todo'}"><div class="chead"><strong>${esc(ch.label)}</strong>${need > 1 ? `<span class="count">${sel.length}/${need}</span>` : ''}<span class="src muted">${esc(ev.srcLabel)}</span></div>${body}</div>`;
  }
  function choicesFor(pred) { return R.choiceList.filter(pred).map(choiceControl).join(''); }

  /* ---------- builder shell ---------- */
  const TABS = [['origin', 'Origin'], ['class', 'Class'], ['abilities', 'Abilities'], ['spells', 'Spells'], ['equipment', 'Equipment'], ['details', 'Details']];
  function render() {
    const body = { origin: tabOrigin, class: tabClass, abilities: tabAbilities, spells: tabSpells, equipment: tabEquipment, details: tabDetails }[TAB] || tabOrigin;
    app.innerHTML = `<div class="wrap builder"><div class="main">
      <div class="tabs">${TABS.map(([k, n]) => `<a href="#/edit/${C.id}/${k}" class="${TAB === k ? 'on' : ''}">${n}${R.choicesNeeded.some(x => x.section === k) ? ' <i class="dot"></i>' : ''}</a>`).join('')}</div>
      ${body()}</div><aside class="side" id="summary"></aside></div>`;
    renderSummary();
  }
  function renderSummary() {
    const el = $('#summary'); if (!el) return;
    const sp = by(D.species, C.species), bg = by(D.backgrounds, C.background);
    el.innerHTML = `<div class="card">
      <input class="nameinput" id="cname" placeholder="Character name" value="${esc(C.name)}">
      <div class="muted">${esc(summaryLine(C))}</div>
      <div class="stats"><div><b>${R.hp}</b><span>HP</span></div><div><b>${R.ac}</b><span>AC</span></div><div><b>${signed(R.init)}</b><span>Init</span></div><div><b>${R.speed}</b><span>Speed</span></div><div><b>${signed(R.pb)}</b><span>Prof</span></div></div>
      <div class="abil">${ABIL.map(a => `<div><span>${abAbbr(a)}</span><b>${R.scores[a]}</b><small>${signed(R.mods[a])}</small></div>`).join('')}</div>
      <div class="row"><a class="btn pri sm" href="#/sheet/${C.id}">View sheet</a><button class="btn sm" data-act="export" data-id="${C.id}">Export</button></div></div>
      ${R.choicesNeeded.length ? `<div class="card todo"><h4>Still to do</h4><ul>${R.choicesNeeded.map(x => `<li>${x.section ? `<a href="#/edit/${C.id}/${x.section}">${esc(x.label)}</a>` : esc(x.label)}</li>`).join('')}</ul></div>` : '<div class="card ok"><h4>Looks complete ✔</h4></div>'}
      ${R.warnings.length ? `<div class="card warn"><h4>Heads up</h4><ul>${R.warnings.map(w => `<li>${esc(w)}</li>`).join('')}</ul></div>` : ''}`;
  }

  /* ---------- ORIGIN ---------- */
  function featureList(feats) {
    return feats.filter(f => !f.hidden).map(f => `<details class="feat"><summary><strong>${esc(f.name)}</strong>${f.level > 1 ? `<span class="lvl">Lv ${f.level}</span>` : ''}</summary>${md(f.desc)}</details>`).join('');
  }
  function tabOrigin() {
    const sp = by(D.species, C.species), bg = by(D.backgrounds, C.background);
    const sub = sp && sp.subraces;
    const origChoices = ev => ev.ctx && ev.ctx.src && (ev.ctx.src.kind === 'species' || ev.ctx.src.kind === 'background');
    let h = `<div class="card"><h3>Species</h3><select data-act="species"><option value="">— choose a species —</option>${D.species.map(s => `<option value="${s.key}" ${C.species === s.key ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>`;
    if (sp) {
      h += `<p class="muted">Size: ${esc([].concat(sp.size).join(' or '))} · Speed: ${sp.speed} ft.${sp.ability ? ' · ' + esc(sp.ability) : ''}</p>`;
      if (Array.isArray(sp.size)) h += `<label class="inl">Size <select data-act="size">${sp.size.map(s => `<option ${C.sizeChoice === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`;
      if (sub) h += `<label class="inl">${esc(sp.subLabel || 'Subrace')} <select data-cid="species:${sp.key}:sub"><option value="">— choose —</option>${sub.map(s => `<option value="${s.key}" ${E.firstSel(C, 'species:' + sp.key + ':sub') === s.key ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>`;
      const sources = E.collectSources(C).filter(s => s.kind === 'species');
      h += sources.map(s => featureList(s.features.map(f => Object.assign({}, f, { level: f.level })))).join('');
      h += choicesFor(ev => ev.ctx.src.kind === 'species');
    }
    h += '</div>';
    h += `<div class="card"><h3>Background</h3><select data-act="background"><option value="">— choose a background —</option>${D.backgrounds.map(b => `<option value="${b.key}" ${C.background === b.key ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>`;
    if (bg) {
      if (bg.blurb) h += `<p>${esc(bg.blurb)}</p>`;
      if (D.rules.asiFrom === 'background') {
        const b = C.bgAsi || { mode: 'twoone' };
        h += `<div class="choice ${R.choicesNeeded.some(x => x.label.startsWith('Background')) ? 'todo' : 'done'}"><div class="chead"><strong>Ability score increases</strong><span class="src muted">${bg.abilities.map(abName).join(', ')}</span></div>
          <label class="opt"><input type="radio" name="bgmode" data-act="bgmode" value="twoone" ${b.mode === 'twoone' ? 'checked' : ''}> +2 to one, +1 to another</label>
          <label class="opt"><input type="radio" name="bgmode" data-act="bgmode" value="oneoneone" ${b.mode === 'oneoneone' ? 'checked' : ''}> +1 to all three</label>
          ${b.mode === 'twoone' ? `<div class="row"><label class="inl">+2 <select data-act="bgplus2"><option value="">—</option>${bg.abilities.map(a => `<option value="${a}" ${b.plus2 === a ? 'selected' : ''}>${abName(a)}</option>`).join('')}</select></label>
          <label class="inl">+1 <select data-act="bgplus1"><option value="">—</option>${bg.abilities.filter(a => a !== b.plus2).map(a => `<option value="${a}" ${b.plus1 === a ? 'selected' : ''}>${abName(a)}</option>`).join('')}</select></label></div>` : ''}</div>`;
        const ft = by(D.feats, bg.feat); if (ft) h += `<details class="feat" open><summary><strong>Origin feat: ${esc(ft.name)}</strong></summary>${md(ft.desc)}</details>`;
      }
      h += featureList(bg.features);
      h += choicesFor(ev => ev.ctx.src.kind === 'background');
    }
    h += '</div>';
    if (D.rules.languageChoice) {
      const ln = E.selectionOf(C, 'origin#languages');
      h += `<div class="card"><h3>Languages</h3><p class="muted">You know Common plus ${D.rules.languageChoice} more of your choice.</p><div class="optgrid cols">${D.languages.standard.concat(D.languages.rare).map(l => `<label class="opt"><input type="checkbox" data-cid="origin#languages" data-v="${esc(l)}" data-lim="${D.rules.languageChoice}" ${ln.includes(l) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>`;
    }
    return h;
  }

  /* ---------- CLASS ---------- */
  function tabClass() {
    const total = E.totalLevel(C);
    let h = '';
    C.classes.forEach((k, idx) => {
      const cl = by(D.classes, k.key); if (!cl) return;
      const sc = by(cl.subclasses, k.subclass);
      const slots = E.asiSlots(C).filter(s => s.classKey === cl.key);
      h += `<div class="card"><div class="row between"><h3>${esc(cl.name)}${idx === 0 ? ' <small class="muted">(starting class)</small>' : ''}</h3><button class="btn sm danger" data-act="rmclass" data-i="${idx}">Remove</button></div>
        <div class="row"><label class="inl">Class <select data-act="classkey" data-i="${idx}">${D.classes.map(c2 => `<option value="${c2.key}" ${c2.key === cl.key ? 'selected' : ''}>${esc(c2.name)}</option>`).join('')}</select></label>
        <label class="inl">Level <input type="number" min="1" max="${20 - total + k.level}" value="${k.level}" data-act="classlevel" data-i="${idx}" class="num"></label>
        ${k.level >= cl.subclassLevel ? `<label class="inl">Subclass <select data-act="subclass" data-i="${idx}"><option value="">— choose —</option>${cl.subclasses.map(s => `<option value="${s.key}" ${k.subclass === s.key ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>` : `<span class="muted">Subclass at level ${cl.subclassLevel}</span>`}</div>
        <p class="muted">Hit Die d${cl.hitDie} · Saves ${cl.profs.saves.map(abAbbr).join(', ')} · ${idx === 0 ? 'Armor: ' + (cl.profs.armor.length ? cl.profs.armor.join(', ') : 'none') + ' · Weapons: ' + cl.profs.weapons.join(', ').replace(/martial:light/, 'Martial (Light)').replace(/martial:finesse-light/, 'Martial (Finesse/Light)') + (cl.skillsLine ? ' · Skills: ' + esc(cl.skillsLine) : '') : 'Multiclass: only the multiclass proficiencies apply'}</p>`;
      h += choicesFor(ev => ev.ctx && ev.ctx.src && ev.ctx.src.classKey === cl.key && ev.ctx.src.kind !== 'ignore' && !ev.srcId.includes('@asi:'));
      slots.forEach(sl => {
        const v = C.asi[sl.id] || {};
        const cid = 'asi:' + sl.id;
        const feats = D.feats.filter(f => sl.boon ? f.category === 'Epic Boon' : (f.category === 'General' || f.category === 'Origin' && false));
        h += `<div class="choice ${(v.type === 'asi' && v.a) || (v.type === 'feat' && v.feat) ? 'done' : 'todo'}"><div class="chead"><strong>${sl.boon ? 'Epic Boon' : 'Ability Score Improvement'} — level ${sl.level}</strong></div>
          ${sl.boon ? '' : `<label class="opt"><input type="radio" name="asit-${sl.id}" data-act="asitype" data-id="${sl.id}" value="asi" ${v.type !== 'feat' ? 'checked' : ''}> Increase ability scores</label>
          <label class="opt"><input type="radio" name="asit-${sl.id}" data-act="asitype" data-id="${sl.id}" value="feat" ${v.type === 'feat' ? 'checked' : ''}> Take a feat</label>`}
          ${v.type !== 'feat' && !sl.boon ? `<div class="row"><label class="inl">+1 <select data-act="asia" data-id="${sl.id}"><option value="">—</option>${ABIL.map(a => `<option value="${a}" ${v.a === a ? 'selected' : ''}>${abName(a)}</option>`).join('')}</select></label>
          <label class="inl">+1 <select data-act="asib" data-id="${sl.id}"><option value="">—</option>${ABIL.map(a => `<option value="${a}" ${v.b === a ? 'selected' : ''}>${abName(a)}</option>`).join('')}</select></label><span class="muted">Pick the same ability twice for +2.</span></div>` : `
          <select data-act="asifeat" data-id="${sl.id}"><option value="">— choose a feat —</option>${(sl.boon ? D.feats.filter(f => f.category === 'Epic Boon') : D.feats.filter(f => f.category === 'General')).map(f => `<option value="${f.key}" ${v.feat === f.key ? 'selected' : ''}>${esc(f.name)}${f.prereq ? ' (' + esc(f.prereq) + ')' : ''}</option>`).join('')}</select>
          ${v.feat ? (by(D.feats, v.feat).asi ? `<label class="inl">Increase <select data-cid="asi:${sl.id}#abil">${by(D.feats, v.feat).asi.map(a => `<option value="${a}" ${E.firstSel(C, 'asi:' + sl.id + '#abil') === a ? 'selected' : ''}>${abName(a)}</option>`).join('')}</select></label>` : '') + `<div class="optdesc">${md(by(D.feats, v.feat).desc)}</div>` : ''}`}
          ${v.type === 'feat' && v.feat ? choicesFor(ev => ev.srcId.includes('@asi:' + sl.id)) : ''}</div>`;
      });
      // hit points
      h += `<details><summary>Features (${R.features.filter(f => f.srcId === 'class:' + cl.key && !f.hidden).length})</summary>${featureList(E.collectSources(C).filter(s => s.classKey === cl.key).map(s => s.features).reduce((a, b) => a.concat(b), []))}</details></div>`;
    });
    const avail = D.classes;
    h += `<div class="card"><h3>${C.classes.length ? 'Multiclass' : 'Choose a class'}</h3>${total >= 20 ? '<p class="muted">You are at level 20.</p>' : `<div class="row"><select id="newclass">${avail.filter(c2 => !C.classes.some(k => k.key === c2.key)).map(c2 => `<option value="${c2.key}">${esc(c2.name)}</option>`).join('')}</select><button class="btn pri" data-act="addclass">Add class</button></div>${C.classes.length ? '<p class="muted">Multiclassing has ability-score prerequisites at the table; this builder doesn’t enforce them.</p>' : ''}`}</div>`;
    if (C.classes.length) {
      h += `<div class="card"><h3>Hit Points</h3><p>Maximum: <b>${R.hp}</b> — Hit Dice: ${Object.keys(R.hitDice).map(d2 => R.hitDice[d2] + 'd' + d2).join(' + ')}. Level 1 takes the maximum; later levels use the average unless you roll.</p>
        <div class="row"><button class="btn sm" data-act="rollhp">Roll all levels</button><button class="btn sm" data-act="avghp">Use averages</button></div>
        ${Object.keys(C.hpRolls).length ? '<p class="muted">Rolled: ' + Object.keys(C.hpRolls).map(k => k.split(':')[1] + '→' + C.hpRolls[k]).join(', ') + '</p>' : ''}</div>`;
    }
    return h;
  }

  /* ---------- ABILITIES ---------- */
  function tabAbilities() {
    const m = C.method, pool = D.rules.standardArray.slice();
    let h = `<div class="card"><h3>Ability scores</h3><div class="row">${[['standard', 'Standard array'], ['pointbuy', 'Point buy'], ['roll', 'Roll 4d6 (drop lowest)'], ['manual', 'Manual']].map(([k, n]) => `<label class="opt"><input type="radio" name="meth" data-act="method" value="${k}" ${m === k ? 'checked' : ''}> ${n}</label>`).join('')}</div>`;
    if (m === 'standard' || m === 'roll') {
      const values = m === 'standard' ? pool : (C.rolled || []);
      if (m === 'roll') h += `<div class="row"><button class="btn sm" data-act="rollstats">${values.length ? 'Re-roll' : 'Roll'} scores</button><span>${values.join(', ')}</span></div>`;
      const used = {}; ABIL.forEach(a => { const v = C.stdAssign[a]; if (v) used[v] = (used[v] || 0) + 1; });
      const avail = v => values.filter(x => x === v).length - (used[v] || 0);
      h += `<div class="assign">${ABIL.map(a => `<label>${abName(a)}<select data-act="assign" data-a="${a}"><option value="">—</option>${Array.from(new Set(values)).sort((x, y) => y - x).map(v => `<option value="${v}" ${C.stdAssign[a] === v ? 'selected' : ''} ${avail(v) <= 0 && C.stdAssign[a] !== v ? 'disabled' : ''}>${v}</option>`).join('')}</select></label>`).join('')}</div>`;
    } else if (m === 'pointbuy') {
      const pb = D.rules.pointBuy, spent = E.pointBuyCost(C.pointBuy);
      h += `<p>Points spent: <b>${spent}</b> / ${pb.budget} ${spent > pb.budget ? '<span class="bad">over budget</span>' : ''}</p><div class="assign">${ABIL.map(a => `<div class="pb"><span>${abName(a)}</span><button class="btn sm" data-act="pb" data-a="${a}" data-d="-1">−</button><b>${C.pointBuy[a]}</b><button class="btn sm" data-act="pb" data-a="${a}" data-d="1">＋</button></div>`).join('')}</div>`;
    } else {
      h += `<div class="assign">${ABIL.map(a => `<label>${abName(a)}<input type="number" class="num" min="1" max="20" value="${C.base[a]}" data-act="manual" data-a="${a}"></label>`).join('')}</div>`;
    }
    h += `</div><div class="card"><h3>Totals</h3><table class="tbl"><tr><th>Ability</th><th>Base</th><th>Species/feats</th><th>Background</th><th>Level-ups</th><th>Total</th><th>Mod</th></tr>${ABIL.map(a => `<tr><td>${abName(a)}</td><td>${R.base[a]}</td><td>${R.abilityBonus[a] ? signed(R.abilityBonus[a]) : '–'}</td><td>${R.bgBonus[a] ? signed(R.bgBonus[a]) : '–'}</td><td>${R.asiBonus[a] ? signed(R.asiBonus[a]) : '–'}</td><td><b>${R.scores[a]}</b></td><td>${signed(R.mods[a])}</td></tr>`).join('')}</table>
      ${D.rules.asiFrom === 'background' ? '<p class="muted">In the 2024 rules your background, not your species, grants ability score increases.</p>' : ''}</div>`;
    return h;
  }

  /* ---------- SPELLS ---------- */
  function spellRow(s, checkbox) {
    return `<div class="srow">${checkbox}<details><summary><strong>${esc(s.name)}</strong> <span class="muted">${s.level ? 'L' + s.level : 'Cantrip'} · ${esc(s.school)}${s.concentration ? ' · C' : ''}${s.ritual ? ' · R' : ''}</span></summary>${spellBody(s)}</details></div>`;
  }
  function spellBody(s) {
    return `<div class="sbody"><div class="muted">${esc(s.castingTime || s.castShort)} · ${esc(s.range)} · ${esc(compsStr(s))} · ${esc(s.duration)}</div>${md(s.desc)}<div class="muted">Lists: ${esc(s.classes.join(', '))}</div></div>`;
  }
  function compsStr(s) {
    const c = s.components; if (typeof c === 'string') return c;
    return [c.v && 'V', c.s && 'S', c.m && 'M' + (c.material ? ' (' + c.material + ')' : '')].filter(Boolean).join(', ');
  }
  function tabSpells() {
    if (!R.spellcasting.length && !R.grantedSpells.length) return '<div class="card"><p>Your character has no spellcasting yet. Spellcasting classes (and some species and feats) will appear here.</p></div>';
    let h = '';
    R.spellcasting.forEach(sc => {
      const st = C.spells[sc.classKey] = C.spells[sc.classKey] || { cantrips: [], prepared: [], book: [] };
      const list = D.spells.filter(s => s.classes.includes(sc.list));
      const book = sc.kind === 'book';
      h += `<div class="card"><h3>${esc(sc.name)} spells</h3><p class="muted">Spellcasting ability ${abName(sc.ability)} · Save DC <b>${sc.dc}</b> · Attack <b>${signed(sc.attack)}</b></p>`;
      if (sc.cantrips) {
        h += `<div class="choice ${st.cantrips.length >= sc.cantrips ? 'done' : 'todo'}"><div class="chead"><strong>Cantrips</strong><span class="count">${st.cantrips.length}/${sc.cantrips}</span></div><div class="slist">${list.filter(s => s.level === 0).map(s => spellRow(s, `<input type="checkbox" data-act="spell" data-c="${sc.classKey}" data-f="cantrips" data-v="${s.key}" data-lim="${sc.cantrips}" ${st.cantrips.includes(s.key) ? 'checked' : ''}>`)).join('')}</div></div>`;
      }
      const pickFrom = book ? list.filter(s => s.level > 0 && s.level <= sc.maxLevel) : list.filter(s => s.level > 0 && s.level <= sc.maxLevel);
      if (book) {
        h += `<div class="choice ${st.book.length >= sc.spellbook ? 'done' : 'todo'}"><div class="chead"><strong>Spellbook</strong><span class="count">${st.book.length}/${sc.spellbook}</span></div><div class="slist">${pickFrom.map(s => spellRow(s, `<input type="checkbox" data-act="spell" data-c="${sc.classKey}" data-f="book" data-v="${s.key}" data-lim="${sc.spellbook}" ${st.book.includes(s.key) ? 'checked' : ''}>`)).join('')}</div></div>`;
        const bookSp = pickFrom.filter(s => st.book.includes(s.key));
        h += `<div class="choice ${st.prepared.length >= sc.prepared ? 'done' : 'todo'}"><div class="chead"><strong>Prepared spells</strong><span class="count">${st.prepared.length}/${sc.prepared}</span></div><div class="slist">${bookSp.length ? bookSp.map(s => spellRow(s, `<input type="checkbox" data-act="spell" data-c="${sc.classKey}" data-f="prepared" data-v="${s.key}" data-lim="${sc.prepared}" ${st.prepared.includes(s.key) ? 'checked' : ''}>`)).join('') : '<p class="muted">Add spells to your spellbook first.</p>'}</div></div>`;
      } else if (sc.prepared) {
        h += `<div class="choice ${st.prepared.length >= sc.prepared ? 'done' : 'todo'}"><div class="chead"><strong>${sc.kind === 'known' ? 'Spells known' : 'Prepared spells'}</strong><span class="count">${st.prepared.length}/${sc.prepared}</span><span class="muted">up to level ${sc.maxLevel}</span></div><div class="slist">${pickFrom.length ? pickFrom.map(s => spellRow(s, `<input type="checkbox" data-act="spell" data-c="${sc.classKey}" data-f="prepared" data-v="${s.key}" data-lim="${sc.prepared}" ${st.prepared.includes(s.key) ? 'checked' : ''}>`)).join('') : '<p class="muted">No spell slots yet at this level.</p>'}</div></div>`;
      }
      h += '</div>';
    });
    if (R.grantedSpells.length) h += `<div class="card"><h3>Granted spells</h3><p class="muted">Always available from species, subclass, or feats; these don’t count against your limits.</p><div class="slist">${R.grantedSpells.map(g => spellRow(g.spell, '<span class="pin">★</span>').replace('</summary>', ' <span class="muted">— ' + esc(g.source) + (g.ability ? ' (' + abAbbr(g.ability) + ')' : '') + '</span></summary>')).join('')}</div></div>`;
    return h;
  }

  /* ---------- EQUIPMENT ---------- */
  function resolveItem(name) {
    const n = E.slug(name);
    let x = D.weapons.find(w => w.key === n); if (x) return { ref: 'weapon:' + x.key, name: x.name };
    x = D.armor.find(a => a.key === n); if (x) return { ref: 'armor:' + x.key, name: x.name };
    x = D.gear.find(g => g.key === n || E.slug(g.name) === n); if (x) return { ref: 'gear:' + x.key, name: x.name };
    x = D.tools.find(t => t.key === n); if (x) return { ref: 'tool:' + x.key, name: x.name };
    return { ref: 'custom', name: name };
  }
  function addItem(name, qty, ref) {
    const it = ref ? { ref, name } : resolveItem(name);
    const ex = C.equipment.items.find(i => i.ref === it.ref && it.ref !== 'custom' || (it.ref === 'custom' && i.name === it.name && i.ref === 'custom'));
    if (ex) ex.qty += qty; else C.equipment.items.push({ ref: it.ref, name: it.name, qty: qty || 1, equipped: false });
  }
  function applyPackage(list, gold) {
    list.forEach(([n, q]) => addItem(n, q));
    C.equipment.gp = (C.equipment.gp || 0) + gold;
    // sensible default equips
    const eq = C.equipment.items; let body = false, shield = false, weapons = 0;
    eq.forEach(i => {
      if (i.ref.startsWith('armor:')) { const a = by(D.armor, i.ref.slice(6)); if (a.category === 'shield') { if (!shield) { i.equipped = true; shield = true; } } else if (!body) { i.equipped = true; body = true; } }
      if (i.ref.startsWith('weapon:') && weapons < 2) { i.equipped = true; weapons++; }
    });
  }
  function tabEquipment() {
    const cl = C.classes[0] && by(D.classes, C.classes[0].key), bg = by(D.backgrounds, C.background);
    let h = '<div class="card"><h3>Starting equipment</h3>';
    if (D.rules.asiFrom === 'background') {
      h += '<p class="muted">Pick a package from your class and from your background (or take the gold instead), then add them to your inventory.</p><div class="row">';
      if (cl && cl.equip) {
        const e = cl.equip;
        h += `<div class="pkg"><strong>${esc(cl.name)}</strong><button class="btn sm" data-act="pkg" data-s="class" data-p="A">A: ${e.A.map(x => (x[1] > 1 ? x[1] + ' ' : '') + x[0]).join(', ')}, ${e.goldA} GP</button>${e.B ? `<button class="btn sm" data-act="pkg" data-s="class" data-p="B">B: ${e.B.map(x => (x[1] > 1 ? x[1] + ' ' : '') + x[0]).join(', ')}, ${e.goldB_pack} GP</button>` : ''}<button class="btn sm" data-act="pkg" data-s="class" data-p="${e.B ? 'C' : 'B'}">${e.B ? 'C' : 'B'}: ${e.B ? e.goldC : e.goldB} GP</button></div>`;
      }
      if (bg) h += `<div class="pkg"><strong>${esc(bg.name)}</strong><button class="btn sm" data-act="pkg" data-s="bg" data-p="A">A: ${bg.equipA.map(x => (x[1] > 1 ? x[1] + ' ' : '') + x[0]).join(', ')}, ${bg.goldA} GP</button><button class="btn sm" data-act="pkg" data-s="bg" data-p="B">B: ${bg.goldB} GP</button></div>`;
      h += '</div>';
    } else if (cl) {
      h += '<p class="muted">Choose a starting package, or buy your own gear below.</p><div class="row">' + (cl.equipChoices || []).map((p, i) => `<button class="btn sm" data-act="pkg14" data-i="${i}">${esc(p.label)}</button>`).join('') + '</div>';
      if (bg && bg.equip) h += `<div class="pkg"><strong>${esc(bg.name)}</strong><button class="btn sm" data-act="pkg14bg">${bg.equip.map(x => (x[1] > 1 ? x[1] + ' ' : '') + x[0]).join(', ')}, ${bg.gp} GP</button></div>`;
    } else h += '<p class="muted">Choose a class first to see starting packages.</p>';
    h += '</div>';
    h += `<div class="card"><h3>Inventory</h3>${C.equipment.items.length ? `<table class="tbl"><tr><th>Item</th><th>Qty</th><th>Equipped</th><th></th></tr>${C.equipment.items.map((i, n) => {
      const eq = /^(weapon|armor):/.test(i.ref);
      return `<tr><td>${esc(i.name)}${i.ref === 'custom' ? ' <small class="muted">custom</small>' : ''}</td><td><input class="num" type="number" min="1" value="${i.qty}" data-act="qty" data-n="${n}"></td><td>${eq ? `<input type="checkbox" data-act="equip" data-n="${n}" ${i.equipped ? 'checked' : ''}>` : ''}</td><td><button class="btn sm danger" data-act="rmitem" data-n="${n}">✕</button></td></tr>`;
    }).join('')}</table>` : '<p class="muted">Nothing yet.</p>'}
      <div class="row"><label class="inl">GP <input class="num" type="number" min="0" value="${C.equipment.gp || 0}" data-act="coin" data-k="gp"></label><label class="inl">SP <input class="num" type="number" min="0" value="${C.equipment.sp || 0}" data-act="coin" data-k="sp"></label><label class="inl">CP <input class="num" type="number" min="0" value="${C.equipment.cp || 0}" data-act="coin" data-k="cp"></label></div>
      <h4>Add an item</h4><div class="row"><select id="additem"><option value="">— choose —</option><optgroup label="Weapons">${D.weapons.map(w => `<option value="weapon:${w.key}">${esc(w.name)} (${esc(w.damage)} ${esc(w.damageType)})</option>`).join('')}</optgroup>
      <optgroup label="Armor &amp; shields">${D.armor.map(a => `<option value="armor:${a.key}">${esc(a.name)}</option>`).join('')}</optgroup><optgroup label="Adventuring gear">${D.gear.map(g => `<option value="gear:${g.key}">${esc(g.name)}</option>`).join('')}</optgroup><optgroup label="Tools">${D.tools.map(t => `<option value="tool:${t.key}">${esc(t.name)}</option>`).join('')}</optgroup></select><button class="btn" data-act="additem">Add</button></div>
      <div class="row"><input id="customitem" placeholder="Custom item name"><button class="btn" data-act="addcustom">Add custom</button></div></div>`;
    return h;
  }

  /* ---------- DETAILS ---------- */
  function tabDetails() {
    const d = C.details;
    const f = (k, l, ta) => `<label class="fld"><span>${l}</span>${ta ? `<textarea data-act="detail" data-k="${k}" rows="3">${esc(d[k])}</textarea>` : `<input data-act="detail" data-k="${k}" value="${esc(d[k])}">`}</label>`;
    return `<div class="card"><h3>Details</h3><div class="grid2">${f('alignment', 'Alignment')}${f('age', 'Age')}${f('height', 'Height')}${f('weight', 'Weight')}${f('eyes', 'Eyes')}${f('hair', 'Hair')}${f('skin', 'Skin')}</div>${f('personality', 'Personality traits', 1)}${f('ideals', 'Ideals', 1)}${f('bonds', 'Bonds', 1)}${f('flaws', 'Flaws', 1)}${f('backstory', 'Backstory', 1)}${f('notes', 'Notes', 1)}</div>`;
  }

  /* ---------- SHEET ---------- */
  function renderSheet() {
    const sp = by(D.species, C.species), bg = by(D.backgrounds, C.background);
    const p = C.play;
    const hpNow = p.hp == null ? R.hp : p.hp;
    const srcGroups = {};
    R.features.filter(f => !f.hidden && f.name).forEach(f => { const g = f.source; (srcGroups[g] = srcGroups[g] || []).push(f); });
    const sl = R.slots, used = p.slots || {};
    app.innerHTML = `<div class="wrap sheet"><div class="noprint row between"><a class="btn" href="#/edit/${C.id}/origin">← Edit</a><div class="row"><button class="btn" data-act="resetplay">Long rest</button><button class="btn pri" onclick="window.print()">Print</button></div></div>
      <header class="sh-head"><div><h1>${esc(C.name || 'Unnamed character')}</h1><div class="muted">${esc(summaryLine(C))} · ${esc(R.size)}${C.details.alignment ? ' · ' + esc(C.details.alignment) : ''}</div></div><div class="muted">${esc(D.short)}</div></header>
      <div class="sh-top"><div class="box big"><span>Armor Class</span><b>${R.ac}</b><small>${esc(R.acNote)}</small></div>
        <div class="box big"><span>Hit Points</span><b><input class="hpin" type="number" data-act="hp" value="${hpNow}"> / ${R.hp}</b><small>Temp <input class="hpin sm" type="number" data-act="temp" value="${p.temp || 0}"></small></div>
        <div class="box"><span>Initiative</span><b>${signed(R.init)}</b></div><div class="box"><span>Speed</span><b>${R.speed} ft</b></div><div class="box"><span>Proficiency</span><b>${signed(R.pb)}</b></div>
        <div class="box"><span>Hit Dice</span><b>${Object.keys(R.hitDice).map(d2 => R.hitDice[d2] + 'd' + d2).join(' + ') || '–'}</b></div></div>
      <div class="sh-cols"><div class="c1"><div class="abil sheetab">${ABIL.map(a => `<div><span>${abName(a)}</span><b>${signed(R.mods[a])}</b><small>${R.scores[a]}</small></div>`).join('')}</div>
        <div class="card"><h4>Saving throws</h4>${R.saves.map(s => `<div class="line"><i class="pip ${s.prof ? 'on' : ''}"></i><span>${abName(s.key)}</span><b>${signed(s.bonus)}</b></div>`).join('')}</div>
        <div class="card"><h4>Skills</h4>${R.skills.map(s => `<div class="line"><i class="pip ${s.expertise ? 'ex' : s.prof ? 'on' : ''}"></i><span>${esc(s.name)} <small class="muted">${abAbbr(s.ability)}</small></span><b>${signed(s.bonus)}</b></div>`).join('')}</div>
        <div class="card"><h4>Passive</h4><div class="line"><span>Perception</span><b>${R.passive.perception}</b></div><div class="line"><span>Insight</span><b>${R.passive.insight}</b></div><div class="line"><span>Investigation</span><b>${R.passive.investigation}</b></div></div>
        <div class="card"><h4>Proficiencies &amp; languages</h4><p><strong>Armor:</strong> ${Object.keys(R.prof.armor).join(', ') || 'none'}</p><p><strong>Weapons:</strong> ${Object.keys(R.prof.weapons).join(', ').replace(/martial:light/, 'Martial (Light)').replace(/martial:finesse-light/, 'Martial (Finesse/Light)') || 'none'}</p><p><strong>Tools:</strong> ${Object.keys(R.prof.tools).map(esc).join(', ') || 'none'}</p><p><strong>Languages:</strong> ${R.languages.map(esc).join(', ') || '—'}</p>
        <p><strong>Senses:</strong> ${Object.keys(R.senses).map(k => esc(k) + ' ' + R.senses[k] + ' ft').join(', ') || '—'}</p>${R.resist.length ? '<p><strong>Resistances:</strong> ' + R.resist.map(esc).join(', ') + '</p>' : ''}</div></div>
      <div class="c2"><div class="card"><h4>Attacks</h4><table class="tbl"><tr><th>Name</th><th>Atk</th><th>Damage</th>${D.rules.weaponMastery ? '<th>Mastery</th>' : ''}<th>Properties</th></tr>${R.attacks.map(a => `<tr><td>${esc(a.name)}${a.proficient ? '' : ' <small class="muted">(not proficient)</small>'}</td><td>${signed(a.atk)}</td><td>${esc(a.dmg)} ${esc(a.type)}</td>${D.rules.weaponMastery ? `<td>${esc(a.mastery || '')}</td>` : ''}<td class="muted">${esc(a.props)}</td></tr>`).join('')}</table></div>
        ${R.resourceList.length ? `<div class="card"><h4>Resources</h4>${R.resourceList.map(x => { const u = p.used[x.fid] || 0; return `<div class="line"><span>${esc(x.name)} <small class="muted">${esc(x.per || '')}</small></span><span>${Array.from({ length: Math.min(x.max, 12) }, (_, i) => `<input type="checkbox" data-act="use" data-f="${esc(x.fid)}" data-i="${i}" ${i < u ? 'checked' : ''}>`).join('')}${x.max > 12 ? ' ' + x.max : ''}</span></div>`; }).join('')}</div>` : ''}
        ${(R.spellcasting.length || R.grantedSpells.length) ? sheetSpells(sl, used) : ''}
        <div class="card"><h4>Features &amp; traits</h4>${Object.keys(srcGroups).map(g => `<h5>${esc(g)}</h5>` + srcGroups[g].map(f => `<details class="feat"><summary><strong>${esc(f.name)}</strong>${f.optionOf ? ' <small class="muted">(' + esc(f.optionOf) + ')</small>' : ''}</summary>${md(f.desc)}</details>`).join('')).join('')}</div>
        <div class="card"><h4>Equipment</h4><p>${C.equipment.items.map(i => esc(i.name) + (i.qty > 1 ? ' ×' + i.qty : '') + (i.equipped ? ' <small class="muted">(equipped)</small>' : '')).join(', ') || '—'}</p><p><strong>Coins:</strong> ${C.equipment.gp || 0} gp, ${C.equipment.sp || 0} sp, ${C.equipment.cp || 0} cp</p></div>
        ${['personality', 'ideals', 'bonds', 'flaws', 'backstory', 'notes'].some(k => C.details[k]) ? `<div class="card"><h4>Details</h4>${['personality', 'ideals', 'bonds', 'flaws', 'backstory', 'notes'].filter(k => C.details[k]).map(k => `<p><strong>${cap(k)}:</strong> ${esc(C.details[k])}</p>`).join('')}</div>` : ''}
      </div></div></div>`;
  }
  function sheetSpells(sl, used) {
    let h = '<div class="card"><h4>Spellcasting</h4>';
    R.spellcasting.forEach(sc => {
      const st = C.spells[sc.classKey] || { cantrips: [], prepared: [] };
      h += `<p><strong>${esc(sc.name)}:</strong> ${abName(sc.ability)} · DC <b>${sc.dc}</b> · attack <b>${signed(sc.attack)}</b></p>`;
      const nm = ks => ks.map(k => by(D.spells, k)).filter(Boolean).map(s => esc(s.name)).join(', ') || '—';
      if (st.cantrips.length) h += `<p><strong>Cantrips:</strong> ${nm(st.cantrips)}</p>`;
      const prep = (st.prepared || []).map(k => by(D.spells, k)).filter(Boolean);
      for (let l = 1; l <= 9; l++) { const g = prep.filter(s => s.level === l); if (g.length) h += `<p><strong>Level ${l}:</strong> ${g.map(s => `<span class="sp" title="${esc(s.castShort)}">${esc(s.name)}</span>`).join(', ')}</p>`; }
      if (sc.kind === 'book' && (st.book || []).length) h += `<p class="muted"><strong>Spellbook:</strong> ${nm(st.book)}</p>`;
    });
    if (R.grantedSpells.length) h += `<p><strong>Granted:</strong> ${R.grantedSpells.map(g => esc(g.spell.name) + ' <small class="muted">(' + esc(g.source) + ')</small>').join(', ')}</p>`;
    if (sl.length) h += `<div class="slots"><strong>Spell slots</strong> ${sl.map((n, i) => `<span class="slot"><b>L${i + 1}</b> ${Array.from({ length: n }, (_, j) => `<input type="checkbox" data-act="slot" data-l="${i + 1}" data-j="${j}" ${(used[i + 1] || 0) > j ? 'checked' : ''}>`).join('')}</span>`).join('')}</div>`;
    if (R.pact) h += `<div class="slots"><strong>Pact Magic</strong> ${R.pact.slots} × level ${R.pact.level} ${Array.from({ length: R.pact.slots }, (_, j) => `<input type="checkbox" data-act="slot" data-l="pact" data-j="${j}" ${(used.pact || 0) > j ? 'checked' : ''}>`).join('')}</div>`;
    return h + '</div>';
  }

  /* ---------- browsers ---------- */
  function viewSpells() {
    const f = window.__sf = window.__sf || { q: '', level: '', cls: '', school: '', conc: false, rit: false };
    const classes = Array.from(new Set(D.spells.flatMap(s => s.classes))).sort();
    const list = D.spells.filter(s => (!f.q || s.name.toLowerCase().includes(f.q.toLowerCase())) && (f.level === '' || s.level === +f.level) && (!f.cls || s.classes.includes(f.cls)) && (!f.school || s.school === f.school) && (!f.conc || s.concentration) && (!f.rit || s.ritual));
    app.innerHTML = `<div class="wrap"><h1>Spells <small class="muted">${list.length} of ${D.spells.length}</small></h1><div class="filters card"><input id="sq" placeholder="Search by name" value="${esc(f.q)}">
      <select data-f="level"><option value="">Any level</option>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => `<option value="${l}" ${String(f.level) === String(l) ? 'selected' : ''}>${l ? 'Level ' + l : 'Cantrip'}</option>`).join('')}</select>
      <select data-f="cls"><option value="">Any class</option>${classes.map(c => `<option ${f.cls === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <select data-f="school"><option value="">Any school</option>${D.schools.map(c => `<option ${f.school === c ? 'selected' : ''}>${c}</option>`).join('')}</select>
      <label class="opt"><input type="checkbox" data-f="conc" ${f.conc ? 'checked' : ''}> Concentration</label><label class="opt"><input type="checkbox" data-f="rit" ${f.rit ? 'checked' : ''}> Ritual</label></div>
      <div class="slist">${list.map(s => spellRow(s, '')).join('') || '<p class="muted">No spells match.</p>'}</div></div>`;
    const q = $('#sq'); q.addEventListener('input', () => { f.q = q.value; const pos = q.selectionStart; viewSpells(); const q2 = $('#sq'); q2.focus(); q2.setSelectionRange(pos, pos); });
  }
  function viewEquipment(tab) {
    const tabs = ['weapons', 'armor', 'gear', 'tools'];
    let t = '';
    if (tab === 'weapons') t = `<table class="tbl"><tr><th>Name</th><th>Type</th><th>Damage</th><th>Properties</th>${D.rules.weaponMastery ? '<th>Mastery</th>' : ''}<th>Weight</th><th>Cost</th></tr>${D.weapons.map(w => `<tr><td>${esc(w.name)}</td><td>${esc(cap(w.category))} ${esc(w.kind)}</td><td>${esc(w.damage)} ${esc(w.damageType)}</td><td>${esc(w.props || '—')}</td>${D.rules.weaponMastery ? `<td>${esc(w.mastery || '')}</td>` : ''}<td>${esc(w.weight || '—')}</td><td>${esc(w.cost)}</td></tr>`).join('')}</table>
      ${D.rules.weaponMastery ? '<h3>Mastery properties</h3>' + Object.keys(D.mastery).map(k => `<p><strong>${esc(k)}.</strong> ${esc(D.mastery[k])}</p>`).join('') : ''}<h3>Weapon properties</h3>${Object.keys(D.weaponProps).map(k => `<p><strong>${esc(k)}.</strong> ${esc(D.weaponProps[k])}</p>`).join('')}`;
    else if (tab === 'armor') t = `<table class="tbl"><tr><th>Armor</th><th>Category</th><th>AC</th><th>Str</th><th>Stealth</th><th>Weight</th><th>Cost</th></tr>${D.armor.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(cap(a.category))}</td><td>${a.ac}${a.dex === 'full' ? ' + Dex' : a.dex === 'max2' ? ' + Dex (max 2)' : a.category === 'shield' ? ' bonus' : ''}</td><td>${a.strReq || '—'}</td><td>${a.stealthDis ? 'Disadvantage' : '—'}</td><td>${esc(a.weight || '—')}</td><td>${esc(a.cost)}</td></tr>`).join('')}</table>`;
    else if (tab === 'gear') t = `<table class="tbl"><tr><th>Item</th><th>Weight</th><th>Cost</th></tr>${D.gear.map(g => `<tr><td>${esc(g.name)}</td><td>${esc(g.weight || '—')}</td><td>${esc(g.cost)}</td></tr>`).join('')}</table>`;
    else t = `<table class="tbl"><tr><th>Tool</th><th>Category</th><th>Cost</th></tr>${D.tools.map(g => `<tr><td>${esc(g.name)}</td><td>${esc(g.cat)}</td><td>${esc(g.cost)}</td></tr>`).join('')}</table>`;
    app.innerHTML = `<div class="wrap"><h1>Equipment</h1><div class="tabs">${tabs.map(x => `<a href="#/equipment/${x}" class="${x === tab ? 'on' : ''}">${cap(x)}</a>`).join('')}</div><div class="card scroll">${t}</div></div>`;
  }
  function viewAbout() {
    app.innerHTML = `<div class="wrap prose"><h1>About</h1><p>This is a static HTML/CSS/JavaScript character builder, converted from the Clojure/ClojureScript OrcPub2 project. It runs entirely in your browser; characters are saved to <code>localStorage</code> on this device. Use Export to back them up.</p><p>Edition: <strong>${esc(D.short)}</strong>.</p><h3>Not included from the original</h3><p>User accounts, e-mail, server-side PDF generation, parties, and the monster/encounter/homebrew tools depend on a server and are not part of this static build. Use <em>Print</em> on the character sheet to save a PDF.</p><h3>Attribution</h3><p>${esc(D.attribution)}</p></div>`;
  }

  /* ---------- events ---------- */
  function setChoice(cid, vals) { if (vals.length) C.choices[cid] = vals; else delete C.choices[cid]; }
  function pruneChoices() { /* drop choices whose source is gone */
    const keep = new Set(); const R2 = E.compute(C);
    R2.choiceList.forEach(ev => keep.add(ev.cid));
    Object.keys(C.choices).forEach(k => { if (!keep.has(k) && !/^(origin#|species:.*:sub$|asi:.*#abil$)/.test(k)) delete C.choices[k]; });
  }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]'); if (!t || t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA') return;
    const a = t.dataset.act;
    if (a === 'del') { if (confirm('Delete this character?')) { Store.remove(t.dataset.id); viewHome(); } }
    else if (a === 'dup') { const c = JSON.parse(JSON.stringify(Store.get(t.dataset.id))); c.id = E.uid(); c.name = (c.name || 'Character') + ' (copy)'; Store.save(c); viewHome(); }
    else if (a === 'export') { const c = Store.get(t.dataset.id); download((c.name || 'character').replace(/\W+/g, '_') + '.json', JSON.stringify(c, null, 2)); }
    else if (a === 'exportall') download('characters-' + ED + '.json', JSON.stringify(Store.all(), null, 2));
    else if (a === 'addclass') { const k = $('#newclass').value; if (!k) return; C.classes.push({ key: k, level: 1, subclass: null }); pruneChoices(); commit(); }
    else if (a === 'rmclass') { C.classes.splice(+t.dataset.i, 1); pruneChoices(); commit(); }
    else if (a === 'rollhp') { C.hpRolls = {}; C.classes.forEach((k, i) => { const cl = by(D.classes, k.key); for (let l = 1; l <= k.level; l++) { if (i === 0 && l === 1) continue; C.hpRolls[k.key + ':' + l] = 1 + Math.floor(Math.random() * cl.hitDie); } }); commit(); }
    else if (a === 'avghp') { C.hpRolls = {}; commit(); }
    else if (a === 'rollstats') { C.rolled = Array.from({ length: 6 }, () => { const r = Array.from({ length: 4 }, () => 1 + Math.floor(Math.random() * 6)).sort((x, y) => y - x); return r[0] + r[1] + r[2]; }).sort((x, y) => y - x); C.stdAssign = {}; commit(); }
    else if (a === 'pb') { const k = t.dataset.a, d = +t.dataset.d, pb = D.rules.pointBuy, v = C.pointBuy[k] + d; if (v < pb.min || v > pb.max) return; const next = Object.assign({}, C.pointBuy, { [k]: v }); if (E.pointBuyCost(next) > pb.budget) { toast('Not enough points'); return; } C.pointBuy = next; commit(); }
    else if (a === 'pkg') {
      const src = t.dataset.s === 'class' ? by(D.classes, C.classes[0].key).equip : by(D.backgrounds, C.background);
      const p = t.dataset.p;
      if (t.dataset.s === 'class') { if (p === 'A') applyPackage(src.A, src.goldA); else if (p === 'B' && src.B) applyPackage(src.B, src.goldB_pack); else applyPackage([], src.goldC || src.goldB); }
      else { if (p === 'A') applyPackage(src.equipA, src.goldA); else applyPackage([], src.goldB); }
      commit(); toast('Added to inventory');
    }
    else if (a === 'pkg14') { const cl = by(D.classes, C.classes[0].key); const p = cl.equipChoices[+t.dataset.i]; applyPackage(p.items, p.gp || 0); commit(); toast('Added to inventory'); }
    else if (a === 'pkg14bg') { const bg = by(D.backgrounds, C.background); applyPackage(bg.equip, bg.gp || 0); commit(); }
    else if (a === 'additem') { const v = $('#additem').value; if (!v) return; const [type, key] = v.split(':'); const src = type === 'weapon' ? D.weapons : type === 'armor' ? D.armor : type === 'gear' ? D.gear : D.tools; const it = by(src, key); addItem(it.name, 1, v); commit(); }
    else if (a === 'addcustom') { const n = $('#customitem').value.trim(); if (n) { addItem(n, 1, 'custom'); commit(); } }
    else if (a === 'rmitem') { C.equipment.items.splice(+t.dataset.n, 1); commit(); }
    else if (a === 'resetplay') { C.play = { used: {}, slots: {}, hp: null, temp: 0 }; Store.save(C); renderSheet(); }
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'imp') { importFile(t.files[0]); return; }
    if (t.dataset.f !== undefined && t.closest('.filters')) { const f = window.__sf; f[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value; viewSpells(); return; }
    if (!C) return;
    const a = t.dataset.act, i = +t.dataset.i;
    if (t.dataset.cid !== undefined) {
      const cid = t.dataset.cid;
      if (t.type === 'checkbox') {
        let cur = E.selectionOf(C, cid).slice(); const v = t.dataset.v, lim = +t.dataset.lim;
        if (t.checked) { if (cur.length >= lim) { t.checked = false; toast('You can choose ' + lim + ' here — uncheck one first.'); return; } cur.push(v); } else cur = cur.filter(x => x !== v);
        setChoice(cid, cur);
      } else setChoice(cid, t.value ? [t.value] : []);
      pruneChoices(); commit(); return;
    }
    switch (a) {
      case 'species': C.species = t.value || null; C.sizeChoice = null; pruneChoices(); commit(); break;
      case 'size': C.sizeChoice = t.value; commit(); break;
      case 'background': C.background = t.value || null; C.bgAsi = { mode: 'twoone', plus2: null, plus1: null }; pruneChoices(); commit(); break;
      case 'bgmode': C.bgAsi = { mode: t.value, plus2: null, plus1: null }; commit(); break;
      case 'bgplus2': C.bgAsi.plus2 = t.value || null; if (C.bgAsi.plus1 === C.bgAsi.plus2) C.bgAsi.plus1 = null; commit(); break;
      case 'bgplus1': C.bgAsi.plus1 = t.value || null; commit(); break;
      case 'classkey': C.classes[i] = { key: t.value, level: C.classes[i].level, subclass: null }; pruneChoices(); commit(); break;
      case 'classlevel': { let v = Math.max(1, Math.min(20, +t.value || 1)); const others = E.totalLevel(C) - C.classes[i].level; v = Math.min(v, 20 - others); C.classes[i].level = v; C.hpRolls = {}; pruneChoices(); commit(); break; }
      case 'subclass': C.classes[i].subclass = t.value || null; pruneChoices(); commit(); break;
      case 'asitype': C.asi[t.dataset.id] = { type: t.value }; commit(); break;
      case 'asia': C.asi[t.dataset.id] = Object.assign({ type: 'asi' }, C.asi[t.dataset.id], { a: t.value || null }); commit(); break;
      case 'asib': C.asi[t.dataset.id] = Object.assign({ type: 'asi' }, C.asi[t.dataset.id], { b: t.value || null }); commit(); break;
      case 'asifeat': C.asi[t.dataset.id] = { type: 'feat', feat: t.value || null }; Object.keys(C.choices).forEach(k => { if (k.indexOf('@asi:' + t.dataset.id) >= 0) delete C.choices[k]; }); pruneChoices(); commit(); break;
      case 'method': C.method = t.value; if (t.value === 'manual') C.base = Object.assign({}, R.base); C.stdAssign = {}; commit(); break;
      case 'assign': if (t.value) C.stdAssign[t.dataset.a] = +t.value; else delete C.stdAssign[t.dataset.a]; commit(); break;
      case 'manual': C.base[t.dataset.a] = Math.max(1, Math.min(30, +t.value || 10)); commit(); break;
      case 'spell': {
        const st = C.spells[t.dataset.c] = C.spells[t.dataset.c] || { cantrips: [], prepared: [], book: [] }, f = t.dataset.f; st[f] = st[f] || [];
        if (t.checked) { if (st[f].length >= +t.dataset.lim) { t.checked = false; toast('Limit reached — uncheck one first.'); return; } st[f].push(t.dataset.v); }
        else { st[f] = st[f].filter(x => x !== t.dataset.v); if (f === 'book') st.prepared = (st.prepared || []).filter(x => st.book.includes(x)); }
        commit(); break;
      }
      case 'qty': C.equipment.items[+t.dataset.n].qty = Math.max(1, +t.value || 1); commit(false); break;
      case 'equip': C.equipment.items[+t.dataset.n].equipped = t.checked; commit(); break;
      case 'coin': C.equipment[t.dataset.k] = Math.max(0, +t.value || 0); commit(false); break;
      case 'detail': C.details[t.dataset.k] = t.value; commit(false); break;
      case 'hp': C.play.hp = +t.value; Store.save(C); break;
      case 'temp': C.play.temp = +t.value; Store.save(C); break;
      case 'use': { const f = t.dataset.f, idx = +t.dataset.i; C.play.used[f] = t.checked ? idx + 1 : idx; Store.save(C); renderSheet(); break; }
      case 'slot': { const l = t.dataset.l, j = +t.dataset.j; C.play.slots[l] = t.checked ? j + 1 : j; Store.save(C); renderSheet(); break; }
    }
  });
  document.addEventListener('input', e => { if (e.target.id === 'cname' && C) { C.name = e.target.value; Store.save(C); } });
  function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }
  function importFile(f) {
    if (!f) return; const rd = new FileReader();
    rd.onload = () => { try { let d = JSON.parse(rd.result); if (!Array.isArray(d)) d = [d]; let n = 0; d.forEach(c => { if (c && c.classes && c.edition === ED) { c.id = E.uid(); Store.save(c); n++; } }); toast(n ? 'Imported ' + n + ' character(s)' : 'No ' + ED + '-edition characters found in that file'); viewHome(); } catch (err) { toast('That file isn’t valid JSON.'); } };
    rd.readAsText(f);
  }
  document.title = D.title;
  $('#brand-edition').textContent = D.short;
  route();
})();
