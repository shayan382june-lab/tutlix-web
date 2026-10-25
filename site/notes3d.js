/* Tutlix tiny 3D engine: shaded spheres + bonds on a canvas, drag to rotate. */
(function(){
function hex2rgb(h){h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16);return [(n>>16)&255,(n>>8)&255,n&255];}
function mix(a,b,t){return a.map((v,i)=>Math.round(v+(b[i]-v)*t));}
function css(c,a){return a===undefined?`rgb(${c[0]},${c[1]},${c[2]})`:`rgba(${c[0]},${c[1]},${c[2]},${a})`;}
window.T3D=function(canvas,opt){
  opt=opt||{};const ctx=canvas.getContext('2d');let atoms=opt.atoms||[],bonds=opt.bonds||[];
  let ry=opt.ry||0,rx=opt.rx||0.25,zoom=opt.zoom||1,auto=opt.auto!==false,dragging=false,lx=0,ly=0,vel=0;
  const still=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fit(){const r=canvas.getBoundingClientRect();if(r.width>0&&r.height>0){const w=Math.round(canvas.height*r.width/r.height);if(Math.abs(canvas.width-w)>2)canvas.width=w;}}fit();addEventListener('resize',()=>{fit();if(still)render();});
  const cache={};
  function prep(){atoms.forEach(a=>{if(!a._rgb)a._rgb=hex2rgb(a.c||'#888');});}
  prep();
  function project(a,W,H,cx,cy){const cY=Math.cos(ry),sY=Math.sin(ry),cX=Math.cos(rx),sX=Math.sin(rx);
    let x=a.x*cY+a.z*sY,z=-a.x*sY+a.z*cY,y=a.y*cX-z*sX;z=a.y*sX+z*cX;
    const f=opt.fov||600,s=f/(f+z)*zoom*(opt.scale||1);return {x:cx+x*s,y:cy+y*s,z,s};}
  function sphere(p,r,rgb,alpha){const g=ctx.createRadialGradient(p.x-r*.38,p.y-r*.42,r*.08,p.x,p.y,r);
    g.addColorStop(0,css(mix(rgb,[255,255,255],.75),alpha));g.addColorStop(.35,css(mix(rgb,[255,255,255],.15),alpha));g.addColorStop(1,css(mix(rgb,[0,0,0],.45),alpha));
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(p.x,p.y,r,0,7);ctx.fill();}
  function render(){const dpr=1,W=canvas.width,H=canvas.height,cx=W/2+(opt.ox||0),cy=H/2+(opt.oy||0);ctx.clearRect(0,0,W,H);
    if(opt.bg){ctx.fillStyle=opt.bg;ctx.fillRect(0,0,W,H);}
    const P=atoms.map(a=>project(a,W,H,cx,cy));
    const items=[];bonds.forEach(b=>{const p=P[b[0]],q=P[b[1]];if(!p||!q)return;items.push({z:(p.z+q.z)/2+0.01,t:'b',p,q,c:b[2]||'#2A2A2E',w:b[3]||3,dash:b[4]});});
    atoms.forEach((a,i)=>{if(a.hide)return;items.push({z:P[i].z,t:'a',p:P[i],a});});
    items.sort((m,n)=>n.z-m.z);
    const zs=P.map(p=>p.z),zmin=Math.min(...zs),zmax=Math.max(...zs);
    items.forEach(it=>{const fog=zmax>zmin?0.55+0.45*(zmax-it.z)/(zmax-zmin):1;
      if(it.t==='b'){ctx.globalAlpha=fog;ctx.strokeStyle=it.c;ctx.lineWidth=it.w*it.p.s;ctx.lineCap='round';if(it.dash)ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(it.p.x,it.p.y);ctx.lineTo(it.q.x,it.q.y);ctx.stroke();ctx.setLineDash([]);ctx.globalAlpha=1;}
      else{const r=(it.a.r||6)*it.p.s;sphere(it.p,r,it.a._rgb,Math.min(1,fog+(it.a.glow?0.3:0)));if(it.a.ring){ctx.strokeStyle='#FFFFFF';ctx.lineWidth=3;ctx.beginPath();ctx.arc(it.p.x,it.p.y,r+3,0,7);ctx.stroke();}}});
    if(opt.after)opt.after(ctx,P);
    lastP=P;}
  let lastP=[];
  function loop(){if(auto&&!dragging&&!still)ry+=opt.speed||0.006;if(!dragging&&Math.abs(vel)>0.0005){ry+=vel;vel*=0.94;}render();raf=requestAnimationFrame(loop);}
  let raf;
  canvas.style.touchAction='pan-y';canvas.style.cursor='grab';
  canvas.addEventListener('pointerdown',e=>{dragging=true;lx=e.clientX;ly=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';});
  canvas.addEventListener('pointermove',e=>{if(!dragging)return;const k=canvas.width/canvas.getBoundingClientRect().width;const dx=(e.clientX-lx)*k,dy=(e.clientY-ly)*k;ry+=dx*0.01;rx=Math.max(-1.3,Math.min(1.3,rx+dy*0.01));vel=dx*0.0015;lx=e.clientX;ly=e.clientY;if(still)render();});
  canvas.addEventListener('pointerup',e=>{dragging=false;canvas.style.cursor='grab';if(opt.onPick){const r=canvas.getBoundingClientRect(),k=canvas.width/r.width,mx=(e.clientX-r.left)*k,my=(e.clientY-r.top)*k;let best=-1,bd=1e9;
      lastP.forEach((p,i)=>{if(atoms[i].hide||!atoms[i].pick)return;const d=Math.hypot(p.x-mx,p.y-my);if(d<(atoms[i].r||6)*p.s+6&&p.z<bd){bd=p.z;best=i;}});if(best>=0)opt.onPick(atoms[best],best);}});
  if(still)render();else loop();
  return {set(a,b){atoms=a;bonds=b||bonds;prep();if(still)render();},render,get atoms(){return atoms;},setAuto(v){auto=v;},rot(y,x){ry=y;if(x!==undefined)rx=x;if(still)render();}};
};
})();
/* molecule helper: atoms [[el,x,y,z],...] in Å → T3D atoms/bonds with CPK colours and auto bonds */
window.MOL=function(list,opt){opt=opt||{};const S=opt.scale||38;const CPK={C:'#57525C',O:'#E0476F',H:'#F4F4F4',N:'#3D55F5',P:'#FF9F43',S:'#FBDF4A',Fe:'#C0662B',Mg:'#22D3A5',R:'#8E5BD9'};const RAD={H:7,C:12,O:12,N:12,P:14,S:14,Fe:15,Mg:15,R:14};
 let cx=0,cy=0,cz=0;list.forEach(a=>{cx+=a[1];cy+=a[2];cz+=a[3];});cx/=list.length;cy/=list.length;cz/=list.length;
 const A=list.map(a=>({x:(a[1]-cx)*S,y:(a[2]-cy)*S,z:(a[3]-cz)*S,r:(RAD[a[0]]||12)*(opt.r||1),c:a[4]||CPK[a[0]]||'#999',pick:1,k:a[5]||a[0],el:a[0]}));const B=[];
 for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){const d=Math.hypot(list[i][1]-list[j][1],list[i][2]-list[j][2],list[i][3]-list[j][3]);const h=list[i][0]==='H'||list[j][0]==='H';if(d<(h?1.25:1.75))B.push([i,j,'#B8B2C0',opt.bw||5]);}
 (opt.extra||[]).forEach(b=>B.push(b));return [A,B];};
