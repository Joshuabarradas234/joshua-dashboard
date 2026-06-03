import { useState, useEffect, useCallback } from "react";

// ─── Storage ───────────────────────────────────────────────────────────────
const SK = { shifts:"ld_shifts", events:"ld_events", reminders:"ld_reminders", todos:"ld_todos", notes:"ld_notes" };
async function load(key) {
  try { const r = await window.storage.get(key); if (r) { try { localStorage.setItem(key, r.value); } catch {} return JSON.parse(r.value); } } catch {}
  try { const l = localStorage.getItem(key); if (l) return JSON.parse(l); } catch {}
  return [];
}
async function save(key, data) {
  const j = JSON.stringify(data);
  try { await window.storage.set(key, j); } catch {}
  try { localStorage.setItem(key, j); } catch {}
}

// ─── LBM Shifts ───────────────────────────────────────────────────────────
const LBM_SHIFTS = [
  {date:"2026-06-01",start:"12:30",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-02",start:"12:30",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-03",start:"07:15",end:"16:30",note:"LBM PH"},
  {date:"2026-06-04",start:"14:30",end:"21:00",note:"LBM Bond Court"},
  {date:"2026-06-05",start:"07:00",end:"12:30",note:"LBM Bond Court"},
  {date:"2026-06-08",start:"12:30",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-10",start:"08:00",end:"17:00",note:"LBM Bond Court"},
  {date:"2026-06-13",start:"09:00",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-15",start:"07:00",end:"16:00",note:"LBM Bond Court"},
  {date:"2026-06-16",start:"08:00",end:"17:00",note:"LBM Bond Court"},
  {date:"2026-06-17",start:"07:15",end:"16:30",note:"LBM PH"},
  {date:"2026-06-20",start:"09:00",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-21",start:"09:00",end:"17:00",note:"LBM Bond Court"},
  {date:"2026-06-22",start:"07:00",end:"12:30",note:"LBM Bond Court"},
  {date:"2026-06-23",start:"11:00",end:"18:00",note:"LBM Bond Court"},
  {date:"2026-06-25",start:"14:30",end:"21:00",note:"LBM Bond Court"},
];

// ─── Helpers ──────────────────────────────────────────────────────────────
const DAYS=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
function fmt(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function parse(s){const[y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d);}
function today(){return fmt(new Date());}
function addDays(ds,n){const d=parse(ds);d.setDate(d.getDate()+n);return fmt(d);}
function startOfWeek(ds){const d=parse(ds);d.setDate(d.getDate()-d.getDay());return fmt(d);}
function to12(t){if(!t)return"";const[h,m]=t.split(":").map(Number);const ap=h>=12?"PM":"AM";const hr=h%12||12;return`${hr}:${String(m).padStart(2,"0")} ${ap}`;}
function prettyDate(ds){const d=parse(ds);return`${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;}
function greet(){const h=new Date().getHours();if(h<12)return"Good morning";if(h<18)return"Good afternoon";return"Good evening";}

function shiftCountdown(shift){
  const now=new Date();
  const[sh,sm]=shift.start.split(":").map(Number);
  const[eh,em]=shift.end.split(":").map(Number);
  const start=new Date();start.setHours(sh,sm,0,0);
  const end=new Date();end.setHours(eh,em,0,0);
  const diffStart=start-now;
  const diffEnd=end-now;
  if(diffStart>0){
    const hrs=Math.floor(diffStart/3600000);const mins=Math.floor((diffStart%3600000)/60000);
    if(hrs>0)return`Starts in ${hrs}h ${mins}m`;
    return`Starts in ${mins}m`;
  }
  if(diffEnd>0){
    const hrs=Math.floor(diffEnd/3600000);const mins=Math.floor((diffEnd%3600000)/60000);
    if(hrs>0)return`On shift · ${hrs}h ${mins}m left`;
    return`On shift · ${mins}m left`;
  }
  return"Shift ended";
}

function nextShiftInfo(shifts){
  const now=new Date();
  const todayStr=today();
  // Check if currently on shift today
  const todayShift=shifts.find(s=>s.date===todayStr);
  if(todayShift){
    const[eh,em]=todayShift.end.split(":").map(Number);
    const end=new Date();end.setHours(eh,em,0,0);
    if(end>now)return{shift:todayShift,isToday:true};
  }
  // Next upcoming shift
  const upcoming=shifts.filter(s=>s.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date));
  if(upcoming.length>0)return{shift:upcoming[0],isToday:false};
  return null;
}

// ─── Local Search ─────────────────────────────────────────────────────────
function localSearch(q,shifts,events,reminders){
  const query=q.toLowerCase().trim();
  const fullMonths=["january","february","march","april","may","june","july","august","september","october","november","december"];
  const monthNames=["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  function extractDate(str){
    if(str.includes("today"))return today();
    if(str.includes("tomorrow"))return addDays(today(),1);
    const weekdays=["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
    for(let i=0;i<weekdays.length;i++){if(str.includes(weekdays[i])){const d=new Date();const diff=(i-d.getDay()+7)%7||7;d.setDate(d.getDate()+diff);return fmt(d);}}
    for(let mi=0;mi<fullMonths.length;mi++){const mn=fullMonths[mi];const ms=monthNames[mi];const dm=str.match(new RegExp("(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(?:"+mn+"|"+ms+")|(?:"+mn+"|"+ms+")\\s*(\\d{1,2})"));if(dm){const day=parseInt(dm[1]||dm[2]);return`2026-${String(mi+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}}
    const nd=str.match(/(\d{1,2})[\/\-](\d{1,2})/);if(nd){const a=parseInt(nd[1]),b=parseInt(nd[2]);const month=a>12?b:(b>12?a:Math.min(a,b));const day=a>12?a:(b>12?b:Math.max(a,b));return`2026-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;}
    return null;
  }
  const td=extractDate(query);
  if(td&&(query.includes("what")||query.includes("when")||query.includes("on")||query.includes("doing")||query.includes("have")||query.includes("got")||query.includes("happening"))){
    const ds=shifts.find(s=>s.date===td);const de=events.filter(e=>e.date===td);const dr=reminders.filter(r=>r.date===td);const label=prettyDate(td);
    if(!ds&&de.length===0&&dr.length===0)return`Nothing saved for ${label} — looks like a free day! 🎉`;
    let out=`📅 ${label}\n\n`;
    if(ds)out+=`💼 Work: ${to12(ds.start)} – ${to12(ds.end)}${ds.note?" · "+ds.note:""}\n`;
    de.forEach(e=>{out+=`🎉 ${e.title}${e.time?" at "+to12(e.time):""}\n`;});
    dr.forEach(r=>{out+=`🔔 Reminder: ${r.text}\n`;});
    return out.trim();
  }
  if(query.includes("work")||query.includes("shift")||query.includes("rota")){
    if(td){const s=shifts.find(sh=>sh.date===td);if(s)return`💼 ${prettyDate(td)}: ${to12(s.start)} – ${to12(s.end)}${s.note?" · "+s.note:""}`;return`No shift on ${prettyDate(td)} — day off!`;}
    const ws=startOfWeek(today());const wsh=shifts.filter(s=>s.date>=ws&&s.date<=addDays(ws,6));
    if(wsh.length===0)return"No shifts this week.";
    return"💼 This week:\n"+wsh.sort((a,b)=>a.date.localeCompare(b.date)).map(s=>`${prettyDate(s.date)}: ${to12(s.start)} – ${to12(s.end)}`).join("\n");
  }
  const words=query.replace(/[^a-z0-9 ]/g,"").split(" ").filter(w=>w.length>2&&!["when","what","where","find","show","me","is","are","the","my","have","got","do","and"].includes(w));
  if(words.length>0){
    const me=events.filter(e=>words.some(w=>e.title.toLowerCase().includes(w)));
    const mr=reminders.filter(r=>words.some(w=>r.text.toLowerCase().includes(w)));
    if(me.length===0&&mr.length===0)return`Nothing found matching "${q}".`;
    let out="";
    me.forEach(e=>{out+=`🎉 ${e.title}\n${prettyDate(e.date)}${e.time?" at "+to12(e.time):""}${e.note?"\n"+e.note:""}\n\n`;});
    mr.forEach(r=>{out+=`🔔 ${r.text}\n${r.date?prettyDate(r.date):"No date set"}${r.time?" at "+to12(r.time):""}\n\n`;});
    return out.trim();
  }
  if(query.includes("upcoming")||query.includes("coming up")||query.includes("soon")){
    const up=events.filter(e=>e.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,5);
    if(up.length===0)return"No upcoming events saved.";
    return"🎉 Upcoming:\n"+up.map(e=>`${prettyDate(e.date)}: ${e.title}`).join("\n");
  }
  if(query.includes("remind")||query.includes("remember")){
    const p=reminders.filter(r=>!r.done);
    if(p.length===0)return"No pending reminders ✅";
    return"🔔 Reminders:\n"+p.map(r=>`• ${r.text}${r.date?" ("+prettyDate(r.date)+")":""}`).join("\n");
  }
  return`Try: "What's on June 27th?", "When am I working?", "When is Bad Bunny?"`;
}

// ─── UI Primitives ────────────────────────────────────────────────────────
function Modal({title,onClose,children}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0f1117",border:"1px solid #2a2d3a",borderRadius:"16px",width:"100%",maxWidth:"440px",padding:"24px",boxShadow:"0 24px 60px rgba(0,0,0,0.6)",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"20px"}}>
          <span style={{fontWeight:700,fontSize:"17px",color:"#f0f0f5"}}>{title}</span>
          <button onClick={onClose} style={{background:"#1e2030",border:"none",color:"#888",width:"32px",height:"32px",borderRadius:"8px",cursor:"pointer",fontSize:"18px"}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
const iS={width:"100%",padding:"10px 12px",background:"#1a1d27",border:"1px solid #2a2d3a",borderRadius:"10px",color:"#f0f0f5",fontFamily:"'DM Sans',sans-serif",fontSize:"14px",boxSizing:"border-box",outline:"none"};
const lS={display:"block",color:"#888",fontSize:"12px",marginBottom:"5px",letterSpacing:"0.05em"};
const fS={marginBottom:"14px"};
function Btn({children,onClick,color="#6366f1",style={}}){return(<button onClick={onClick} style={{background:color,border:"none",color:"#fff",padding:"10px 18px",borderRadius:"10px",cursor:"pointer",fontWeight:600,fontSize:"14px",fontFamily:"'DM Sans',sans-serif",...style}}>{children}</button>);}

// ─── MAIN ─────────────────────────────────────────────────────────────────
export default function App(){
  const [tab,setTab]=useState("home");
  const [weekStart,setWeekStart]=useState(startOfWeek(today()));
  const [shifts,setShifts]=useState([]);
  const [events,setEvents]=useState([]);
  const [reminders,setReminders]=useState([]);
  const [todos,setTodos]=useState([]);
  const [notes,setNotes]=useState([]);
  const [modal,setModal]=useState(null);
  const [aiQ,setAiQ]=useState("");
  const [aiA,setAiA]=useState("");
  const [now,setNow]=useState(new Date());
  const todayStr=today();

  // Load data
  useEffect(()=>{
    const stored=load(SK.shifts);
    const ex=new Set(stored.map(s=>s.date));
    const toAdd=LBM_SHIFTS.filter(s=>!ex.has(s.date));
    setShifts([...stored,...toAdd]);
    setEvents(load(SK.events));
    setReminders(load(SK.reminders));
    setTodos(load(SK.todos));
    setNotes(load(SK.notes));
  },[]);
  useEffect(()=>{if(shifts.length)save(SK.shifts,shifts);},[shifts]);
  useEffect(()=>{save(SK.events,events);},[events]);
  useEffect(()=>{save(SK.reminders,reminders);},[reminders]);
  useEffect(()=>{save(SK.todos,todos);},[todos]);
  useEffect(()=>{save(SK.notes,notes);},[notes]);

  // Live clock for countdown
  useEffect(()=>{const t=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(t);},[]);



  const days14=Array.from({length:14},(_,i)=>addDays(weekStart,i));
  const shiftMap={};shifts.forEach(s=>{shiftMap[s.date]=s;});
  const evMap={};events.forEach(e=>{if(!evMap[e.date])evMap[e.date]=[];evMap[e.date].push(e);});

  const todayShift=shiftMap[todayStr];
  const todayEvents=evMap[todayStr]||[];
  const pendingTodos=todos.filter(t=>!t.done&&(t.date===todayStr||!t.date));
  const nextEvent=events.filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date))[0];
  const upcomingShifts=shifts.filter(s=>s.date>todayStr).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  const nextShift=nextShiftInfo(shifts);

  // ── Modals ────────────────────────────────────────────────────────────────
  function ShiftModal({date,shift,onClose}){
    const[start,setStart]=useState(shift?.start||"");
    const[end,setEnd]=useState(shift?.end||"");
    const[note,setNote]=useState(shift?.note||"");
    return(<Modal title={`Work Shift — ${prettyDate(date)}`} onClose={onClose}>
      <div style={fS}><label style={lS}>START TIME</label><input type="time" style={iS} value={start} onChange={e=>setStart(e.target.value)}/></div>
      <div style={fS}><label style={lS}>END TIME</label><input type="time" style={iS} value={end} onChange={e=>setEnd(e.target.value)}/></div>
      <div style={fS}><label style={lS}>NOTE</label><input type="text" style={iS} placeholder="e.g. Opening shift" value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <Btn onClick={()=>{setShifts(p=>{const f=p.filter(x=>x.date!==date);return start?[...f,{date,start,end,note}]:f;});onClose();}}>Save</Btn>
        {shift&&<Btn color="#dc2626" onClick={()=>{setShifts(p=>p.filter(x=>x.date!==date));onClose();}}>Remove</Btn>}
        <Btn color="#374151" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>);
  }

  const EC=["#6366f1","#10b981","#f59e0b","#ef4444","#ec4899","#06b6d4","#8b5cf6"];
  function EventModal({ev,onClose}){
    const[title,setTitle]=useState(ev?.title||"");
    const[date,setDate]=useState(ev?.date||today());
    const[time,setTime]=useState(ev?.time||"");
    const[color,setColor]=useState(ev?.color||EC[0]);
    const[note,setNote]=useState(ev?.note||"");
    return(<Modal title={ev?"Edit Event":"Add Event"} onClose={onClose}>
      <div style={fS}><label style={lS}>TITLE</label><input type="text" style={iS} placeholder="Concert, birthday, trip..." value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div style={fS}><label style={lS}>DATE</label><input type="date" style={iS} value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div style={fS}><label style={lS}>TIME</label><input type="time" style={iS} value={time} onChange={e=>setTime(e.target.value)}/></div>
      <div style={fS}><label style={lS}>NOTES</label><input type="text" style={iS} placeholder="Any extra info" value={note} onChange={e=>setNote(e.target.value)}/></div>
      <div style={fS}><label style={lS}>COLOUR</label><div style={{display:"flex",gap:"8px"}}>{EC.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:"28px",height:"28px",borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></div>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <Btn onClick={()=>{if(title&&date){setEvents(p=>[...p.filter(x=>x.id!==ev?.id),{id:ev?.id||Date.now(),title,date,time,color,note}]);onClose();}}}>Save</Btn>
        {ev&&<Btn color="#dc2626" onClick={()=>{setEvents(p=>p.filter(x=>x.id!==ev.id));onClose();}}>Delete</Btn>}
        <Btn color="#374151" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>);
  }

  function ReminderModal({rem,onClose}){
    const[text,setText]=useState(rem?.text||"");
    const[date,setDate]=useState(rem?.date||"");
    const[time,setTime]=useState(rem?.time||"");
    const[priority,setPriority]=useState(rem?.priority||"normal");
    return(<Modal title={rem?"Edit Reminder":"Add Reminder"} onClose={onClose}>
      <div style={fS}><label style={lS}>REMINDER</label><input type="text" style={iS} placeholder="What do you need to remember?" value={text} onChange={e=>setText(e.target.value)}/></div>
      <div style={fS}><label style={lS}>DATE</label><input type="date" style={iS} value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div style={fS}><label style={lS}>TIME</label><input type="time" style={iS} value={time} onChange={e=>setTime(e.target.value)}/></div>
      <div style={fS}><label style={lS}>PRIORITY</label><div style={{display:"flex",gap:"8px"}}>{[["low","#10b981"],["normal","#6366f1"],["high","#ef4444"]].map(([p,c])=>(<button key={p} onClick={()=>setPriority(p)} style={{padding:"6px 14px",borderRadius:"8px",border:`2px solid ${priority===p?c:"#2a2d3a"}`,background:priority===p?c+"22":"transparent",color:priority===p?c:"#888",cursor:"pointer",fontWeight:600,fontSize:"13px",textTransform:"capitalize",fontFamily:"'DM Sans',sans-serif"}}>{p}</button>))}</div></div>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <Btn onClick={()=>{if(text){setReminders(p=>[...p.filter(x=>x.id!==rem?.id),{id:rem?.id||Date.now(),text,date,time,priority,done:rem?.done||false}]);onClose();}}}>Save</Btn>
        {rem&&<Btn color="#dc2626" onClick={()=>{setReminders(p=>p.filter(x=>x.id!==rem.id));onClose();}}>Delete</Btn>}
        <Btn color="#374151" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>);
  }

  function TodoModal({todo,onClose}){
    const[text,setText]=useState(todo?.text||"");
    const[date,setDate]=useState(todo?.date||"");
    const[priority,setPriority]=useState(todo?.priority||"normal");
    return(<Modal title={todo?"Edit Task":"Add Task"} onClose={onClose}>
      <div style={fS}><label style={lS}>TASK</label><input type="text" style={iS} placeholder="What needs doing?" value={text} onChange={e=>setText(e.target.value)} autoFocus/></div>
      <div style={fS}><label style={lS}>DATE (optional)</label><input type="date" style={iS} value={date} onChange={e=>setDate(e.target.value)}/></div>
      <div style={fS}><label style={lS}>PRIORITY</label><div style={{display:"flex",gap:"8px"}}>{[["low","#10b981"],["normal","#6366f1"],["high","#ef4444"]].map(([p,c])=>(<button key={p} onClick={()=>setPriority(p)} style={{padding:"6px 14px",borderRadius:"8px",border:`2px solid ${priority===p?c:"#2a2d3a"}`,background:priority===p?c+"22":"transparent",color:priority===p?c:"#888",cursor:"pointer",fontWeight:600,fontSize:"13px",textTransform:"capitalize",fontFamily:"'DM Sans',sans-serif"}}>{p}</button>))}</div></div>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <Btn onClick={()=>{if(text){setTodos(p=>[...p.filter(x=>x.id!==todo?.id),{id:todo?.id||Date.now(),text,date,priority,done:false}]);onClose();}}}>Save</Btn>
        {todo&&<Btn color="#dc2626" onClick={()=>{setTodos(p=>p.filter(x=>x.id!==todo.id));onClose();}}>Delete</Btn>}
        <Btn color="#374151" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>);
  }

  function NoteModal({note,onClose}){
    const[title,setTitle]=useState(note?.title||"");
    const[body,setBody]=useState(note?.body||"");
    const[color,setColor]=useState(note?.color||"#6366f1");
    const NC=["#6366f1","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
    return(<Modal title={note?"Edit Note":"New Note"} onClose={onClose}>
      <div style={fS}><label style={lS}>TITLE</label><input type="text" style={iS} placeholder="Note title..." value={title} onChange={e=>setTitle(e.target.value)}/></div>
      <div style={fS}><label style={lS}>NOTE</label><textarea style={{...iS,minHeight:"120px",resize:"vertical",lineHeight:1.6}} placeholder="Write anything..." value={body} onChange={e=>setBody(e.target.value)}/></div>
      <div style={fS}><label style={lS}>COLOUR</label><div style={{display:"flex",gap:"8px"}}>{NC.map(c=><div key={c} onClick={()=>setColor(c)} style={{width:"28px",height:"28px",borderRadius:"50%",background:c,cursor:"pointer",border:color===c?"3px solid #fff":"3px solid transparent"}}/>)}</div></div>
      <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
        <Btn onClick={()=>{if(title||body){setNotes(p=>[...p.filter(x=>x.id!==note?.id),{id:note?.id||Date.now(),title,body,color,updatedAt:Date.now()}]);onClose();}}}>Save</Btn>
        {note&&<Btn color="#dc2626" onClick={()=>{setNotes(p=>p.filter(x=>x.id!==note.id));onClose();}}>Delete</Btn>}
        <Btn color="#374151" onClick={onClose}>Cancel</Btn>
      </div>
    </Modal>);
  }

  const TABS=[{id:"home",label:"🏠"},{id:"schedule",label:"📅"},{id:"events",label:"🎉"},{id:"todos",label:"✅"},{id:"reminders",label:"🔔"},{id:"notes",label:"📝"},{id:"ask",label:"💬"}];
  const TAB_NAMES={home:"Home",schedule:"Schedule",events:"Events",todos:"To-Do",reminders:"Reminders",notes:"Notes",ask:"Ask"};
  const weekLabel=(()=>{const s=parse(weekStart);const e=parse(addDays(weekStart,13));return`${s.getDate()} ${MONTHS[s.getMonth()].slice(0,3)} – ${e.getDate()} ${MONTHS[e.getMonth()].slice(0,3)}`;})();

  return(
    <div style={{minHeight:"100vh",background:"#080a10",fontFamily:"'DM Sans',sans-serif",color:"#f0f0f5",paddingBottom:"80px"}}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@700;800&display=swap" rel="stylesheet"/>

      {/* ── NEXT SHIFT BANNER ── */}
      {nextShift&&(
        <div style={{background:"linear-gradient(90deg,#1e2f4e,#1a2540)",borderBottom:"1px solid #2563eb44",padding:"8px 16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <span style={{fontSize:"16px"}}>💼</span>
            <div>
              <div style={{fontSize:"12px",color:"#93c5fd",fontWeight:700}}>
                {nextShift.isToday ? shiftCountdown(nextShift.shift) : `Next shift · ${prettyDate(nextShift.shift.date)}`}
              </div>
              <div style={{fontSize:"11px",color:"#60a5fa"}}>{to12(nextShift.shift.start)} – {to12(nextShift.shift.end)} · {nextShift.shift.note}</div>
            </div>
          </div>

        </div>
      )}

      {/* ── HEADER ── */}
      <div style={{background:"linear-gradient(135deg,#0f1117,#141826)",borderBottom:"1px solid #1e2234",padding:"14px 16px 0",position:"sticky",top:nextShift?41:0,zIndex:50}}>
        <div style={{maxWidth:"640px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"10px"}}>
            <div>
              <span style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:"18px",background:"linear-gradient(135deg,#818cf8,#6366f1)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Welcome, Joshua</span>
              <span style={{color:"#4b5563",fontSize:"11px",marginLeft:"8px"}}>{TAB_NAMES[tab]}</span>
            </div>

          </div>
          <div style={{display:"flex",gap:"0",overflowX:"auto"}}>
            {TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 13px",background:"transparent",border:"none",borderBottom:tab===t.id?"2px solid #6366f1":"2px solid transparent",color:tab===t.id?"#818cf8":"#6b7280",cursor:"pointer",fontWeight:600,fontSize:"17px",whiteSpace:"nowrap",transition:"all 0.2s"}}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{maxWidth:"640px",margin:"0 auto",padding:"20px 16px"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            <div style={{marginBottom:"20px"}}>
              <div style={{fontFamily:"'Space Grotesk',sans-serif",fontWeight:800,fontSize:"22px",color:"#f0f0f5"}}>{greet()} 👋</div>
              <div style={{color:"#6b7280",fontSize:"14px",marginTop:"2px"}}>{prettyDate(todayStr)}</div>
            </div>

            {/* Today card */}
            <div style={{background:"linear-gradient(135deg,#1a1d30,#151828)",border:"1px solid #6366f133",borderRadius:"16px",padding:"18px",marginBottom:"14px"}}>
              <div style={{fontSize:"11px",color:"#6366f1",fontWeight:700,letterSpacing:"0.08em",marginBottom:"12px"}}>TODAY</div>
              {todayShift?(
                <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
                  <div style={{fontSize:"20px"}}>💼</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:700,color:"#93c5fd"}}>Work {to12(todayShift.start)} – {to12(todayShift.end)}</div>
                    <div style={{fontSize:"12px",color:"#60a5fa"}}>{shiftCountdown(todayShift)}</div>
                    <div style={{fontSize:"11px",color:"#6b7280"}}>{todayShift.note}</div>
                  </div>

                </div>
              ):(
                <div style={{color:"#6b7280",fontSize:"14px",marginBottom:"10px"}}>🌴 Day off today</div>
              )}
              {todayEvents.map(e=>(
                <div key={e.id} style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"8px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:e.color,flexShrink:0}}/>
                  <div style={{fontWeight:600,color:"#f0f0f5"}}>{e.title}{e.time?` · ${to12(e.time)}`:""}</div>
                </div>
              ))}
              {!todayShift&&todayEvents.length===0&&<div style={{color:"#4b5563",fontSize:"13px"}}>Nothing else today</div>}
            </div>

            {/* Today's to-dos */}
            <div style={{background:"#0f1117",border:"1px solid #1e2234",borderRadius:"16px",padding:"16px",marginBottom:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <div style={{fontSize:"11px",color:"#10b981",fontWeight:700,letterSpacing:"0.08em"}}>TODAY'S TASKS</div>
                <button onClick={()=>setModal({type:"todo",todo:null})} style={{background:"#10b98122",border:"none",color:"#10b981",padding:"4px 10px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>+ Add</button>
              </div>
              {pendingTodos.length===0?(<div style={{color:"#4b5563",fontSize:"13px"}}>All done! ✅</div>):
              pendingTodos.map(t=>(
                <div key={t.id} style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"8px"}}>
                  <button onClick={()=>setTodos(p=>p.map(x=>x.id===t.id?{...x,done:true}:x))} style={{width:"22px",height:"22px",borderRadius:"6px",border:"2px solid #374151",background:"transparent",cursor:"pointer",flexShrink:0}}/>
                  <span style={{fontSize:"14px",color:"#e5e7eb"}}>{t.text}</span>
                </div>
              ))}
            </div>

            {/* Coming up */}
            <div style={{background:"#0f1117",border:"1px solid #1e2234",borderRadius:"16px",padding:"16px"}}>
              <div style={{fontSize:"11px",color:"#f59e0b",fontWeight:700,letterSpacing:"0.08em",marginBottom:"12px"}}>COMING UP</div>
              {nextEvent&&(
                <div style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"8px"}}>
                  <div style={{width:"8px",height:"8px",borderRadius:"50%",background:nextEvent.color,flexShrink:0}}/>
                  <div><div style={{fontWeight:600,color:"#f0f0f5"}}>{nextEvent.title}</div><div style={{fontSize:"12px",color:"#9ca3af"}}>{prettyDate(nextEvent.date)}</div></div>
                </div>
              )}
              {upcomingShifts.map(s=>(
                <div key={s.date} style={{display:"flex",gap:"10px",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{fontSize:"16px"}}>💼</span>
                  <div><div style={{fontWeight:600,color:"#93c5fd"}}>Work · {prettyDate(s.date)}</div><div style={{fontSize:"12px",color:"#9ca3af"}}>{to12(s.start)} – {to12(s.end)} · {s.note}</div></div>
                </div>
              ))}
              {!nextEvent&&upcomingShifts.length===0&&<div style={{color:"#4b5563",fontSize:"13px"}}>Nothing coming up yet</div>}
            </div>
          </div>
        )}

        {/* ── SCHEDULE ── */}
        {tab==="schedule"&&(
          <div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"16px"}}>
              <button onClick={()=>setWeekStart(addDays(weekStart,-14))} style={{background:"#1a1d27",border:"1px solid #2a2d3a",color:"#818cf8",padding:"8px 14px",borderRadius:"10px",cursor:"pointer",fontWeight:700,fontSize:"16px"}}>‹</button>
              <span style={{fontWeight:700,fontSize:"13px",color:"#9ca3af"}}>{weekLabel}</span>
              <button onClick={()=>setWeekStart(addDays(weekStart,14))} style={{background:"#1a1d27",border:"1px solid #2a2d3a",color:"#818cf8",padding:"8px 14px",borderRadius:"10px",cursor:"pointer",fontWeight:700,fontSize:"16px"}}>›</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"8px"}}>
              {days14.map(d=>{
                const shift=shiftMap[d];const dayEvs=evMap[d]||[];const isToday=d===todayStr;const past=d<todayStr;
                return(<div key={d} onClick={()=>setModal({type:"shift",date:d,shift})} style={{background:isToday?"linear-gradient(135deg,#1e1f3a,#1a1d30)":past?"#0d0f18":"#0f1117",border:isToday?"1px solid #6366f1":"1px solid #1e2234",borderRadius:"12px",padding:"12px",cursor:"pointer",opacity:past?0.6:1,position:"relative"}}>
                  {isToday&&<div style={{position:"absolute",top:"10px",right:"10px",width:"7px",height:"7px",borderRadius:"50%",background:"#6366f1"}}/>}
                  <div style={{fontSize:"11px",color:"#6b7280",fontWeight:600,marginBottom:"2px"}}>{DAYS[parse(d).getDay()]}</div>
                  <div style={{fontSize:"20px",fontWeight:800,color:isToday?"#818cf8":"#e5e7eb",lineHeight:1,marginBottom:"6px"}}>{parse(d).getDate()}</div>
                  {shift?.start?(<div style={{background:"#1e2f4e",border:"1px solid #2563eb33",borderRadius:"8px",padding:"5px 8px"}}>
                    <div style={{fontSize:"11px",color:"#60a5fa",fontWeight:700}}>WORK</div>
                    <div style={{fontSize:"11px",color:"#93c5fd",fontWeight:600}}>{to12(shift.start)}–{to12(shift.end)}</div>
                    {shift.note&&<div style={{fontSize:"10px",color:"#6b7280",marginTop:"1px"}}>{shift.note}</div>}
                  </div>):(<div style={{fontSize:"11px",color:"#374151",fontStyle:"italic"}}>day off</div>)}
                  {dayEvs.slice(0,2).map(ev=>(<div key={ev.id} style={{marginTop:"4px",background:ev.color+"22",borderLeft:`2px solid ${ev.color}`,borderRadius:"0 6px 6px 0",padding:"2px 6px"}}><div style={{fontSize:"10px",color:ev.color,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ev.title}</div></div>))}
                </div>);
              })}
            </div>
            <div style={{marginTop:"12px",textAlign:"center",fontSize:"12px",color:"#4b5563"}}>Tap any day to add or edit a shift</div>
          </div>
        )}

        {/* ── EVENTS ── */}
        {tab==="events"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <span style={{fontWeight:700,fontSize:"16px"}}>Your Events</span>
              <Btn onClick={()=>setModal({type:"event",ev:null})}>+ Add Event</Btn>
            </div>
            {events.filter(e=>e.date>=todayStr).sort((a,b)=>a.date.localeCompare(b.date)).map(ev=>{
              const shift=shiftMap[ev.date];
              return(<div key={ev.id} onClick={()=>setModal({type:"event",ev})} style={{background:"#0f1117",border:`1px solid ${ev.color}33`,borderLeft:`3px solid ${ev.color}`,borderRadius:"12px",padding:"14px 16px",marginBottom:"10px",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:"15px"}}>{ev.title}</div>
                  <div style={{fontSize:"13px",color:"#9ca3af",marginTop:"2px"}}>{prettyDate(ev.date)}{ev.time?` · ${to12(ev.time)}`:""}</div>
                  {ev.note&&<div style={{fontSize:"12px",color:"#6b7280",marginTop:"2px"}}>{ev.note}</div>}
                  {shift?.start&&<div style={{fontSize:"12px",color:"#60a5fa",marginTop:"4px"}}>⚡ Also working: {to12(shift.start)}–{to12(shift.end)}</div>}
                </div>
                <div style={{width:"10px",height:"10px",borderRadius:"50%",background:ev.color,flexShrink:0,marginLeft:"12px"}}/>
              </div>);
            })}
            {events.filter(e=>e.date>=todayStr).length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#4b5563"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>🗓️</div><div style={{fontWeight:600}}>No upcoming events</div></div>}
            {events.filter(e=>e.date<todayStr).length>0&&(<>
              <div style={{color:"#4b5563",fontSize:"12px",fontWeight:700,letterSpacing:"0.08em",margin:"20px 0 10px"}}>PAST</div>
              {events.filter(e=>e.date<todayStr).sort((a,b)=>b.date.localeCompare(a.date)).map(ev=>(
                <div key={ev.id} onClick={()=>setModal({type:"event",ev})} style={{background:"#0a0c12",border:"1px solid #1a1d27",borderRadius:"10px",padding:"10px 16px",marginBottom:"6px",cursor:"pointer",opacity:0.5}}>
                  <div style={{fontWeight:600,fontSize:"14px",color:"#9ca3af"}}>{ev.title}</div>
                  <div style={{fontSize:"12px",color:"#6b7280"}}>{prettyDate(ev.date)}</div>
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* ── TO-DOS ── */}
        {tab==="todos"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <span style={{fontWeight:700,fontSize:"16px"}}>To-Do List</span>
              <Btn color="#10b981" onClick={()=>setModal({type:"todo",todo:null})}>+ Add Task</Btn>
            </div>
            <div style={{display:"flex",gap:"8px",marginBottom:"20px"}}>
              <input type="text" id="quicktodo" style={{...iS,flex:1}} placeholder="Quick add — type and press enter..."
                onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){setTodos(p=>[...p,{id:Date.now(),text:e.target.value.trim(),date:"",priority:"normal",done:false}]);e.target.value="";}}}/>
            </div>
            {todos.filter(t=>!t.done).length===0&&<div style={{textAlign:"center",padding:"30px",color:"#4b5563"}}><div style={{fontSize:"28px",marginBottom:"8px"}}>✅</div><div>All done!</div></div>}
            {todos.filter(t=>!t.done).sort((a,b)=>{const p={high:0,normal:1,low:2};return p[a.priority]-p[b.priority];}).map(t=>{
              const pc={high:"#ef4444",normal:"#6366f1",low:"#10b981"}[t.priority];
              return(<div key={t.id} style={{background:"#0f1117",border:`1px solid ${pc}22`,borderRadius:"12px",padding:"12px 14px",marginBottom:"8px",display:"flex",gap:"12px",alignItems:"center"}}>
                <button onClick={()=>setTodos(p=>p.map(x=>x.id===t.id?{...x,done:true}:x))} style={{width:"24px",height:"24px",borderRadius:"6px",border:`2px solid ${pc}`,background:"transparent",cursor:"pointer",flexShrink:0}}/>
                <div style={{flex:1}} onClick={()=>setModal({type:"todo",todo:t})}>
                  <div style={{fontWeight:600,fontSize:"14px",color:"#f0f0f5"}}>{t.text}</div>
                  {t.date&&<div style={{fontSize:"12px",color:"#9ca3af",marginTop:"2px"}}>📅 {prettyDate(t.date)}</div>}
                </div>
                <span style={{fontSize:"10px",fontWeight:700,color:pc,background:pc+"22",padding:"2px 8px",borderRadius:"99px",textTransform:"uppercase"}}>{t.priority}</span>
              </div>);
            })}
            {todos.filter(t=>t.done).length>0&&(<>
              <div style={{color:"#4b5563",fontSize:"12px",fontWeight:700,letterSpacing:"0.08em",margin:"20px 0 10px"}}>DONE ({todos.filter(t=>t.done).length})</div>
              {todos.filter(t=>t.done).map(t=>(
                <div key={t.id} style={{background:"#0a0c12",border:"1px solid #1a1d27",borderRadius:"10px",padding:"10px 14px",marginBottom:"6px",display:"flex",gap:"10px",alignItems:"center",opacity:0.45}}>
                  <span>✅</span><span style={{flex:1,fontSize:"14px",color:"#6b7280",textDecoration:"line-through"}}>{t.text}</span>
                  <button onClick={()=>setTodos(p=>p.filter(x=>x.id!==t.id))} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:"16px"}}>✕</button>
                </div>
              ))}
              <button onClick={()=>setTodos(p=>p.filter(t=>!t.done))} style={{background:"#1a1d27",border:"1px solid #2a2d3a",color:"#6b7280",padding:"8px 16px",borderRadius:"8px",cursor:"pointer",fontSize:"12px",fontWeight:600,marginTop:"4px",fontFamily:"'DM Sans',sans-serif"}}>Clear all done</button>
            </>)}
          </div>
        )}

        {/* ── REMINDERS ── */}
        {tab==="reminders"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <span style={{fontWeight:700,fontSize:"16px"}}>Reminders</span>
              <Btn onClick={()=>setModal({type:"reminder",rem:null})}>+ Add</Btn>
            </div>
            {reminders.filter(r=>!r.done).length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#4b5563"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>✅</div><div style={{fontWeight:600}}>All clear!</div></div>}
            {reminders.filter(r=>!r.done).sort((a,b)=>{const p={high:0,normal:1,low:2};return p[a.priority]-p[b.priority];}).map(r=>{
              const pc={high:"#ef4444",normal:"#6366f1",low:"#10b981"}[r.priority];const ov=r.date&&r.date<todayStr;
              return(<div key={r.id} style={{background:"#0f1117",border:`1px solid ${pc}33`,borderRadius:"12px",padding:"14px 16px",marginBottom:"10px",display:"flex",gap:"12px",alignItems:"flex-start"}}>
                <button onClick={()=>setReminders(p=>p.map(x=>x.id===r.id?{...x,done:true}:x))} style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid ${pc}`,background:"transparent",cursor:"pointer",flexShrink:0,marginTop:"2px"}}/>
                <div style={{flex:1}} onClick={()=>setModal({type:"reminder",rem:r})}>
                  <div style={{fontWeight:600,fontSize:"15px"}}>{r.text}</div>
                  {r.date&&<div style={{fontSize:"13px",color:ov?"#ef4444":"#9ca3af",marginTop:"2px",fontWeight:ov?700:400}}>{ov?"⚠️ Overdue · ":"📅 "}{prettyDate(r.date)}{r.time?` · ${to12(r.time)}`:""}</div>}
                  <span style={{fontSize:"11px",fontWeight:700,color:pc,background:pc+"22",padding:"2px 8px",borderRadius:"99px",textTransform:"uppercase",marginTop:"4px",display:"inline-block"}}>{r.priority}</span>
                </div>
              </div>);
            })}
            {reminders.filter(r=>r.done).length>0&&(<>
              <div style={{color:"#4b5563",fontSize:"12px",fontWeight:700,letterSpacing:"0.08em",margin:"20px 0 10px"}}>DONE</div>
              {reminders.filter(r=>r.done).map(r=>(
                <div key={r.id} style={{background:"#0a0c12",border:"1px solid #1a1d27",borderRadius:"10px",padding:"10px 16px",marginBottom:"6px",display:"flex",gap:"10px",alignItems:"center",opacity:0.45}}>
                  <span>✅</span><span style={{flex:1,fontSize:"14px",color:"#6b7280",textDecoration:"line-through"}}>{r.text}</span>
                  <button onClick={()=>setReminders(p=>p.filter(x=>x.id!==r.id))} style={{background:"none",border:"none",color:"#4b5563",cursor:"pointer",fontSize:"16px"}}>✕</button>
                </div>
              ))}
            </>)}
          </div>
        )}

        {/* ── NOTES ── */}
        {tab==="notes"&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <span style={{fontWeight:700,fontSize:"16px"}}>Notes</span>
              <Btn color="#8b5cf6" onClick={()=>setModal({type:"note",note:null})}>+ New Note</Btn>
            </div>
            {notes.length===0&&<div style={{textAlign:"center",padding:"40px 20px",color:"#4b5563"}}><div style={{fontSize:"32px",marginBottom:"8px"}}>📝</div><div style={{fontWeight:600}}>No notes yet</div><div style={{fontSize:"13px",marginTop:"4px"}}>Jot down anything — ideas, diary, lists...</div></div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
              {notes.sort((a,b)=>b.updatedAt-a.updatedAt).map(n=>(
                <div key={n.id} onClick={()=>setModal({type:"note",note:n})} style={{background:"#0f1117",border:`1px solid ${n.color}44`,borderTop:`3px solid ${n.color}`,borderRadius:"12px",padding:"14px",cursor:"pointer",minHeight:"100px"}}>
                  <div style={{fontWeight:700,fontSize:"14px",color:"#f0f0f5",marginBottom:"6px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title||"Untitled"}</div>
                  <div style={{fontSize:"12px",color:"#6b7280",lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical"}}>{n.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ASK ── */}
        {tab==="ask"&&(
          <div>
            <div style={{marginBottom:"16px"}}>
              <div style={{fontWeight:700,fontSize:"16px",marginBottom:"4px"}}>Ask anything</div>
              <div style={{fontSize:"13px",color:"#6b7280"}}>"What's on June 27th?", "When is Bad Bunny?", "What am I working tomorrow?"</div>
            </div>
            <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"16px"}}>
              {["What am I working this week?","What's on today?","Any events coming up?","What do I need to remember?"].map(q=>(
                <button key={q} onClick={()=>{setAiQ(q);setAiA(localSearch(q,shifts,events,reminders));}} style={{background:"#1a1d27",border:"1px solid #2a2d3a",color:"#9ca3af",padding:"6px 12px",borderRadius:"99px",cursor:"pointer",fontSize:"12px",fontWeight:500,fontFamily:"'DM Sans',sans-serif"}}>{q}</button>
              ))}
            </div>
            <div style={{display:"flex",gap:"8px",marginBottom:"16px"}}>
              <input type="text" style={{...iS,flex:1}} placeholder="Ask about your schedule..." value={aiQ} onChange={e=>setAiQ(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&aiQ.trim())setAiA(localSearch(aiQ,shifts,events,reminders));}}/>
              <Btn onClick={()=>{if(aiQ.trim())setAiA(localSearch(aiQ,shifts,events,reminders));}} style={{flexShrink:0,padding:"10px 16px"}}>Ask</Btn>
            </div>
            {aiA&&(
              <div style={{background:"linear-gradient(135deg,#1a1d30,#151828)",border:"1px solid #6366f133",borderRadius:"14px",padding:"18px"}}>
                <div style={{fontSize:"11px",color:"#6366f1",fontWeight:700,letterSpacing:"0.08em",marginBottom:"10px"}}>✦ ANSWER</div>
                <div style={{fontSize:"15px",color:"#e5e7eb",lineHeight:1.7,whiteSpace:"pre-wrap"}}>{aiA}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.type==="shift"&&<ShiftModal date={modal.date} shift={modal.shift} onClose={()=>setModal(null)}/>}
      {modal?.type==="event"&&<EventModal ev={modal.ev} onClose={()=>setModal(null)}/>}
      {modal?.type==="reminder"&&<ReminderModal rem={modal.rem} onClose={()=>setModal(null)}/>}
      {modal?.type==="todo"&&<TodoModal todo={modal.todo} onClose={()=>setModal(null)}/>}
      {modal?.type==="note"&&<NoteModal note={modal.note} onClose={()=>setModal(null)}/>}
    </div>
  );
}
