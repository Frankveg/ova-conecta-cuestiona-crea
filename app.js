const APP_VERSION = '2.2.0';
let ANALYTICS_KEY = 'ova_cqc_analytics_v2';
let STORAGE_KEY = 'ova_cqc_state_v1';
const ACCOUNT_KEY='ova_cqc_accounts_v22';
const SESSION_KEY='ova_cqc_active_user_v22';
let activeUser=null;

const MODULES = [
  ['home', 'Inicio'],
  ['m0', '0. Mi perfil digital'],
  ['m1', '1. Información o conocimiento'],
  ['m2', '2. Método CRITICA'],
  ['m3', '3. Algoritmos y redes'],
  ['m4', '4. Inteligencia artificial'],
  ['m5', '5. Pensamos mejor juntos'],
  ['m6', '6. Ciudadano digital'],
  ['final', 'Reto final'],
  ['meta', 'Mi aprendizaje'],
  ['analytics', 'Mi progreso y evidencias']
];

const defaultState = {
  current: 'home',
  completed: [],
  diagnostic: {},
  profile: null,
  m1: {},
  m2: { ratings: {}, before: '', after: '', reflection: '' },
  m3: { stance: '', choices: [], reflection: '' },
  m4: { selected: [], rewrite: '', commitment: [] },
  m5: { roles: {}, evidenceFor: '', evidenceAgainst: '', limits: '', conclusion: '', confidence: '', peer1: '', peer2: '', peerQ: '', revised: '' },
  m6: {},
  final: { caseId: '', hypothesis: '', sources: '', ratings: {}, for: '', against: '', limits: '', verdict: '', argument: '', confidence: '' },
  meta: { before: '', now: '', changed: '', collaboration: '', aiRisk: '', commitment: '' }
};

