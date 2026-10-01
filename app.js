(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
  const $ = id => document.getElementById(id);
  const els = {
    setupWarning:$("setupWarning"), modeBadge:$("modeBadge"), adminLoginBtn:$("adminLoginBtn"),
    logoutBtn:$("logoutBtn"), addItemBtn:$("addItemBtn"), adminColHead:$("adminColHead"),
    rows:$("rentalRows"), empty:$("emptyState"), filterCategory:$("filterCategory"),
    filterStatus:$("filterStatus"), searchText:$("searchText"), sortBy:$("sortBy"),
    loginDialog:$("loginDialog"), loginForm:$("loginForm"), loginEmail:$("loginEmail"),
    loginPassword:$("loginPassword"), loginError:$("loginError"), itemDialog:$("itemDialog"),
    itemForm:$("itemForm"), itemDialogTitle:$("itemDialogTitle"), itemError:$("itemError")
  };
  let client=null, items=[], isAdmin=false;
  const selectedIds=new Set();
  const money=n=>`${Math.round(Number(n)||0).toLocaleString("ko-KR")}원`;
  const num=id=>Math.max(0,Number($(id).value||0));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));

  function normalizePromos(raw){
    if(Array.isArray(raw)) return raw;
    if(typeof raw==="string"){try{return JSON.parse(raw)||[];}catch(e){return [];}}
    return [];
  }
  function normalizeCardPromos(raw){
    if(Array.isArray(raw)) return raw;
    if(typeof raw==="string"){try{return JSON.parse(raw)||[];}catch(e){return [];}}
    return [];
  }
  function cardPromoLabel(p){
    const end=Number(p.start_month)+Number(p.duration_months)-1;
    return `${p.start_month}~${end}개월 +${money(p.extra_discount)}`;
  }
  function promoMonthlyCharge(normal,month,promos){
    const p=promos.find(v=>month>=Number(v.start_month)&&month<Number(v.start_month)+Number(v.duration_months));
    if(!p) return normal;
    if(p.type==="percent") return Math.max(0,normal*(1-Number(p.value||0)/100));
    if(p.type==="fixed") return Math.max(0,Number(p.value||0));
    return normal;
  }
  function promoLabel(p){
    const end=Number(p.start_month)+Number(p.duration_months)-1;
    return p.type==="percent"
      ? `${p.start_month}~${end}개월 ${Number(p.value).toLocaleString("ko-KR")}% 할인`
      : `${p.start_month}~${end}개월 월 ${money(p.value)}`;
  }
  const calc=x=>{
    const normal=Number(x.monthly_rent||0), months=Number(x.contract_months||0);
    const promos=normalizePromos(x.promotions);
    let billedRent=0;
    for(let m=1;m<=months;m++) billedRent+=promoMonthlyCharge(normal,m,promos);
    const normalRent=normal*months;
    const promoSaving=Math.max(0,normalRent-billedRent);
    const totalRent=billedRent+Number(x.install_fee||0)+Number(x.initial_cost||0);
    const dm=Math.min(Number(x.discount_months||0),months);
    const baseCardDiscount=Number(x.card_discount||0);
    const cardPromos=normalizeCardPromos(x.card_promotions);
    let totalBaseCard=0, totalCardPromo=0;
    for(let m=1;m<=months;m++){
      if(m<=dm) totalBaseCard+=baseCardDiscount;
      for(const cp of cardPromos){
        const start=Number(cp.start_month||0), end=start+Number(cp.duration_months||0)-1;
        if(m>=start && m<=end) totalCardPromo+=Number(cp.extra_discount||0);
      }
    }
    const totalCard=totalBaseCard+totalCardPromo;
    const totalBenefit=promoSaving+totalCard+Number(x.cashback||0)+Number(x.extra_benefit||0);
    const netTotal=Math.max(0,totalRent-totalCard-Number(x.cashback||0)-Number(x.extra_benefit||0));
    const netMonthly=months>0?netTotal/months:0;
    return {...x,promotions:promos,card_promotions:cardPromos,promoSaving,totalRent,totalBaseCard,totalCardPromo,totalCard,totalBenefit,netTotal,netMonthly};
  };

  function setAdminMode(v){
    isAdmin=v; els.modeBadge.textContent=v?"관리자":"게스트";
    els.adminLoginBtn.classList.toggle("hidden",v); els.logoutBtn.classList.toggle("hidden",!v);
    els.addItemBtn.classList.toggle("hidden",!v); els.adminColHead.classList.toggle("hidden",!v);
    render();
  }

  async function checkAdmin(){
    if(!client){setAdminMode(false);return false;}
    const {data:{session}}=await client.auth.getSession();
    if(!session){setAdminMode(false);return false;}
    const {data,error}=await client.rpc("is_admin");
    const ok=!error&&data===true; setAdminMode(ok); return ok;
  }

  async function loadItems(){
    if(!client){items=[];render();return;}
    const source=isAdmin?"rental_items":"rental_items_public";
    const {data,error}=await client.from(source).select("*").order("updated_at",{ascending:false});
    if(error){items=[];els.empty.textContent=`데이터를 불러오지 못했습니다: ${error.message}`;els.empty.classList.remove("hidden");return;}
    items=data||[];
    const liveIds=new Set(items.map(x=>String(x.id)));
    for(const id of [...selectedIds]) if(!liveIds.has(id)) selectedIds.delete(id);
    if(selectedIds.size===0 && items.length) items.forEach(x=>selectedIds.add(String(x.id)));
    render();
  }

  function filteredItems(){
    const q=els.searchText.value.trim().toLowerCase(), cat=els.filterCategory.value, st=els.filterStatus.value, sort=els.sortBy.value;
    const arr=items.map(calc).filter(x=>!cat||x.category===cat).filter(x=>!st||x.status===st).filter(x=>{
      if(!q)return true;
      const fields=[x.brand,x.product_name,x.public_memo,x.care_service,x.card_name];
      if(isAdmin)fields.push(x.admin_memo);
      return fields.filter(Boolean).join(" ").toLowerCase().includes(q);
    });
    arr.sort((a,b)=>{
      if(sort==="net_total")return a.netTotal-b.netTotal;
      if(sort==="benefit_desc")return b.totalBenefit-a.totalBenefit;
      if(sort==="monthly")return Number(a.monthly_rent)-Number(b.monthly_rent);
      if(sort==="updated_desc")return new Date(b.updated_at)-new Date(a.updated_at);
      return a.netMonthly-b.netMonthly;
    }); return arr;
  }

  function render(){
    const arr=filteredItems();els.rows.innerHTML="";els.empty.classList.toggle("hidden",arr.length>0);els.empty.textContent="등록된 제품이 없습니다.";
    for(const x of arr){
      const adminNote=isAdmin&&x.admin_memo?`<div class="sub">🔒 ${esc(x.admin_memo)}</div>`:"";
      const tr=document.createElement("tr");
      const checked=selectedIds.has(String(x.id))?"checked":"";
      tr.innerHTML=`
        <td class="compare-col"><input class="compare-check" type="checkbox" data-id="${x.id}" ${checked} aria-label="${esc(x.brand)} ${esc(x.product_name)} 비교 선택" /></td>
        <td><span class="status ${esc(x.status||"")}">${esc(x.status||"관심")}</span></td>
        <td>${esc(x.category||"-")}</td>
        <td><div class="product">${esc(x.brand)} ${esc(x.product_name)}</div><div class="sub">${esc(x.size||"")}${x.public_memo?" · "+esc(x.public_memo):""}</div>${adminNote}</td>
        <td class="num">${money(x.monthly_rent)}</td>
        <td>${Number(x.contract_months||0)}개월<div class="sub">의무 ${Number(x.mandatory_months||0)}개월</div></td>
        <td>${esc(x.care_service||"-")}<div class="sub">${x.care_cycle?`${x.care_cycle}개월 주기`:""}</div></td>
        <td>${x.promotions.length ? x.promotions.map(p=>`<div class="promo-chip">${esc(promoLabel(p))}</div>`).join("") : "-"}<div class="sub">${x.promoSaving? `절감 ${money(x.promoSaving)}` : ""}</div></td>
        <td class="num">${money(x.totalCard)}
          <div class="sub">${esc(x.card_name||"")}${x.totalBaseCard? ` · 기본 ${money(x.totalBaseCard)}` : ""}</div>
          ${x.card_promotions.length ? x.card_promotions.map(p=>`<div class="card-promo-chip">${esc(cardPromoLabel(p))}</div>`).join("") : ""}
          ${x.totalCardPromo ? `<div class="sub">추가 할인 ${money(x.totalCardPromo)}</div>` : ""}
        </td>
        <td class="num">${money(x.cashback)}</td><td class="num">${money(x.totalRent)}</td><td class="num">${money(x.totalBenefit)}</td>
        <td class="num"><strong>${money(x.netTotal)}</strong></td><td class="num"><strong>${money(x.netMonthly)}</strong></td>
        ${isAdmin?`<td><button class="btn small edit-btn" data-id="${x.id}">수정</button> <button class="btn small danger del-btn" data-id="${x.id}">삭제</button></td>`:""}
      `; els.rows.appendChild(tr);
    }
    const selected=items.map(calc).filter(x=>selectedIds.has(String(x.id)));
    $("kpiCount").textContent=`${selected.length}개`;
    $("kpiBestMonthly").textContent=selected.length?money(Math.min(...selected.map(x=>x.netMonthly))):"-";
    $("kpiBestTotal").textContent=selected.length?money(Math.min(...selected.map(x=>x.netTotal))):"-";
    $("kpiBestBenefit").textContent=selected.length?money(Math.max(...selected.map(x=>x.totalBenefit))):"-";
    const visibleIds=arr.map(x=>String(x.id));
    const allVisible=visibleIds.length>0 && visibleIds.every(id=>selectedIds.has(id));
    const someVisible=visibleIds.some(id=>selectedIds.has(id));
    $("selectAllVisible").checked=allVisible;
    $("selectAllVisible").indeterminate=!allVisible&&someVisible;
    document.querySelectorAll(".compare-check").forEach(b=>b.addEventListener("change",()=>{
      const id=String(b.dataset.id);
      if(b.checked) selectedIds.add(id); else selectedIds.delete(id);
      render();
    }));
    document.querySelectorAll(".edit-btn").forEach(b=>b.addEventListener("click",()=>openEdit(b.dataset.id)));
    document.querySelectorAll(".del-btn").forEach(b=>b.addEventListener("click",()=>deleteItem(b.dataset.id)));
  }

  function addPromoRow(p={start_month:1,duration_months:12,type:"percent",value:50}){
    const row=document.createElement("div"); row.className="promo-row";
    row.innerHTML=`
      <label>시작월<input class="promo-start" type="number" min="1" value="${Number(p.start_month||1)}"></label>
      <label>적용개월<input class="promo-duration" type="number" min="1" value="${Number(p.duration_months||1)}"></label>
      <label>방식<select class="promo-type"><option value="percent" ${p.type==="percent"?"selected":""}>할인율(%)</option><option value="fixed" ${p.type==="fixed"?"selected":""}>월 청구액</option></select></label>
      <label>값<input class="promo-value" type="number" min="0" value="${Number(p.value||0)}"></label>
      <button type="button" class="btn small danger promo-remove">삭제</button>`;
    row.querySelector(".promo-remove").addEventListener("click",()=>row.remove());
    $("promoRows").appendChild(row);
  }
  function readPromos(){
    return [...document.querySelectorAll("#promoRows .promo-row")].map(row=>({
      start_month:Number(row.querySelector(".promo-start").value||0),
      duration_months:Number(row.querySelector(".promo-duration").value||0),
      type:row.querySelector(".promo-type").value,
      value:Number(row.querySelector(".promo-value").value||0)
    }));
  }
  function validatePromos(promos,contractMonths){
    const occupied=new Set();
    for(const p of promos){
      if(p.start_month<1||p.duration_months<1) return "프로모션 시작월과 적용개월을 확인하세요.";
      if(p.start_month>contractMonths) return "프로모션 시작월이 총 계약기간을 넘습니다.";
      if(p.type==="percent"&&(p.value<0||p.value>100)) return "할인율은 0~100%로 입력하세요.";
      const end=Math.min(contractMonths,p.start_month+p.duration_months-1);
      for(let m=p.start_month;m<=end;m++){
        if(occupied.has(m)) return `${m}개월차에 프로모션 구간이 겹칩니다.`;
        occupied.add(m);
      }
    }
    return "";
  }
  function addCardPromoRow(p={start_month:1,duration_months:36,extra_discount:10000}){
    const row=document.createElement("div"); row.className="promo-row card-promo-row";
    row.innerHTML=`
      <label>시작월<input class="card-promo-start" type="number" min="1" value="${Number(p.start_month||1)}"></label>
      <label>적용개월<input class="card-promo-duration" type="number" min="1" value="${Number(p.duration_months||1)}"></label>
      <label class="card-extra-label">추가 월 할인액<input class="card-promo-extra" type="number" min="0" value="${Number(p.extra_discount||0)}"></label>
      <button type="button" class="btn small danger card-promo-remove">삭제</button>`;
    row.querySelector(".card-promo-remove").addEventListener("click",()=>row.remove());
    $("cardPromoRows").appendChild(row);
  }
  function readCardPromos(){
    return [...document.querySelectorAll("#cardPromoRows .card-promo-row")].map(row=>({
      start_month:Number(row.querySelector(".card-promo-start").value||0),
      duration_months:Number(row.querySelector(".card-promo-duration").value||0),
      extra_discount:Number(row.querySelector(".card-promo-extra").value||0)
    }));
  }
  function validateCardPromos(promos,contractMonths){
    for(const p of promos){
      if(p.start_month<1||p.duration_months<1) return "카드 프로모션 시작월과 적용개월을 확인하세요.";
      if(p.start_month>contractMonths) return "카드 프로모션 시작월이 총 계약기간을 넘습니다.";
      if(p.extra_discount<0) return "추가 카드 할인액은 0원 이상이어야 합니다.";
    }
    return "";
  }
  function openNew(){
    els.itemForm.reset();$("itemId").value="";$("status").value="관심";$("promoRows").innerHTML="";$("cardPromoRows").innerHTML="";
    ["installFee","initialCost","cardDiscount","cashback","extraBenefit"].forEach(id=>$(id).value=0);
    els.itemDialogTitle.textContent="제품 추가";els.itemError.textContent="";els.itemDialog.showModal();
  }
  function openEdit(id){
    const x=items.find(v=>String(v.id)===String(id));if(!x)return;
    const vals={itemId:x.id,category:x.category||"기타",status:x.status||"관심",brand:x.brand||"",productName:x.product_name||"",size:x.size||"",
      monthlyRent:x.monthly_rent||0,mandatoryMonths:x.mandatory_months||0,contractMonths:x.contract_months||60,installFee:x.install_fee||0,initialCost:x.initial_cost||0,
      cardName:x.card_name||"",cardDiscount:x.card_discount||0,discountMonths:x.discount_months||0,cashback:x.cashback||0,extraBenefit:x.extra_benefit||0,
      careCycle:x.care_cycle||0,careService:x.care_service||"",publicMemo:x.public_memo||"",adminMemo:x.admin_memo||""};
    Object.entries(vals).forEach(([k,v])=>$(k).value=v);
    $("promoRows").innerHTML="";
    normalizePromos(x.promotions).forEach(addPromoRow);
    $("cardPromoRows").innerHTML="";
    normalizeCardPromos(x.card_promotions).forEach(addCardPromoRow);
    els.itemDialogTitle.textContent="제품 수정";els.itemError.textContent="";els.itemDialog.showModal();
  }
  function payload(){return{
    category:$("category").value,status:$("status").value,brand:$("brand").value.trim(),product_name:$("productName").value.trim(),size:$("size").value.trim(),
    monthly_rent:num("monthlyRent"),mandatory_months:num("mandatoryMonths"),contract_months:num("contractMonths"),install_fee:num("installFee"),initial_cost:num("initialCost"),
    card_name:$("cardName").value.trim(),card_discount:num("cardDiscount"),discount_months:num("discountMonths"),cashback:num("cashback"),extra_benefit:num("extraBenefit"),
    care_service:$("careService").value.trim(),care_cycle:num("careCycle"),promotions:readPromos(),card_promotions:readCardPromos(),public_memo:$("publicMemo").value.trim(),admin_memo:$("adminMemo").value.trim()
  };}

  async function saveItem(e){
    e.preventDefault();if(!isAdmin)return;
    const id=$("itemId").value,p=payload();if(!p.brand||!p.product_name||p.contract_months<1){els.itemError.textContent="브랜드, 제품명, 총 계약기간을 확인하세요.";return;}
    const promoError=validatePromos(p.promotions,p.contract_months);if(promoError){els.itemError.textContent=promoError;return;}
    const cardPromoError=validateCardPromos(p.card_promotions,p.contract_months);if(cardPromoError){els.itemError.textContent=cardPromoError;return;}
    const r=id?await client.from("rental_items").update(p).eq("id",id):await client.from("rental_items").insert(p);
    if(r.error){els.itemError.textContent=r.error.message;return;}els.itemDialog.close();await loadItems();
  }
  async function deleteItem(id){if(!isAdmin||!confirm("이 제품을 삭제할까요?"))return;const {error}=await client.from("rental_items").delete().eq("id",id);if(error)return alert(error.message);await loadItems();}
  async function login(e){
    e.preventDefault();els.loginError.textContent="";
    const {error}=await client.auth.signInWithPassword({email:els.loginEmail.value.trim(),password:els.loginPassword.value});
    if(error){els.loginError.textContent=error.message;return;}
    const ok=await checkAdmin();if(!ok){await client.auth.signOut();els.loginError.textContent="관리자 권한이 없는 계정입니다.";return;}
    await loadItems();els.loginDialog.close();
  }
  async function logout(){if(client)await client.auth.signOut();setAdminMode(false);await loadItems();}

  $("addPromoBtn").addEventListener("click",()=>addPromoRow());
  $("addCardPromoBtn").addEventListener("click",()=>addCardPromoRow());
  $("selectAllVisible").addEventListener("change",()=>{
    const visible=filteredItems();
    if($("selectAllVisible").checked) visible.forEach(x=>selectedIds.add(String(x.id)));
    else visible.forEach(x=>selectedIds.delete(String(x.id)));
    render();
  });
  [els.filterCategory,els.filterStatus,els.sortBy].forEach(el=>el.addEventListener("change",render));
  els.searchText.addEventListener("input",render);els.adminLoginBtn.addEventListener("click",()=>els.loginDialog.showModal());
  els.logoutBtn.addEventListener("click",logout);els.addItemBtn.addEventListener("click",openNew);els.loginForm.addEventListener("submit",login);els.itemForm.addEventListener("submit",saveItem);
  document.querySelectorAll("[data-close]").forEach(btn=>btn.addEventListener("click",()=>$(btn.dataset.close).close()));

  async function init(){
    if(!configured){els.setupWarning.classList.remove("hidden");setAdminMode(false);render();return;}
    client=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
    await checkAdmin();await loadItems();
  }
  init();
})();