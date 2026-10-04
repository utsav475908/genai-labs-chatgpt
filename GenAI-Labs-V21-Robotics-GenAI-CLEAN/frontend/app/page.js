"use client";
import {useState} from "react";

const API=process.env.NEXT_PUBLIC_API_URL||"http://localhost:8021";
const items=[["🤖","Dashboard"],["🧠","AI Assistant"],["👁️","Vision"],["🎯","Object Detection"],["🧭","Navigation"],["🦾","Robot Arm"],["🚁","Drone"],["📡","Telemetry"],["🧩","ROS 2"],["🛡️","Safety"]];

export default function Home(){
 const [tab,setTab]=useState("Dashboard"),[robot,setRobot]=useState({x:50,y:50}),[text,setText]=useState(""),[plan,setPlan]=useState(null),[answer,setAnswer]=useState(""),[busy,setBusy]=useState(false),[moving,setMoving]=useState(false);
 const move=(dir)=>{
  if(moving)return; setMoving(true); let n=0;
  const t=setInterval(()=>{n++;setRobot(r=>({x:Math.max(5,Math.min(95,r.x+(dir==="left"?-1:dir==="right"?1:0))),y:Math.max(5,Math.min(95,r.y+(dir==="up"?-1:dir==="down"?1:0)))}));if(n>=15){clearInterval(t);setMoving(false)}},35);
 };
 const reset=()=>setRobot({x:50,y:50});
 async function generate(){
  if(!text.trim())return;setBusy(true);setPlan(null);setAnswer("");
  try{const r=await fetch(API+"/robot/plan",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:text,robot:"Simulator"})});const d=await r.json();setPlan(d.plan)}
  catch(e){setAnswer("Backend is offline. Start FastAPI on port 8021.")}
  finally{setBusy(false)}
 }
 async function ask(){
  if(!text.trim())return;setBusy(true);
  try{const r=await fetch(API+"/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({instruction:text})});const d=await r.json();setAnswer(d.response||d.detail)}
  catch(e){setAnswer("Backend is offline.")}
  finally{setBusy(false)}
 }
 function execute(){if(plan?.action==="move"){const d=plan.direction==="backward"?"down":plan.direction==="left"?"left":plan.direction==="right"?"right":"up";move(d)}}
 return <main>
  <header><div><b>GENAI-LABS</b><small>V21 · ROBOTICS + GENAI LAB</small></div><div className="online">● SIMULATOR ONLINE <em>localhost:3021</em></div></header>
  <div className="shell">
   <aside><h4>ROBOTICS LAB</h4>{items.map(([i,n])=><button className={tab===n?"sel":""} onClick={()=>setTab(n)} key={n}><span>{i}</span>{n}</button>)}<footer>● AI API READY<br/>● SIMULATOR READY</footer></aside>
   <section className="main">
    <div className="heading"><div><label>AI + ROBOTICS + SIMULATION</label><h1>{tab}</h1><p>Natural language → AI planning → safety → robot simulation</p></div><button className="reset" onClick={reset}>↻ Reset</button></div>
    <div className="columns">
     <section className="card simulator"><div className="title"><b>🤖 ROBOT SIMULATOR</b><span>2D NAVIGATION ENVIRONMENT</span></div>
      <div className="map"><div className="ob o1"/><div className="ob o2"/><div className="ob o3"/><div className="start">START</div><div className="bot" style={{left:`${robot.x}%`,top:`${robot.y}%`}}>🤖</div><small>LOCAL ROBOT MAP</small></div>
      <div className="stats"><div>BATTERY<strong>87%</strong></div><div>POSITION<strong>{robot.x.toFixed(0)}, {robot.y.toFixed(0)}</strong></div><div>STATE<strong>{moving?"MOVING":"IDLE"}</strong></div><div>SAFETY<strong className="green">● READY</strong></div></div>
      <div className="manual"><span>MANUAL CONTROL</span><div><button onClick={()=>move("up")}>↑</button><button onClick={()=>move("left")}>←</button><button onClick={reset}>■</button><button onClick={()=>move("right")}>→</button><button onClick={()=>move("down")}>↓</button></div></div>
     </section>
     <div className="right">
      <section className="card"><div className="title"><b>ROBOT STATUS</b><span className="green">● ONLINE</span></div><h3>GenAI Robot Simulator</h3><p>Battery <b>87%</b></p><p>Mode <b>{moving?"MOVING":"IDLE"}</b></p><p>Safety <b className="green">READY</b></p></section>
      <section className="card"><div className="title"><b>AI ROBOT PIPELINE</b></div><div className="flow"><span>USER</span>→<span>🧠 AI</span>→<span>🛡️ SAFETY</span>→<span>🤖 ROBOT</span></div></section>
      <section className="card quick"><div className="title"><b>QUICK COMMANDS</b></div><button onClick={()=>setText("Move the robot forward 1 meter.")}>Move forward 1m</button><button onClick={()=>setText("Move the robot right 1 meter.")}>Move right 1m</button><button onClick={()=>setText("Stop the robot.")}>Stop robot</button></section>
     </div>
    </div>
    <section className="card command"><div className="cmdhead"><div><label>NATURAL LANGUAGE CONTROL</label><h2>🧠 AI Command Center</h2></div><span>🛡️ SAFETY ENABLED</span></div>
     <textarea value={text} onChange={e=>setText(e.target.value)} placeholder='Try: "Move the robot forward 1 meter."'/>
     <button className="primary" onClick={generate} disabled={busy}>{busy?"Generating...":"Generate Safe Plan"}</button><button className="secondary" onClick={ask} disabled={busy}>Ask Robotics AI</button>{plan?.action==="move"&&<button className="execute" onClick={execute}>▶ Execute in Simulator</button>}
     {plan&&<div className="plan"><label>GENERATED ROBOT PLAN</label><div><b>ACTION<br/><strong>{plan.action||"—"}</strong></b><b>DIRECTION<br/><strong>{plan.direction||"—"}</strong></b><b>DISTANCE<br/><strong>{plan.distance_m??"—"} m</strong></b><b>SPEED<br/><strong>{plan.speed??"—"} m/s</strong></b></div><p>{plan.explanation||""}</p></div>}
     {answer&&<pre>{answer}</pre>}
    </section>
   </section>
  </div>
 </main>
}