/* dc-lite: tiny runtime that renders the canvas .dc templates as a static site (preview only).
   v2: re-renders patch the live DOM in place (so refs, hover, focus and observers survive),
   supports ref="{{fn}}" callbacks and React-style lifecycle (componentDidMount). */
(function(){
class DCLogic{constructor(props){this.props=props||{};this.state={};}
 setState(p){Object.assign(this.state,typeof p==='function'?p(this.state,this.props):p);this.__rerender&&this.__schedule();}
 forceUpdate(){this.__rerender&&this.__schedule();}}
function evalExpr(expr,scope){try{return Function('s','with(s){return ('+expr+');}')(scope);}catch(e){return undefined;}}
const ONE=/^\s*\{\{([\s\S]+?)\}\}\s*$/, ANY=/\{\{([\s\S]+?)\}\}/g;
function interp(str,scope){return str.replace(ANY,(m,e)=>{const v=evalExpr(e,scope);return v==null||v===false?'':String(v);});}
const EVMAP={doubleclick:'dblclick'};
function process(node,scope){
 const kids=Array.from(node.childNodes);
 for(const n of kids){
  if(n.nodeType===3){if(n.nodeValue.includes('{{'))n.nodeValue=interp(n.nodeValue,scope);continue;}
  if(n.nodeType!==1)continue;
  const tag=n.tagName.toLowerCase();
  if(tag==='sc-if'){const m=(n.getAttribute('value')||'').match(ONE);const v=m?evalExpr(m[1],scope):false;
    if(v){process(n,scope);n.replaceWith(...Array.from(n.childNodes));}else n.remove();continue;}
  if(tag==='sc-for'){const m=(n.getAttribute('list')||'').match(ONE);const list=(m?evalExpr(m[1],scope):[])||[];const as=n.getAttribute('as')||'item';
    const frag=document.createDocumentFragment();
    list.forEach((item,i)=>{const wrap=document.createElement('div');wrap.innerHTML=n.innerHTML;const sc=Object.create(scope);sc[as]=item;sc.index=i;sc.$index=i;process(wrap,sc);frag.append(...Array.from(wrap.childNodes));});
    n.replaceWith(frag);continue;}
  for(const a of Array.from(n.attributes)){
   if(a.name.startsWith('hint-')){n.removeAttribute(a.name);continue;}
   if(!a.value.includes('{{'))continue;
   const m=a.value.match(ONE);
   if(a.name==='ref'){const fn=m?evalExpr(m[1],scope):null;n.removeAttribute('ref');if(typeof fn==='function')n.__dcRef=fn;continue;}
   if(a.name.startsWith('on')){const fn=m?evalExpr(m[1],scope):null;n.removeAttribute(a.name);
     if(typeof fn==='function'){let ev=a.name.slice(2).toLowerCase();ev=EVMAP[ev]||ev;(n.__dcOn||(n.__dcOn={}))[ev]=fn;}continue;}
   if(m&&(a.name==='checked'||a.name==='disabled'||a.name==='selected'||a.name==='open')){const v=evalExpr(m[1],scope);if(v&&v!=='false')n.setAttribute(a.name,'');else n.removeAttribute(a.name);continue;}
   n.setAttribute(a.name,interp(a.value,scope));
  }
  process(n,scope);
 }
}
// event wiring: one real listener per (element, event) that calls whatever handler the latest render gave it
function wire(el){
 if(!el.__dcOn)return;
 const live=el.__dcLive||(el.__dcLive={});
 for(const ev in el.__dcOn){if(!live[ev]){live[ev]=true;el.addEventListener(ev,function(e){const h=el.__dcOn&&el.__dcOn[ev];if(h)h(e);});}}
}
function adopt(from,to){ // move render-time data (handlers, refs) from the fresh node onto the live node
 from.__dcOn=to.__dcOn;from.__dcRef=to.__dcRef;
}
function syncAttrs(from,to){
 for(const a of Array.from(from.attributes)){if(!to.hasAttribute(a.name))from.removeAttribute(a.name);}
 for(const a of Array.from(to.attributes)){if(from.getAttribute(a.name)!==a.value)from.setAttribute(a.name,a.value);}
 const tag=from.tagName;
 if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'){
  if(from.type==='checkbox'||from.type==='radio'){from.checked=to.hasAttribute('checked');}
  else if(to.hasAttribute('value')){const v=to.getAttribute('value');if(from.value!==v)from.value=v;}
 }
}
function prep(node,refs){ // a brand new subtree going live: wire it and collect its refs
 if(node.nodeType!==1)return;
 wire(node);if(node.__dcRef)refs.push(node);
 if(node.tagName==='INPUT'&&node.hasAttribute('value'))node.value=node.getAttribute('value');
 if(node.tagName==='TEXTAREA'&&node.hasAttribute('value'))node.value=node.getAttribute('value');
 for(const c of node.children)prep(c,refs);
}
function morph(from,to,refs){
 const a=Array.from(from.childNodes),b=Array.from(to.childNodes);
 for(let i=0;i<b.length;i++){
  const f=a[i],t=b[i];
  if(!f){prep(t,refs);from.appendChild(t);continue;}
  if(f.nodeType!==t.nodeType||(f.nodeType===1&&f.tagName!==t.tagName)){prep(t,refs);from.replaceChild(t,f);continue;}
  if(f.nodeType===3||f.nodeType===8){if(f.nodeValue!==t.nodeValue)f.nodeValue=t.nodeValue;continue;}
  if(f.nodeType===1){
   if(f.tagName==='SVG'||f.namespaceURI==='http://www.w3.org/2000/svg'){if(f.outerHTML!==t.outerHTML){prep(t,refs);from.replaceChild(t,f);}continue;}
   syncAttrs(f,t);adopt(f,t);wire(f);if(f.__dcRef)refs.push(f);
   morph(f,t,refs);
  }
 }
 for(let i=a.length-1;i>=b.length;i--){if(a[i].parentNode===from)from.removeChild(a[i]);}
}
function boot(){
 const host=document.querySelector('x-dc');if(!host)return;
 const helmet=host.querySelector('helmet');if(helmet){document.head.append(...Array.from(helmet.childNodes));helmet.remove();}
 const tpl=host.innerHTML;
 const sEl=document.querySelector('script[data-dc-script]');
 let props={};try{const d=JSON.parse(sEl.getAttribute('data-props')||'{}');for(const k in d){if(k[0]!=='$')props[k]=d[k].default;}}catch(e){}
 Object.assign(props,window.DC_PROPS||{});
 const Comp=Function('DCLogic',sEl.textContent+'\n;return Component;')(DCLogic);
 const c=new Comp(props);c.props=props;
 let first=true,queued=false;
 function render(){
  queued=false;
  const wrap=document.createElement('div');wrap.innerHTML=tpl;
  process(wrap,Object.assign(Object.create(null),c.renderVals()));
  const refs=[];
  if(first){host.replaceChildren();morph(host,wrap,refs);first=false;}else morph(host,wrap,refs);
  refs.forEach(el=>{try{el.__dcRef(el);}catch(e){}});
 }
 c.__rerender=render;
 c.__schedule=function(){if(queued)return;queued=true;Promise.resolve().then(render);};
 render();
 c.componentDidMount&&c.componentDidMount();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
