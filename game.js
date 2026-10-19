(() => {
'use strict';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const ui={overlay:$('overlay'),pause:$('pause-overlay'),start:$('start-button'),resume:$('resume-button'),objective:$('objective-text'),sanity:$('sanity-fill'),sanityNum:$('sanity-number'),items:$('items'),prompt:$('prompt'),message:$('message')};
const TILE=64, COLS=30, ROWS=22, WORLD_W=COLS*TILE, WORLD_H=ROWS*TILE;
let W=innerWidth,H=innerHeight,dpr=1,running=false,paused=false,won=false,gameOver=false,last=0,elapsed=0,noise=0,msgTimer=0,shake=0;
let sanity=100,inventory=[],flags={fuse:false,code:false,power:false,keycard:false,exitOpen:false};
const keys=new Set(),touch=new Set();
const stick={x:0,y:0};
let audioCtx=null,ambientNodes=[],ambientOn=false;
function setAmbient(on){ambientOn=on;const buttons=[$('music-toggle'),$('desktop-music-toggle')].filter(Boolean);buttons.forEach(b=>{b.textContent=on?'♫ AMBIENCE ON':'♫ AMBIENCE OFF';b.setAttribute('aria-pressed',String(on));});if(!on){ambientNodes.forEach(n=>{try{n.stop?.()}catch(e){}try{n.disconnect?.()}catch(e){}});ambientNodes=[];if(audioCtx){audioCtx.close().catch(()=>{});audioCtx=null;}return;}try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();const master=audioCtx.createGain();master.gain.value=.12;master.connect(audioCtx.destination);[55,56.2,82.4].forEach((freq,i)=>{const osc=audioCtx.createOscillator(),gain=audioCtx.createGain(),filter=audioCtx.createBiquadFilter();osc.type=i===2?'triangle':'sine';osc.frequency.value=freq;filter.type='lowpass';filter.frequency.value=180;gain.gain.value=i===2?.12:.25;osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start();ambientNodes.push(osc,filter,gain);});ambientNodes.push(master);}catch(e){setAmbient(false);}}
const player={x:3.5*TILE,y:17.5*TILE,r:13,speed:190,faceX:0,faceY:-1};
const camera={x:0,y:0};
const map=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>x===0||y===0||x===COLS-1||y===ROWS-1?1:0));
function wall(x,y){if(map[y]&&map[y][x]!==undefined)map[y][x]=1}
// Office partitions, rooms and corridors. Openings are intentional routes.
for(let x=2;x<28;x++){if(![5,6,13,14,21,22].includes(x)){wall(x,5);wall(x,12);}}
for(let y=2;y<19;y++){if(![4,5,10,11,16,17].includes(y)){wall(9,y);wall(19,y);}}
for(let x=3;x<8;x++){wall(x,8);wall(x,9)}for(let x=11;x<18;x++){wall(x,8);wall(x,9)}for(let x=21;x<27;x++){wall(x,8);wall(x,9)}
// Ensure navigable doorways through partitions.
[[5,5],[6,5],[13,5],[14,5],[21,5],[22,5],[5,12],[6,12],[13,12],[14,12],[21,12],[22,12],[9,4],[9,5],[9,10],[9,11],[9,16],[9,17],[19,4],[19,5],[19,10],[19,11],[19,16],[19,17]].forEach(([x,y])=>map[y][x]=0);
const objects=[
{id:'desk',x:5.5*TILE,y:15.1*TILE,w:72,h:42,name:'Desk drawer',kind:'drawer',icon:'▤',used:false},
{id:'note',x:6.3*TILE,y:14.5*TILE,w:20,h:16,name:'Crumpled note',kind:'note',icon:'▧',used:false},
{id:'cabinet',x:15.7*TILE,y:4.2*TILE,w:52,h:54,name:'Supply cabinet',kind:'cabinet',icon:'▥',used:false},
{id:'fusebox',x:25.2*TILE,y:6.5*TILE,w:46,h:62,name:'Fuse box',kind:'fusebox',icon:'▦',used:false},
{id:'terminal',x:24.8*TILE,y:15.2*TILE,w:50,h:42,name:'Security terminal',kind:'terminal',icon:'▣',used:false},
{id:'exit',x:27.4*TILE,y:18.5*TILE,w:58,h:80,name:'Emergency exit',kind:'exit',icon:'⇧',used:false},
{id:'phone',x:12.2*TILE,y:15.5*TILE,w:26,h:18,name:'Ringing phone',kind:'phone',icon:'☎',used:false},
{id:'mirror',x:24.2*TILE,y:3.2*TILE,w:30,h:54,name:'Dark window',kind:'mirror',icon:'▯',used:false}
];
const desks=[];for(let y of [2.7,6.9,10.5,14.1])for(let x of [3.2,7.1,11.2,16.4,21.4,25.1]){if((x<9&&y>11)||(x>20&&y<6))continue;desks.push({x:x*TILE,y:y*TILE,w:52,h:34})}
const shadow={x:23*TILE,y:11*TILE,r:18,active:false,stun:0,phase:0};
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);canvas.style.width=W+'px';canvas.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);document.body.classList.toggle('mobile',W<760);}
addEventListener('resize',resize);resize();
function say(text,duration=3200){ui.message.textContent=text;ui.message.classList.remove('hidden');msgTimer=duration;}
function setObjective(text){ui.objective.textContent=text;}
function addItem(id,label,icon){if(!inventory.some(i=>i.id===id))inventory.push({id,label,icon});renderInventory()}
function removeItem(id){inventory=inventory.filter(i=>i.id!==id);renderInventory()}
function has(id){return inventory.some(i=>i.id===id)}
function renderInventory(){ui.items.innerHTML=inventory.length?inventory.map(i=>`<span class="item"><span>${i.icon}</span>${i.label}</span>`).join(''):'<span class="empty-slot">EMPTY</span>'}
function solidAt(x,y,r){let left=Math.floor((x-r)/TILE),right=Math.floor((x+r)/TILE),top=Math.floor((y-r)/TILE),bottom=Math.floor((y+r)/TILE);for(let ty=top;ty<=bottom;ty++)for(let tx=left;tx<=right;tx++)if(!map[ty]||map[ty][tx]!==0)return true;for(const d of desks)if(x+r>d.x-d.w/2&&x-r<d.x+d.w/2&&y+r>d.y-d.h/2&&y-r<d.y+d.h/2)return true;for(const o of objects){if(['exit','note','phone','mirror'].includes(o.kind))continue;if(x+r>o.x-o.w/2&&x-r<o.x+o.w/2&&y+r>o.y-o.h/2&&y-r<o.y+o.h/2)return true}return false}
function move(dx,dy,dt){let mag=Math.hypot(dx,dy);if(!mag)return;if(mag>1){dx/=mag;dy/=mag}player.faceX=dx;player.faceY=dy;const nx=player.x+dx*player.speed*dt,ny=player.y+dy*player.speed*dt;if(!solidAt(nx,player.y,player.r))player.x=nx;if(!solidAt(player.x,ny,player.r))player.y=ny;player.x=Math.max(TILE*1.3,Math.min(WORLD_W-TILE*1.3,player.x));player.y=Math.max(TILE*1.3,Math.min(WORLD_H-TILE*1.3,player.y));}
function nearest(){let best=null,bd=Infinity;for(const o of objects){let d=Math.hypot(player.x-o.x,player.y-o.y);if(d<Math.max(o.w,o.h)*.5+46&&d<bd){best=o;bd=d}}return best}
function interact(){if(!running||paused||won||gameOver)return;const o=nearest();if(!o){say('Only the hum of fluorescent lights answers you.',1800);return}switch(o.kind){
case'drawer':if(!flags.fuse){flags.fuse=true;addItem('fuse','FUSE','ϟ');o.used=true;say('Inside: a spare fuse. Someone scratched “DON’T TRUST THE CLOCK” into the wood.')}else say('An empty drawer. The scratch marks look fresh.');break;
case'note':if(!flags.code){flags.code=true;o.used=true;say('A note in red ink: “The date the company was founded. 0419. Do not let it see you.”');setObjective('Find the security terminal. The code is 0419.')}else say('The note reads 0419. The ink looks wet.');break;
case'cabinet':if(!flags.keycard){if(!flags.fuse){say('The cabinet’s electronic latch is dead. A fuse might restore it.');}else{flags.keycard=true;addItem('keycard','BADGE','▣');o.used=true;say('The cabinet clicks open. A security badge is taped inside—with your photo, but a different name.');setObjective('Restore power at the fuse box.');}}else say('Dusty files and an empty badge hook.');break;
case'fusebox':if(!flags.fuse){say('One fuse is missing. The panel is warm to the touch.');}else if(!flags.power){flags.power=true;removeItem('fuse');o.used=true;say('The fuse seats with a snap. Lights wake up across the floor. Something moves behind the glass.');shadow.active=true;setObjective('Use the security terminal. Find the access code.');sanity=Math.max(0,sanity-7);shake=9;}else say('Power is on. The panel emits a low, steady buzz.');break;
case'terminal':if(!flags.power){say('NO POWER. The terminal shows a blinking cursor.');}else if(!flags.keycard){say('ACCESS DENIED. Badge authentication required.');}else if(!flags.code){say('A numeric code is required. Search the office for a clue.');}else{const code=prompt('SECURITY TERMINAL\nEnter the four-digit code:');if(code===null)break;if(code.trim()==='0419'){flags.exitOpen=true;o.used=true;say('ACCESS GRANTED. EXIT MAGLOCK RELEASED. The intercom whispers your name.');setObjective('Reach the emergency exit. Keep moving.');}else{sanity=Math.max(0,sanity-18);shake=12;say('ACCESS DENIED. The terminal flashes: WE SAW YOU COME IN.');if(sanity<=0)endGame(false)}}break;
case'phone':if(!o.used){o.used=true;sanity=Math.max(0,sanity-8);shadow.active=true;say('A voice on the line: “You left me in Meeting Room B.” The receiver is ice-cold.');shake=5}else say('No dial tone. A faint breathing continues anyway.');break;
case'mirror':sanity=Math.max(0,sanity-4);say('Your reflection is still standing there after you move. Don’t look back.');shake=4;break;
case'exit':if(flags.exitOpen){endGame(true)}else{say('The emergency exit is magnetically sealed. The terminal controls the lock.');setObjective('Unlock the exit at the security terminal.')}break;
}}
function endGame(win){won=win;gameOver=!win;running=false;ui.overlay.classList.add('show');ui.overlay.innerHTML=win?`<div class="overlay-card"><div class="eyebrow">SHIFT COMPLETE // 02:43 AM</div><h1>YOU MADE<br><em>IT OUT.</em></h1><p class="intro">The alarm finally stops. In the glass doors behind you, a second silhouette watches you leave. Your badge reads: EMPLOYEE SINCE TOMORROW.</p><div class="briefing"><div><b>✓</b><span>POWER</span><small>Restored.</small></div><div><b>✓</b><span>ACCESS</span><small>Terminal bypassed.</small></div><div><b>?</b><span>WITNESS</span><small>Still inside.</small></div></div><button id="restart-button">PLAY AGAIN <span>↗</span></button></div>`:`<div class="overlay-card"><div class="eyebrow">CONNECTION LOST</div><h1>THE OFFICE<br><em>KEEPS YOU.</em></h1><p class="intro">The lights flicker once. Your footsteps stop—but the footsteps behind you keep going.</p><button id="restart-button">TRY AGAIN <span>↗</span></button></div>`;$('restart-button').addEventListener('click',resetGame);}
function resetGame(){player.x=3.5*TILE;player.y=17.5*TILE;camera.x=Math.max(0,Math.min(WORLD_W-W,player.x-W/2));camera.y=Math.max(0,Math.min(WORLD_H-H,player.y-H/2));sanity=100;inventory=[];flags={fuse:false,code:false,power:false,keycard:false,exitOpen:false};objects.forEach(o=>o.used=false);shadow.x=23*TILE;shadow.y=11*TILE;shadow.active=false;shadow.stun=0;elapsed=0;won=gameOver=false;paused=false;running=true;ui.overlay.classList.remove('show');ui.pause.classList.add('hidden');ui.message.classList.add('hidden');setObjective('Search the office for a fuse and a clue.');renderInventory();say('2:17 AM. Your shift ended twenty minutes ago. Why is the exit locked?',4000);last=performance.now();}
function togglePause(){if(!running)return;paused=!paused;ui.pause.classList.toggle('hidden',!paused)}
ui.start.addEventListener('click',resetGame);ui.resume.addEventListener('click',togglePause);
addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();const k=e.key.toLowerCase();if(k==='escape'){togglePause();return}if(['e',' ','enter'].includes(k)){if(!keys.has(k))interact();keys.add(k);return}keys.add(k)});addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
$('touch-interact').addEventListener('pointerdown',e=>{e.preventDefault();interact()});
const joystick=$('joystick'),knob=$('joystick-knob');let stickPointer=null;
function updateStick(e){const r=joystick.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,max=r.width*.31;let dx=e.clientX-cx,dy=e.clientY-cy,d=Math.hypot(dx,dy);if(d>max){dx=dx/d*max;dy=dy/d*max}stick.x=dx/max;stick.y=dy/max;knob.style.transform=`translate(${dx}px,${dy}px)`;}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();stickPointer=e.pointerId;joystick.setPointerCapture(e.pointerId);updateStick(e)});joystick.addEventListener('pointermove',e=>{if(e.pointerId===stickPointer)updateStick(e)});function resetStick(){stickPointer=null;stick.x=stick.y=0;knob.style.transform='translate(0px,0px)'}['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joystick.addEventListener(ev,resetStick));
[$('music-toggle'),$('desktop-music-toggle')].filter(Boolean).forEach(b=>b.addEventListener('click',()=>setAmbient(!ambientOn)));
function update(dt){elapsed+=dt;noise+=dt;const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+stick.x,dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+stick.y;move(dx,dy,dt);
if(shadow.active&&shadow.stun<=0){let vx=player.x-shadow.x,vy=player.y-shadow.y,d=Math.hypot(vx,vy);if(d>4){let speed=d<300?104:57;const nx=shadow.x+vx/d*speed*dt,ny=shadow.y+vy/d*speed*dt;if(!solidAt(nx,shadow.y,shadow.r))shadow.x=nx;if(!solidAt(shadow.x,ny,shadow.r))shadow.y=ny;}if(d<38){sanity-=dt*26;shake=6;if(sanity<=0)endGame(false)}}else shadow.stun=Math.max(0,shadow.stun-dt);
// Stability falls very slowly while the shadow is active; light and distance buy time.
if(shadow.active&&Math.hypot(player.x-shadow.x,player.y-shadow.y)>330)sanity-=dt*.7;
sanityFix();
// Smooth follow camera: tracks the player with a small look-ahead in the facing direction.
// Clamp to world bounds so the camera never shows empty space outside the office.
const lookAhead=72;
const targetX=Math.max(0,Math.min(WORLD_W-W,player.x-W/2+player.faceX*lookAhead));
const targetY=Math.max(0,Math.min(WORLD_H-H,player.y-H/2+player.faceY*lookAhead));
const cameraEase=1-Math.exp(-5.5*dt);
camera.x+=(targetX-camera.x)*cameraEase;
camera.y+=(targetY-camera.y)*cameraEase;
const o=nearest();if(o){ui.prompt.textContent='E / SPACE  ·  '+o.name.toUpperCase();ui.prompt.classList.remove('hidden')}else ui.prompt.classList.add('hidden');ui.sanity.style.width=Math.max(0,sanity)+'%';ui.sanity.style.background=sanity<35?'#ff596a':'#7ce5e2';ui.sanityNum.textContent=Math.max(0,Math.ceil(sanity))+'%';if(msgTimer>0){msgTimer-=dt*1000;if(msgTimer<=0)ui.message.classList.add('hidden')}
}
function sanityFix(){if(sanity<0)sanity=0}
function poly(points,fill,stroke){ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
function box(x,y,w,h,base,top,edge){ctx.fillStyle=edge;ctx.fillRect(x-w/2,y-h/2+7,w,h);poly([[x-w/2,y-h/2],[x-w/2+8,y-h/2-7],[x+w/2+8,y-h/2-7],[x+w/2,y-h/2]],top);ctx.fillStyle=base;ctx.fillRect(x-w/2,y-h/2,w,h);ctx.strokeStyle='rgba(180,205,220,.14)';ctx.strokeRect(x-w/2,y-h/2,w,h)}
function drawWorld(){ctx.fillStyle='#101720';ctx.fillRect(0,0,W,H);ctx.save();ctx.translate(-camera.x,-camera.y);
// tile floor with subtle perspective-like seams
for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const px=x*TILE,py=y*TILE;if(map[y][x]){ctx.fillStyle='#202b34';ctx.fillRect(px,py,TILE,TILE);ctx.fillStyle='#2b3943';ctx.fillRect(px,py,TILE,4);ctx.fillStyle='#111923';ctx.fillRect(px,py+TILE-4,TILE,4);ctx.strokeStyle='#35434d';ctx.strokeRect(px+.5,py+.5,TILE-1,TILE-1)}else{ctx.fillStyle=((x+y)%2===0)?'#18232b':'#1a252e';ctx.fillRect(px,py,TILE,TILE);ctx.strokeStyle='rgba(112,141,155,.09)';ctx.strokeRect(px+.5,py+.5,TILE-1,TILE-1)}}
// wall signage and office details
ctx.font='10px monospace';ctx.fillStyle='#657885';ctx.fillText('OPERATIONS',2.5*TILE,2*TILE);ctx.fillText('MEETING ROOM B',10.5*TILE,2*TILE);ctx.fillText('RECORDS',20.4*TILE,2*TILE);ctx.fillText('EXIT  →',25*TILE,20*TILE);
for(const d of desks){box(d.x,d.y,d.w,d.h,'#39444a','#66777b','#171e25');ctx.fillStyle='#8aa1a2';ctx.fillRect(d.x-12,d.y-8,24,9);ctx.fillStyle='#d0c7ac';ctx.fillRect(d.x+10,d.y-8,8,6);ctx.fillStyle='#232e38';ctx.fillRect(d.x-6,d.y+18,12,9)}
// objects
for(const o of objects){const x=o.x,y=o.y;ctx.save();if(o.kind==='exit'){ctx.fillStyle=flags.exitOpen?'#295b59':'#3c454c';ctx.fillRect(x-27,y-39,54,78);ctx.strokeStyle=flags.exitOpen?'#7ce5e2':'#9a6570';ctx.lineWidth=3;ctx.strokeRect(x-27,y-39,54,78);ctx.fillStyle=flags.exitOpen?'#7ce5e2':'#ba6470';ctx.fillRect(x+14,y-3,4,7);ctx.fillStyle='#c3d0d5';ctx.font='9px monospace';ctx.fillText(flags.exitOpen?'OPEN':'SEALED',x-18,y-45)}else if(o.kind==='note'){ctx.translate(x,y);ctx.rotate(-.14);ctx.fillStyle='#d9d1b5';ctx.fillRect(-12,-9,24,18);ctx.strokeStyle='#9b4e55';ctx.beginPath();ctx.moveTo(-7,-3);ctx.lineTo(6,-3);ctx.moveTo(-7,1);ctx.lineTo(3,1);ctx.stroke()}else if(o.kind==='phone'){ctx.fillStyle='#111820';ctx.fillRect(x-15,y-10,30,20);ctx.fillStyle='#c95f69';ctx.fillRect(x-7,y-5,14,9);if(!o.used&&Math.sin(elapsed*8)>0){ctx.strokeStyle='#ff6876';ctx.beginPath();ctx.arc(x,y,22,0,Math.PI*2);ctx.stroke()}}else if(o.kind==='mirror'){ctx.fillStyle='#182934';ctx.fillRect(x-14,y-28,28,56);ctx.strokeStyle='#738b96';ctx.strokeRect(x-14,y-28,28,56);ctx.fillStyle='rgba(124,229,226,.15)';ctx.fillRect(x-9,y-23,18,46)}else{const color=o.kind==='fusebox'?(flags.power?'#315f5b':'#744750'):o.kind==='terminal'?(flags.power?'#244b50':'#333b40'):'#3d4b53';box(x,y,o.w,o.h,color,'#71828a','#111820');ctx.fillStyle=o.kind==='terminal'&&flags.power?'#7ce5e2':o.kind==='fusebox'&&flags.power?'#7ce5e2':'#c2a77e';ctx.fillRect(x-10,y-10,20,10);ctx.fillStyle='#18242b';ctx.fillRect(x-8,y+6,16,4);if(o.used){ctx.fillStyle='#7ce5e2';ctx.beginPath();ctx.arc(x+o.w/2,y-o.h/2,4,0,Math.PI*2);ctx.fill()}}
ctx.restore();}
// Exit light and overhead pools
for(const [x,y,r] of [[6*TILE,15*TILE,160],[16*TILE,4*TILE,145],[25*TILE,6*TILE,130],[27*TILE,18*TILE,140]]){let g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,'rgba(124,229,226,.065)');g.addColorStop(1,'rgba(124,229,226,0)');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}
// shadow entity
if(shadow.active){let d=Math.hypot(player.x-shadow.x,player.y-shadow.y);ctx.save();ctx.globalAlpha=.84;ctx.fillStyle='#030509';ctx.shadowColor='#b13b53';ctx.shadowBlur=25;ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,shadow.r*.8,shadow.r*1.5,Math.sin(elapsed*2)*.12,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.fillStyle='#ed5269';ctx.beginPath();ctx.arc(shadow.x-5,shadow.y-8,2,0,Math.PI*2);ctx.arc(shadow.x+5,shadow.y-8,2,0,Math.PI*2);ctx.fill();ctx.restore();if(d<300){ctx.fillStyle=`rgba(160,20,45,${.08*(1-d/300)})`;ctx.fillRect(0,0,WORLD_W,WORLD_H)}}
// player character with pseudo-height shadow
ctx.save();ctx.translate(player.x,player.y);ctx.fillStyle='#080d12';ctx.beginPath();ctx.ellipse(0,9,15,7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d7e4e6';ctx.beginPath();ctx.ellipse(0,-5,9,12,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#5dd0d0';ctx.fillRect(-8,-7,16,11);ctx.fillStyle='#c6a18b';ctx.beginPath();ctx.arc(0,-17,7,0,Math.PI*2);ctx.fill();ctx.fillStyle='#111b26';ctx.fillRect(-6,-20,12,4);ctx.strokeStyle='#c8f8f6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-4);ctx.lineTo(player.faceX*8,-4+player.faceY*8);ctx.stroke();ctx.restore();
ctx.restore();}
function drawEffects(){// vignette, flicker, scanlines and sanity distortion
const pulse=.03+Math.max(0,Math.sin(elapsed*2.4))*.025+(sanity<35?.08:0);let g=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.12,W/2,H/2,Math.max(W,H)*.68);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,`rgba(0,0,0,${.72+pulse})`);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);if(Math.random()<.012){ctx.fillStyle='rgba(215,240,255,.025)';ctx.fillRect(0,Math.random()*H,W,1+Math.random()*4)}if(sanity<50){ctx.fillStyle=`rgba(120,15,42,${(50-sanity)/900})`;ctx.fillRect(0,0,W,H)}if(shake>0){shake=Math.max(0,shake-.35)}}
function draw(){ctx.save();if(shake>0)ctx.translate((Math.random()-.5)*shake,(Math.random()-.5)*shake);drawWorld();drawEffects();ctx.restore();}
function loop(t){const dt=Math.min((t-last)/1000||0,.04);last=t;if(running&&!paused&&!won&&!gameOver)update(dt);draw();requestAnimationFrame(loop)}
setObjective('Search the office for a fuse and a clue.');renderInventory();requestAnimationFrame(t=>{last=t;loop(t)});
})();
                                   
