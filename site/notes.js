
(function(){
const still=matchMedia('(prefers-reduced-motion: reduce)').matches;window.TUTLIX_STILL=still;
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
/* flip cards */
document.addEventListener('click',e=>{const f=e.target.closest('.flip');if(!f)return;f.setAttribute('aria-pressed',String(f.getAttribute('aria-pressed')!=='true'));});
/* flashcards */
$$('[data-terms]').forEach(deck=>{JSON.parse(deck.dataset.terms).forEach(([t,d])=>{const b=document.createElement('button');b.className='flip';b.type='button';b.setAttribute('aria-pressed','false');
  b.innerHTML='<span class="in"><span class="f"><span class="name"></span><span class="hint">tap to flip</span></span><span class="b"><span class="name"></span><span class="d"></span></span></span>';
  b.querySelectorAll('.name').forEach(n=>n.textContent=t);b.querySelector('.d').textContent=d;deck.appendChild(b);});});
/* progress + rail */
const bar=document.getElementById('bar'),links=$$('.rail a'),secs=links.map(a=>document.querySelector(a.getAttribute('href')));
function onScroll(){const h=document.documentElement,max=h.scrollHeight-h.clientHeight;if(bar)bar.style.width=(max>0?h.scrollTop/max*100:0)+'%';
  let cur=0;secs.forEach((s,i)=>{if(s&&s.getBoundingClientRect().top<140)cur=i;});links.forEach((a,i)=>a.classList.toggle('on',i===cur));}
addEventListener('scroll',onScroll,{passive:true});onScroll();
const shuffle=a=>a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]);
/* MCQ quiz */
$$('[data-quiz]').forEach(box=>{const items=JSON.parse(box.dataset.quiz);let score=0,done=0;
  const head=document.createElement('div');head.className='qbar';head.innerHTML='<span class="score">Score 0 / '+items.length+'</span><button class="btn small alt" type="button">Try again</button>';box.appendChild(head);
  const list=document.createElement('div');list.className='quiz';box.appendChild(list);
  function build(){list.innerHTML='';score=0;done=0;head.querySelector('.score').textContent='Score 0 / '+items.length;
    items.forEach((it,qi)=>{const d=document.createElement('div');d.className='qitem';d.innerHTML='<div class="qq"></div><div class="qopts"></div><p class="qexp" hidden></p>';
      d.querySelector('.qq').textContent=(qi+1)+'. '+it.q;const ops=d.querySelector('.qopts');
      shuffle(it.o.map((o,i)=>[o,i])).forEach(([o,i])=>{const b=document.createElement('button');b.type='button';b.className='qopt';b.textContent=o;
        b.addEventListener('click',()=>{ $$('.qopt',ops).forEach(x=>{x.disabled=true;if(+x.dataset.i===it.a)x.classList.add('ok');});
          if(i!==it.a)b.classList.add('no');else score++;done++;const ex=d.querySelector('.qexp');ex.hidden=false;ex.textContent=(i===it.a?'✓ Correct. ':'✗ Not quite. ')+(it.e||'');
          head.querySelector('.score').textContent='Score '+score+' / '+items.length+(done===items.length?(score===items.length?'  🎉 perfect!':''):'');});
        b.dataset.i=i;ops.appendChild(b);});list.appendChild(d);});}
  head.querySelector('button').addEventListener('click',build);build();});
/* sorter */
$$('[data-sorter]').forEach(box=>{const cfg=JSON.parse(box.dataset.sorter);const N=cfg.items.length;
  box.innerHTML='<div class="sort"><div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><span class="score">0 / '+N+'</span><button class="btn small alt" type="button">Start again</button></div><div class="pool"></div><div class="bins"></div><p class="gmsg" role="status"></p></div>';
  const pool=box.querySelector('.pool'),bins=box.querySelector('.bins'),msg=box.querySelector('.gmsg'),sc=box.querySelector('.score');let sel=null,right=0;
  function build(){pool.innerHTML='';bins.innerHTML='';sel=null;right=0;sc.textContent='0 / '+N;msg.textContent='';
    shuffle(cfg.items).forEach(([txt,k])=>{const b=document.createElement('button');b.type='button';b.className='chipq';b.textContent=txt;b.dataset.k=k;b.setAttribute('aria-pressed','false');
      b.addEventListener('click',()=>{if(b.classList.contains('right'))return;sel=b;$$('.chipq',pool).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$$('.bin',bins).forEach(x=>x.classList.add('ready'));});pool.appendChild(b);});
    cfg.bins.forEach((n,k)=>{const d=document.createElement('button');d.type='button';d.className='bin';d.innerHTML='<span class="bt"></span>';d.querySelector('.bt').textContent=n;
      d.addEventListener('click',()=>{if(!sel){msg.textContent='Tap an item first.';return;}
        if(+sel.dataset.k===k){sel.classList.add('right');sel.setAttribute('aria-pressed','false');d.appendChild(sel);right++;sc.textContent=right+' / '+N;msg.textContent=right===N?'All correct! 🎉':'Correct!';}
        else{const s=sel;s.classList.remove('wrong');void s.offsetWidth;s.classList.add('wrong');msg.textContent='Not quite, try another box.';}
        sel=null;$$('.bin',bins).forEach(x=>x.classList.remove('ready'));});bins.appendChild(d);});}
  box.querySelector('.btn').addEventListener('click',build);build();});
