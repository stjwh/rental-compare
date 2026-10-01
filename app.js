(() => {
  const cfg = window.APP_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL &&
    cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("YOUR_") &&
    !cfg.SUPABASE_ANON_KEY.includes("YOUR_");

  const $ = (id) => document.getElementById(id);
  const els = {
    setupWarning:$("setupWarning"), modeBadge:$("modeBadge"), adminLoginBtn:$("adminLoginBtn"),
    logoutBtn:$("logoutBtn"), addItemBtn:$("addItemBtn"), adminColHead:$("adminColHead"),
    rows:$("rentalRows"), empty:$("emptyState"), filterCategory:$("filterCategory"),
    filterStatus:$("filterStatus"), searchText:$("searchText"), sortBy:$("sortBy"),
    loginDialog:$("loginDialog"), loginForm:$("loginForm"), loginEmail:$("loginEmail"),
    loginPassword:$("loginPassword"), loginError:$("loginError"), itemDialog:$("itemDialog"),
    itemForm:$("itemForm"), itemDialogTitle:$("itemDialogTitle"), itemError:$("itemError")
  };

  let client = null;
  let items = [];
  let isAdmin = false;

  const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("ko-KR")}원`;
  const num = (id) => Math.max(0, Number($(id).value || 0));

  const calc = (x) => {
    const totalRent = Number(x.monthly_rent || 0) * Number(x.contract_months || 0)
      + Number(x.install_fee || 0) + Number(x.initial_cost || 0);
    const discountMonths = Math.min(Number(x.discount_months || 0), Number(x.contract_months || 0));
    const totalCard = Number(x.card_discount || 0) * discountMonths;
    const totalBenefit = totalCard + Number(x.cashback || 0) + Number(x.extra_benefit || 0);
    const netTotal = Math.max(0, totalRent - totalBenefit);
    const netMonthly = Number(x.contract_months || 0) > 0 ? netTotal / Number(x.contract_months) : 0;
    return { ...x, totalRent, totalCard, totalBenefit, netTotal, netMonthly };
  };

  function setAdminMode(admin) {
    isAdmin = admin;
    els.modeBadge.textContent = admin ? "관리자" : "게스트";
    els.adminLoginBtn.classList.toggle("hidden", admin);
    els.logoutBtn.classList.toggle("hidden", !admin);
    els.addItemBtn.classList.toggle("hidden", !admin);
    els.adminColHead.classList.toggle("hidden", !admin);
    render();
  }

  async function checkAdmin() {
    if (!client) return setAdminMode(false);
    const { data: { session } } = await client.auth.getSession();
    if (!session) return setAdminMode(false);

    const { data, error } = await client.rpc("is_admin");
    setAdminMode(!error && data === true);
  }

  async function loadItems() {
    if (!client) {
      items = [];
      render();
      return;
    }
    const { data, error } = await client
      .from("rental_items")
      .select("*")
      .order("updated_at", { ascending:false });

    if (error) {
      els.empty.textContent = `데이터를 불러오지 못했습니다: ${error.message}`;
      els.empty.classList.remove("hidden");
      return;
    }
    items = data || [];
    render();
  }

  function filteredItems() {
    const q = els.searchText.value.trim().toLowerCase();
    const category = els.filterCategory.value;
    const status = els.filterStatus.value;
    const sort = els.sortBy.value;

    const arr = items
      .map(calc)
      .filter(x => !category || x.category === category)
      .filter(x => !status || x.status === status)
      .filter(x => {
        if (!q) return true;
        return [x.brand, x.product_name, x.memo, x.care_service, x.card_name]
          .filter(Boolean).join(" ").toLowerCase().includes(q);
      });

    arr.sort((a,b) => {
      if (sort === "net_total") return a.netTotal - b.netTotal;
      if (sort === "benefit_desc") return b.totalBenefit - a.totalBenefit;
      if (sort === "monthly") return Number(a.monthly_rent) - Number(b.monthly_rent);
      if (sort === "updated_desc") return new Date(b.updated_at) - new Date(a.updated_at);
      return a.netMonthly - b.netMonthly;
    });
    return arr;
  }

  function render() {
    const arr = filteredItems();
    els.rows.innerHTML = "";
    els.empty.classList.toggle("hidden", arr.length > 0);
    els.empty.textContent = "등록된 제품이 없습니다.";

    for (const x of arr) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="status ${x.status || ""}">${x.status || "관심"}</span></td>
        <td>${x.category || "-"}</td>
        <td><div class="product">${escapeHtml(x.brand || "")} ${escapeHtml(x.product_name || "")}</div>
            <div class="sub">${escapeHtml(x.size || "")}${x.memo ? " · " + escapeHtml(x.memo) : ""}</div></td>
        <td class="num">${money(x.monthly_rent)}</td>
        <td>${Number(x.contract_months || 0)}개월<div class="sub">의무 ${Number(x.mandatory_months || 0)}개월</div></td>
        <td>${escapeHtml(x.care_service || "-")}<div class="sub">${x.care_cycle ? `${x.care_cycle}개월 주기` : ""}</div></td>
        <td class="num">${money(x.totalCard)}<div class="sub">${escapeHtml(x.card_name || "")}</div></td>
        <td class="num">${money(x.cashback)}</td>
        <td class="num">${money(x.totalRent)}</td>
        <td class="num">${money(x.totalBenefit)}</td>
        <td class="num"><strong>${money(x.netTotal)}</strong></td>
        <td class="num"><strong>${money(x.netMonthly)}</strong></td>
        ${isAdmin ? `<td>
          <button class="btn small edit-btn" data-id="${x.id}">수정</button>
          <button class="btn small danger del-btn" data-id="${x.id}">삭제</button>
        </td>` : ""}
      `;
      els.rows.appendChild(tr);
    }

    $("kpiCount").textContent = `${arr.length}개`;
    $("kpiBestMonthly").textContent = arr.length ? money(Math.min(...arr.map(x=>x.netMonthly))) : "-";
    $("kpiBestTotal").textContent = arr.length ? money(Math.min(...arr.map(x=>x.netTotal))) : "-";
    $("kpiBestBenefit").textContent = arr.length ? money(Math.max(...arr.map(x=>x.totalBenefit))) : "-";

    document.querySelectorAll(".edit-btn").forEach(btn =>
      btn.addEventListener("click", () => openEdit(btn.dataset.id))
    );
    document.querySelectorAll(".del-btn").forEach(btn =>
      btn.addEventListener("click", () => deleteItem(btn.dataset.id))
    );
  }

  function escapeHtml(v) {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function openNew() {
    els.itemForm.reset();
    $("itemId").value = "";
    $("status").value = "관심";
    $("installFee").value = 0; $("initialCost").value = 0;
    $("cardDiscount").value = 0; $("cashback").value = 0; $("extraBenefit").value = 0;
    els.itemDialogTitle.textContent = "제품 추가";
    els.itemError.textContent = "";
    els.itemDialog.showModal();
  }

  function openEdit(id) {
    const x = items.find(v => String(v.id) === String(id));
    if (!x) return;
    $("itemId").value = x.id;
    $("category").value = x.category || "기타";
    $("status").value = x.status || "관심";
    $("brand").value = x.brand || "";
    $("productName").value = x.product_name || "";
    $("size").value = x.size || "";
    $("monthlyRent").value = x.monthly_rent || 0;
    $("mandatoryMonths").value = x.mandatory_months || 0;
    $("contractMonths").value = x.contract_months || 60;
    $("installFee").value = x.install_fee || 0;
    $("initialCost").value = x.initial_cost || 0;
    $("cardName").value = x.card_name || "";
    $("cardDiscount").value = x.card_discount || 0;
    $("discountMonths").value = x.discount_months || 0;
    $("cashback").value = x.cashback || 0;
    $("extraBenefit").value = x.extra_benefit || 0;
    $("careCycle").value = x.care_cycle || 0;
    $("careService").value = x.care_service || "";
    $("memo").value = x.memo || "";
    els.itemDialogTitle.textContent = "제품 수정";
    els.itemError.textContent = "";
    els.itemDialog.showModal();
  }

  function formPayload() {
    return {
      category:$("category").value,
      status:$("status").value,
      brand:$("brand").value.trim(),
      product_name:$("productName").value.trim(),
      size:$("size").value.trim(),
      monthly_rent:num("monthlyRent"),
      mandatory_months:num("mandatoryMonths"),
      contract_months:num("contractMonths"),
      install_fee:num("installFee"),
      initial_cost:num("initialCost"),
      card_name:$("cardName").value.trim(),
      card_discount:num("cardDiscount"),
      discount_months:num("discountMonths"),
      cashback:num("cashback"),
      extra_benefit:num("extraBenefit"),
      care_service:$("careService").value.trim(),
      care_cycle:num("careCycle"),
      memo:$("memo").value.trim()
    };
  }

  async function saveItem(e) {
    e.preventDefault();
    if (!isAdmin) return;
    const id = $("itemId").value;
    const payload = formPayload();
    if (!payload.brand || !payload.product_name || payload.contract_months < 1) {
      els.itemError.textContent = "브랜드, 제품명, 총 계약기간을 확인하세요.";
      return;
    }
    let result;
    if (id) result = await client.from("rental_items").update(payload).eq("id", id);
    else result = await client.from("rental_items").insert(payload);
    if (result.error) {
      els.itemError.textContent = result.error.message;
      return;
    }
    els.itemDialog.close();
    await loadItems();
  }

  async function deleteItem(id) {
    if (!isAdmin || !confirm("이 제품을 삭제할까요?")) return;
    const { error } = await client.from("rental_items").delete().eq("id", id);
    if (error) return alert(error.message);
    await loadItems();
  }

  async function login(e) {
    e.preventDefault();
    els.loginError.textContent = "";
    const { error } = await client.auth.signInWithPassword({
      email:els.loginEmail.value.trim(),
      password:els.loginPassword.value
    });
    if (error) {
      els.loginError.textContent = error.message;
      return;
    }
    await checkAdmin();
    els.loginDialog.close();
  }

  async function logout() {
    if (client) await client.auth.signOut();
    setAdminMode(false);
  }

  [els.filterCategory, els.filterStatus, els.sortBy].forEach(el => el.addEventListener("change", render));
  els.searchText.addEventListener("input", render);
  els.adminLoginBtn.addEventListener("click", () => els.loginDialog.showModal());
  els.logoutBtn.addEventListener("click", logout);
  els.addItemBtn.addEventListener("click", openNew);
  els.loginForm.addEventListener("submit", login);
  els.itemForm.addEventListener("submit", saveItem);
  document.querySelectorAll("[data-close]").forEach(btn =>
    btn.addEventListener("click", () => $(btn.dataset.close).close())
  );

  async function init() {
    if (!configured) {
      els.setupWarning.classList.remove("hidden");
      setAdminMode(false);
      render();
      return;
    }
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    client.auth.onAuthStateChange(async () => { await checkAdmin(); });
    await checkAdmin();
    await loadItems();
  }

  init();
})();
