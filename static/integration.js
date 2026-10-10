'use strict';
(() => {
  const token=document.querySelector('meta[name="integration-token"]').content;
  const $=id=>document.getElementById(id);
  let snapshot=null, autoPrompted=false, checking=false, manual=false;
  const dialog=$('components-dialog');
  async function api(name,body) {
    const response=await fetch('/api/integration/'+name,{method:body===undefined?'GET':'POST',headers:{'X-App-Token':token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const value=await response.json();if(!response.ok)throw new Error(value.error || '操作失敗。');return value;
  }
  function render(data) {
    snapshot=data;
    $('component-status').textContent=data.busy?data.message:data.checking?'正在檢查元件版本…':data.message || '尚未檢查元件。';
    $('components-feedback').textContent=data.message;
    $('check-components').disabled=data.checking || data.busy;
    $('components-update').disabled=data.busy || data.checking || !data.items.some(r=>r.action);
    $('components-later').textContent=data.busy?'關閉對話框':'稍後處理';
    const list=$('components-list');
    data.items.forEach(row=>{
      let label=Array.from(list.children).find(n=>n.dataset.component===row.id);
      if(!label) {
        label=document.createElement('label');label.className='component-row';label.dataset.component=row.id;
        const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=row.id;
        const text=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');
        text.append(title,detail);label.append(checkbox,text);list.append(label);
      }
      const checkbox=label.querySelector('input');
      checkbox.onchange=()=>{$('components-update').disabled=!!snapshot?.busy || !!snapshot?.checking || !list.querySelector('input:checked:not(:disabled)');};
      if(row.action && checkbox.dataset.available!=='yes')checkbox.checked=true;
      if(!row.action)checkbox.checked=false;
      checkbox.dataset.available=row.action?'yes':'no';checkbox.disabled=!row.action || data.busy;
      label.querySelector('strong').textContent=row.name;
      label.querySelector('small').textContent=(row.current || '缺少或損壞')+(row.latest?' → '+row.latest:'')+' · '+(row.pending?'已暫存，重新啟動後套用':row.error || (row.action==='repair'?'可修復':row.action?'可更新':'已就緒'));
    });
    $('components-update').disabled=data.busy || data.checking || !list.querySelector('input:checked:not(:disabled)');
  }
  async function poll() {
    try {
      const data=await api('components');render(data);
      if(data.checked && !data.checking && !data.busy && (manual || (!autoPrompted && data.items.some(r=>r.action || !r.current)))) {
        manual=false;autoPrompted=true;if(!dialog.open)dialog.showModal();
      }
      if(data.checking || data.busy)setTimeout(poll,1200);
    } catch(error){$('component-status').textContent='元件檢查未完成：'+error.message;$('check-components').disabled=false;}
  }
  async function check(isManual=false){if(checking)return;checking=true;manual=isManual;try{await api('check',{});await poll();}catch(error){$('component-status').textContent=error.message;}finally{checking=false;}}
  $('check-components').addEventListener('click',()=>check(true));
  $('components-later').addEventListener('click',()=>dialog.close());
  $('components-update').addEventListener('click',async()=>{
    const ids=Array.from($('components-list').querySelectorAll('input:checked')).map(n=>n.value);
    if(!ids.length){$('components-feedback').textContent='請勾選要修復或更新的元件。';return;}
    $('components-update').disabled=true;
    try{await api('update',{ids});await poll();}catch(error){$('components-feedback').textContent=error.message;$('components-update').disabled=false;}
  });
  $('open-wechat').addEventListener('click',async()=>{
    const button=$('open-wechat'),popup=window.open('about:blank','huanyu-wechat');
    button.disabled=true;button.textContent='正在啟動，請允許管理員權限…';
    try{const result=await api('wechat',{});if(popup)popup.location.href=result.url;else window.location.href=result.url;}
    catch(error){if(popup)popup.close();$('component-status').textContent=error.message;}
    finally{button.disabled=false;button.textContent='開啟微信影音號工具';}
  });
  check();
})();
