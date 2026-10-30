/* Character engine — edition-agnostic. All rules differences come from window.DATA (the data pack). */
(function (global) {
  'use strict';
  const D = () => global.DATA;
  const ABIL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  const mod = s => Math.floor((s - 10) / 2);
  const pbFor = lvl => 2 + Math.floor((Math.max(1, lvl) - 1) / 4);
  const signed = n => (n >= 0 ? '+' : '') + n;
  const uid = () => 'c' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const byKey = (arr, k) => (arr || []).find(x => x.key === k);
  const slug = s => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const FULL_SLOTS = [[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]];
  const HALF_SLOTS = [[2],[2],[3],[3],[4,2],[4,2],[4,3],[4,3],[4,3,2],[4,3,2],[4,3,3],[4,3,3],[4,3,3,1],[4,3,3,1],[4,3,3,2],[4,3,3,2],[4,3,3,3,1],[4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2]];
  const PACT = [[1,1],[2,1],[2,2],[2,2],[2,3],[2,3],[2,4],[2,4],[2,5],[2,5],[3,5],[3,5],[3,5],[3,5],[3,5],[3,5],[4,5],[4,5],[4,5],[4,5]];

  function newCharacter() {
    return { id: uid(), name: '', edition: D().edition, species: null, background: null,
      bgAsi: { mode: 'twoone', plus2: null, plus1: null },
      method: 'standard', base: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, stdAssign: {},
      pointBuy: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
      classes: [], choices: {}, asi: {}, spells: {}, equipment: { items: [], cp: 0, sp: 0, gp: 0 },
      details: { alignment: '', age: '', height: '', weight: '', eyes: '', hair: '', skin: '', personality: '', ideals: '', bonds: '', flaws: '', backstory: '', notes: '' },
      hpRolls: {}, created: Date.now(), updated: Date.now() };
  }
  const totalLevel = c => c.classes.reduce((a, k) => a + (k.level || 0), 0);
  const classLevel = (c, key) => { const k = c.classes.find(x => x.key === key); return k ? k.level : 0; };
  const selectionOf = (c, cid) => { const v = c.choices[cid]; return v == null ? [] : (Array.isArray(v) ? v : [v]); };
  const firstSel = (c, cid) => selectionOf(c, cid)[0];

  function pickedSub(c, sp) {
    const v = firstSel(c, 'species:' + sp.key + ':sub');
    return v ? byKey(sp.subraces, v) : null;
  }

  function collectSources(c) {
    const d = D(), out = [];
    const sp = byKey(d.species, c.species);
    if (sp) {
      out.push({ id: 'species:' + sp.key, kind: 'species', label: sp.name, features: sp.features || [] });
      const sub = pickedSub(c, sp);
      if (sub) out.push({ id: 'species:' + sp.key + ':' + sub.key, kind: 'species', label: sub.name, features: sub.features || [] });
    }
    const bg = byKey(d.backgrounds, c.background);
    if (bg) out.push({ id: 'bg:' + bg.key, kind: 'background', label: bg.name, features: bg.features || [] });
    c.classes.forEach((k, idx) => {
      const cl = byKey(d.classes, k.key); if (!cl) return;
      const total = totalLevel(c);
      const feats = (cl.features || []).filter(f => (f.level || 1) <= k.level && !(idx > 0 && f.firstOnly));
      out.push({ id: 'class:' + cl.key, kind: 'class', label: cl.name, classKey: cl.key, level: k.level, features: feats });
      const sc = byKey(cl.subclasses, k.subclass);
      if (sc) out.push({ id: 'sub:' + cl.key + ':' + sc.key, kind: 'subclass', label: sc.name, classKey: cl.key, level: k.level,
        features: (sc.features || []).filter(f => (f.level || 3) <= k.level) });
    });
    return out;
  }

  function asiSlots(c) {
    const d = D(), slots = [];
    c.classes.forEach(k => {
      const cl = byKey(d.classes, k.key); if (!cl) return;
      (cl.asiLevels || [4, 8, 12, 16, 19]).forEach(l => {
        if (l <= k.level) slots.push({ id: k.key + ':' + l, classKey: k.key, level: l, boon: !!d.rules.epicBoon && l === 19 });
      });
    });
    return slots;
  }

  /* Walk every feature / choice / option / feat reachable from the character */
  function walk(c, fn) {
    const d = D(), seen = new Set();
    function visitFeature(srcId, srcLabel, f, ctx) {
      const fid = srcId + '/' + (f.id || slug(f.name));
      fn({ type: 'feature', srcId, srcLabel, f, fid, ctx });
      (f.choices || []).forEach(ch => visitChoice(srcId, srcLabel, f, fid, ch, ctx));
    }
    function visitChoice(srcId, srcLabel, f, fid, ch, ctx) {
      const cid = fid + '#' + ch.id;
      const sel = selectionOf(c, cid);
      fn({ type: 'choice', srcId, srcLabel, f, fid, ch, cid, sel, ctx });
      if (ch.kind === 'feat') sel.forEach(fk => { const ft = byKey(d.feats, fk); if (ft && !seen.has(cid + fk)) { seen.add(cid + fk); visitFeat(cid, ft, ctx); } });
      if (ch.kind === 'options') sel.forEach(ok => {
        const o = (ch.options || []).find(x => x.key === ok); if (!o) return;
        fn({ type: 'option', srcId, srcLabel, f, fid, ch, cid, o, ctx });
        (o.choices || []).forEach(ch2 => visitChoice(srcId, srcLabel, o, cid + '.' + ok, ch2, ctx));
      });
    }
    function visitFeat(parentId, ft, ctx) {
      const fid = 'feat:' + ft.key + '@' + parentId;
      fn({ type: 'feat', srcId: fid, srcLabel: ft.name, ft, ctx });
      (ft.features || [{ name: ft.name, desc: ft.desc, effects: ft.effects, choices: ft.choices, uses: ft.uses }]).forEach(f => visitFeature(fid, ft.name, f, ctx));
    }
    collectSources(c).forEach(src => src.features.forEach(f => visitFeature(src.id, src.label, f, { src })));
    const bg = byKey(d.backgrounds, c.background);
    if (bg && bg.feat) { const ft = byKey(d.feats, bg.feat); if (ft) visitFeat('bg:' + bg.key, ft, { src: { kind: 'background' } }); }
    asiSlots(c).forEach(slot => {
      const v = c.asi[slot.id];
      if (v && v.type === 'feat' && v.feat) { const ft = byKey(d.feats, v.feat); if (ft) visitFeat('asi:' + slot.id, ft, { src: { kind: 'class' } }); }
    });
  }

  function needCount(ch, c) {
    if (typeof ch.count === 'number') return ch.count;
    if (Array.isArray(ch.count)) {
      const lvl = ch.classKey ? classLevel(c, ch.classKey) : totalLevel(c);
      return ch.count[Math.min(Math.max(lvl, 1), ch.count.length) - 1] || 0;
    }
    return 1;
  }

  function evalUses(u, c, r) {
    let m = u.max;
    if (Array.isArray(m)) { const lvl = u.classKey ? classLevel(c, u.classKey) : r.total; m = m[Math.min(Math.max(lvl, 1), m.length) - 1] || 0; }
    else if (m === 'prof') m = r.pb;
    else if (typeof m === 'string' && /Mod\+1$/.test(m)) m = Math.max(1, r.mods[m.slice(0, 3)] + 1);
    else if (typeof m === 'string' && /Mod$/.test(m)) m = Math.max(1, r.mods[m.slice(0, 3)]);
    return m;
  }

  function compute(c) {
    const d = D(), R = d.rules, total = totalLevel(c);
    const r = { total, pb: pbFor(total), warnings: [], features: [], resources: [], choicesNeeded: [], feats: [] };
    const prof = { skills: {}, expertise: {}, saves: {}, tools: {}, weapons: {}, armor: {}, languages: {} };
    const abilityBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const eff = { speed: 0, speedBase: null, senses: {}, resist: {}, hpFlat: 0, hpPerLevel: 0, init: 0, initProf: false, acBase: [], acBonus: [], atk: [], spells: [], notes: [], cap: {} };
    const choiceList = [];

    function applyEffects(list, ev) {
      (list || []).forEach(e => { try {
        if (e.minLevel && total < e.minLevel) return;
        switch (e.t) {
          case 'save': e.v.forEach(a => prof.saves[a] = true); break;
          case 'skill': e.v.forEach(a => prof.skills[a] = true); break;
          case 'tool': e.v.forEach(a => prof.tools[a] = true); break;
          case 'weapon': e.v.forEach(a => prof.weapons[a] = true); break;
          case 'armor': e.v.forEach(a => prof.armor[a] = true); break;
          case 'language': e.v.forEach(a => prof.languages[a] = true); break;
          case 'speed': eff.speed += e.v; break;
          case 'speedBase': eff.speedBase = Math.max(eff.speedBase || 0, e.v); break;
          case 'sense': eff.senses[e.name] = Math.max(eff.senses[e.name] || 0, e.range); break;
          case 'resist': e.v.forEach(a => eff.resist[a] = true); break;
          case 'hp': if (e.perLevel) eff.hpPerLevel += e.v; else eff.hpFlat += e.v; break;
          case 'init': eff.init += e.v; break;
          case 'initProf': eff.initProf = true; break;
          case 'acBase': eff.acBase.push(e); break;
          case 'acBonus': eff.acBonus.push(e); break;
          case 'atkBonus': eff.atk.push(e); break;
          case 'ability': abilityBonus[e.ability] += e.v; break;
          case 'abilityCap': eff.cap[e.ability] = Math.max(eff.cap[e.ability] || 0, e.v); break;
          case 'spell': eff.spells.push(Object.assign({}, e, { source: ev.srcLabel, ctx: ev.fid })); break;
        }
        } catch (x) { /* ignore a malformed effect */ }
      });
    }

    walk(c, ev => {
      if (ev.type === 'feature') {
        const f = ev.f;
        r.features.push({ srcId: ev.srcId, source: ev.srcLabel, name: f.name, desc: f.desc, level: f.level, fid: ev.fid, hidden: f.hidden, kind: ev.ctx && ev.ctx.src && ev.ctx.src.kind });
        applyEffects(f.effects, ev);
        if (f.uses) r.resources.push({ name: f.name, uses: f.uses, source: ev.srcLabel, fid: ev.fid });
      } else if (ev.type === 'choice') choiceList.push(ev);
      else if (ev.type === 'option') {
        const o = ev.o;
        r.features.push({ srcId: ev.srcId, source: ev.srcLabel, name: o.name, desc: o.desc, fid: ev.cid + '.' + o.key, optionOf: ev.ch.label, hidden: o.hidden, kind: ev.ctx && ev.ctx.src && ev.ctx.src.kind });
        applyEffects(o.effects, ev);
        if (o.uses) r.resources.push({ name: o.name, uses: o.uses, source: ev.srcLabel, fid: ev.cid + '.' + o.key });
      } else if (ev.type === 'feat') r.feats.push({ key: ev.ft.key, name: ev.ft.name, category: ev.ft.category });
    });

    choiceList.forEach(ev => {
      const ch = ev.ch, sel = ev.sel, need = needCount(ch, c);
      if (sel.length < need) r.choicesNeeded.push({ cid: ev.cid, label: ev.srcLabel + ': ' + ch.label, have: sel.length, need });
      if (ch.kind === 'skills') sel.forEach(k => prof.skills[k] = true);
      else if (ch.kind === 'expertise') sel.forEach(k => prof.expertise[k] = true);
      else if (ch.kind === 'tools') sel.forEach(k => prof.tools[k] = true);
      else if (ch.kind === 'languages') sel.forEach(k => prof.languages[k] = true);
      else if (ch.kind === 'skilltool') sel.forEach(k => { if (d.skills.some(s => s.key === k)) prof.skills[k] = true; else prof.tools[k] = true; });
      else if (ch.kind === 'abilitypick') sel.forEach(k => { abilityBonus[k] += (ch.bonus || 0); });
      else if (ch.kind === 'spell') {
        let ab = ch.ability || null;
        if (ch.abilityFrom) ab = firstSel(c, ev.fid + '#' + ch.abilityFrom) || null;
        sel.forEach(k => eff.spells.push({ t: 'spell', key: k, kind: ch.level === 0 ? 'cantrip' : 'prepared', ability: ab, source: ev.srcLabel, innate: !!ch.innate, uses: ch.uses }));
      }
    });

    /* ability scores */
    const base = Object.assign({}, c.base);
    if (c.method === 'standard' || c.method === 'roll') ABIL.forEach(a => { base[a] = c.stdAssign[a] || 8; });
    else if (c.method === 'pointbuy') ABIL.forEach(a => { base[a] = c.pointBuy[a]; });
    r.base = base;
    const asiBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    r.bgBonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const bg = byKey(d.backgrounds, c.background);
    if (R.asiFrom === 'background' && bg) {
      const b = c.bgAsi || {};
      if (b.mode === 'twoone') {
        if (b.plus2 && bg.abilities.includes(b.plus2)) r.bgBonus[b.plus2] += 2;
        if (b.plus1 && bg.abilities.includes(b.plus1) && b.plus1 !== b.plus2) r.bgBonus[b.plus1] += 1;
      } else if (b.mode === 'oneoneone') bg.abilities.forEach(a => r.bgBonus[a] += 1);
    }
    const cap = {}; ABIL.forEach(a => cap[a] = Math.max(20, eff.cap[a] || 0));
    asiSlots(c).forEach(slot => {
      const v = c.asi[slot.id]; if (!v) return;
      if (v.type === 'asi') {
        if (v.a && v.b && v.a === v.b) asiBonus[v.a] += 2; else { if (v.a) asiBonus[v.a] += 1; if (v.b) asiBonus[v.b] += 1; }
      } else if (v.type === 'feat' && v.feat) {
        const ft = byKey(d.feats, v.feat);
        if (ft && ft.asi) {
          const a = firstSel(c, 'asi:' + slot.id + '#abil') || ft.asi[0];
          asiBonus[a] += ft.asiAmount || 1; if (ft.category === 'Epic Boon') cap[a] = 30;
        }
      }
    });
    r.scores = {}; r.mods = {};
    ABIL.forEach(a => {
      const s = base[a] + abilityBonus[a] + r.bgBonus[a] + asiBonus[a];
      r.scores[a] = Math.min(s, Math.max(cap[a], base[a])); r.mods[a] = mod(r.scores[a]);
    });
    r.abilityBonus = abilityBonus; r.asiBonus = asiBonus;

    /* class proficiencies (first class: full; later classes: multiclass subset) */
    c.classes.forEach((k, idx) => {
      const cl = byKey(d.classes, k.key); if (!cl) return;
      const P = idx === 0 ? cl.profs : cl.multiProfs; if (!P) return;
      (P.saves || []).forEach(a => prof.saves[a] = true);
      (P.armor || []).forEach(a => prof.armor[a] = true);
      (P.weapons || []).forEach(a => prof.weapons[a] = true);
      (P.tools || []).forEach(a => prof.tools[a] = true);
    });
    r.prof = prof;

    r.skills = d.skills.map(s => {
      const p = !!prof.skills[s.key], e = p && !!prof.expertise[s.key];
      return { key: s.key, name: s.name, ability: s.ability, prof: p, expertise: e, bonus: r.mods[s.ability] + (p ? r.pb * (e ? 2 : 1) : 0) };
    });
    r.saves = ABIL.map(a => ({ key: a, prof: !!prof.saves[a], bonus: r.mods[a] + (prof.saves[a] ? r.pb : 0) }));

    /* hit points */
    let hp = 0, first = true; r.hitDice = {};
    c.classes.forEach(k => {
      const cl = byKey(d.classes, k.key); if (!cl) return;
      r.hitDice[cl.hitDie] = (r.hitDice[cl.hitDie] || 0) + k.level;
      for (let l = 1; l <= k.level; l++) {
        if (first) { hp += cl.hitDie; first = false; }
        else { const roll = (c.hpRolls || {})[k.key + ':' + l]; hp += roll != null ? roll : Math.floor(cl.hitDie / 2) + 1; }
        hp += r.mods.con;
      }
    });
    hp += eff.hpFlat + eff.hpPerLevel * total;
    r.hp = total ? Math.max(1, hp) : 0;

    const sp = byKey(d.species, c.species);
    const sub = sp && pickedSub(c, sp);
    r.speed = (eff.speedBase || (sub && sub.speed) || (sp && sp.speed) || 30) + eff.speed;
    r.size = c.sizeChoice || (sp && (Array.isArray(sp.size) ? sp.size[0] : sp.size)) || 'Medium';
    r.senses = eff.senses; r.resist = Object.keys(eff.resist);

    /* armor class */
    const eqItems = (c.equipment.items || []).filter(i => i.equipped);
    const armorEq = eqItems.map(i => i.ref && i.ref.startsWith('armor:') ? byKey(d.armor, i.ref.slice(6)) : null).filter(Boolean);
    const body = armorEq.find(a => a.category !== 'shield'), shield = armorEq.find(a => a.category === 'shield');
    const dexm = r.mods.dex, acOpts = [];
    if (body) acOpts.push({ v: body.ac + (body.dex === 'full' ? dexm : body.dex === 'max2' ? Math.min(2, dexm) : 0), label: body.name });
    else {
      acOpts.push({ v: 10 + dexm, label: 'Unarmored' });
      eff.acBase.forEach(e => { if (e.shield === false && shield) return; acOpts.push({ v: 10 + dexm + (e.bonus || 0) + e.abilities.reduce((s, a) => s + r.mods[a], 0), label: e.label || 'Unarmored Defense' }); });
    }
    const best = acOpts.reduce((a, b) => (b.v > a.v ? b : a));
    let ac = best.v + (shield ? shield.ac : 0);
    eff.acBonus.forEach(e => { if (e.cond === 'armor' && !body) return; ac += e.v; });
    r.ac = ac; r.acNote = best.label + (shield ? ' + Shield' : '');
    if (body && body.strReq && r.scores.str < body.strReq) r.speed = Math.max(0, r.speed - 10), r.warnings.push(body.name + ' needs Strength ' + body.strReq + ': your Speed is reduced by 10 ft.');
    if (body && !prof.armor[body.category]) r.warnings.push('Not trained with ' + body.category + ' armor: Disadvantage on Str/Dex D20 Tests and you can’t cast spells.');
    if (shield && !prof.armor.shield) r.warnings.push('Not trained with Shields.');

    r.init = r.mods.dex + eff.init + (eff.initProf ? r.pb : 0);
    const sk = k => r.skills.find(s => s.key === k).bonus;
    r.passive = { perception: 10 + sk('perception'), insight: 10 + sk('insight'), investigation: 10 + sk('investigation') };
    if (R.languageChoice) { prof.languages['Common'] = true; selectionOf(c, 'origin#languages').forEach(l => prof.languages[l] = true); }
    r.languages = Object.keys(prof.languages);
    if (R.languageChoice && selectionOf(c, 'origin#languages').length < R.languageChoice) r.choicesNeeded.push({ section: 'origin', label: 'Choose ' + R.languageChoice + ' languages' });

    computeSpells(c, r, eff);
    computeAttacks(c, r, eff, eqItems);
    r.resourceList = r.resources.map(x => ({ name: x.name, source: x.source, max: evalUses(x.uses, c, r), per: x.uses.per, fid: x.fid })).filter(x => x.max > 0);

    /* outstanding decisions */
    asiSlots(c).forEach(slot => {
      const v = c.asi[slot.id];
      if (!v || (v.type === 'asi' && !v.a) || (v.type === 'feat' && !v.feat)) r.choicesNeeded.push({ section: 'class', asi: slot.id, label: byKey(d.classes, slot.classKey).name + ' level ' + slot.level + ': ' + (slot.boon ? 'Epic Boon' : 'Ability Score Improvement or feat') });
    });
    if (R.asiFrom === 'background' && bg && !(c.bgAsi && ((c.bgAsi.mode === 'twoone' && c.bgAsi.plus2 && c.bgAsi.plus1) || c.bgAsi.mode === 'oneoneone'))) r.choicesNeeded.push({ section: 'origin', label: 'Background: assign ability score increases' });
    if (!c.species) r.choicesNeeded.push({ section: 'origin', label: 'Choose a species' });
    if (!c.background) r.choicesNeeded.push({ section: 'origin', label: 'Choose a background' });
    if (!c.classes.length) r.choicesNeeded.push({ section: 'class', label: 'Choose a class' });
    c.classes.forEach(k => { const cl = byKey(d.classes, k.key); if (cl && k.level >= (cl.subclassLevel || 3) && !k.subclass) r.choicesNeeded.push({ section: 'class', label: cl.name + ': choose a subclass' }); });
    if ((c.method === 'standard' || c.method === 'roll') && ABIL.some(a => !c.stdAssign[a])) r.choicesNeeded.push({ section: 'abilities', label: 'Assign every standard-array score' });
    r.spellcasting.forEach(s => {
      const sel = (c.spells[s.classKey] || {});
      const nc = (sel.cantrips || []).length, np = (sel.prepared || []).length;
      if (nc < s.cantrips) r.choicesNeeded.push({ section: 'spells', label: s.name + ': ' + (s.cantrips - nc) + ' cantrip(s) left to choose' });
      if (s.kind === 'book') { const nb = (sel.book || []).length; if (nb < s.spellbook) r.choicesNeeded.push({ section: 'spells', label: s.name + ': ' + (s.spellbook - nb) + ' spellbook spell(s) left' }); }
      if (np < s.prepared && s.kind !== 'book') r.choicesNeeded.push({ section: 'spells', label: s.name + ': ' + (s.prepared - np) + ' spell(s) left to ' + (s.kind === 'known' ? 'learn' : 'prepare') });
    });
    r.choiceList = choiceList; r.eff = eff;
    return r;
  }

  function computeSpells(c, r, eff) {
    const d = D(), R = d.rules;
    r.spellcasting = []; let casterLevel = 0, pact = null;
    c.classes.forEach(k => {
      const cl = byKey(d.classes, k.key); if (!cl || !cl.spell) return;
      const S = cl.spell, lvl = k.level;
      if (S.startLevel && lvl < S.startLevel) return;
      const mood = r.mods[S.ability];
      const cantrips = S.cantrips ? (S.cantrips[lvl - 1] || 0) : 0;
      let prepared = 0;
      if (S.known) prepared = S.known[lvl - 1] || 0;
      else if (S.prepared) prepared = S.prepared[lvl - 1] || 0;
      else if (S.preparedFormula === 'mod+level') prepared = Math.max(1, mood + lvl);
      else if (S.preparedFormula === 'mod+halflevel') prepared = Math.max(1, mood + Math.floor(lvl / 2));
      const maxLevel = S.caster === 'pact' ? PACT[lvl - 1][1] : (((S.caster === 'full' ? FULL_SLOTS : HALF_SLOTS)[lvl - 1]) || []).length;
      const spellbook = S.book ? S.book.start + S.book.perLevel * (lvl - 1) : 0;
      r.spellcasting.push({ classKey: cl.key, name: cl.name, ability: S.ability, dc: 8 + r.pb + mood, attack: r.pb + mood, cantrips, prepared, kind: S.kind || 'prepared', maxLevel, spellbook, list: S.list || cl.name, caster: S.caster, level: lvl, ritualFromBook: !!S.ritualCasting });
      if (S.caster === 'full') casterLevel += lvl;
      else if (S.caster === 'half') casterLevel += R.multiclassRoundUp ? Math.ceil(lvl / 2) : Math.floor(lvl / 2);
      else if (S.caster === 'pact') pact = { slots: PACT[lvl - 1][0], level: PACT[lvl - 1][1] };
    });
    const regular = r.spellcasting.filter(s => s.caster !== 'pact');
    if (regular.length === 1 && c.classes.length === 1) {
      const s = regular[0]; r.slots = ((s.caster === 'full' ? FULL_SLOTS : HALF_SLOTS)[s.level - 1] || []).slice();
    } else r.slots = casterLevel > 0 ? FULL_SLOTS[Math.min(20, casterLevel) - 1].slice() : [];
    r.pact = pact;
    r.grantedSpells = eff.spells.map(s => {
      const sp = byKey(d.spells, s.key); let ab = s.ability;
      if (ab === 'class') ab = (r.spellcasting[0] || {}).ability || 'int';
      else if (ab && ab.charAt(0) === '$') ab = firstSel(c, s.ctx + '#' + ab.slice(1)) || null;
      return Object.assign({}, s, { spell: sp, ability: ab });
    }).filter(s => s.spell);
  }

  function weaponProficient(prof, w) {
    if (prof.weapons[w.category] || prof.weapons[w.key]) return true;
    const pl = w.propList || [];
    if (w.category === 'martial' && prof.weapons['martial:light'] && pl.some(p => /^Light/.test(p))) return true;
    if (w.category === 'martial' && prof.weapons['martial:finesse-light'] && pl.some(p => /^(Light|Finesse)/.test(p))) return true;
    return false;
  }

  function computeAttacks(c, r, eff, eqItems) {
    const d = D(); r.attacks = [];
    const mast = new Set();
    Object.keys(c.choices).forEach(k => { if (/#mastery$/.test(k)) selectionOf(c, k).forEach(w => mast.add(w)); });
    r.mastered = Array.from(mast);
    const monk = c.classes.find(k => k.key === 'monk');
    eqItems.forEach(i => {
      if (!i.ref || !i.ref.startsWith('weapon:')) return;
      const w = byKey(d.weapons, i.ref.slice(7)); if (!w) return;
      const pl = w.propList || [];
      const finesse = pl.some(p => /^Finesse/.test(p)), ranged = w.kind === 'ranged';
      let ab = ranged ? 'dex' : 'str';
      if (finesse && r.mods.dex > r.mods.str) ab = 'dex';
      let martial = false;
      const mw = d.rules.monkWeapons ? d.rules.monkWeapons.includes(w.key) : pl.some(p => /^Light/.test(p));
      if (monk && d.rules.martialArts && !ranged && (w.category === 'simple' || mw) && !pl.some(p => /^(Heavy|Two-Handed)/.test(p))) { martial = true; if (r.mods.dex > r.mods[ab]) ab = 'dex'; }
      const p = weaponProficient(r.prof, w);
      let atk = r.mods[ab] + (p ? r.pb : 0);
      eff.atk.forEach(e => { if (!e.cond || (e.cond === 'ranged' && ranged) || (e.cond === 'melee' && !ranged)) atk += e.v; });
      let die = w.damage;
      if (martial) { const md = martialDie(monk.level); const n = parseInt(die, 10); if (/^1d/.test(die) && parseInt(md.slice(1), 10) > parseInt(die.slice(2), 10)) die = '1' + md; }
      const dm = r.mods[ab];
      r.attacks.push({ name: i.name || w.name, ref: w.key, atk, dmg: die + (dm ? signed(dm) : ''), type: w.damageType, props: w.props, mastery: (d.rules.weaponMastery && mast.has(w.key)) ? w.mastery : null, proficient: p, ability: ab });
    });
    const useMA = monk && d.rules.martialArts;
    const us = useMA ? Math.max(r.mods.str, r.mods.dex) : r.mods.str;
    r.attacks.push({ name: 'Unarmed Strike', atk: us + r.pb, dmg: useMA ? ('1' + martialDie(monk.level) + (us ? signed(us) : '')) : String(1 + us), type: 'Bludgeoning', props: '', proficient: true });
  }

  function martialDie(level) { const t = D().rules.martialArtsDice || [[1, 'd6']]; let die = t[0][1]; t.forEach(p => { if (level >= p[0]) die = p[1]; }); return die; }
  const pointBuyCost = pb => ABIL.reduce((s, a) => s + (D().rules.pointBuy.costs[pb[a]] || 0), 0);

  global.Engine = { ABIL, mod, signed, pbFor, uid, slug, byKey, newCharacter, totalLevel, classLevel, compute, walk, collectSources, asiSlots, selectionOf, firstSel, needCount, pointBuyCost, weaponProficient, FULL_SLOTS, HALF_SLOTS, PACT, pickedSub, evalUses, martialDie };
})(window);
