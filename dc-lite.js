/* dc-lite: tiny runtime that renders the canvas .dc templates as a static site (preview only) */
(function(){
class DCLogic{constructor(props){this.props=props||{};this.state={};}
 setState(p){Object.assign(this.state,typeof p==='function'?p(this.state):p);this.__rerender&&this.__rerender();}}
function evalExpr(expr,scope){try{return Function('s','with(s){return ('+expr+');}')(scope);}catch(e){return undefined;}}
const ONE=/^\s*\{\{([\s\S]+?)\}\}\s*$/, ANY=/\{\{([\s\S]+?)\}\}/g;
function interp(str,scope){return str.replace(ANY,(m,e)=>{const v=evalExpr(e,scope);return v==null||v===false?'':String(v);});}
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
    list.forEach((item,i)=>{const wrap=document.createElement('template');wrap.innerHTML=n.innerHTML;const sc=Object.create(scope);sc[as]=item;sc.index=i;process(wrap.content,sc);frag.append(...Array.from(wrap.content.childNodes));});
    n.replaceWith(frag);continue;}
  for(const a of Array.from(n.attributes)){
   if(a.name.startsWith('hint-')){n.removeAttribute(a.name);continue;}
   if(!a.value.includes('{{'))continue;
   if(a.name==='ref'){const m=a.value.match(ONE);const fn=m?evalExpr(m[1],scope):null;n.removeAttribute('ref');if(typeof fn==='function')(window.__dcRefs=window.__dcRefs||[]).push([fn,n]);continue;}
   if(a.name.startsWith('on')){const m=a.value.match(ONE);const fn=m?evalExpr(m[1],scope):null;n.removeAttribute(a.name);
     if(typeof fn==='function'){let ev=a.name.slice(2);n.addEventListener(ev,fn);}continue;}
   const m=a.value.match(ONE);
   if(m&&(a.name==='checked'||a.name==='disabled')){const v=evalExpr(m[1],scope);if(v)n.setAttribute(a.name,'');else n.removeAttribute(a.name);if(a.name==='checked')n.checked=!!v;continue;}
   const val=interp(a.value,scope);n.setAttribute(a.name,val);if(a.name==='value')n.value=val;
  }
  process(n,scope);
 }
}
function boot(){
 const host=document.querySelector('x-dc');if(!host)return;
 const helmet=host.querySelector('helmet');if(helmet){document.head.append(...Array.from(helmet.childNodes));helmet.remove();}
 const tpl=host.innerHTML;
 const sEl=document.querySelector('script[data-dc-script]');
 let props={};try{const d=JSON.parse(sEl.getAttribute('data-props')||'{}');for(const k in d){if(k[0]!=='$')props[k]=d[k].default;}}catch(e){}
 Object.assign(props,window.DC_PROPS||{});
 const Comp=Function('DCLogic',sEl.textContent+'\n;return Component;')(DCLogic);
 const c=new Comp(props);c.props=props;if(typeof window.DC_PATCH==='function')window.DC_PATCH(c);
 function render(){
  const ae=document.activeElement;let key=null,sel=null;
  if(ae&&host.contains(ae)&&(ae.tagName==='INPUT'||ae.tagName==='TEXTAREA')){key=ae.id?('#'+ae.id):(ae.getAttribute('placeholder')?'[placeholder="'+ae.getAttribute('placeholder').replace(/"/g,'\\"')+'"]':null);try{sel=ae.selectionStart;}catch(e){}}
  const openDetails=Array.from(host.querySelectorAll('details')).map(d=>d.open);
  /* inert <template>: {{holes}} in src attributes are never requested before they are filled */
  const wrap=document.createElement('template');wrap.innerHTML=tpl;
  process(wrap.content,Object.assign(Object.create(null),c.renderVals()));
  host.replaceChildren(wrap.content);
  (window.__dcRefs||[]).splice(0).forEach(([fn,el])=>{try{fn(el);}catch(e){}});
  host.querySelectorAll('details').forEach((d,i)=>{if(openDetails[i])d.open=true;});
  if(key){const el=host.querySelector(key);if(el){el.focus();try{el.setSelectionRange(sel,sel);}catch(e){}}}
 }
 c.__rerender=render;render();c.componentDidMount&&c.componentDidMount();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
