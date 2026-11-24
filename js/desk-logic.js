/* UPSC Desk add-on logic. Pure helpers: syllabus columns, revision order, plan dates, weight trend, coach. */
window.Desk=(function(){
const pad=n=>(n<10?'0':'')+n;
const iso=d=>{d=d||new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())};
const add=(k,n)=>{const d=new Date(k+'T12:00');d.setDate(d.getDate()+n);return iso(d)};
const span=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
const TAGL={d:'Study',q:'PYQs',mc:'MCQs',aw:'Answer writing',r1:'Revision 1',r2:'Revision 2',p2:'Practice again',grand:'Consolidation'};
function tagsFor(paper){const t=[['d','Study'],['q','PYQs'],['r1','Revision 1'],['r2','Revision 2']];t.splice(2,0,paper==='P'?['mc','MCQs']:['aw','Answer writing']);return t}
function dispTag(paper,tag){return tag==='p2'?(paper==='P'?'mc':'aw'):(tag||'d')}
function pathText(u,tag){if(!u)return '';const bits=[u.l1,u.l2,u.l3,u.text].filter(Boolean);const lab=TAGL[tag]||'';return bits.join(' / ')+(lab?' <'+lab+'>':'')}
function columns(units,path){path=path||[];const keys=['l1','l2','l3'],cols=[];let pool=units.slice();
 for(let i=0;i<=path.length&&i<3;i++){const key=keys[i],g={};pool.forEach(u=>{const k=u[key]||'—';g[k]=(g[k]||0)+1});
  cols.push({depth:i,items:Object.keys(g).sort((a,b)=>a.localeCompare(b)),counts:g,sel:path[i]||''});
  if(!path[i])break;pool=pool.filter(u=>(u[key]||'—')===path[i])}
 return{cols,units:path.length>=3?pool:null}}
function examDays(exam,today){if(!exam)return null;return Math.ceil((new Date(exam+'T12:00')-new Date(today+'T12:00'))/864e5)}
function pracKey(paper){return paper==='P'?'mc':'aw'}
function nextStep(u,p,exam,today){p=p||{};const paper=u.paper,prac=pracKey(paper),dd=examDays(exam,today);
 if(!p.d)return{tag:'d',ready:true,why:'Reading comes first. Nothing else is suggested until this is studied.'};
 if(!p.q)return{tag:'q',ready:true,why:'PYQs come right after the reading, before MCQs or answer writing.'};
 if(!p[prac]){const ready=!p.qAt||p.qAt<today;return{tag:prac,ready,why:ready?(paper==='P'?'MCQs come after PYQs, so the past paper has already shown what is asked.':'Answer writing comes after PYQs, once the demand of the question is clear.'):'PYQs were done today. Leave MCQs and answer writing for the next day so this sitting stays a past-paper sitting.'}}
 if(!p.r1){const w=p.dAt?span(p.dAt,today):99,ready=w>=6;return{tag:'r1',ready,why:ready?'Revision 1 comes only after study, PYQs, and a first practice round. That sequence is done, and the first reading is at least a week old.':'Revision 1 waits about a week after the first reading, and only once PYQs and practice are done.'}}
 if(!p.p2){const ready=!p.r1At||p.r1At<today;return{tag:'p2',ready,why:ready?(paper==='P'?'A second MCQ round comes after Revision 1, before the late Revision 2.':'A second answer-writing round comes after Revision 1, before the late Revision 2.'):'Revision 1 was today. The second practice round starts tomorrow.'}}
 if(!p.r2){if(dd==null)return{tag:'r2',ready:false,held:true,why:'Revision 2 is for the last month before the exam. Set the exam date and it will unlock then.'};
  if(dd>30)return{tag:'r2',ready:false,held:true,why:'Revision 2 stays parked until the exam is about a month away ('+dd+' days left).'};
  const ready=!p.p2At||p.p2At<today;return{tag:'r2',ready,why:ready?'The exam is inside a month, and the earlier steps are done, so Revision 2 is the right pass.':'The second practice round was today. Revision 2 starts tomorrow.'}}
 return{tag:'grand',ready:true,why:'This micro topic has cleared Revision 2. Keep it for consolidation and a grand test, not another early revision.'}}
function dailyRevision(units,prog,exam,today,limit){const ready=[],waiting=[];let held=0;const cap=limit||8;
 units.forEach(u=>{const p=prog[u.id];if(!p||!p.d)return;const n=nextStep(u,p,exam,today);if(n.tag==='d'||n.tag==='grand')return;if(n.held){held++;return}(n.ready?ready:waiting).push({u,n})});
 const rank={q:0,mc:1,aw:1,r1:2,p2:3,r2:4};
 ready.sort((a,b)=>(rank[a.n.tag]-rank[b.n.tag])||(a.u.l1<b.u.l1?-1:1));
 const by={};units.forEach(u=>{const k=u.paper+'|'+u.l1,o=by[k]=by[k]||{paper:u.paper,l1:u.l1,n:0,studied:0,grand:0,r1:0};o.n++;const p=prog[u.id];if(p&&p.d)o.studied++;if(p&&p.r1)o.r1++;if(p&&p.r2)o.grand++});
 const dd=examDays(exam,today);
 const grands=Object.values(by).filter(o=>{if(o.studied<4)return false;if(o.grand>=3&&o.grand/o.studied>=.5)return true;if(dd!=null&&dd<=45&&o.studied>=6&&o.r1/o.n>=.6)return true;return false}).map(o=>({subject:o.l1,paper:o.paper,why:o.grand>=3?o.l1+' has several micros through Revision 2. Sit a consolidation set or a grand test before opening new topics.':'Most of '+o.l1+' has cleared Revision 1 and the exam is close. A sectional or grand test will show what still leaks.'}));
 return{today:ready.slice(0,cap),more:Math.max(0,ready.length-cap),waiting:waiting.length,held,grands}}
function weekStart(k,wk){const d=new Date(k+'T12:00'),day=d.getDay(),delta=wk===0?day:(day+6)%7;d.setDate(d.getDate()-delta);return iso(d)}
function weightForecast(logs,goal){const pts=(logs||[]).filter(x=>x&&x.kg>0&&x.date).sort((a,b)=>a.date<b.date?-1:1);if(pts.length<3)return{ready:false,need:3-pts.length};
 let level=pts[0].kg,trend=0;const alpha=.4,beta=.3;
 for(let i=1;i<pts.length;i++){const sp=Math.max(1,span(pts[i-1].date,pts[i].date)),forecast=level+trend*sp,err=pts[i].kg-forecast,a=Math.abs(err)>=1.2?.9:alpha,prev=level;
  level=a*pts[i].kg+(1-a)*forecast;trend=beta*((level-prev)/sp)+(1-beta)*trend}
 const curve=[];for(let d=0;d<=30;d+=5)curve.push({d,kg:Math.round((level+trend*d)*10)/10});
 let goalIn=null;const g=+goal;if(g&&Math.abs(trend)>.005){const need=g-level;if(Math.abs(need)<.15)goalIn=0;else if(need*trend>0)goalIn=Math.round(need/trend)}
 return{ready:true,level:Math.round(level*10)/10,trend,week:Math.round(trend*70)/10,curve,goalIn,last:pts[pts.length-1]}}
function coach(x){const o=[],prog=x.prog||{},units=x.units||[],byId=x.byId||{},pyq=[];
 units.forEach(u=>{const p=prog[u.id];if(!p||!p.d||p.q||!p.dAt)return;const w=span(p.dAt,x.today);if(w>=2)pyq.push({u,w})});
 pyq.sort((a,b)=>b.w-a.w);
 if(pyq.length){const t=pyq[0];o.push({t:'tip',m:t.u.l1+' / '+(t.u.l3||t.u.l2)+' / '+t.u.text+' was read '+t.w+' days ago and still has no PYQ. The next legal step is PYQs, not a fresh MCQ set or a revision.'})}
 const dd=examDays(x.exam,x.today);let early=0,skip=0;
 units.forEach(u=>{const p=prog[u.id];if(!p)return;if(p.r2&&(dd==null||dd>30))early++;if(p.r1&&p.d&&p.q&&!(u.paper==='P'?p.mc:p.aw))skip++});
 if(early)o.push({t:'warn',m:early+' micro topic'+(early>1?'s have':' has')+' Revision 2 ticked while the exam is not inside the last month. Leave Revision 2 for that window so the second pass is still fresh on the day.'});
 if(skip)o.push({t:'tip',m:skip+' topic'+(skip>1?'s were':' was')+' revised before the first MCQ or answer-writing round. Finish that practice before a second revision, or the revision has nothing to correct.'});
 const days=x.dayRows||[],pairs=[];
 for(let i=0;i<days.length-1;i++){if(days[i].sleep==null||!days[i+1].study)continue;pairs.push({low:days[i].sleep<6.5,study:days[i+1].study})}
 const lo=pairs.filter(p=>p.low).map(p=>p.study),hi=pairs.filter(p=>!p.low).map(p=>p.study);
 if(lo.length>=3&&hi.length>=3){const a=lo.reduce((s,v)=>s+v,0)/lo.length,b=hi.reduce((s,v)=>s+v,0)/hi.length;if(b-a>=.6)o.push({t:'tip',m:'The morning after a night under 6.5 h, study averages '+a.toFixed(1)+' h. After a longer night it is '+b.toFixed(1)+' h. A short night is the thing that quietly cuts the next day’s plan.'})}
 const long=days.filter(d=>d.study>=4&&d.protein>0);
 if(long.length>=3&&x.proTarget){const short=long.filter(d=>d.protein<x.proTarget*.75);if(short.length>=2&&short.length/long.length>=.5)o.push({t:'tip',m:'On '+short.length+' of '+long.length+' days with 4 h or more of study, protein was under three quarters of the '+x.proTarget+' g target. Those are the days the target matters.'})}
 if((x.planOpen||0)>=3)o.push({t:'warn',m:x.planOpen+' planned micros are still open from earlier days. Clear that carry-forward before making the next week heavier.'});
 if(x.weight&&x.weight.ready&&x.weightGoal){const g=+x.weightGoal;if(x.weight.goalIn==null&&Math.abs(g-x.weight.level)>=.4)o.push({t:'tip',m:'Weight is drifting '+(x.weight.week>0?'up':'down')+' about '+Math.abs(x.weight.week)+' kg a week, which does not close on the '+g+' kg goal. The line only reaches the goal if a later weigh-in turns it.'});
  else if(x.weight.goalIn>0)o.push({t:'good',m:'At the corrected trend, '+g+' kg is about '+x.weight.goalIn+' days out. The next weigh-in will pull that date if it disagrees with the line.'})}
 const mc=x.mistBySubject||{},keys=Object.keys(mc);
 if(keys.length>=2){keys.sort((a,b)=>mc[b]-mc[a]);const top=mc[keys[0]],rest=keys.slice(1).reduce((s,k)=>s+mc[k],0);if(top>=3&&top>rest)o.push({t:'tip',m:'Logged mistakes cluster in '+keys[0]+' ('+top+', more than every other subject combined). Send that subject’s missed micros to PYQs before another full mock.'})}
 const last={};(x.sessions||[]).forEach(s=>{if(!s.unit||!byId[s.unit])return;const l1=byId[s.unit].l1;if(!last[l1]||s.date>last[l1])last[l1]=s.date});
 const stale=Object.keys(last).map(l=>[l,span(last[l],x.today)]).filter(z=>z[1]>=12).sort((a,b)=>b[1]-a[1]);
 const fresh=Object.keys(last).some(l=>span(last[l],x.today)<=3);
 if(stale.length&&fresh)o.push({t:'tip',m:stale[0][0]+' has had no mapped session for '+stale[0][1]+' days, while another subject was studied in the last three days. A short PYQ pass on the cold subject holds it better than a new chapter.'});
 const signals=(x.sessions||[]).length+days.filter(d=>d.sleep!=null||d.study>0).length+Object.keys(prog).length;
 if(!o.length&&signals<4)return[{t:'tip',wait:true,m:'Not enough logged yet to see anything the charts do not already show. A few study sessions tied to micro topics, plus sleep or a weigh-in, and this will start.'}];
 if(!o.length)return[{t:'good',m:'Nothing is hiding off the charts right now. The step order is intact, and no subject you have started has gone cold beside an active one.'}];
 return o.slice(0,5)}
return{TAGL,tagsFor,dispTag,pathText,columns,nextStep,dailyRevision,weekStart,add,weightForecast,coach,examDays,pracKey}})();
