(function(){
"use strict";
const LETTERS = "ABCDE";
const KEY = "s5-qstats";
let DB = null, ST = {}, view = {name:"home"};
try{ ST = JSON.parse(localStorage.getItem(KEY) || "{}"); }catch(e){ ST = {}; }
const save = () => { try{ localStorage.setItem(KEY, JSON.stringify(ST)); }catch(e){} };
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const para = s => esc(s).split(/\n{2,}/).map(p => "<p>"+p.replace(/\n/g,"<br>")+"</p>").join("");
const root = () => document.getElementById("quiz");

function stat(id){ return ST[id] || null; }       // [seen, right, last(1|0)]
function record(id, ok){
  const s = ST[id] || [0,0,0];
  s[0]++; if(ok) s[1]++; s[2] = ok ? 1 : 0; ST[id] = s; save();
}
function subjectQs(sid){ return DB.questions.filter(q => q.s === sid); }
function groupQs(g){ const ids = new Set(DB.subjects.filter(s => s.group === g).map(s => s.id)); return DB.questions.filter(q => ids.has(q.s)); }
function summary(qs){
  let seen = 0, mastered = 0, wrong = 0;
  qs.forEach(q => { const s = stat(q.id); if(s){ seen++; if(s[2]) mastered++; else wrong++; } });
  return {n: qs.length, seen, mastered, wrong};
}
function pick(qs, n){
  // priorité : jamais vues, puis ratées la dernière fois, puis le reste ; mélange à l'intérieur
  const w = qs.map(q => { const s = stat(q.id); const base = !s ? 2 : (s[2] ? 0 : 3); return {q, k: base + Math.random()*1.5}; });
  w.sort((a,b) => b.k - a.k);
  let chosen = w.slice(0, n).map(x => x.q);
  // garder les questions d'un même passage ensemble et dans l'ordre
  chosen.sort((a,b) => (a.p||"").localeCompare(b.p||"") || a.id.localeCompare(b.id));
  if(!chosen.some(q => q.p)) chosen = shuffle(chosen);
  return chosen;
}
function shuffle(a){ a = a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

// ---------- views ----------
function render(){
  const r = root(); if(!r) return;
  if(!DB){ r.innerHTML = `<p class="sub">Chargement des questions…</p>`; return; }
  if(view.name === "home") return renderHome(r);
  if(view.name === "q") return renderQ(r);
  if(view.name === "end") return renderEnd(r);
}
function bar(sm){ const p = sm.n ? Math.round(sm.mastered/sm.n*100) : 0; return `<div class="bar small"><i style="width:${p}%"></i></div>`; }
function renderHome(r){
  const groups = [["S5","Cours du S5"],["TAGE","TAGE MAGE"],["TOEIC","TOEIC (lecture)"]];
  const all = summary(DB.questions);
  r.innerHTML = `
  <header><h1>Réviser</h1><p class="sub">${all.n} questions. Les séries te proposent d'abord ce que tu n'as jamais vu, puis ce que tu as raté.</p></header>
  <div><div class="bar"><i style="width:${all.n?Math.round(all.mastered/all.n*100):0}%"></i></div>
  <div class="stats"><span>${all.mastered} réussies la dernière fois</span><span>${all.wrong} à revoir</span></div></div>
  ${groups.map(([g, label]) => {
    const subs = DB.subjects.filter(s => s.group === g); if(!subs.length) return "";
    const gs = summary(groupQs(g));
    return `<section class="phase"><h2>${label}<small>${gs.mastered}/${gs.n}</small></h2>
    ${g==="TAGE" ? `<p class="pd">Épreuve = 15 questions en 20 minutes, sans correction avant la fin, barème du TAGE MAGE (+4 bonne réponse, −1 mauvaise, 0 sans réponse).</p>` : ""}
    ${g==="S5" ? `<div class="row"><button data-mix="S5">Mélange de tout le S5 · 20</button>${gs.wrong?`<button data-mixwrong="S5">Toutes mes erreurs du S5 · ${gs.wrong}</button>`:""}</div>` : ""}
    <ul class="subjects">${subs.map(s => { const sm = summary(subjectQs(s.id)); return `<li class="subj">
      <div class="body"><span class="tt">${esc(s.name)}</span><span class="dd">${sm.n} questions · ${sm.seen} vues · ${sm.wrong} à revoir</span>${bar(sm)}</div>
      <div class="row">
        <button class="primary" data-run="${s.id}" data-n="10">10</button>
        <button data-run="${s.id}" data-n="20">20</button>
        ${sm.wrong ? `<button data-wrong="${s.id}">Erreurs (${sm.wrong})</button>` : ""}
        ${g==="TAGE" ? `<button data-exam="${s.id}">Épreuve 20 min</button>` : ""}
      </div></li>`; }).join("")}</ul></section>`;
  }).join("")}
  <section class="add"><span class="eyebrow">Remettre à zéro</span><span class="sub">Efface ton historique de réponses (pas tes coches de la checklist).</span>
  <div class="row"><button id="qreset">${view.confirmReset ? "Confirmer l'effacement" : "Effacer mon historique"}</button>${view.confirmReset?`<button id="qresetno">Annuler</button>`:""}</div></section>`;
}
function start(qs, opts){
  if(!qs.length) return;
  view = {name:"q", qs, i:0, answers:{}, revealed:false, exam: !!(opts&&opts.exam), title: opts.title, deadline: opts.exam ? (Date.now() + 20*60*1000) : 0};
  if(view.exam) tick();
  render(); window.scrollTo(0,0);
}
let timerId = null;
function tick(){
  clearInterval(timerId);
  timerId = setInterval(() => {
    if(view.name !== "q" || !view.exam){ clearInterval(timerId); return; }
    const left = view.deadline - Date.now();
    const el = document.getElementById("qtimer");
    if(left <= 0){ clearInterval(timerId); finish(); return; }
    if(el) el.textContent = fmt(left);
  }, 1000);
}
const fmt = ms => { const s = Math.ceil(ms/1000); return Math.floor(s/60)+":"+String(s%60).padStart(2,"0"); };
function renderQ(r){
  const q = view.qs[view.i], total = view.qs.length, chosen = view.answers[q.id];
  const subj = DB.subjects.find(s => s.id === q.s);
  const pas = q.p && DB.passages[q.p];
  const show = view.revealed && !view.exam;
  r.innerHTML = `
  <div class="qhead"><button id="qquit">← Quitter</button><span class="min">${view.i+1} / ${total}</span>${view.exam?`<span class="timer" id="qtimer">${fmt(view.deadline-Date.now())}</span>`:""}</div>
  <div class="bar small"><i style="width:${Math.round(view.i/total*100)}%"></i></div>
  <div class="tag">${esc(subj ? subj.name : "")}${q.c ? " · "+esc(q.c) : ""}</div>
  ${pas ? `<details class="passage" ${view.passageOpen===q.p?"":"open"}><summary>${esc(pas.title || "Texte")}</summary><div class="ptext">${para(pas.text)}</div></details>` : ""}
  <div class="qtext">${para(q.q)}</div>
  <div class="opts">${q.o.map((o,k) => {
    let cls = "opt";
    if(show){ if(k === q.a) cls += " good"; else if(k === chosen) cls += " bad"; }
    else if(k === chosen) cls += " picked";
    return `<button class="${cls}" data-opt="${k}" ${show?"disabled":""}><b>${LETTERS[k]}</b><span>${esc(o)}</span></button>`;
  }).join("")}</div>
  ${show ? `<div class="expl ${chosen===q.a?"ok":"ko"}"><b>${chosen===q.a?"Bonne réponse.":"Raté : la bonne réponse est "+LETTERS[q.a]+"."}</b> ${esc(q.e||"")}</div>` : ""}
  <div class="row">
    ${view.exam ? `<button data-nav="-1" ${view.i===0?"disabled":""}>Précédente</button><button class="primary" data-nav="1">${view.i===total-1?"Terminer l'épreuve":"Suivante"}</button>`
      : (show ? `<button class="primary" id="qnext">${view.i===total-1?"Voir le résultat":"Suivante"}</button>` : `<span class="sub">Touche une réponse.</span>`)}
  </div>`;
}
function renderEnd(r){
  const qs = view.qs; let good = 0, bad = 0, skip = 0;
  qs.forEach(q => { const a = view.answers[q.id]; if(a === undefined) skip++; else if(a === q.a) good++; else bad++; });
  const missed = qs.filter(q => view.answers[q.id] !== q.a);
  r.innerHTML = `
  <header><h1>${good} / ${qs.length}</h1><p class="sub">${esc(view.title||"")}${view.exam ? ` · score TAGE MAGE : <b>${good*4 - bad}</b> / ${qs.length*4} (${good} bonnes, ${bad} fausses, ${skip} sans réponse)` : ""}</p></header>
  <div class="row"><button class="primary" id="qhome">Retour aux matières</button>${missed.length?`<button id="qredo">Refaire mes ${missed.length} erreurs</button>`:""}</div>
  ${missed.length ? `<section class="phase"><h2>À revoir</h2><ul>${missed.map(q => `<li class="review">
    <div class="body"><span class="tt">${esc(q.q.length>220?q.q.slice(0,220)+"…":q.q)}</span>
    <span class="dd">Bonne réponse : <b>${LETTERS[q.a]}. ${esc(q.o[q.a])}</b>${view.answers[q.id]!==undefined?` · ta réponse : ${LETTERS[view.answers[q.id]]}`:" · pas de réponse"}</span>
    <span class="dd">${esc(q.e||"")}</span></div></li>`).join("")}</ul></section>` : `<p class="sub">Aucune erreur sur cette série.</p>`}`;
}
function finish(){
  clearInterval(timerId);
  if(view.exam){ view.qs.forEach(q => { const a = view.answers[q.id]; if(a !== undefined) record(q.id, a === q.a); else record(q.id, false); }); }
  view.name = "end"; render(); window.scrollTo(0,0);
}

document.addEventListener("click", e => {
  const b = e.target.closest("#quiz button"); if(!b || !DB) return;
  if(b.dataset.run){ const s = DB.subjects.find(x => x.id === b.dataset.run); start(pick(subjectQs(b.dataset.run), +b.dataset.n), {title: s.name}); }
  else if(b.dataset.wrong){ const s = DB.subjects.find(x => x.id === b.dataset.wrong); start(shuffle(subjectQs(b.dataset.wrong).filter(q => { const t = stat(q.id); return t && !t[2]; })).slice(0,30), {title: s.name+" · erreurs"}); }
  else if(b.dataset.exam){ const s = DB.subjects.find(x => x.id === b.dataset.exam); start(pick(subjectQs(b.dataset.exam), 15), {exam:true, title: s.name+" · épreuve"}); }
  else if(b.dataset.mix){ start(shuffle(pick(groupQs(b.dataset.mix).filter(q => !q.p), 20)), {title:"Mélange S5"}); }
  else if(b.dataset.mixwrong){ start(shuffle(groupQs(b.dataset.mixwrong).filter(q => { const t = stat(q.id); return t && !t[2]; })).slice(0,30), {title:"Erreurs du S5"}); }
  else if(b.dataset.opt !== undefined){
    const q = view.qs[view.i], k = +b.dataset.opt;
    if(view.exam){ view.answers[q.id] = (view.answers[q.id] === k ? undefined : k); render(); }
    else if(!view.revealed){ view.answers[q.id] = k; view.revealed = true; record(q.id, k === q.a); view.passageOpen = null; render(); }
  }
  else if(b.id === "qnext"){ if(view.i === view.qs.length-1) finish(); else { view.i++; view.revealed = false; render(); window.scrollTo(0,0); } }
  else if(b.dataset.nav){ const d = +b.dataset.nav; if(d > 0 && view.i === view.qs.length-1) finish(); else { view.i = Math.max(0, Math.min(view.qs.length-1, view.i+d)); render(); window.scrollTo(0,0); } }
  else if(b.id === "qquit" || b.id === "qhome"){ clearInterval(timerId); view = {name:"home"}; render(); window.scrollTo(0,0); }
  else if(b.id === "qredo"){ const missed = view.qs.filter(q => view.answers[q.id] !== q.a); start(missed, {title: (view.title||"")+" · erreurs", exam:false}); }
  else if(b.id === "qreset"){ if(view.confirmReset){ ST = {}; save(); view.confirmReset = false; } else view.confirmReset = true; render(); }
  else if(b.id === "qresetno"){ view.confirmReset = false; render(); }
});

window.S5Quiz = { render };
fetch("questions.json").then(r => r.json()).then(d => { DB = d; render(); }).catch(() => { const r = root(); if(r) r.innerHTML = `<p class="sub">Impossible de charger les questions. Ouvre l'app une fois avec internet.</p>`; });
})();