/* put in order */
$$('[data-order]').forEach(box=>{const steps=JSON.parse(box.dataset.order);
  box.innerHTML='<div class="order"><p style="font-size:15px;margin:0">Tap the steps in the correct order, then press Check.</p><div class="olist"></div><div class="qbar"><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn small" type="button" data-a="check">Check</button><button class="btn small alt" type="button" data-a="reset">Shuffle</button></div><p class="gmsg" role="status"></p></div></div>';
  const list=box.querySelector('.olist'),msg=box.querySelector('.gmsg');let picks=[];
  function build(){list.innerHTML='';picks=[];msg.textContent='';
    shuffle(steps.map((s,i)=>[s,i])).forEach(([s,i])=>{const b=document.createElement('button');b.type='button';b.className='ostep';b.dataset.i=i;b.innerHTML='<span class="on"></span><span class="st"></span>';b.querySelector('.st').textContent=s;
      b.addEventListener('click',()=>{const k=picks.indexOf(b);if(k>=0){picks.splice(k,1);}else picks.push(b);
        $$('.ostep',list).forEach(x=>{const p=picks.indexOf(x);x.classList.toggle('picked',p>=0);x.classList.remove('ok','no');x.querySelector('.on').textContent=p>=0?p+1:'';});});list.appendChild(b);});}
  box.querySelector('[data-a=check]').addEventListener('click',()=>{if(picks.length<steps.length){msg.textContent='Tap all '+steps.length+' steps first.';return;}
    let r=0;picks.forEach((b,p)=>{const ok=+b.dataset.i===p;b.classList.add(ok?'ok':'no');if(ok)r++;});msg.textContent=r===steps.length?'Perfect order! 🎉':r+'/'+steps.length+' in the right place. Tap a step to unpick it and try again.';});
  box.querySelector('[data-a=reset]').addEventListener('click',build);build();});
/* tap-to-label */
$$('.labelfig').forEach(fig=>{const info=fig.querySelector('.lfinfo');const hots=$$('.hot',fig);
  hots.forEach(h=>h.addEventListener('click',()=>{const open=h.getAttribute('aria-expanded')!=='true';h.setAttribute('aria-expanded',String(open));
    if(open&&info){info.innerHTML='<b></b> ';info.querySelector('b').textContent=h.dataset.l+':';info.append(h.dataset.d||'');}}));
  const all=fig.querySelector('.reveal-all');if(all)all.addEventListener('click',()=>{const any=hots.some(h=>h.getAttribute('aria-expanded')!=='true');hots.forEach(h=>h.setAttribute('aria-expanded',String(any)));all.textContent=any?'Hide all labels':'Show all labels';});});
/* tabs */
$$('[data-tabs]').forEach(w=>{const bs=$$('[data-tab]',w),ps=$$('.tabpane',w);bs.forEach(b=>b.addEventListener('click',()=>{bs.forEach(x=>x.setAttribute('aria-pressed',String(x===b)));ps.forEach(p=>p.hidden=p.dataset.pane!==b.dataset.tab);}));});
/* challenges unlock */
$$('.chal').forEach(c=>{const bs=$$('button',c);const m=c.parentElement.querySelector('.protomsg');bs.forEach(b=>b.addEventListener('click',()=>{const o=b.getAttribute('aria-expanded')!=='true';b.setAttribute('aria-expanded',String(o));
  if(b.dataset.p){const el=document.getElementById(b.dataset.p);if(el)el.classList.toggle('on',o);}
  if(m){const n=bs.filter(x=>x.getAttribute('aria-expanded')==='true').length;m.textContent=n===bs.length?(m.dataset.done||'All unlocked! 🎉'):n+' / '+bs.length+' unlocked.';}}));});
})();