let state = loadState();
let analytics = loadAnalytics();
let lastActivity = Date.now();
let currentViewStart = Date.now();
let sessionStarted = Date.now();
function loadAnalytics(){
  try { const a=JSON.parse(localStorage.getItem(ANALYTICS_KEY)||'null');
    if(a && typeof a==='object' && Array.isArray(a.events)) return a;
  } catch(e){} return {participant:'',consent:false,startedAt:null,events:[],notes:[]};
}
function persistAnalytics(){try{localStorage.setItem(ANALYTICS_KEY,JSON.stringify(analytics));}catch(e){console.warn('No se pudo guardar la analítica local',e);}}
function recordEvent(type,detail={}){
  if(!analytics.consent || !analytics.participant)return;
  const event={at:new Date().toISOString(),participant:analytics.participant,module:state.current,type,detail};
  analytics.events.push(event);
  if(analytics.events.length>4000)analytics.events=analytics.events.slice(-4000);
  persistAnalytics();
}
function recordDuration(){
  if(!analytics.consent)return;
  const now=Date.now(),secs=Math.round((now-currentViewStart)/1000);
  if(secs>=2 && secs<=3600)recordEvent('tiempo_modulo',{seconds:secs});
  currentViewStart=now;
}
function requireParticipant(){if(analytics.consent && analytics.participant)return true;toast('Inicia sesión para comenzar la prueba.');navigate('analytics');return false;}
function analyticsView(){
  const es=analytics.events;
  const visits=es.filter(e=>e.type==='visita_modulo');
  const completed=es.filter(e=>e.type==='modulo_completado');
  const difficulties=es.filter(e=>['dificultad','validacion_incompleta'].includes(e.type));
  const decisions=es.filter(e=>e.type==='decision');
  const answers=es.filter(e=>e.type==='respuesta' && typeof e.detail?.correct==='boolean');
  const correct=answers.filter(e=>e.detail.correct).length,wrong=answers.length-correct;
  const durations=es.filter(e=>e.type==='tiempo_modulo');
  const time=durations.reduce((n,e)=>n+(Number(e.detail?.seconds)||0),0);
  const pct=progressPercent();
  const moduleIds=['m0','m1','m2','m3','m4','m5','m6','final','meta'];
  const names={m0:'Perfil digital',m1:'Información',m2:'Método CRITICA',m3:'Algoritmos',m4:'Inteligencia artificial',m5:'Colaboración',m6:'Ciudadanía digital',final:'Reto final',meta:'Mi aprendizaje'};
  const active=analytics.consent && analytics.participant;
  const totalDecisions=decisions.length;
  const evidenceCount=es.length+analytics.notes.length;
  const stat=(label,value,note)=>`<div class="la-stat"><div class="la-stat-label">${label}</div><div class="la-stat-value">${value}</div><div class="la-stat-note">${note}</div></div>`;
  const bar=(label,value,max,unit='')=>`<div class="la-bar-row"><span class="la-bar-label">${esc(label)}</span><div class="la-bar-track" role="img" aria-label="${esc(label)}: ${value}${unit}"><span style="width:${max?Math.min(100,Math.round(value/max*100)):0}%"></span></div><strong>${value}${unit}</strong></div>`;
  const moduleBars=moduleIds.map(id=>{
    const count=visits.filter(e=>e.module===id).length;
    const done=state.completed.includes(id);
    return `<div class="la-module-row"><span>${esc(names[id])}</span><div class="la-module-track"><span style="width:${done?'100':count?'45':'0'}%" class="${done?'la-done':''}"></span></div><small>${done?'Finalizado':count?'Visitado':'Pendiente'}</small></div>`;
  }).join('');
  const recent=[...es.map(e=>({at:e.at,type:e.type,module:e.module,detail:e.detail})),...analytics.notes.map(n=>({at:n.at,type:'observación: '+n.kind,module:n.module,detail:{text:n.text}}))].sort((a,b)=>b.at.localeCompare(a.at)).slice(0,12);
  const eventRows=recent.map(e=>`<tr><td>${esc(new Date(e.at).toLocaleString('es-CO'))}</td><td>${esc(names[e.module]||e.module||'General')}</td><td>${esc(e.type.replaceAll('_',' '))}</td><td>${esc(String(e.detail?.text||e.detail?.choice||e.detail?.seconds&&e.detail.seconds+' s'||'').slice(0,90))}</td></tr>`).join('');
  const comprehension=answers.length?Math.round(correct/answers.length*100):null;
  return `${moduleHead('OVA 2.2 · Learning Analytics','Mi progreso y evidencias','Panel de analítica local del participante. Los gráficos se actualizan con los eventos registrados en este navegador.','Panel local')}
  <section class="card section la-session"><div><h2>Participante ${active?esc(activeUser?.name||analytics.participant):'sin registrar'} <small>(${esc(analytics.participant)})</small></h2><p class="muted">${active?'Sesión activa · Los datos se almacenan localmente.':'Regístrate en la pantalla de acceso para activar la analítica.'}</p></div><button class="secondary" id="endParticipant" ${active?'':'disabled'}>Cerrar sesión</button></section>
  <section class="section"><h2>1. Resumen del aprendizaje</h2><div class="la-stats">
  ${stat('Progreso',pct+'%','Actividades completadas')}${stat('Permanencia',Math.round(time/60)+' min','Tiempo registrado aproximado')}${stat('Decisiones',totalDecisions,'Elecciones registradas')}${stat('Comprensión',comprehension===null?'Sin datos':comprehension+'%','Aciertos en respuestas evaluables')}
  </div></section>
  <section class="la-dashboard section">
    <article class="card la-panel"><h2>2. Avance por módulo</h2><p class="muted">Distingue módulos visitados, finalizados y pendientes.</p><div class="la-module-chart">${moduleBars}</div><div class="la-legend"><span>■ Finalizado</span><span>■ Visitado</span></div></article>
    <article class="card la-panel"><h2>3. Aciertos y errores</h2><p class="muted">Solo se cuentan respuestas que el OVA puede evaluar automáticamente.</p><div class="la-donut" style="--la-correct:${answers.length?correct/answers.length*100:0}%"><div><strong>${answers.length?comprehension+'%':'—'}</strong><small>${answers.length?'de aciertos':'Sin respuestas'}</small></div></div><div class="la-legend"><span><i class="la-dot la-green"></i>Aciertos: ${correct}</span><span><i class="la-dot la-red"></i>Errores: ${wrong}</span></div></article>
    <article class="card la-panel"><h2>4. Tiempo por módulo</h2><p class="muted">Segundos acumulados al cambiar de módulo o salir de la página.</p><div class="la-bar-chart">${moduleIds.map(id=>bar(names[id],durations.filter(e=>e.module===id).reduce((n,e)=>n+(Number(e.detail?.seconds)||0),0),Math.max(1,...moduleIds.map(mid=>durations.filter(e=>e.module===mid).reduce((n,e)=>n+(Number(e.detail?.seconds)||0),0))),' s')).join('')}</div></article>
    <article class="card la-panel"><h2>5. Interacciones y dificultades</h2><p class="muted">Frecuencia de acciones detectadas durante la prueba.</p><div class="la-bar-chart">${[['Visitas',visits.length],['Decisiones',decisions.length],['Dificultades',difficulties.length],['Observaciones',analytics.notes.length],['Finalizaciones',completed.length]].map(([name,n])=>bar(name,n,Math.max(1,visits.length,decisions.length,difficulties.length,analytics.notes.length,completed.length))).join('')}</div><p class="muted">Un error no equivale necesariamente a una dificultad pedagógica; revisa la bitácora para interpretarlo.</p></article>
  </section>
  <section class="card section la-panel"><h2>6. Bitácora de eventos recientes</h2><p class="muted">Últimos 12 eventos de esta prueba. Exporta CSV o JSON para consultar el historial completo.</p><div class="la-table-wrap"><table class="la-table"><thead><tr><th>Fecha y hora</th><th>Módulo</th><th>Evento</th><th>Detalle</th></tr></thead><tbody>${eventRows||'<tr><td colspan="4">Todavía no hay eventos. Completa actividades para generar evidencias.</td></tr>'}</tbody></table></div></section>
  <section class="card section"><h2>7. Registrar dificultades y observaciones</h2><p>El evaluador puede documentar dudas, dificultades, abandonos, aciertos o solicitudes de ayuda. No incluyas datos personales.</p><div class="form-row"><label for="evidenceKind">Tipo de evidencia</label><select id="evidenceKind">${['Duda','Dificultad','Error','Acierto','Solicitud de ayuda','Abandono','Observación'].map(x=>`<option>${x}</option>`).join('')}</select></div>${textArea('evidenceNote','Describe brevemente lo observado','')}<button class="secondary" id="saveEvidence">Registrar observación</button></section>
  <section class="card section"><h2>8. Exportar evidencias</h2><p>Exporta al finalizar cada prueba. El OVA no envía los registros a ningún servidor.</p><div class="hero-actions"><button class="primary" id="exportCSV">Exportar CSV</button><button class="secondary" id="exportJSON">Exportar JSON</button><button class="secondary" id="clearAnalytics">Borrar evidencias locales</button></div><p class="muted">${evidenceCount} registros y observaciones almacenados en este navegador.</p></section>`;
}
function downloadBlob(data,type,name){const b=new Blob([data],{type}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
function exportAnalytics(format){
  if(!analytics.participant){toast('Registra un participante antes de exportar.');return;}
  const rows=[...analytics.events,...analytics.notes.map(n=>({at:n.at,participant:analytics.participant,module:n.module,type:'observacion_'+n.kind,detail:{text:n.text}}))].sort((a,b)=>a.at.localeCompare(b.at));
  const base='OVA2_'+analytics.participant+'_evidencias';
  if(format==='json'){downloadBlob(JSON.stringify({version:APP_VERSION,participant:analytics.participant,startedAt:analytics.startedAt,exportedAt:new Date().toISOString(),completed:state.completed,events:rows},null,2),'application/json;charset=utf-8',base+'.json');return;}
  const csvCell=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
  const csv=[['fecha','participante','modulo','evento','detalle'].map(csvCell).join(','),...rows.map(e=>[e.at,e.participant,e.module,e.type,JSON.stringify(e.detail)].map(csvCell).join(','))].join('\r\n');
  downloadBlob('\ufeff'+csv,'text/csv;charset=utf-8',base+'.csv');
}
function bindAnalytics(){
  const end=document.getElementById('endParticipant');
  if(end)end.onclick=()=>{logoutAccount();};
  const save=document.getElementById('saveEvidence');
  if(save)save.onclick=()=>{if(!analytics.consent){toast('Inicia una prueba primero.');return;}const text=document.getElementById('evidenceNote').value.trim();if(!text){toast('Escribe una observación.');return;}const kind=document.getElementById('evidenceKind').value;analytics.notes.push({at:new Date().toISOString(),module:state.current,kind,text});recordEvent('observacion',{kind});persistAnalytics();render();toast('Observación registrada.');};
  const exportCSVBtn=document.getElementById('exportCSV'); if(exportCSVBtn) exportCSVBtn.onclick=()=>exportAnalytics('csv');
  const exportJSONBtn=document.getElementById('exportJSON'); if(exportJSONBtn) exportJSONBtn.onclick=()=>exportAnalytics('json');
  const clearAnalyticsBtn=document.getElementById('clearAnalytics'); if(clearAnalyticsBtn) clearAnalyticsBtn.onclick=()=>{if(confirm('¿Borrar de este navegador todas las evidencias de la prueba? Exporta primero si deseas conservarlas.')){analytics={participant:activeUser?.username||'',consent:true,startedAt:new Date().toISOString(),events:[],notes:[]};persistAnalytics();render();}};
}

function loadState(){
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? deepMerge(structuredClone(defaultState), saved) : structuredClone(defaultState);
  } catch { return structuredClone(defaultState); }
}
function deepMerge(target, source){
  for(const k in source){
    if(source[k] && typeof source[k] === 'object' && !Array.isArray(source[k])){
      target[k] = deepMerge(target[k] || {}, source[k]);
    } else target[k] = source[k];
  }
  return target;
}
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateChrome(); }
function markComplete(id){ if(!state.completed.includes(id)){state.completed.push(id);recordEvent('modulo_completado',{id});} saveState(); }
function isComplete(id){ return state.completed.includes(id); }
function progressPercent(){
  const tracked = ['m0','m1','m2','m3','m4','m5','m6','final','meta'];
  return Math.round(tracked.filter(isComplete).length / tracked.length * 100);
}
function toast(msg){ if(/completa|responde|selecciona|escribe|primero/i.test(msg))recordEvent('validacion_incompleta',{message:msg}); const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show'); setTimeout(()=>el.classList.remove('show'),2200); }
function esc(s=''){ return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }

function updateChrome(){
  document.getElementById('progressText').textContent = `${progressPercent()}%`;
  document.getElementById('progressFill').style.width = `${progressPercent()}%`;
  document.getElementById('profileMini').textContent = `Perfil: ${state.profile?.name || 'aún no definido'}`;
  renderNav();
}
function renderNav(){
  const nav = document.getElementById('sideNav');
  nav.innerHTML = MODULES.map(([id,label],i)=>{
    const locked = (id==='final' && !['m0','m1','m2','m3','m4','m5','m6'].every(isComplete)) || (id==='meta' && !isComplete('final'));
    return `<button class="nav-btn ${state.current===id?'active':''} ${isComplete(id)?'done':''} ${locked?'locked':''}" data-nav="${id}" ${locked?'disabled':''}>
      <span class="n">${isComplete(id)?'✓':i}</span><span>${label}</span></button>`;
  }).join('');
}

function navigate(id){
  if(!activeUser){syncRegistrationGate();return;}
  const locked = (id==='final' && !['m0','m1','m2','m3','m4','m5','m6'].every(isComplete)) || (id==='meta' && !isComplete('final'));
  if(locked){ toast('Completa primero los módulos anteriores.'); return; }
  if(id!=='analytics' && id!=='home' && !requireParticipant())return;
  if(state.current!==id){recordDuration();recordEvent('salida_modulo',{to:id});}
  state.current=id; saveState(); recordEvent('visita_modulo',{id}); render(); window.scrollTo({top:0,behavior:'smooth'}); document.getElementById('main').focus({preventScroll:true});
}

function render(){
  if(!activeUser){state.current='home';}
  const main = document.getElementById('main');
  const views = {home, m0, m1, m2, m3, m4, m5, m6, final:finalChallenge, meta, analytics:analyticsView};
  main.innerHTML = views[state.current]();
  bindView();
  bindAnalytics();
  updateChrome();
  syncRegistrationGate();
}

function moduleHead(kicker,title,desc,time='10–15 min'){
  return `<div class="module-head"><div><div class="module-kicker">${kicker}</div><h1>${title}</h1><p class="lede">${desc}</p></div><span class="module-chip">⏱ ${time}</span></div>`;
}

function home(){
  return `<section class="hero">
    <div class="eyebrow">Objeto Virtual de Aprendizaje</div>
    <h1>Conecta, cuestiona y crea</h1>
    <p>Laboratorio digital para aprender a pensar en la era de la información. Explora, verifica, contrasta y transforma información digital en conocimiento argumentado.</p>
    <div class="hero-actions"><button class="primary" data-nav="m0">Descubre tu perfil digital →</button><button class="secondary" id="aboutBtn">Fundamento pedagógico</button></div>
  </section>
  <section class="section"><div class="callout"><div class="quote">“No todo lo que encuentras en internet es conocimiento.”</div><p>Tu misión será aprender a decidir qué merece confianza y cómo construir conclusiones basadas en evidencia.</p></div></section>
  <section class="section"><h2>¿Qué aprenderás?</h2><div class="grid grid-3">
    ${feature('🔎','Cuestionar','Analizarás críticamente afirmaciones, fuentes y respuestas digitales.')}
    ${feature('🔗','Contrastar','Compararás evidencias y perspectivas antes de llegar a una conclusión.')}
    ${feature('💡','Crear','Transformarás información en conocimiento mediante argumentación y colaboración.')}
  </div></section>
  <section class="section"><h2>Tu recorrido</h2><div class="grid grid-4">
    ${mini('0','Descúbrete','¿Cómo consumes información?')}${mini('1','Comprende','¿Información o conocimiento?')}${mini('2','Cuestiona','Método CRITICA')}${mini('3','Descubre','Algoritmos y burbujas')}
    ${mini('4','Verifica','IA bajo análisis')}${mini('5','Colabora','Inteligencia colectiva')}${mini('6','Decide','Ciudadanía digital')}${mini('★','Reto final','Detectives de la información')}
  </div></section>
  ${referencesBlock()}`;
}
function feature(icon,title,text){ return `<div class="card feature-card"><div class="feature-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`; }
function mini(n,title,text){ return `<div class="card"><div class="feature-icon">${n}</div><h3>${title}</h3><p class="muted">${text}</p></div>`; }

const diagQs = [
  ['Encuentras un video con más de un millón de reproducciones que afirma que escuchar determinados sonidos mientras duermes mejora la memoria. ¿Qué harías primero?',['Lo considero confiable porque muchas personas lo han visto.','Leo los comentarios para saber si a otras personas les funcionó.','Busco quién hizo la afirmación y qué evidencia presenta.','Busco la fuente original y comparo la afirmación con otras fuentes independientes.']],
  ['Una inteligencia artificial responde una pregunta de tu tarea con una explicación extensa, clara y aparentemente científica. ¿Qué haces?',['Utilizo directamente la respuesta.','Le vuelvo a preguntar a la misma IA para confirmar.','Verifico las afirmaciones principales utilizando otras fuentes.','Localizo las fuentes originales, comparo evidencias y después construyo mi propia respuesta.']],
  ['Una publicación tiene 250.000 “Me gusta” y miles de comentarios apoyando su contenido. ¿Qué significa para ti?',['Probablemente sea verdadera.','Muchas personas están de acuerdo, por lo que debe tener algo de verdad.','Su popularidad no permite determinar si es verdadera.','La popularidad y la confiabilidad deben analizarse de manera independiente.']],
  ['Encuentras dos páginas que ofrecen explicaciones contradictorias sobre el mismo tema. ¿Qué haces?',['Elijo la explicación más sencilla.','Utilizo la primera que encontré.','Comparo quién publica cada información.','Analizo autoría, evidencia, fecha, contexto y otras fuentes antes de decidir.']],
  ['Una noticia coincide completamente con algo que ya pensabas. ¿Qué haces?',['La comparto porque confirma lo que sabía.','Leo rápidamente el contenido.','Compruebo la fuente antes de compartirla.','Intento encontrar también información confiable que cuestione esa posición.']],
  ['Cuando realizas una investigación escolar, ¿cómo eliges normalmente las fuentes?',['Utilizo los primeros resultados del buscador.','Selecciono las páginas que explican mejor el tema.','Reviso quién publica la información y cuándo fue publicada.','Comparo varias fuentes y verifico de dónde procede la evidencia.']],
  ['Si un compañero comparte una información alarmante que podría afectar a otras personas, pero no sabes de dónde proviene, ¿qué haces?',['La comparto para prevenir a los demás.','Pregunto quién se la envió.','Busco si medios confiables también la publicaron.','Intento localizar la fuente original y no la comparto hasta poder verificarla.']],
  ['¿Cuál de estas frases describe mejor tu relación con la información digital?',['Si parece convincente, normalmente confío.','Suelo revisar rápidamente antes de aceptar algo.','Intento verificar la información importante.','Suelo contrastar fuentes y evidencias antes de construir una conclusión.']]
];
function m0(){
  const done=isComplete('m0');
  return `${moduleHead('Módulo 0','¿Cómo consumo información?','Este diagnóstico identifica tu punto de partida. No es una nota: sirve para personalizar tu ruta de aprendizaje.','8–10 min')}
  <div class="callout warn"><strong>Responde según lo que realmente harías.</strong> No según lo que creas que “deberías” responder.</div>
  ${diagQs.map((q,idx)=>questionRadio(`d${idx}`,`${idx+1}. ${q[0]}`,q[1],state.diagnostic[`d${idx}`])).join('')}
  <div class="inline no-print"><button class="primary" id="scoreDiagnostic">Calcular mi perfil</button>${done?'<button class="secondary" data-nav="m1">Continuar al módulo 1 →</button>':''}</div>
  <div id="diagResult">${state.profile?profileResult():''}</div>`;
}
function questionRadio(name,title,options,value){
  return `<section class="card question"><h3>${title}</h3><div class="choices">${options.map((o,i)=>`<label class="choice"><input type="radio" name="${name}" value="${i+1}" ${String(value)===String(i+1)?'checked':''}><span><strong>${String.fromCharCode(65+i)}.</strong> ${o}</span></label>`).join('')}</div></section>`;
}
function calcProfile(){
  const values=diagQs.map((_,i)=>Number(document.querySelector(`input[name="d${i}"]:checked`)?.value||0));
  if(values.some(v=>!v)){ toast('Responde las 8 situaciones para obtener tu perfil.'); return; }
  values.forEach((v,i)=>state.diagnostic[`d${i}`]=v);
  const score=values.reduce((a,b)=>a+b,0);
  let p;
  if(score<=15) p={name:'Explorador digital',icon:'🧭',desc:'Exploras con soltura, pero necesitas fortalecer la verificación, el contraste y la trazabilidad de la información.',route:'Realiza todos los recursos guiados y presta especial atención al método CRITICA.'};
  else if(score<=24) p={name:'Investigador digital',icon:'🔎',desc:'Ya utilizas algunas estrategias de verificación. Tu reto será profundizar en evidencias, sesgos, algoritmos y argumentación.',route:'Sigue la ruta estándar y completa los retos de contraste.'};
  else p={name:'Analista crítico',icon:'🧠',desc:'Sueles contrastar y verificar antes de aceptar información. Tu reto será profundizar en sesgos, incertidumbre, IA y construcción colectiva.',route:'Completa toda la ruta y dedica especial atención a los retos avanzados y a la reflexión metacognitiva.'};
  state.profile={...p,score}; markComplete('m0'); render();
}
function profileResult(){
  const p=state.profile; return `<div class="profile-box section"><div class="score">${p.icon}</div><h2>Tu perfil inicial: ${p.name}</h2><p>${p.desc}</p><p><strong>Puntuación diagnóstica:</strong> ${p.score}/32</p><div class="callout"><strong>Ruta recomendada:</strong> ${p.route}</div><p class="muted">Este perfil describe un punto de partida, no una etiqueta permanente. El propósito del OVA es ayudarte a evolucionar tu manera de analizar información.</p></div>`;
}

const m1Items = [
  ['37 °C','Dato'],
  ['La temperatura registrada fue de 37 °C.','Información'],
  ['Hace demasiado calor.','Opinión'],
  ['Cinco mediciones independientes registraron entre 36,8 °C y 37,2 °C.','Evidencia'],
  ['Una encuesta reporta 62 % de preferencia en una muestra definida.','Evidencia'],
  ['Esta es la mejor aplicación para estudiar.','Opinión']
];
function m1(){
  return `${moduleHead('Módulo 1','¿Información o conocimiento?','Aprenderás a distinguir dato, información, opinión y evidencia, y a reconocer por qué la popularidad no equivale a confiabilidad.')}
  <div class="callout"><div class="quote">¿Tener más información significa saber más?</div></div>
  <section class="card"><h2>Reto 1 · Clasifica</h2><p>Selecciona la categoría más adecuada para cada ejemplo.</p>
  ${m1Items.map((it,i)=>`<div class="form-row"><label>${i+1}. ${it[0]}</label><select data-m1="${i}"><option value="">Selecciona...</option>${['Dato','Información','Opinión','Evidencia'].map(x=>`<option ${state.m1[i]===x?'selected':''}>${x}</option>`).join('')}</select><div class="feedback" id="m1f${i}" hidden></div></div>`).join('')}
  <button class="primary no-print" id="checkM1">Comprobar respuestas</button></section>
  <section class="section"><h2>De los datos al conocimiento</h2><div class="flow"><span>Datos</span><b>→</b><span>Contexto</span><b>→</b><span>Información</span><b>→</b><span>Análisis</span><b>→</b><span>Evidencia</span><b>→</b><span>Conocimiento</span></div></section>
  <section class="post-card"><div class="post-top"><div class="avatar"></div><div><strong>@AprendeMás</strong><div class="muted">Publicación viral</div></div></div><div class="post-body"><h2>“Un estudio demuestra que escuchar música mientras estudias mejora la memoria un 40 %.”</h2><p>¡Compártelo con tus amigos!</p></div><div class="post-metrics"><span>♥ 95.000</span><span>↻ 17.000</span><span>💬 4.300</span></div></section>
  <section class="card section"><h2>¿La popularidad demuestra que es verdad?</h2>${questionRadio('viral','Tu decisión',['Sí, tantas interacciones hacen probable que sea cierta.','No necesariamente; necesito conocer la evidencia.','No estoy seguro; tendría que verificarla.'],state.m1.viral||'')}
  <div class="form-row"><label>¿Qué información necesitarías antes de aceptar la afirmación?</label><textarea id="m1Need">${esc(state.m1.need||'')}</textarea></div><div class="callout warn"><strong>Popularidad ≠ evidencia.</strong> Una afirmación no se vuelve válida porque muchas personas la compartan.</div><button class="primary no-print" id="finishM1">Guardar y continuar</button></section>`;
}
function checkM1(){
  let correct=0; m1Items.forEach((it,i)=>{ const sel=document.querySelector(`[data-m1="${i}"]`); state.m1[i]=sel.value; const fb=document.getElementById(`m1f${i}`); fb.hidden=false; if(sel.value===it[1]){correct++;fb.className='feedback ok';fb.textContent='✓ Correcto.';} else {fb.className='feedback bad';fb.textContent=`Revisa: la categoría esperada es “${it[1]}”.`;}}); saveState(); toast(`Resultado: ${correct}/${m1Items.length}`);
}

const critica = [
  ['C','Creador','¿Quién creó el contenido y qué pertinencia tiene?'],['R','Referencias','¿Presenta fuentes y realmente respaldan lo afirmado?'],['I','Intención','¿Busca informar, persuadir, vender, entretener o provocar?'],['T','Trazabilidad','¿Puedes llegar hasta la fuente original?'],['I','Independencia','¿Otras fuentes independientes confirman la afirmación?'],['C','Contexto','¿Conoces fecha, condiciones y límites?'],['A','Argumento','¿Qué puedes concluir realmente con la evidencia?']
];
function m2(){
  return `${moduleHead('Módulo 2','¿Puedo confiar en esta información?','Aplicarás el método CRITICA: siete preguntas antes de confiar, compartir o utilizar información digital.','15–20 min')}
  <div class="critica-grid">${critica.map(c=>`<div class="critica-card"><div class="critica-letter">${c[0]}</div><strong>${c[1]}</strong><p class="muted">${c[2]}</p></div>`).join('')}</div>
  <section class="post-card section"><div class="post-top"><div class="avatar"></div><div><strong>VidaActiva360</strong><div class="muted">Blog de bienestar · autor no identificado</div></div></div><div class="post-body"><h2>“Estudiar con música instrumental aumenta la memoria exactamente un 40 %.”</h2><p>La publicación menciona “investigaciones recientes”, pero no enlaza ningún estudio, no identifica muestra ni condiciones y ofrece un enlace a una lista de reproducción patrocinada.</p></div><div class="post-metrics"><span>Fuente: blog</span><span>Fecha: no visible</span></div></section>
  <section class="card"><h2>Antes de CRITICA</h2><div class="form-row"><label>¿Cómo valorarías inicialmente esta publicación?</label><select id="m2before"><option value="">Selecciona...</option>${['Confiable','Dudosa','Engañosa','No estoy seguro'].map(x=>`<option ${state.m2.before===x?'selected':''}>${x}</option>`).join('')}</select></div></section>
  <section class="card section"><h2>Aplica CRITICA</h2><p>Valora cada criterio: <strong>Verde = cumple</strong>, <strong>Amarillo = parcial</strong>, <strong>Rojo = no cumple</strong>.</p>${critica.map((c,i)=>ratingRow(`m2r${i}`,`${c[0]} — ${c[1]}`,state.m2.ratings[i])).join('')}</section>
  <section class="card"><h2>Después de CRITICA</h2><div class="form-row"><label>¿Cómo la valoras ahora?</label><select id="m2after"><option value="">Selecciona...</option>${['Confiable','Dudosa','Engañosa','No hay evidencia suficiente'].map(x=>`<option ${state.m2.after===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="form-row"><label>¿Qué evidencia hizo cambiar o reafirmar tu decisión?</label><textarea id="m2reflection">${esc(state.m2.reflection)}</textarea></div><button class="primary no-print" id="finishM2">Guardar análisis</button></section>`;
}
function ratingRow(name,label,val){ return `<div class="form-row"><label>${label}</label><div class="rating-group"><label><input type="radio" name="${name}" value="3" ${String(val)==='3'?'checked':''}>🟢 Cumple</label><label><input type="radio" name="${name}" value="2" ${String(val)==='2'?'checked':''}>🟡 Parcial</label><label><input type="radio" name="${name}" value="1" ${String(val)==='1'?'checked':''}>🔴 No cumple</label></div></div>`; }

const feedPro = [
  ['“Los videojuegos pueden desarrollar ciertas habilidades visuoespaciales.”','A favor'],['“Estudio encuentra asociaciones entre juegos de estrategia y resolución de problemas.”','A favor'],['“Docente relata mejoras de motivación al usar gamificación.”','A favor'],['“Meta-análisis advierte que los efectos dependen del tipo de juego y del tiempo de exposición.”','Mixta']
];
const feedCon = [
  ['“Uso excesivo de videojuegos se asocia con menor tiempo dedicado a tareas.”','En contra'],['“Especialistas advierten sobre sueño insuficiente cuando el juego desplaza el descanso.”','En contra'],['“Familias reportan dificultades de autorregulación en algunos casos.”','En contra'],['“Investigación señala que los efectos varían según contexto, duración y características del estudiante.”','Mixta']
];
function m3(){
  const c=state.m3.choices.length;
  return `${moduleHead('Módulo 3','Cuando la información me encuentra','Simularás cómo tus elecciones pueden moldear lo que ves y aprenderás a romper deliberadamente una burbuja informativa.','12–15 min')}
  <section class="card"><h2>1. Elige una posición inicial</h2><p>Pregunta: <strong>¿Los videojuegos perjudican el aprendizaje?</strong></p><div class="inline"><button class="secondary stance" data-stance="pro">Creo que no necesariamente</button><button class="secondary stance" data-stance="con">Creo que sí pueden perjudicarlo</button></div><p class="muted">No hay una respuesta “correcta” aquí. La simulación observará cómo una elección inicial puede influir en la información que recibes.</p></section>
  ${state.m3.stance?`<section class="section"><h2>2. Tu feed personalizado</h2><p>Selecciona tres contenidos que te parezcan interesantes. El sistema prioriza contenidos coherentes con tu elección inicial.</p><div class="sim-feed">${renderFeed()}</div><div class="section"><div class="inline"><strong>Contenido alineado con tu posición:</strong><span>${Math.min(100,55+c*10)}%</span></div><div class="bubble-meter"><div style="width:${Math.min(100,55+c*10)}%"></div></div></div>${c>=3?bubbleReveal():''}</section>`:''}`;
}
function renderFeed(){
  const primary=state.m3.stance==='pro'?feedPro:feedCon; const alternate=state.m3.stance==='pro'?feedCon:feedPro;
  const feed=[primary[0],primary[1],primary[2],alternate[3]];
  return feed.map((f,i)=>`<div class="feed-item"><div><span class="tag">${f[1]}</span><p>${f[0]}</p></div><button class="secondary feed-choice" data-feed="${i}" ${state.m3.choices.includes(i)?'disabled':''}>${state.m3.choices.includes(i)?'Visto ✓':'Abrir'}</button></div>`).join('');
}
function bubbleReveal(){ return `<div class="callout warn"><h3>Has construido una burbuja informativa</h3><p>La mayoría de los contenidos que acabas de recibir confirman tu elección inicial. Esto no demuestra que tu postura sea falsa ni verdadera: muestra que <strong>la selección de información puede limitar tu visión del problema</strong>.</p></div><section class="card"><h2>3. Rompe tu burbuja</h2><p>Imagina que ahora buscas deliberadamente una fuente confiable que cuestione tu posición inicial.</p><div class="form-row"><label>¿Qué podría aportarte una fuente con la que inicialmente no estás de acuerdo?</label><textarea id="m3reflection">${esc(state.m3.reflection)}</textarea></div><button class="primary no-print" id="finishM3">Romper la burbuja y continuar</button></section>`; }

const aiSegments = [
  ['La luz de las pantallas puede retrasar el inicio del sueño cuando se usan dispositivos poco antes de acostarse.',false],
  ['Por eso, cualquier uso del celular después de las 8:00 p. m. reduce necesariamente el rendimiento escolar al día siguiente.',true],
  ['Un estudio de 2024 de la “International Institute of Digital Sleep” demostró una caída exacta del 37 % en las notas.',true],
  ['El efecto puede variar según duración de uso, contenido, hábitos de sueño, edad y otros factores.',false],
  ['En consecuencia, se debe concluir que el celular es la causa principal del bajo rendimiento de todos los adolescentes.',true]
];
function m4(){
  return `${moduleHead('Módulo 4','IA: ¿respuesta o punto de partida?','Auditarás una respuesta simulada de IA para diferenciar fluidez verbal de evidencia verificable.','15 min')}
  <div class="callout"><div class="quote">Una respuesta convincente no es necesariamente una respuesta correcta.</div></div>
  <section class="card"><h2>1. Auditor de IA</h2><p>Haz clic en las partes que consideres que <strong>deben verificarse con especial cuidado</strong>.</p><div class="ai-answer">${aiSegments.map((s,i)=>`<span class="ai-segment ${state.m4.selected.includes(i)?'selected':''}" data-ai="${i}">${s[0]}</span> `).join('')}</div><div class="inline section no-print"><button class="primary" id="checkAI">Comprobar selección</button><button class="secondary" id="clearAI">Limpiar</button></div><div id="aiFeedback"></div></section>
  <section class="card section"><h2>2. Reescribe con prudencia</h2><p>Redacta una versión que distinga lo que puede sostenerse de lo que requiere mayor evidencia.</p><div class="form-row"><textarea id="m4rewrite" placeholder="Ejemplo: El uso de pantallas antes de dormir puede relacionarse con...">${esc(state.m4.rewrite)}</textarea></div></section>
  <section class="card"><h2>3. Mi regla personal de IA</h2><p>Selecciona al menos tres compromisos.</p>${['Verificar afirmaciones importantes en fuentes independientes.','No presentar como propio un contenido que no comprendo.','Buscar la fuente original cuando se cite un estudio.','Distinguir hechos, inferencias y opiniones.','Reconocer el uso de IA cuando corresponda.'].map((x,i)=>`<label class="choice"><input type="checkbox" data-commit="${i}" ${state.m4.commitment.includes(i)?'checked':''}>${x}</label>`).join('')}<button class="primary no-print section" id="finishM4">Guardar compromisos</button></section>`;
}
function checkAI(){
  const selected=[...document.querySelectorAll('.ai-segment.selected')].map(x=>Number(x.dataset.ai));
  const expected=aiSegments.map((s,i)=>s[1]?i:null).filter(x=>x!==null);
  document.querySelectorAll('.ai-segment').forEach((el,i)=>{ el.classList.remove('correct-hit','wrong-hit'); if(selected.includes(i)) el.classList.add(aiSegments[i][1]?'correct-hit':'wrong-hit'); });
  const hits=expected.filter(i=>selected.includes(i)).length; const falseHits=selected.filter(i=>!expected.includes(i)).length;
  document.getElementById('aiFeedback').innerHTML=`<div class="feedback ${hits===expected.length&&falseHits===0?'ok':''}"><strong>Detectaste ${hits} de ${expected.length} alertas clave.</strong> ${falseHits?`Marcaste ${falseHits} fragmento(s) que podían ser razonables, aunque igualmente conviene verificar el contexto.`:'Buena selección.'} Las señales críticas son afirmaciones absolutas, cifras muy precisas sin trazabilidad y referencias que no podemos localizar.</div>`;
}

function m5(){
  return `${moduleHead('Módulo 5','Pensamos mejor juntos','Aplicarás inteligencia colectiva: diferentes roles aportan perspectivas complementarias para construir una conclusión más robusta.','20 min')}
  <section class="grid grid-4">${role('🧭','Explorador','Localiza fuentes y perspectivas.')}${role('🔎','Verificador','Comprueba evidencia, autoría y trazabilidad.')}${role('❓','Cuestionador','Busca contradicciones, sesgos y alternativas.')}${role('📝','Relator','Integra resultados y formula la conclusión.')}</section>
  <section class="card section"><h2>Problema colaborativo</h2><div class="callout"><strong>“El uso de inteligencia artificial hace que los estudiantes aprendan menos.”</strong></div><p>Construyan una respuesta que no sea simplemente “sí” o “no”. Consideren condiciones, usos, límites y evidencia.</p>
  ${textArea('m5for','Evidencia a favor',state.m5.evidenceFor)}${textArea('m5against','Evidencia en contra',state.m5.evidenceAgainst)}${textArea('m5limits','Limitaciones y condiciones',state.m5.limits)}${textArea('m5conclusion','Conclusión provisional',state.m5.conclusion)}
  <div class="form-row"><label>Nivel de confianza</label><select id="m5confidence"><option value="">Selecciona...</option>${['Alto','Medio','Bajo'].map(x=>`<option ${state.m5.confidence===x?'selected':''}>${x}</option>`).join('')}</select></div></section>
  <section class="peer-box section"><h2>Retroalimentación 2 + 1</h2><p>Revisen el trabajo de otro equipo y registren dos fortalezas y una pregunta crítica.</p>${textArea('peer1','Fortaleza 1',state.m5.peer1)}${textArea('peer2','Fortaleza 2',state.m5.peer2)}${textArea('peerQ','Pregunta crítica',state.m5.peerQ)}${textArea('revised','¿Cómo cambiaría o se fortalecería su conclusión después de esta retroalimentación?',state.m5.revised)}<button class="primary no-print" id="finishM5">Guardar trabajo colaborativo</button></section>`;
}
function role(icon,title,text){ return `<div class="card role"><div class="feature-icon">${icon}</div><h3>${title}</h3><p>${text}</p></div>`; }
function textArea(id,label,val){ return `<div class="form-row"><label for="${id}">${label}</label><textarea id="${id}">${esc(val||'')}</textarea></div>`; }

const dilemmas = [
  {q:'Un grupo introduce fotografías, nombres y datos personales de compañeros en una herramienta de IA sin autorización. ¿Qué decisión es más responsable?',opts:['Usarlos porque la actividad es educativa.','Usarlos si la herramienta es conocida.','Evitar compartir datos personales innecesarios y solicitar autorización cuando corresponda.'],correct:2,fb:'La finalidad educativa no elimina la responsabilidad sobre privacidad y minimización de datos.'},
  {q:'Recibes una información alarmante sobre tu colegio que aún no puedes verificar. ¿Qué haces?',opts:['La comparto “por si acaso”.','La verifico antes de difundirla y busco la fuente original.','La comparto solo con amigos cercanos.'],correct:1,fb:'Compartir información no verificada puede amplificar daño y desinformación.'},
  {q:'Una IA redactó casi todo tu trabajo. Lo entiendes y estás de acuerdo. ¿Qué opción refleja mejor una práctica académica responsable?',opts:['Presentarlo como propio porque lo revisé.','Reconocer el uso de IA, verificar el contenido y reconstruir el argumento con comprensión propia según las reglas del curso.','Cambiar algunas palabras para que parezca propio.'],correct:1,fb:'Comprender un texto no convierte automáticamente su producción en autoría propia.'},
  {q:'Una plataforma empieza a mostrarte casi exclusivamente contenidos que confirman tus opiniones. ¿Cuál es el principal riesgo educativo?',opts:['Que la aplicación se vuelva aburrida.','Que aumente la velocidad de navegación.','Que disminuya la exposición a perspectivas diferentes y se refuercen sesgos.'],correct:2,fb:'Las burbujas informativas pueden limitar contraste, diversidad de perspectivas y pensamiento crítico.'}
];
function m6(){
  return `${moduleHead('Módulo 6','Ciudadano digital','Resolverás dilemas sobre privacidad, autoría, desinformación y algoritmos para construir una brújula ética propia.','12–15 min')}
  ${dilemmas.map((d,i)=>`<section class="card section dilemma"><div class="num">${i+1}</div><div><h2>${d.q}</h2><div class="choices">${d.opts.map((o,j)=>`<label class="choice"><input type="radio" name="dil${i}" value="${j}" ${String(state.m6[i])===String(j)?'checked':''}>${o}</label>`).join('')}</div><div class="feedback" id="dilfb${i}" hidden></div></div></section>`).join('')}
  <section class="card"><h2>Mi brújula digital</h2><p>Antes de terminar, completa esta frase:</p><div class="form-row"><label>A partir de ahora, antes de creer o compartir información digital, yo...</label><textarea id="m6compass">${esc(state.m6.compass||'')}</textarea></div><button class="primary no-print" id="finishM6">Revisar decisiones y completar módulo</button></section>`;
}

const finalCases = [
  {id:'ia',title:'“Estudiar utilizando inteligencia artificial siempre mejora las calificaciones.”'},
  {id:'celular',title:'“Los teléfonos celulares reducen necesariamente la capacidad de atención de los adolescentes.”'},
  {id:'redes',title:'“Las redes sociales son la principal causa de los problemas de salud mental entre adolescentes.”'}
];
function finalChallenge(){
  return `${moduleHead('Reto final','Detectives de la información','Integra todo lo aprendido para producir un veredicto argumentado, explícito sobre evidencia, límites e incertidumbre.','25–40 min')}
  <section class="card"><h2>1. Elige tu caso</h2><div class="grid grid-3">${finalCases.map(c=>`<div class="case-option ${state.final.caseId===c.id?'selected':''}" data-case="${c.id}"><span class="tag">Caso</span><h3>${c.title}</h3></div>`).join('')}</div></section>
  ${state.final.caseId?`<section class="card section"><h2>2. Expediente</h2><p><strong>Afirmación:</strong> ${finalCases.find(c=>c.id===state.final.caseId).title}</p>${textArea('finalHyp','Hipótesis inicial',state.final.hypothesis)}${textArea('finalSources','Fuentes consultadas (autor, título, fecha, enlace o referencia)',state.final.sources)}<h3>Aplicación de CRITICA</h3>${critica.map((c,i)=>ratingRow(`finalr${i}`,`${c[0]} — ${c[1]}`,state.final.ratings[i])).join('')}${textArea('finalFor','Evidencias que apoyan la afirmación',state.final.for)}${textArea('finalAgainst','Evidencias que la cuestionan',state.final.against)}${textArea('finalLimits','Limitaciones e incertidumbre',state.final.limits)}</section>
  <section class="card"><h2>3. Veredicto</h2><div class="verdicts">${['Confiable','Dudosa','Engañosa','No hay evidencia suficiente'].map(v=>`<div class="verdict ${state.final.verdict===v?'selected':''}" data-verdict="${v}">${v}</div>`).join('')}</div>${textArea('finalArg','Argumentación: “Nuestro veredicto es... porque... Sin embargo...”',state.final.argument)}<div class="form-row"><label>Nivel de confianza</label><select id="finalConf"><option value="">Selecciona...</option>${['Alto','Medio','Bajo'].map(x=>`<option ${state.final.confidence===x?'selected':''}>${x}</option>`).join('')}</select></div><div class="inline no-print"><button class="primary" id="finishFinal">Cerrar expediente</button><button class="secondary" id="printFinal">Imprimir / Guardar PDF</button></div></section>`:'<div class="callout warn section">Selecciona uno de los casos para abrir tu expediente.</div>'}`;
}

function meta(){
  return `${moduleHead('Cierre','Mi aprendizaje','Compara tu punto de partida con lo que haces ahora. Esta reflexión final es parte del aprendizaje, no un trámite.','10 min')}
  <section class="card">${textArea('metaBefore','¿Qué pensabas sobre la información digital antes de comenzar este OVA?',state.meta.before)}${textArea('metaNow','¿Qué haces ahora que antes no hacías para verificar información?',state.meta.now)}${textArea('metaChanged','Describe una situación en la que una evidencia haya cambiado o matizado tu opinión.',state.meta.changed)}${textArea('metaCollab','¿Qué aportó otra persona a tu aprendizaje que difícilmente habrías obtenido trabajando solo?',state.meta.collaboration)}${textArea('metaAI','¿Qué riesgo encuentras en utilizar IA sin verificar sus respuestas?',state.meta.aiRisk)}${textArea('metaCommit','Completa: “A partir de ahora, antes de creer o compartir información digital, yo...”',state.meta.commitment)}<button class="primary no-print" id="finishMeta">Finalizar laboratorio</button></section>
  ${isComplete('meta')?completionBlock():''}`;
}
function completionBlock(){
  return `<section class="completion section"><h1>Laboratorio completado</h1><p>Has pasado de consumir información a detenerte, cuestionar, contrastar, colaborar y construir conclusiones basadas en evidencia.</p><div class="quote">No preguntes solamente “¿qué dice?”. Pregunta también: “¿por qué debería creerlo?”</div><div class="hero-actions no-print"><button class="primary" id="printSummary">Imprimir / Guardar PDF</button><button class="secondary" id="downloadSummary">Descargar resumen .txt</button></div></section>${summaryBlock()}`;
}
function summaryBlock(){
  return `<section class="card section"><h2>Resumen del recorrido</h2><table class="summary-table"><tr><th>Perfil inicial</th><td>${state.profile?.name||'—'} (${state.profile?.score||0}/32)</td></tr><tr><th>Método CRITICA</th><td>${esc(state.m2.after||'—')} · ${esc(state.m2.reflection||'')}</td></tr><tr><th>IA</th><td>${esc(state.m4.rewrite||'—')}</td></tr><tr><th>Reto final</th><td>${esc(state.final.verdict||'—')} · confianza ${esc(state.final.confidence||'—')}</td></tr><tr><th>Compromiso</th><td>${esc(state.meta.commitment||state.m6.compass||'—')}</td></tr></table></section>${referencesBlock()}`;
}

function referencesBlock(){
  return `<section class="section card refs"><h2>Fundamento pedagógico del OVA</h2><p>El diseño articula inteligencia colectiva, conectivismo, alfabetización digital crítica, educomunicación, reflexión sobre subjetividades mediáticas y ética digital.</p><ul><li>Lévy, P. (2007). <em>Cibercultura: la cultura de la sociedad digital.</em></li><li>Siemens, G. (2005). Conectivismo y aprendizaje en redes.</li><li>Cobo, C. (2016). <em>La innovación pendiente.</em></li><li>Corea, C. & Lewkowicz, I. (2011). <em>Pedagogía del aburrido.</em></li><li>Sibilia, P. (2012). <em>¿Redes o paredes?</em></li><li>Castells, M. (2001). <em>La era de la información.</em></li><li>Drucker, J. (2021). <em>The Digital Humanities Coursebook.</em></li><li>Nissenbaum, H. (2010). <em>Privacy in Context.</em></li></ul><div class="footer-note">OVA académico · versión ${APP_VERSION}. No recopila datos personales ni envía respuestas a servicios externos.</div></section>`;
}

function bindView(){
  const about=document.getElementById('aboutBtn'); if(about) about.addEventListener('click',()=>{document.querySelector('.refs')?.scrollIntoView({behavior:'smooth'});});
  const score=document.getElementById('scoreDiagnostic'); if(score) score.onclick=calcProfile;
  const c1=document.getElementById('checkM1'); if(c1) c1.onclick=checkM1;
  const f1=document.getElementById('finishM1'); if(f1) f1.onclick=()=>{state.m1.viral=document.querySelector('input[name="viral"]:checked')?.value||'';state.m1.need=document.getElementById('m1Need').value.trim();if(!state.m1.viral||!state.m1.need){toast('Responde la decisión y explica qué información necesitarías.');return;}markComplete('m1');toast('Módulo 1 completado.');navigate('m2');};
  const f2=document.getElementById('finishM2'); if(f2) f2.onclick=()=>{state.m2.before=document.getElementById('m2before').value;state.m2.after=document.getElementById('m2after').value;state.m2.reflection=document.getElementById('m2reflection').value.trim();for(let i=0;i<critica.length;i++)state.m2.ratings[i]=document.querySelector(`input[name="m2r${i}"]:checked`)?.value||'';if(!state.m2.before||!state.m2.after||!state.m2.reflection||Object.values(state.m2.ratings).filter(Boolean).length<7){toast('Completa todos los criterios y la reflexión.');return;}markComplete('m2');toast('Análisis CRITICA guardado.');navigate('m3');};
  document.querySelectorAll('.stance').forEach(b=>b.onclick=()=>{state.m3.stance=b.dataset.stance;state.m3.choices=[];saveState();render();});
  document.querySelectorAll('.feed-choice').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.feed);if(!state.m3.choices.includes(i))state.m3.choices.push(i);saveState();render();});
  const f3=document.getElementById('finishM3'); if(f3) f3.onclick=()=>{state.m3.reflection=document.getElementById('m3reflection').value.trim();if(!state.m3.reflection){toast('Escribe qué puede aportar una perspectiva diferente.');return;}markComplete('m3');navigate('m4');};
  document.querySelectorAll('.ai-segment').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.ai);const set=new Set(state.m4.selected);set.has(i)?set.delete(i):set.add(i);state.m4.selected=[...set];saveState();el.classList.toggle('selected');});
  const checkAi=document.getElementById('checkAI'); if(checkAi) checkAi.onclick=checkAI;
  const clearAi=document.getElementById('clearAI'); if(clearAi) clearAi.onclick=()=>{state.m4.selected=[];saveState();render();};
  const f4=document.getElementById('finishM4'); if(f4) f4.onclick=()=>{state.m4.rewrite=document.getElementById('m4rewrite').value.trim();state.m4.commitment=[...document.querySelectorAll('[data-commit]:checked')].map(x=>Number(x.dataset.commit));if(!state.m4.rewrite||state.m4.commitment.length<3){toast('Reescribe la respuesta y selecciona al menos tres compromisos.');return;}markComplete('m4');navigate('m5');};
  const f5=document.getElementById('finishM5'); if(f5) f5.onclick=()=>{Object.assign(state.m5,{evidenceFor:v('m5for'),evidenceAgainst:v('m5against'),limits:v('m5limits'),conclusion:v('m5conclusion'),confidence:document.getElementById('m5confidence').value,peer1:v('peer1'),peer2:v('peer2'),peerQ:v('peerQ'),revised:v('revised')});if(!state.m5.evidenceFor||!state.m5.evidenceAgainst||!state.m5.conclusion||!state.m5.peer1||!state.m5.peer2||!state.m5.peerQ){toast('Completa las evidencias, conclusión y retroalimentación 2+1.');return;}markComplete('m5');navigate('m6');};
  const f6=document.getElementById('finishM6'); if(f6) f6.onclick=()=>{let ok=0;dilemmas.forEach((d,i)=>{const val=document.querySelector(`input[name="dil${i}"]:checked`)?.value;state.m6[i]=val;const fb=document.getElementById(`dilfb${i}`);fb.hidden=false;if(String(val)===String(d.correct)){ok++;fb.className='feedback ok';fb.innerHTML=`✓ ${d.fb}`;}else{fb.className='feedback bad';fb.innerHTML=`Revisa tu decisión. ${d.fb}`;}});state.m6.compass=v('m6compass');saveState();if(Object.keys(state.m6).filter(k=>/^\d+$/.test(k)).length<4||!state.m6.compass){toast('Responde los cuatro dilemas y completa tu brújula digital.');return;}markComplete('m6');toast(`Decisiones revisadas: ${ok}/4 alineadas con los criterios éticos del módulo.`);setTimeout(()=>navigate('final'),700);};
  document.querySelectorAll('.case-option').forEach(el=>el.onclick=()=>{state.final.caseId=el.dataset.case;saveState();render();});
  document.querySelectorAll('.verdict').forEach(el=>el.onclick=()=>{state.final.verdict=el.dataset.verdict;saveState();render();});
  const ff=document.getElementById('finishFinal'); if(ff) ff.onclick=()=>{state.final.hypothesis=v('finalHyp');state.final.sources=v('finalSources');state.final.for=v('finalFor');state.final.against=v('finalAgainst');state.final.limits=v('finalLimits');state.final.argument=v('finalArg');state.final.confidence=document.getElementById('finalConf').value;for(let i=0;i<critica.length;i++)state.final.ratings[i]=document.querySelector(`input[name="finalr${i}"]:checked`)?.value||'';if(!state.final.hypothesis||!state.final.sources||!state.final.for||!state.final.against||!state.final.limits||!state.final.verdict||!state.final.argument||!state.final.confidence){toast('Completa el expediente antes de cerrarlo.');return;}markComplete('final');toast('Expediente cerrado.');setTimeout(()=>navigate('meta'),700);};
  const pf=document.getElementById('printFinal'); if(pf) pf.onclick=()=>window.print();
  const fm=document.getElementById('finishMeta'); if(fm) fm.onclick=()=>{Object.assign(state.meta,{before:v('metaBefore'),now:v('metaNow'),changed:v('metaChanged'),collaboration:v('metaCollab'),aiRisk:v('metaAI'),commitment:v('metaCommit')});if(Object.values(state.meta).some(x=>!x)){toast('Completa las seis preguntas de reflexión.');return;}markComplete('meta');saveState();render();};
  const ps=document.getElementById('printSummary'); if(ps) ps.onclick=()=>window.print();
  const ds=document.getElementById('downloadSummary'); if(ds) ds.onclick=downloadSummary;
}
function v(id){ return document.getElementById(id)?.value.trim()||''; }
function downloadSummary(){
  const lines=[
    'CONECTA, CUESTIONA Y CREA — RESUMEN',
    `Perfil inicial: ${state.profile?.name||'—'} (${state.profile?.score||0}/32)`,
    `Valoración después de CRITICA: ${state.m2.after||'—'}`,
    `Reflexión CRITICA: ${state.m2.reflection||'—'}`,
    `Reescritura IA: ${state.m4.rewrite||'—'}`,
    `Reto final: ${state.final.verdict||'—'} | confianza: ${state.final.confidence||'—'}`,
    `Argumento final: ${state.final.argument||'—'}`,
    `Compromiso metacognitivo: ${state.meta.commitment||'—'}`,
    '', 'Nota de privacidad: este archivo fue generado localmente en el navegador.'
  ].join('\n\n');
  const blob=new Blob([lines],{type:'text/plain;charset=utf-8'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='resumen_ova_conecta_cuestiona_crea.txt'; a.click(); URL.revokeObjectURL(a.href);
}

function globalBindings(){
  document.body.addEventListener('click',e=>{const n=e.target.closest('[data-nav]');if(n&&!n.disabled)navigate(n.dataset.nav);const close=e.target.closest('[data-close-dialog]');if(close)document.getElementById('helpDialog').close();});
  document.querySelector('.brand').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')navigate('home');});
  document.getElementById('fontToggle').onclick=()=>document.body.classList.toggle('large-text');
  document.getElementById('contrastToggle').onclick=()=>document.body.classList.toggle('high-contrast');
  document.getElementById('helpBtn').onclick=()=>document.getElementById('helpDialog').showModal();
  document.body.addEventListener('change',e=>{
    const el=e.target;if(!analytics.consent || !el)return;
    if(el.matches('input[type="radio"],select')){
      const id=(el.name||el.id||'opcion').slice(0,55);
      recordEvent('decision',{control:id,choice:String(el.value).slice(0,90)});
      if(/^dil\d+$/.test(id)){
        const ix=Number(id.replace('dil',''));
        if(typeof dilemmas!=='undefined' && dilemmas[ix])recordEvent('respuesta',{activity:'dilema',index:ix,correct:String(el.value)===String(dilemmas[ix].correct)});
      }
    }
  });
  document.body.addEventListener('click',e=>{
    if(!analytics.consent)return;
    const el=e.target.closest('.feed-choice,.stance,.ai-segment,.case-option,.verdict');
    if(el)recordEvent('decision',{control:el.className.split(' ')[0],choice:String(el.dataset.feed??el.dataset.stance??el.dataset.ai??el.dataset.case??el.dataset.verdict??'').slice(0,80)});
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)recordDuration();else currentViewStart=Date.now();});
  window.addEventListener('pagehide',()=>{recordDuration();recordEvent('cierre_pagina',{progress:progressPercent()});});
  document.getElementById('resetBtn').onclick=()=>{if(confirm('¿Seguro que deseas borrar todo el progreso guardado en este navegador?')){localStorage.removeItem(STORAGE_KEY);state=structuredClone(defaultState);render();toast('Progreso reiniciado.');}};
}


function accountList(){try{return JSON.parse(localStorage.getItem(ACCOUNT_KEY)||'{}')}catch{return {}}}
function accountStorage(username){ANALYTICS_KEY='ova_cqc_analytics_v22_'+username;STORAGE_KEY='ova_cqc_state_v22_'+username;}
function b64(bytes){return btoa(String.fromCharCode(...bytes))}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function hashPassword(password,salt){
 if(!crypto?.subtle)throw Error('Este navegador requiere HTTPS o localhost para proteger la clave. Abre el OVA desde GitHub Pages.');
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:unb64(salt),iterations:150000,hash:'SHA-256'},key,256);
 return b64(new Uint8Array(bits));
}
function activateAccount(username,account){
 accountStorage(username);activeUser={username,name:account.name};
 sessionStorage.setItem(SESSION_KEY,username);
 state=loadState();analytics=loadAnalytics();
 analytics.participant=username;analytics.consent=true;analytics.startedAt ||= new Date().toISOString();
 persistAnalytics();recordEvent('inicio_sesion',{version:APP_VERSION});
 currentViewStart=Date.now();state.current='home';saveState();render();
}
function logoutAccount(){
 recordDuration();recordEvent('fin_sesion',{completed:state.completed.length});
 activeUser=null;sessionStorage.removeItem(SESSION_KEY);
 analytics={participant:'',consent:false,startedAt:null,events:[],notes:[]};state=structuredClone(defaultState);
 render();
}
function syncRegistrationGate(){
 const gate=document.getElementById('registrationGate');if(!gate)return;
 gate.hidden=!!activeUser;
 const float=document.getElementById('floatingAnalytics');if(float)float.hidden=!activeUser;
}
function bindRegistrationGate(){
 let mode='register';
 const form=document.getElementById('gateForm'),nameWrap=document.getElementById('gateNameWrap');
 const tabs=[document.getElementById('tabRegister'),document.getElementById('tabLogin')];
 function setMode(next){mode=next;tabs[0].classList.toggle('active',mode==='register');tabs[1].classList.toggle('active',mode==='login');nameWrap.hidden=mode==='login';document.getElementById('gateName').required=mode==='register';document.getElementById('gateConsentWrap').hidden=mode==='login';document.getElementById('gateConsent').required=mode==='register';document.getElementById('gateSubmit').textContent=mode==='register'?'Crear usuario e ingresar →':'Ingresar al OVA →';document.getElementById('gatePassword').autocomplete=mode==='register'?'new-password':'current-password';document.getElementById('gateError').hidden=true;}
 tabs[0].onclick=()=>setMode('register');tabs[1].onclick=()=>setMode('login');
 form.addEventListener('submit',async e=>{
  e.preventDefault();const username=document.getElementById('gateUsername').value.trim().toLowerCase();const password=document.getElementById('gatePassword').value;const name=document.getElementById('gateName').value.trim();const err=document.getElementById('gateError'),submit=document.getElementById('gateSubmit');err.hidden=true;
  if(!/^[a-z0-9_-]{3,24}$/.test(username)||password.length<8){err.textContent='Usuario inválido o clave de menos de 8 caracteres.';err.hidden=false;return;}
  submit.disabled=true;
  try{
   const accounts=accountList();let account=accounts[username];
   if(mode==='register'){
    if(account)throw Error('Este usuario ya existe en este navegador. Selecciona «Ya tengo usuario».');
    if(!name)throw Error('Escribe tu nombre.');
    const salt=b64(crypto.getRandomValues(new Uint8Array(16)));
    account={name,salt,hash:await hashPassword(password,salt)};accounts[username]=account;localStorage.setItem(ACCOUNT_KEY,JSON.stringify(accounts));
   }else{
    if(!account || await hashPassword(password,account.salt)!==account.hash)throw Error('Usuario o clave incorrectos en este navegador.');
   }
   document.getElementById('gatePassword').value='';activateAccount(username,account);toast('Bienvenido/a, '+account.name);
  }catch(ex){err.textContent=ex.message;err.hidden=false;}finally{submit.disabled=false;}
 });
 const float=document.getElementById('floatingAnalytics');float.onclick=()=>{if(activeUser)navigate('analytics');};
 const previous=sessionStorage.getItem(SESSION_KEY);const saved=accountList()[previous];
 if(previous && saved){accountStorage(previous);activeUser={username:previous,name:saved.name};state=loadState();analytics=loadAnalytics();analytics.participant=previous;analytics.consent=true;persistAnalytics();}
}

bindRegistrationGate();
globalBindings();
render();
