// ========================================
// سامانه مدیریت ساختمان — app.js کامل و نهایی
// ========================================

const SUPABASE_URL = "https://homnacotnynikzkbfosl.supabase.co";
const SUPABASE_KEY = "sb_publishable_PeVpQHHJ128RlIIXSBgrIA_i0XL-Av8";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ================= توابع عمومی =================
function setActiveBuilding(name, role) {
  localStorage.setItem("activeBuildingName", name);
  localStorage.setItem("activeRole", role);
}
function getActiveBuildingName() { return localStorage.getItem("activeBuildingName") || "—"; }
function getActiveRole() { return localStorage.getItem("activeRole") || "—"; }

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-building]").forEach(el => el.textContent = getActiveBuildingName());
  document.querySelectorAll("[data-role]").forEach(el => el.textContent = getActiveRole());
});

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}
// ----- تابع مشترک: ارسال کد تایید (برای صفحه ثبت‌نام و ورود) -----
async function sendOtpCode(phone, btnEl) {
  if (!phone) { alert("لطفاً ابتدا شماره موبایل را وارد کنید"); return; }

  const originalText = btnEl ? btnEl.textContent : "";
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = "در حال ارسال..."; }

  const { data, error } = await supabaseClient.functions.invoke("send-otp", { body: { phone } });

  if (error || (data && data.error)) {
    alert("خطا در ارسال کد: " + ((data && data.error) || error.message || "نامشخص"));
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = originalText; }
    return;
  }

  alert("کد تایید پیامک شد");
  if (btnEl) startOtpCooldown(btnEl, 60);
}

function startOtpCooldown(btnEl, seconds) {
  let remaining = seconds;
  btnEl.disabled = true;
  btnEl.textContent = "ارسال مجدد (" + remaining + ")";
  const interval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(interval);
      btnEl.disabled = false;
      btnEl.textContent = "دریافت کد";
    } else {
      btnEl.textContent = "ارسال مجدد (" + remaining + ")";
    }
  }, 1000);
}

// ----- تایید کد نزد سرور (مشترک) -----
async function verifyOtpCode(phone, code) {
  const { data, error } = await supabaseClient.functions.invoke("verify-otp", { body: { phone, code } });
  if (error) return { success: false, error: error.message };
  return data;
}

// ================= احراز هویت =================
async function submitSignup() {
  const fullName = document.getElementById("fullName").value;
  const nationalCode = document.getElementById("nationalCode").value;
  const phoneNumber = document.getElementById("phoneNumber").value;
  const otpCode = document.getElementById("otpCode").value;

  if (!fullName || !nationalCode || !phoneNumber) { alert("لطفاً همه فیلدها رو پر کن"); return; }
  if (!otpCode) { alert("لطفاً کد تایید ارسال‌شده را وارد کنید"); return; }

  const submitBtn = document.querySelector(".btn-main");
  if (submitBtn) { submitBtn.textContent = "در حال بررسی کد..."; submitBtn.disabled = true; }

  const otpResult = await verifyOtpCode(phoneNumber, otpCode);
  if (!otpResult.success) {
    alert(otpResult.error || "کد تایید اشتباه است");
    if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
    return;
  }

  if (submitBtn) submitBtn.textContent = "در حال بررسی هویت...";

  let shahkarVerified = false;
  try {
    const { data: shahkarData, error: shahkarError } = await supabaseClient.functions.invoke("verify-shahkar", {
      body: { nationalCode: nationalCode, mobile: phoneNumber }
    });

    if (shahkarError) {
      alert("خطا در بررسی هویت: " + JSON.stringify(shahkarError));
      if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
      return;
    }

    if (shahkarData.success !== true) {
      alert("سرویس احراز هویت پاسخ معتبری برنگرداند: " + (shahkarData.message || "خطای نامشخص"));
      if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
      return;
    }

    shahkarVerified = shahkarData.data === true;
  } catch (err) {
    alert("خطا در ارتباط با سرویس احراز هویت: " + err.message);
    if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
    return;
  }

  if (!shahkarVerified) {
    alert("شماره موبایل وارد‌شده متعلق به این کد ملی نیست. لطفاً اطلاعات را بررسی کنید");
    if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .insert([{ full_name: fullName, national_code: nationalCode, phone_number: phoneNumber, shahkar_verified: true }])
    .select();

  if (error) {
    alert("خطا در ثبت‌نام: " + JSON.stringify(error));
    if (submitBtn) { submitBtn.textContent = "تکمیل ثبت‌نام"; submitBtn.disabled = false; }
  } else {
    alert("ثبت‌نام با موفقیت انجام شد!");
    localStorage.setItem("currentUserId", data[0].id);
    localStorage.setItem("currentUserName", fullName);
    window.location.href = "onboarding.html";
  }
}

// ================= ورود =================
async function loginUser() {
  const phone = document.getElementById("phone").value.trim();
  const otp = document.getElementById("otp").value.trim();

  if (!phone) { alert("لطفاً شماره موبایل را وارد کنید"); return; }
  if (!otp) { alert("لطفاً کد تایید ارسال‌شده را وارد کنید"); return; }

  const otpResult = await verifyOtpCode(phone, otp);
  if (!otpResult.success) {
    alert(otpResult.error || "کد تایید اشتباه است");
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, full_name")
    .eq("phone_number", phone)
    .limit(1);

  if (error || !data || data.length === 0) {
    alert("کاربری با این شماره پیدا نشد. اگر حساب ندارید، ثبت‌نام کنید");
    return;
  }

  localStorage.setItem("currentUserId", data[0].id);
  localStorage.setItem("currentUserName", data[0].full_name);
  window.location.href = "home.html";
}
// ================= ساختمان =================
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

async function submitBuilding() {
  const name = document.getElementById("buildingName").value;
  const province = document.getElementById("buildingProvince") ? document.getElementById("buildingProvince").value : "";
  const city = document.getElementById("buildingCity") ? document.getElementById("buildingCity").value : "";
  const address = document.getElementById("buildingAddress").value;
  const plaque = document.getElementById("plaqueNumber").value;
  const units = document.getElementById("totalUnits").value;
  const floors = document.getElementById("totalFloors").value;

  if (!name || !units) { alert("لطفاً حداقل نام ساختمان و تعداد واحد رو پر کن"); return; }

  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) { alert("لطفاً ابتدا وارد حساب کاربری یا ثبت‌نام کنید"); return; }

  const { data: buildingData, error: buildingError } = await supabaseClient
    .from("buildings")
    .insert([{
      name: name, province: province, city: city, address: address, plaque_number: plaque,
      total_units: parseInt(units), total_floors: parseInt(floors),
      verification_status: "pending", created_by: currentUserId
    }])
    .select();

  if (buildingError) { alert("خطا در ثبت ساختمان: " + JSON.stringify(buildingError)); return; }

  const newBuildingId = buildingData[0].id;

  const { error: roleError } = await supabaseClient
    .from("user_building_roles")
    .insert([{ user_id: currentUserId, building_id: newBuildingId, role: "manager", has_voting_right: false, status: "active" }]);

  if (roleError) { alert("ساختمان ثبت شد ولی خطا در تعیین نقش مدیر: " + JSON.stringify(roleError)); return; }

  const inviteCode = generateInviteCode();
  await supabaseClient.from("invite_codes").insert([{ building_id: newBuildingId, code: inviteCode }]);

  // مرحله ۴: ساخت خودکار همه واحدها (به‌صورت خالی) بر اساس تعداد واحد وارد‌شده
  const totalUnitsCount = parseInt(units) || 0;
  const createdUnitIds = {};
  if (totalUnitsCount > 0) {
    const unitRows = [];
    for (let i = 1; i <= totalUnitsCount; i++) {
      unitRows.push({ building_id: newBuildingId, unit_number: String(i), status: "vacant" });
    }
    const { data: insertedUnits, error: unitsCreateError } = await supabaseClient.from("units").insert(unitRows).select();
    if (unitsCreateError) console.error("خطا در ساخت خودکار واحدها:", unitsCreateError);
    if (insertedUnits) insertedUnits.forEach(u => { createdUnitIds[u.unit_number] = u.id; });
  }

  // مرحله ۵: اگر مدیر خودش مالک یک یا چند واحد است، نقش مالک را هم برایش ثبت کن
  const ownerUnitsInput = document.getElementById("ownerUnitNumbers");
  if (ownerUnitsInput && ownerUnitsInput.value.trim()) {
    const unitNumbersList = parseUnitNumberList(ownerUnitsInput.value.trim());
    for (const unitNum of unitNumbersList) {
      let unitId = createdUnitIds[unitNum];
      if (!unitId) {
        const { data: newUnit } = await supabaseClient
          .from("units").insert([{ building_id: newBuildingId, unit_number: unitNum, status: "occupied" }]).select();
        if (newUnit) unitId = newUnit[0].id;
      } else {
        await supabaseClient.from("units").update({ status: "occupied" }).eq("id", unitId);
      }
      if (unitId) {
        await supabaseClient.from("user_building_roles").insert([{
          user_id: currentUserId, building_id: newBuildingId, unit_id: unitId, role: "owner", has_voting_right: true, status: "active"
        }]);
      }
    }
  }

  alert("ساختمان با موفقیت ثبت شد!");
  localStorage.setItem("activeBuildingId", newBuildingId);
  localStorage.setItem("activeBuildingName_real", name);
  setActiveBuilding(name, "مدیر ساختمان");
  window.location.href = "verification-status.html";
}

// تبدیل رشته‌ای مثل "1,2,5-8" به لیست شماره واحدها
function parseUnitNumberList(input) {
  const result = [];
  input.split(",").forEach(part => {
    part = part.trim();
    if (part.indexOf("-") !== -1) {
      const [start, end] = part.split("-").map(s => parseInt(s.trim()));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) result.push(String(i));
      }
    } else if (part) {
      result.push(part);
    }
  });
  return result;
}

async function loadInviteCode() {
  const codeEl = document.getElementById("inviteCodeDisplay");
  if (!codeEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const { data, error } = await supabaseClient.from("invite_codes").select("code").eq("building_id", buildingId).limit(1);
  if (error || !data || data.length === 0) { codeEl.textContent = "خطا در دریافت کد"; return; }
  codeEl.textContent = data[0].code;
}
document.addEventListener("DOMContentLoaded", loadInviteCode);

function copyInviteCode() {
  const codeEl = document.getElementById("inviteCodeDisplay");
  if (!codeEl) return;
  navigator.clipboard.writeText(codeEl.textContent).then(() => alert("کد دعوت کپی شد: " + codeEl.textContent));
}

// ================= پیوستن با کد دعوت =================
let foundBuildingId = null;
let selectedRole = "owner";

async function checkInviteCode() {
  const codeInput = document.getElementById("inviteCodeInput").value.trim().toUpperCase();
  const resultCard = document.getElementById("foundBuildingCard");
  if (!codeInput) { alert("لطفاً کد دعوت را وارد کنید"); return; }

  const { data, error } = await supabaseClient
    .from("invite_codes")
    .select("building_id, buildings(id, name, address)")
    .eq("code", codeInput)
    .limit(1);

  if (error || !data || data.length === 0) {
    resultCard.style.display = "none";
    alert("کد دعوت معتبر نیست");
    foundBuildingId = null;
    return;
  }

  const building = data[0].buildings;
  foundBuildingId = building.id;
  document.getElementById("foundBuildingName").textContent = building.name;
  document.getElementById("foundBuildingAddress").textContent = building.address || "";
  resultCard.style.display = "flex";
}

function selectJoinRole(role, btnEl) {
  selectedRole = role;
  document.querySelectorAll(".role-btn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

async function submitJoinBuilding() {
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) { alert("لطفاً ابتدا ثبت‌نام یا وارد حساب کاربری شوید"); return; }
  if (!foundBuildingId) { alert("لطفاً ابتدا یک کد دعوت معتبر وارد کنید"); return; }

  const unitNumber = document.getElementById("unitNumberInput").value.trim();
  if (!unitNumber) { alert("لطفاً شماره واحد را وارد کنید"); return; }

  let unitId = null;
  const { data: existingUnits } = await supabaseClient
    .from("units").select("id").eq("building_id", foundBuildingId).eq("unit_number", unitNumber).limit(1);

  if (existingUnits && existingUnits.length > 0) {
    unitId = existingUnits[0].id;
    await supabaseClient.from("units").update({ status: "occupied" }).eq("id", unitId);
  } else {
    const { data: newUnit, error: unitError } = await supabaseClient
      .from("units").insert([{ building_id: foundBuildingId, unit_number: unitNumber, status: "occupied" }]).select();
    if (unitError) { alert("خطا در ثبت واحد: " + JSON.stringify(unitError)); return; }
    unitId = newUnit[0].id;
  }

  const { error: roleError } = await supabaseClient
    .from("user_building_roles")
    .insert([{ user_id: currentUserId, building_id: foundBuildingId, unit_id: unitId, role: selectedRole, has_voting_right: true, status: "active" }]);

  if (roleError) { alert("خطا در پیوستن به ساختمان: " + JSON.stringify(roleError)); return; }

  alert("با موفقیت به ساختمان پیوستید!");
  localStorage.setItem("activeBuildingId", foundBuildingId);
  localStorage.setItem("activeUnitNumber", unitNumber);
  const roleName = selectedRole === "owner" ? "مالک — واحد " + unitNumber : "مستأجر — واحد " + unitNumber;
  setActiveBuilding(document.getElementById("foundBuildingName").textContent, roleName);
  window.location.href = "hub-tenant.html";
}

// ================= خانه: نمایش ساختمان‌های کاربر =================
async function loadMyBuildings() {
  const currentUserId = localStorage.getItem("currentUserId");
  const currentUserName = localStorage.getItem("currentUserName") || "کاربر";
  const nameEl = document.getElementById("userGreetName");
  if (nameEl) nameEl.textContent = currentUserName;
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("user_building_roles")
    .select("role, has_voting_right, unit_id, units(unit_number), buildings(id, name, address, verification_status)")
    .eq("user_id", currentUserId)
    .eq("status", "active");

  if (error) { console.error("خطا در دریافت ساختمان‌ها:", error); return; }

  renderManagerSection(data.filter(r => r.role === "manager"));
  renderTenantOwnerSection("ownerSection", "ownerBuildingsList", data.filter(r => r.role === "owner"), "hub-tenant.html");
  renderTenantOwnerSection("tenantSection", "tenantBuildingsList", data.filter(r => r.role === "tenant"), "hub-tenant.html");
}

function renderManagerSection(roleData) {
  const section = document.getElementById("managerSection");
  const list = document.getElementById("managerBuildingsList");
  if (!section || !list) return;
  if (roleData.length === 0) { section.style.display = "none"; return; }

  section.style.display = "block";
  list.innerHTML = "";
  roleData.forEach(item => {
    const b = item.buildings;
    if (!b) return;
    const statusBadge = b.verification_status === "verified"
      ? '<span class="badge badge-success">تاییدشده</span>'
      : '<span class="badge badge-danger">در حال تایید</span>';
    const row = document.createElement("a");
    row.href = "hub-manager.html";
    row.className = "building-row";
    row.onclick = () => {
      setActiveBuilding(b.name, "مدیر ساختمان");
      localStorage.setItem("activeBuildingId", b.id);
    };
    row.innerHTML = `
      <div class="icon-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-15l8 -4v19"></path><path d="M16 8l4 2v11"></path><path d="M9 9l1 0"></path><path d="M9 12l1 0"></path><path d="M9 15l1 0"></path><path d="M9 18l1 0"></path></svg></div>
      <div style="flex:1;"><p class="name">${b.name}</p><p class="addr">${b.address || ""}</p></div>
      ${statusBadge}`;
    list.appendChild(row);
  });
}

// گروه‌بندی چند واحد یک نفر در یک ساختمان، برای نمایش انتخابگر واحد
function renderTenantOwnerSection(sectionId, listId, roleData, linkTarget) {
  const section = document.getElementById(sectionId);
  const list = document.getElementById(listId);
  if (!section || !list) return;
  if (roleData.length === 0) { section.style.display = "none"; return; }

  section.style.display = "block";
  list.innerHTML = "";

  // گروه‌بندی بر اساس ساختمان
  const grouped = {};
  roleData.forEach(item => {
    const b = item.buildings;
    if (!b) return;
    if (!grouped[b.id]) grouped[b.id] = { building: b, units: [] };
    const unitNumber = item.units ? item.units.unit_number : null;
    if (unitNumber) grouped[b.id].units.push(unitNumber);
  });

  Object.values(grouped).forEach(group => {
    const b = group.building;
    const statusBadge = b.verification_status === "verified"
      ? '<span class="badge badge-success">تاییدشده</span>'
      : '<span class="badge badge-danger">در حال تایید</span>';

    const wrapper = document.createElement("div");
    wrapper.className = "building-row";
    wrapper.style.flexDirection = "column";
    wrapper.style.alignItems = "stretch";
    wrapper.style.cursor = "default";

    const roleLabel = sectionId === "ownerSection" ? "مالک" : "مستأجر";

    if (group.units.length <= 1) {
      const unitNumber = group.units[0] || null;
      const a = document.createElement("a");
      a.href = linkTarget;
      a.style.display = "flex"; a.style.alignItems = "center"; a.style.gap = "10px"; a.style.textDecoration = "none"; a.style.color = "inherit";
      a.onclick = () => {
        setActiveBuilding(b.name, roleLabel + (unitNumber ? " — واحد " + unitNumber : ""));
        localStorage.setItem("activeBuildingId", b.id);
        if (unitNumber) localStorage.setItem("activeUnitNumber", unitNumber);
      };
      a.innerHTML = `
        <div class="icon-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-15l8 -4v19"></path><path d="M16 8l4 2v11"></path><path d="M9 9l1 0"></path><path d="M9 12l1 0"></path><path d="M9 15l1 0"></path><path d="M9 18l1 0"></path></svg></div>
        <div style="flex:1;"><p class="name">${b.name}</p><p class="addr">${b.address || ""}</p></div>
        ${statusBadge}`;
      wrapper.appendChild(a);
    } else {
      const header = document.createElement("div");
      header.style.display = "flex"; header.style.alignItems = "center"; header.style.gap = "10px"; header.style.marginBottom = "10px";
      header.innerHTML = `
        <div class="icon-box"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21v-15l8 -4v19"></path><path d="M16 8l4 2v11"></path><path d="M9 9l1 0"></path><path d="M9 12l1 0"></path><path d="M9 15l1 0"></path><path d="M9 18l1 0"></path></svg></div>
        <div style="flex:1;"><p class="name">${b.name}</p><p class="addr">${b.address || ""}</p></div>
        ${statusBadge}`;
      wrapper.appendChild(header);

      const selectorRow = document.createElement("div");
      selectorRow.style.cssText = "background:#faf8f4; border-radius:10px; padding:10px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px;";
      const select = document.createElement("select");
      select.style.cssText = "border:none; background:transparent; font-family:inherit; font-size:12.5px; font-weight:600; color:#1b3a5c;";
      group.units.forEach(u => {
        const opt = document.createElement("option");
        opt.value = u; opt.textContent = "واحد " + u;
        select.appendChild(opt);
      });
      const goBtn = document.createElement("button");
      goBtn.textContent = "ورود";
      goBtn.style.cssText = "background:#1b3a5c; color:#e8c468; border:none; padding:6px 14px; border-radius:8px; font-size:11.5px; font-family:inherit;";
      goBtn.onclick = () => {
        const unitNumber = select.value;
        setActiveBuilding(b.name, roleLabel + " — واحد " + unitNumber);
        localStorage.setItem("activeBuildingId", b.id);
        localStorage.setItem("activeUnitNumber", unitNumber);
        window.location.href = linkTarget;
      };
      selectorRow.innerHTML = `<span style="font-size:12px; color:#6b6b6b;">انتخاب واحد</span>`;
      const rightWrap = document.createElement("div");
      rightWrap.style.cssText = "display:flex; align-items:center; gap:8px;";
      rightWrap.appendChild(select);
      rightWrap.appendChild(goBtn);
      selectorRow.appendChild(rightWrap);
      wrapper.appendChild(selectorRow);
    }

    list.appendChild(wrapper);
  });
}
document.addEventListener("DOMContentLoaded", loadMyBuildings);

// ================= آپلود فایل به Storage =================
async function uploadFile(file, folder) {
  if (!file) return null;
  const fileExt = file.name.split('.').pop();
  const fileName = folder + "/" + Date.now() + "_" + Math.random().toString(36).substring(2, 8) + "." + fileExt;

  const { error } = await supabaseClient.storage.from('attachments').upload(fileName, file);
  if (error) { console.error("خطا در آپلود فایل:", error); return null; }

  const { data } = supabaseClient.storage.from('attachments').getPublicUrl(fileName);
  return data.publicUrl;
}

function isCurrentUserManager() {
  const role = localStorage.getItem("activeRole") || "";
  return role.indexOf("مدیر") !== -1;
}

// ================= درخواست‌های تعمیرات =================
let selectedCategory = "elevator";
let selectedPriority = "normal";

function selectCategory(cat, btnEl) {
  selectedCategory = cat;
  document.querySelectorAll(".catbtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}
function selectPriority(pri, btnEl) {
  selectedPriority = pri;
  document.querySelectorAll(".priobtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

async function submitRequest() {
  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!currentUserId || !buildingId) { alert("لطفاً ابتدا وارد یک ساختمان شوید"); return; }

  const title = document.getElementById("requestTitle").value.trim();
  const loc = document.getElementById("requestLocation").value;
  const description = document.getElementById("requestDescription").value.trim();
  if (!title) { alert("لطفاً عنوان درخواست را وارد کنید"); return; }

  const fileInput = document.getElementById("requestPhotoInput");
  let photoUrl = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    photoUrl = await uploadFile(fileInput.files[0], "requests");
  }

  const { error } = await supabaseClient
    .from("maintenance_requests")
    .insert([{ building_id: buildingId, submitted_by: currentUserId, title: title, category: selectedCategory, priority: selectedPriority, location: loc, description: description, status: "new", photo_url: photoUrl }]);

  if (error) { alert("خطا در ثبت درخواست: " + JSON.stringify(error)); return; }
  alert("درخواست با موفقیت ثبت شد!");
  window.location.href = "requests.html";
}

async function loadRequests() {
  const listEl = document.getElementById("requestsList");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;">ابتدا یک ساختمان انتخاب کنید</p>'; return; }

  const { data, error } = await supabaseClient
    .from("maintenance_requests")
    .select("*, profiles(full_name)")
    .eq("building_id", buildingId)
    .order("created_at", { ascending: false });

  if (error) { listEl.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت درخواست‌ها</p>'; return; }
  if (data.length === 0) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;padding:20px 0;">هنوز درخواستی ثبت نشده است</p>'; return; }

  const newCountEl = document.getElementById("newCount");
  const inProgressCountEl = document.getElementById("inProgressCount");
  if (newCountEl) newCountEl.textContent = data.filter(r => r.status === "new").length;
  if (inProgressCountEl) inProgressCountEl.textContent = data.filter(r => r.status === "in_progress").length;

  const statusLabels = { new: "جدید", in_progress: "در حال انجام", done: "انجام‌شده", rejected: "رد شده" };
  listEl.innerHTML = "";
  data.forEach(req => {
    const submitterName = req.profiles ? req.profiles.full_name : "ناشناس";
    const timeAgo = new Date(req.created_at).toLocaleDateString("fa-IR");
    const borderColor = req.priority === "emergency" ? "#c0392b" : req.priority === "urgent" ? "#b8860b" : "#e8e2d6";
    const badgeStyle = req.priority === "emergency" ? "background:#fbebe9;color:#c0392b;" : req.priority === "urgent" ? "background:#fbf3e0;color:#b8860b;" : "background:#faf8f4;color:#9a9186;";
    const item = document.createElement("a");
    item.href = "request-detail.html?id=" + req.id;
    item.className = "req-item";
    item.style.borderRight = "3px solid " + borderColor;
    item.innerHTML = `
      <div class="icon-box" style="background:#f3e6c4;"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1b3a5c" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 15l2 2l4 -4"></path><path d="M9 4h6a2 2 0 0 1 2 2v13a1 1 0 0 1 -1.5 .866l-7 -4a1 1 0 0 0 -1 0l-7 4a1 1 0 0 1 -1.5 -.866v-13a2 2 0 0 1 2 -2h6z"></path></svg></div>
      <div style="flex:1;"><p class="name">${req.title}</p><p class="meta">${submitterName} — ${timeAgo}</p></div>
      <span class="badge" style="${badgeStyle}">${statusLabels[req.status] || req.status}</span>`;
    listEl.appendChild(item);
  });
}
document.addEventListener("DOMContentLoaded", loadRequests);

async function loadRequestDetail() {
  const detailEl = document.getElementById("requestDetailContainer");
  if (!detailEl) return;
  const requestId = getQueryParam("id");
  if (!requestId) return;

  const { data, error } = await supabaseClient
    .from("maintenance_requests").select("*, profiles(full_name)").eq("id", requestId).single();

  if (error || !data) { detailEl.innerHTML = '<p style="color:red;">درخواست پیدا نشد</p>'; return; }

  window.currentRequestId = requestId;
  document.getElementById("detailTitle").textContent = data.title;
  document.getElementById("detailMeta").textContent = (data.profiles ? data.profiles.full_name : "ناشناس") + " — " + new Date(data.created_at).toLocaleDateString("fa-IR");
  document.getElementById("detailDescription").textContent = data.description || "بدون توضیحات";

  const photoContainer = document.getElementById("detailPhotoContainer");
  if (photoContainer && data.photo_url) {
    photoContainer.innerHTML = `<img src="${data.photo_url}" style="width:100%; border-radius:12px; margin-top:10px;">`;
  }

  const statusActions = document.getElementById("managerOnlyActions");
  const statusViewOnly = document.getElementById("statusViewOnly");
  const statusLabels = { new: "جدید", in_progress: "در حال انجام", done: "انجام‌شده", rejected: "رد شده" };
  if (statusActions) {
    if (isCurrentUserManager()) {
      statusActions.style.display = "grid";
      if (statusViewOnly) statusViewOnly.style.display = "none";
    } else {
      statusActions.style.display = "none";
      if (statusViewOnly) { statusViewOnly.style.display = "block"; statusViewOnly.textContent = "وضعیت فعلی: " + (statusLabels[data.status] || data.status); }
    }
  }
}
document.addEventListener("DOMContentLoaded", loadRequestDetail);

async function updateRequestStatus(newStatus) {
  if (!window.currentRequestId) return;
  const { error } = await supabaseClient.from("maintenance_requests").update({ status: newStatus }).eq("id", window.currentRequestId);
  if (error) { alert("خطا در تغییر وضعیت: " + JSON.stringify(error)); }
  else { alert("وضعیت به‌روزرسانی شد"); window.location.href = "requests.html"; }
}

// ================= اعلان‌ها (متنی + نظرسنجی، تو یک فید) =================
async function submitNotification() {
  const buildingId = localStorage.getItem("activeBuildingId");
  const currentUserId = localStorage.getItem("currentUserId");
  if (!buildingId || !currentUserId) { alert("لطفاً ابتدا وارد یک ساختمان شوید"); return; }

  const title = document.getElementById("notifTitle").value.trim();
  const body = document.getElementById("notifBody").value.trim();
  if (!title) { alert("لطفاً عنوان اعلان را وارد کنید"); return; }

  const { error } = await supabaseClient
    .from("notifications")
    .insert([{ building_id: buildingId, title: title, body: body, audience: "all", priority: "normal", created_by: currentUserId }]);

  if (error) { alert("خطا در ارسال اعلان: " + JSON.stringify(error)); return; }
  alert("اعلان با موفقیت ارسال شد!");
  const modal = document.getElementById("notifModal");
  if (modal) modal.classList.remove("open");
  loadNotifications();
}

async function loadNotifications() {
  const listEl = document.getElementById("notificationsList");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;">ابتدا یک ساختمان انتخاب کنید</p>'; return; }

  const { data: notifs, error: notifErr } = await supabaseClient
    .from("notifications").select("*").eq("building_id", buildingId);

  const { data: polls, error: pollErr } = await supabaseClient
    .from("polls").select("*").eq("building_id", buildingId);

  if (notifErr && pollErr) { listEl.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت اعلان‌ها</p>'; return; }

  const items = [
    ...((notifs || []).map(n => ({ kind: "notif", data: n }))),
    ...((polls || []).map(p => ({ kind: "poll", data: p })))
  ].sort((a, b) => new Date(b.data.created_at) - new Date(a.data.created_at));

  if (items.length === 0) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;padding:20px 0;">هنوز اعلانی ثبت نشده است</p>'; return; }

  let eligibleCount = 0, myUnitId = null;
  if ((polls || []).length > 0) {
    const { data: votersData } = await supabaseClient
      .from("user_building_roles").select("id").eq("building_id", buildingId).eq("has_voting_right", true).eq("status", "active");
    eligibleCount = votersData ? votersData.length : 0;

    const currentUserId = localStorage.getItem("currentUserId");
    const { data: voterRole } = await supabaseClient
      .from("user_building_roles").select("unit_id").eq("user_id", currentUserId).eq("building_id", buildingId).eq("has_voting_right", true).eq("status", "active").limit(1);
    myUnitId = (voterRole && voterRole[0]) ? voterRole[0].unit_id : null;
  }

  listEl.innerHTML = "";
  for (const item of items) {
    if (item.kind === "notif") {
      const n = item.data;
      const timeAgo = new Date(n.created_at).toLocaleDateString("fa-IR");
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `<p class="title">${n.title}</p><p class="body">${n.body || ""}</p><p class="time">${timeAgo}</p>`;
      listEl.appendChild(card);
    } else {
      const card = await buildPollCard(item.data, eligibleCount, myUnitId);
      listEl.appendChild(card);
    }
  }
}
document.addEventListener("DOMContentLoaded", loadNotifications); 

// ================= گفتگو =================
async function getOrCreateGroupConversation(buildingId) {
  const { data: existing } = await supabaseClient
    .from("conversations").select("id").eq("building_id", buildingId).eq("type", "group").limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabaseClient
    .from("conversations").insert([{ building_id: buildingId, type: "group" }]).select();

  if (error) { console.error(error); return null; }
  return created[0].id;
}

async function loadGroupChat() {
  const chatBox = document.getElementById("chatMessages");
  if (!chatBox) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const conversationId = await getOrCreateGroupConversation(buildingId);
  if (!conversationId) return;
  window.currentConversationId = conversationId;

  const { data, error } = await supabaseClient
    .from("messages")
    .select("*, profiles(full_name)")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) { chatBox.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت پیام‌ها</p>'; return; }

  const currentUserId = localStorage.getItem("currentUserId");
  chatBox.innerHTML = "";
  if (data.length === 0) {
    chatBox.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;">هنوز پیامی ارسال نشده</p>';
  }
  data.forEach(m => {
    const isMine = m.sender_id === currentUserId;
    const senderName = m.profiles ? m.profiles.full_name : "ناشناس";
    const bubble = document.createElement("div");
    bubble.style.marginBottom = "8px";
    bubble.style.display = "flex";
    bubble.style.justifyContent = isMine ? "flex-end" : "flex-start";
    bubble.innerHTML = isMine
      ? `<div style="background:#f3e6c4; color:#1b3a5c; border-radius:10px; padding:8px 11px; max-width:80%; font-size:12px; display:inline-block;">${m.content}</div>`
      : `<div style="max-width:80%;"><p style="font-size:10.5px; color:#9a9186; margin:0 0 2px;">${senderName}</p><div style="background:#faf8f4; border-radius:10px; padding:8px 11px; font-size:12px; color:#1f2a33; display:inline-block;">${m.content}</div></div>`;
    chatBox.appendChild(bubble);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}
document.addEventListener("DOMContentLoaded", loadGroupChat);

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const content = input.value.trim();
  if (!content) return;
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId || !window.currentConversationId) { alert("خطا در ارسال پیام"); return; }

  const { error } = await supabaseClient
    .from("messages")
    .insert([{ conversation_id: window.currentConversationId, sender_id: currentUserId, content: content }]);

  if (error) { alert("خطا در ارسال پیام: " + JSON.stringify(error)); return; }
  input.value = "";
  loadGroupChat();
}

window.perUnitAmounts = {};

async function openPerUnitAmounts() {
  const container = document.getElementById("perUnitSection");
  const list = document.getElementById("perUnitList");
  if (!container || !list) return;

  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  let unitsQuery = supabaseClient.from("units").select("id, unit_number").eq("building_id", buildingId);
  if (selectedChargeScope === "occupied") unitsQuery = unitsQuery.eq("status", "occupied");
  if (selectedChargeScope === "vacant") unitsQuery = unitsQuery.eq("status", "vacant");
  const { data: unitsList } = await unitsQuery;

  if (!unitsList || unitsList.length === 0) { alert("واحدی با این دامنه یافت نشد"); return; }

  const defaultAmount = getRawAmount(document.getElementById("chargeAmount")) || "0";
  list.innerHTML = "";
  window.perUnitAmounts = {};

  unitsList.forEach(u => {
    window.perUnitAmounts[u.id] = defaultAmount;
    const row = document.createElement("div");
    row.style.cssText = "display:flex; align-items:center; gap:8px; margin-bottom:8px;";
    row.innerHTML = `
      <span style="font-size:12px; color:var(--ink); flex-shrink:0; width:60px;">واحد ${u.unit_number}</span>
      <input type="text" inputmode="numeric" class="input-plain perUnitInput" data-unit-id="${u.id}" value="${Number(defaultAmount).toLocaleString('en-US')}" style="flex:1; text-align:center;">
    `;
    list.appendChild(row);
  });

  document.querySelectorAll(".perUnitInput").forEach(inp => {
    formatMoneyInput(inp);
    inp.addEventListener("input", function () {
      window.perUnitAmounts[this.dataset.unitId] = getRawAmount(this);
    });
  });

  container.style.display = "block";
  document.getElementById("openPerUnitLink").style.display = "none";
}

// ================= امور مالی: شارژ =================
let selectedChargeType = "monthly_charge";
function selectChargeType(type, btnEl) {
  selectedChargeType = type;
  document.querySelectorAll(".chargeTypeBtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

let selectedChargeScope = "all";
function selectChargeScope(scope, btnEl) {
  selectedChargeScope = scope;
  document.querySelectorAll(".scopeBtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

async function submitCharge() {
  if (!isCurrentUserManager()) { alert("فقط مدیر ساختمان می‌تواند شارژ یا هزینه ثبت کند"); return; }

  const buildingId = localStorage.getItem("activeBuildingId");
  const currentUserId = localStorage.getItem("currentUserId");
  if (!buildingId) { alert("لطفاً ابتدا وارد یک ساختمان شوید"); return; }

  const month = document.getElementById("chargeMonth").value;
  const year = document.getElementById("chargeYear").value;
  const amount = getRawAmount(document.getElementById("chargeAmount"));
  const description = document.getElementById("chargeDescription") ? document.getElementById("chargeDescription").value : "";
  const usePerUnit = document.getElementById("perUnitSection") && document.getElementById("perUnitSection").style.display === "block";

  if (!usePerUnit && !amount) { alert("لطفاً مبلغ را وارد کنید"); return; }

  const fileInput = document.getElementById("chargeFileInput");
  let attachmentUrl = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    attachmentUrl = await uploadFile(fileInput.files[0], "charges");
  }

  const { data: chargeData, error: chargeError } = await supabaseClient
    .from("charges")
    .insert([{ building_id: buildingId, type: selectedChargeType, month: parseInt(month) || 0, year: parseInt(year) || 1405, description: description, attachment_url: attachmentUrl, created_by: currentUserId }])
    .select();

  if (chargeError) { alert("خطا در ثبت شارژ: " + JSON.stringify(chargeError)); return; }
  const chargeId = chargeData[0].id;

  let rows = [];
  if (usePerUnit && window.perUnitAmounts && Object.keys(window.perUnitAmounts).length > 0) {
    rows = Object.entries(window.perUnitAmounts).map(([unitId, amt]) => ({ charge_id: chargeId, unit_id: unitId, amount: parseFloat(amt) || 0, status: "unpaid" }));
  } else {
    let unitsQuery = supabaseClient.from("units").select("id").eq("building_id", buildingId);
    if (selectedChargeScope === "occupied") unitsQuery = unitsQuery.eq("status", "occupied");
    if (selectedChargeScope === "vacant") unitsQuery = unitsQuery.eq("status", "vacant");
    const { data: unitsList, error: unitsError } = await unitsQuery;

    if (unitsError || !unitsList || unitsList.length === 0) {
      alert("شارژ ثبت شد ولی هیچ واحدی با این دامنه یافت نشد");
      window.location.href = "finance-manager.html";
      return;
    }
    rows = unitsList.map(u => ({ charge_id: chargeId, unit_id: u.id, amount: parseFloat(amount), status: "unpaid" }));
  }

  const { error: ucError } = await supabaseClient.from("unit_charges").insert(rows);

  if (ucError) { alert("خطا در تخصیص شارژ به واحدها: " + JSON.stringify(ucError)); return; }
  alert("شارژ با موفقیت برای " + rows.length + " واحد ثبت شد!");
  window.location.href = "finance-manager.html";
}

// ----- تب بدهی‌ها -----
async function loadUnitCharges() {
  const listEl = document.getElementById("unitChargesList");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const { data: chargesList } = await supabaseClient
    .from("charges").select("id").eq("building_id", buildingId).order("created_at", { ascending: false }).limit(1);

  if (!chargesList || chargesList.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;padding:20px 0;">هنوز شارژی ثبت نشده است</p>';
    return;
  }

  const latestChargeId = chargesList[0].id;
  const { data, error } = await supabaseClient
    .from("unit_charges")
    .select("*, units(unit_number)")
    .eq("charge_id", latestChargeId)
    .neq("status", "paid");

  if (error || !data) { listEl.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }
  if (data.length === 0) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;padding:20px 0;">همه واحدها تسویه‌شده‌اند</p>'; return; }

  listEl.innerHTML = "";
  data.forEach(uc => {
    const unitNumber = uc.units ? uc.units.unit_number : "؟";
    const isPending = uc.status === "pending_confirmation";
    const statusLabel = isPending ? "در انتظار تایید" : "معوق";
    const statusColor = isPending ? "#b8860b" : "#c0392b";
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = `
      <div class="avatar" style="background:#faf8f4; color:${statusColor};">${unitNumber}</div>
      <div style="flex:1;"><p class="name">واحد ${unitNumber}</p><p class="meta" style="color:${statusColor};">${uc.amount ? uc.amount.toLocaleString("fa-IR") : 0} تومان — ${statusLabel}</p></div>
      <button class="action-btn" style="background:#1b3a5c; color:#e8c468;" onclick="markUnitChargePaid('${uc.id}')">تایید پرداخت</button>
    `;
    listEl.appendChild(row);
  });
}
document.addEventListener("DOMContentLoaded", loadUnitCharges);

// ----- تب پرداخت‌های ثبت‌شده -----
async function loadRegisteredPayments() {
  const listEl = document.getElementById("registeredPaymentsList");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const { data, error } = await supabaseClient
    .from("payments")
    .select("*, profiles(full_name), unit_charges(amount, units(unit_number), charges(building_id, month))")
    .order("paid_at", { ascending: false });

  if (error || !data) { listEl.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }

  const filtered = data.filter(p => p.unit_charges && p.unit_charges.charges && p.unit_charges.charges.building_id === buildingId);

  if (filtered.length === 0) { listEl.innerHTML = '<p style="text-align:center;color:#9a9186;font-size:12px;padding:20px 0;">هنوز پرداختی ثبت نشده است</p>'; return; }

  const methodLabels = { online_gateway: "آنلاین", card_to_card: "کارت به کارت", cash: "نقدی" };
  listEl.innerHTML = "";
  filtered.forEach(p => {
    const unitNumber = p.unit_charges.units ? p.unit_charges.units.unit_number : "؟";
    const payerName = p.profiles ? p.profiles.full_name : "ناشناس";
    const timeAgo = new Date(p.paid_at).toLocaleDateString("fa-IR");
    const row = document.createElement("div");
    row.className = "row-item";
    row.innerHTML = `
      <div class="avatar" style="background:#e6f6ef; color:#1f8a5f;">✓</div>
      <div style="flex:1;"><p class="name">واحد ${unitNumber} — ${payerName}</p><p class="meta" style="color:#9a9186;">${p.amount ? p.amount.toLocaleString("fa-IR") : (p.unit_charges.amount || 0).toLocaleString("fa-IR")} تومان — ${methodLabels[p.method] || p.method}</p></div>
      <span style="font-size:10.5px; color:#9a9186;">${timeAgo}</span>
    `;
    listEl.appendChild(row);
  });
}
document.addEventListener("DOMContentLoaded", loadRegisteredPayments);

function switchPaymentTab(tab) {
  document.getElementById("debtsTabContent").style.display = tab === "debts" ? "block" : "none";
  document.getElementById("paymentsTabContent").style.display = tab === "payments" ? "block" : "none";
  document.getElementById("debtsTabBtn").classList.toggle("active", tab === "debts");
  document.getElementById("paymentsTabBtn").classList.toggle("active", tab === "payments");
}

async function markUnitChargePaid(unitChargeId) {
  const { error } = await supabaseClient.from("unit_charges").update({ status: "paid" }).eq("id", unitChargeId);
  if (error) { alert("خطا: " + JSON.stringify(error)); return; }
  alert("پرداخت تایید شد");
  loadUnitCharges();
  loadRegisteredPayments();
}

// ----- نمایش شارژ برای مالک/مستأجر و ثبت پرداخت -----
async function loadMyCharge() {
  const el = document.getElementById("myChargeAmount");
  if (!el) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  const unitNumber = localStorage.getItem("activeUnitNumber");
  if (!buildingId || !unitNumber) { el.textContent = "واحد شما مشخص نیست"; return; }

  const { data: unitData } = await supabaseClient
    .from("units").select("id").eq("building_id", buildingId).eq("unit_number", unitNumber).limit(1);

  if (!unitData || unitData.length === 0) { el.textContent = "واحدی یافت نشد"; return; }
  const unitId = unitData[0].id;

  const { data, error } = await supabaseClient
    .from("unit_charges")
    .select("*, charges(month, year)")
    .eq("unit_id", unitId)
    .eq("status", "unpaid")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    el.textContent = "بدهی‌ای ثبت نشده";
    window.currentUnitChargeId = null;
    return;
  }

  window.currentUnitChargeId = data[0].id;
  el.textContent = data[0].amount.toLocaleString("fa-IR") + " تومان";
}
document.addEventListener("DOMContentLoaded", loadMyCharge);

async function payMyCharge() {
  const currentUserId = localStorage.getItem("currentUserId");
  if (!window.currentUnitChargeId) { alert("بدهی‌ای برای پرداخت یافت نشد"); return; }

  const { error: payError } = await supabaseClient
    .from("payments")
    .insert([{ unit_charge_id: window.currentUnitChargeId, paid_by: currentUserId, amount: 0, method: "online_gateway", status: "confirmed" }]);

  if (payError) { alert("خطا در ثبت پرداخت: " + JSON.stringify(payError)); return; }

  await supabaseClient.from("unit_charges").update({ status: "paid" }).eq("id", window.currentUnitChargeId);

  alert("پرداخت با موفقیت انجام شد!");
  window.location.reload();
}

// ================= خروج و پاک‌سازی نشست (برای تست راحت‌تر) =================
function clearSession() {
  localStorage.clear();
  window.location.href = "index.html";
}


// ================= ثبت پرداخت دستی توسط مدیر =================
let manualPaymentType = "monthly_charge";
function selectManualPaymentType(type, btnEl) {
  manualPaymentType = type;
  document.querySelectorAll(".manualTypeBtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  loadUnitSelectForManualPayment();
}

async function initManualPaymentPage() {
  const monthSelect = document.getElementById("manualPaymentMonth");
  const yearSelect = document.getElementById("manualPaymentYear");
  if (!monthSelect || !yearSelect) return;
  populateMonthSelect(monthSelect, new Date().getMonth() + 1);
  populateYearSelect(yearSelect, 1405);
  monthSelect.addEventListener("change", loadUnitSelectForManualPayment);
  yearSelect.addEventListener("change", loadUnitSelectForManualPayment);
  const amountEl = document.getElementById("manualPaymentAmount");
  if (amountEl) formatMoneyInput(amountEl);
  loadUnitSelectForManualPayment();
}
document.addEventListener("DOMContentLoaded", initManualPaymentPage);

async function loadUnitSelectForManualPayment() {
  const select = document.getElementById("manualPaymentUnitSelect");
  if (!select) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  const monthSelect = document.getElementById("manualPaymentMonth");
  const yearSelect = document.getElementById("manualPaymentYear");
  if (!buildingId || !monthSelect || !yearSelect) return;

  const month = parseInt(monthSelect.value);
  const year = parseInt(yearSelect.value);

  const { data: chargesList } = await supabaseClient
    .from("charges").select("id")
    .eq("building_id", buildingId).eq("month", month).eq("year", year).eq("type", manualPaymentType);

  select.innerHTML = "";
  if (!chargesList || chargesList.length === 0) {
    select.innerHTML = '<option value="">موردی برای این ماه یافت نشد</option>';
    document.getElementById("manualPaymentAmount").value = "";
    return;
  }

  const chargeIds = chargesList.map(c => c.id);
  const { data, error } = await supabaseClient
    .from("unit_charges")
    .select("id, amount, units(unit_number)")
    .in("charge_id", chargeIds)
    .neq("status", "paid");

  if (error || !data || data.length === 0) {
    select.innerHTML = '<option value="">همه واحدها تسویه شده‌اند</option>';
    document.getElementById("manualPaymentAmount").value = "";
    return;
  }

  data.forEach(uc => {
    const opt = document.createElement("option");
    opt.value = uc.id;
    opt.dataset.amount = uc.amount;
    opt.textContent = "واحد " + (uc.units ? uc.units.unit_number : "؟") + " — " + uc.amount.toLocaleString("fa-IR") + " تومان";
    select.appendChild(opt);
  });

  document.getElementById("manualPaymentAmount").value = Number(data[0].amount).toLocaleString("en-US");
  select.onchange = function () {
    const opt = this.options[this.selectedIndex];
    if (opt.dataset.amount) document.getElementById("manualPaymentAmount").value = Number(opt.dataset.amount).toLocaleString("en-US");
  };
}

async function submitManualPayment() {
  const select = document.getElementById("manualPaymentUnitSelect");
  const unitChargeId = select.value;
  const amount = getRawAmount(document.getElementById("manualPaymentAmount"));
  const method = document.querySelector(".methodBtn.active") ? document.querySelector(".methodBtn.active").dataset.method : "cash";
  const note = document.getElementById("manualPaymentNote") ? document.getElementById("manualPaymentNote").value : "";
  const currentUserId = localStorage.getItem("currentUserId");

  if (!unitChargeId) { alert("لطفاً واحد را انتخاب کنید"); return; }

  const fileInput = document.getElementById("manualPaymentReceipt");
  let receiptUrl = null;
  if (fileInput && fileInput.files && fileInput.files[0]) {
    receiptUrl = await uploadFile(fileInput.files[0], "receipts");
  }

  const { error: payError } = await supabaseClient
    .from("payments")
    .insert([{ unit_charge_id: unitChargeId, paid_by: currentUserId, amount: parseFloat(amount), method: method, status: "confirmed", receipt_url: receiptUrl, note: note }]);

  if (payError) { alert("خطا در ثبت پرداخت: " + JSON.stringify(payError)); return; }

  await supabaseClient.from("unit_charges").update({ status: "paid" }).eq("id", unitChargeId);

  alert("پرداخت با موفقیت ثبت شد!");
  window.location.href = "payments-debts.html";
}

function selectMethod(el) {
  document.querySelectorAll(".methodBtn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

// ================= توابع کمکی مشترک: ماه/سال فارسی و فرمت مبلغ =================
const PERSIAN_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];

function populateMonthSelect(selectEl, defaultMonth) {
  selectEl.innerHTML = "";
  PERSIAN_MONTHS.forEach((name, idx) => {
    const opt = document.createElement("option");
    opt.value = idx + 1;
    opt.textContent = name;
    if (defaultMonth && (idx + 1) === parseInt(defaultMonth)) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function populateYearSelect(selectEl, defaultYear) {
  selectEl.innerHTML = "";
  for (let y = 1400; y <= 1414; y++) {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = toPersianDigits(y);
    if (defaultYear && y === parseInt(defaultYear)) opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function toPersianDigits(num) {
  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
}

function formatMoneyInput(inputEl) {
  inputEl.addEventListener("input", function () {
    let raw = this.value.replace(/[^\d]/g, "");
    this.value = raw ? Number(raw).toLocaleString("en-US") : "";
  });
}

function getRawAmount(inputEl) {
  return inputEl.value.replace(/[^\d]/g, "");
}

// ================= مشاهده شارژ/هزینه یک ماه خاص =================
async function loadChargeViewForMonth() {
  const monthSelect = document.getElementById("viewChargeMonth");
  const yearSelect = document.getElementById("viewChargeYear");
  const chargeAmountEl = document.getElementById("viewChargeAmountDisplay");
  const expenseAmountEl = document.getElementById("viewExpenseAmountDisplay");
  if (!monthSelect || !yearSelect) return;

  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const month = parseInt(monthSelect.value);
  const year = parseInt(yearSelect.value);

  const { data: chargesOfMonth } = await supabaseClient
    .from("charges")
    .select("id, type")
    .eq("building_id", buildingId)
    .eq("month", month)
    .eq("year", year);

  let chargeTotal = 0, expenseTotal = 0;

  if (chargesOfMonth && chargesOfMonth.length > 0) {
    const chargeIds = chargesOfMonth.filter(c => c.type === "monthly_charge").map(c => c.id);
    const expenseIds = chargesOfMonth.filter(c => c.type === "one_time_expense").map(c => c.id);

    if (chargeIds.length > 0) {
      const { data: ucData } = await supabaseClient.from("unit_charges").select("amount").in("charge_id", chargeIds);
      if (ucData) chargeTotal = ucData.reduce((sum, r) => sum + (r.amount || 0), 0);
    }
    if (expenseIds.length > 0) {
      const { data: ucData2 } = await supabaseClient.from("unit_charges").select("amount").in("charge_id", expenseIds);
      if (ucData2) expenseTotal = ucData2.reduce((sum, r) => sum + (r.amount || 0), 0);
    }
  }

  if (chargeAmountEl) chargeAmountEl.textContent = chargeTotal.toLocaleString("fa-IR") + " تومان";
  if (expenseAmountEl) expenseAmountEl.textContent = expenseTotal.toLocaleString("fa-IR") + " تومان";
}

async function initChargeViewSection() {
  const monthSelect = document.getElementById("viewChargeMonth");
  const yearSelect = document.getElementById("viewChargeYear");
  if (!monthSelect || !yearSelect) return;

  const buildingId = localStorage.getItem("activeBuildingId");
  let defaultMonth = null, defaultYear = null;

  if (buildingId) {
    const { data: latest } = await supabaseClient
      .from("charges").select("month, year").eq("building_id", buildingId)
      .order("created_at", { ascending: false }).limit(1);
    if (latest && latest.length > 0) {
      defaultMonth = latest[0].month;
      defaultYear = latest[0].year;
    }
  }

  populateMonthSelect(monthSelect, defaultMonth);
  populateYearSelect(yearSelect, defaultYear || 1405);

  monthSelect.addEventListener("change", loadChargeViewForMonth);
  yearSelect.addEventListener("change", loadChargeViewForMonth);

  loadChargeViewForMonth();
}
document.addEventListener("DOMContentLoaded", initChargeViewSection);

// ================= مقداردهی اولیه ماه/سال فرم ثبت شارژ + فرمت مبلغ =================
document.addEventListener("DOMContentLoaded", () => {
  const chargeMonthEl = document.getElementById("chargeMonth");
  const chargeYearEl = document.getElementById("chargeYear");
  if (chargeMonthEl && chargeMonthEl.tagName === "SELECT") populateMonthSelect(chargeMonthEl, new Date().getMonth() + 1);
  if (chargeYearEl && chargeYearEl.tagName === "SELECT") populateYearSelect(chargeYearEl, 1405);

  const chargeAmountEl = document.getElementById("chargeAmount");
  if (chargeAmountEl) formatMoneyInput(chargeAmountEl);
});

// ================= لیست استان‌ها و شهرهای ایران =================
const IRAN_PROVINCES = {
  "آذربایجان شرقی": ["تبریز","آذرشهر","اهر","بستان‌آباد","بناب","جلفا","سراب","سردرود","شبستر","صوفیان","عجب‌شیر","مراغه","مرند","ملکان","ممقان","میانه","هریس","هشترود","کلیبر","بناب جدید","شرفخانه","خسروشهر"],
  "آذربایجان غربی": ["ارومیه","اشنویه","بوکان","تکاب","خوی","سردشت","سلماس","سیه‌چشمه","شاهین‌دژ","فیرورق","قطور","ماکو","محمدیار","مهاباد","میاندوآب","نقده","پیرانشهر","بازرگان"],
  "اردبیل": ["اردبیل","بیله‌سوار","پارس‌آباد","خلخال","سرعین","گرمی","مشگین‌شهر","نمین","نیر","هشتجین"],
  "اصفهان": ["اصفهان","آران‌وبیدگل","اردستان","بادرود","تیران","خمینی‌شهر","خوانسار","خور","داران","دهاقان","زرین‌شهر","سمیرم","شاهین‌شهر","شهرضا","فریدون‌شهر","فلاورجان","فولادشهر","قمصر","کاشان","گلپایگان","مبارکه","نائین","نجف‌آباد","نطنز","نیاسر","هرند","بهارستان","دولت‌آباد","درچه","گز برخوار","حبیب‌آباد","کوهپایه","نوش‌آباد"],
  "البرز": ["کرج","آسارا","اشتهارد","فردیس","کمال‌شهر","ماهدشت","محمدشهر","مشکین‌دشت","نظرآباد","هشتگرد","طالقان","چهارباغ"],
  "ایلام": ["ایلام","آبدانان","ایوان","بدره","دره‌شهر","دهلران","سرابله","مهران","چوار","دلگشا"],
  "بوشهر": ["بوشهر","اهرم","برازجان","بردخون","بندردیلم","بندردیر","بندرریگ","بندرکنگان","بندرگناوه","تنگستان","جم","خارک","خورموج","دالکی","دیر","سعدآباد","عسلویه","کاکی","شبانکاره"],
  "تهران": ["تهران","اسلامشهر","پاکدشت","پردیس","پرند","پیشوا","دماوند","رباط‌کریم","رودهن","ری","شهریار","صفادشت","فیروزکوه","قدس","قرچک","لواسان","ملارد","ورامین","کهریزک","بومهن","نسیم‌شهر","اندیشه","باقرشهر","حسن‌آباد","شاهدشهر"],
  "چهارمحال و بختیاری": ["شهرکرد","اردل","بروجن","بلداجی","سامان","سورشجان","شلمزار","فارسان","فرخ‌شهر","فرادنبه","لردگان","ناغان","هفشجان","چلگرد","گندمان","بن"],
  "خراسان جنوبی": ["بیرجند","اسدیه","بشرویه","خوسف","سرایان","سربیشه","طبس","فردوس","قائن","نهبندان"],
  "خراسان رضوی": ["مشهد","باخرز","بردسکن","تایباد","تربت‌جام","تربت‌حیدریه","چناران","خواف","خلیل‌آباد","درگز","رشتخوار","سبزوار","سرخس","فریمان","فیض‌آباد","قوچان","کاشمر","کلات","گناباد","نیشابور","شاندیز","طرقبه","گلبهار","چکنه"],
  "خراسان شمالی": ["بجنورد","آشخانه","اسفراین","جاجرم","شیروان","فاروج","گرمه"],
  "خوزستان": ["اهواز","آبادان","آغاجاری","امیدیه","اندیمشک","ایذه","باغ‌ملک","بندرماهشهر","بستان","بهبهان","حمیدیه","خرمشهر","دزفول","رامشیر","رامهرمز","سوسنگرد","شادگان","شوش","شوشتر","مسجدسلیمان","هفتگل","هندیجان","اروندکنار","گتوند","لالی","دارخوین"],
  "زنجان": ["زنجان","ابهر","ایجرود","خرمدره","صائین‌قلعه","طارم","قیدار","ماه‌نشان","هیدج"],
  "سمنان": ["سمنان","آرادان","ایوانکی","بسطام","دامغان","سرخه","شاهرود","شهمیرزاد","گرمسار","مهدی‌شهر","میامی"],
  "سیستان و بلوچستان": ["زاهدان","ایرانشهر","چابهار","خاش","راسک","زابل","زهک","سراوان","سرباز","سیب‌وسوران","قصرقند","کنارک","میرجاوه","نیک‌شهر","اسپکه","محمد آباد"],
  "فارس": ["شیراز","آباده","ارسنجان","استهبان","اقلید","جهرم","خرامه","خنج","داراب","سپیدان","سروستان","صفاشهر","فسا","فیروزآباد","قیروکارزین","کازرون","کوار","گراش","لار","لامرد","مرودشت","مهر","نی‌ریز","نورآباد","کوهنجان","زرقان","صدرا","ارد"],
  "قزوین": ["قزوین","آبیک","آوج","بوئین‌زهرا","تاکستان","ضیاءآباد","محمدیه","کوهین"],
  "قم": ["قم","جعفریه","دستجرد","سلفچگان","کهک"],
  "کردستان": ["سنندج","بانه","بیجار","دهگلان","دیواندره","سروآباد","سقز","قروه","کامیاران","مریوان"],
  "کرمان": ["کرمان","انار","بافت","بردسیر","بم","جیرفت","راور","رفسنجان","زرند","سیرجان","شهربابک","عنبرآباد","فهرج","قلعه‌گنج","کهنوج","کوهبنان","گلباف","ماهان","منوجان","نرماشیر"],
  "کرمانشاه": ["کرمانشاه","اسلام‌آباد غرب","پاوه","تازه‌آباد","جوانرود","روانسر","سرپل‌ذهاب","سنقر","صحنه","قصرشیرین","کنگاور","کرندغرب","گیلانغرب","هرسین"],
  "کهگیلویه و بویراحمد": ["یاسوج","باشت","چرام","دهدشت","دوگنبدان","دیشموک","سی‌سخت","لنده","گچساران"],
  "گلستان": ["گرگان","آق‌قلا","آزادشهر","بندرترکمن","بندرگز","رامیان","علی‌آباد کتول","کردکوی","کلاله","گالیکش","گمیشان","گنبدکاووس","مینودشت","فاضل‌آباد"],
  "گیلان": ["رشت","آستارا","آستانه‌اشرفیه","املش","بندرانزلی","تالش","توتکابن","رودبار","رودسر","رضوانشهر","سیاهکل","شفت","صومعه‌سرا","فومن","لاهیجان","لنگرود","ماسال","منجیل","چابکسر","کوچصفهان","کیاشهر","لشت‌نشاء"],
  "لرستان": ["خرم‌آباد","ازنا","الشتر","الیگودرز","بروجرد","پلدختر","چگنی","دورود","کوهدشت","نورآباد"],
  "مازندران": ["ساری","آمل","بابل","بابلسر","بهشهر","تنکابن","جویبار","چالوس","رامسر","سوادکوه","عباس‌آباد","فریدونکنار","قائم‌شهر","محمودآباد","نکا","نور","نوشهر","گلوگاه","سلمان‌شهر"],
  "مرکزی": ["اراک","آشتیان","تفرش","خمین","خنداب","دلیجان","زرندیه","ساوه","شازند","فراهان","محلات","کمیجان"],
  "هرمزگان": ["بندرعباس","ابوموسی","بستک","بشاگرد","بندرلنگه","جاسک","حاجی‌آباد","خمیر","رودان","سیریک","قشم","کیش","میناب","پارسیان"],
  "همدان": ["همدان","اسدآباد","بهار","تویسرکان","رزن","فامنین","کبودراهنگ","ملایر","نهاوند"],
  "یزد": ["یزد","ابرکوه","اردکان","بافق","بهاباد","تفت","مهریز","میبد","خاتم"]
};

function populateProvinceCitySelects(provinceSelectEl, citySelectEl) {
  if (!provinceSelectEl || !citySelectEl) return;
  provinceSelectEl.innerHTML = "";
  Object.keys(IRAN_PROVINCES).forEach(province => {
    const opt = document.createElement("option");
    opt.value = province; opt.textContent = province;
    provinceSelectEl.appendChild(opt);
  });

  function updateCities() {
    const selectedProvince = provinceSelectEl.value;
    citySelectEl.innerHTML = "";
    (IRAN_PROVINCES[selectedProvince] || []).forEach(city => {
      const opt = document.createElement("option");
      opt.value = city; opt.textContent = city;
      citySelectEl.appendChild(opt);
    });
  }
  provinceSelectEl.addEventListener("change", updateCities);
  updateCities();
}

document.addEventListener("DOMContentLoaded", () => {
  const provinceEl = document.getElementById("buildingProvince");
  const cityEl = document.getElementById("buildingCity");
  if (provinceEl && cityEl) populateProvinceCitySelects(provinceEl, cityEl);
});

// ================= هدر یکپارچه: بازگشت + عنوان + پروفایل + ساختمان/واحد =================
async function renderAppHeader() {
  const container = document.getElementById("appHeader");
  if (!container) return;

  const pageTitle = container.dataset.title || "";
  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");
  const activeRole = localStorage.getItem("activeRole") || "";
  const isManager = activeRole.indexOf("مدیر") !== -1;
  const settingsLink = isManager ? "settings-manager.html" : "settings-tenant.html";

  const topRow = `
    <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;">
      <button onclick="history.back()" style="width:30px; height:30px; border-radius:9px; background:rgba(255,255,255,.15); border:none; display:flex; align-items:center; justify-content:center; cursor:pointer;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l14 0"></path><path d="M5 12l6 6"></path><path d="M5 12l6 -6"></path></svg>
      </button>
      <p style="font-size:14px; font-weight:700; color:#e8c468; margin:0;">${pageTitle}</p>
      <a href="${settingsLink}" style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; text-decoration:none;">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"></path><path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"></path></svg>
      </a>
    </div>`;

  if (!buildingId) {
    container.innerHTML = `<div style="background:#1b3a5c; border-radius:18px; padding:16px; margin-bottom:16px;">${topRow}</div>`;
    return;
  }

  const { data: buildingData } = await supabaseClient
    .from("buildings").select("name, address, verification_status").eq("id", buildingId).single();

  if (!buildingData) {
    container.innerHTML = `<div style="background:#1b3a5c; border-radius:18px; padding:16px; margin-bottom:16px;">${topRow}</div>`;
    return;
  }

  let statsHtml = "";
  if (isManager) {
    const { data: unitsData } = await supabaseClient.from("units").select("status").eq("building_id", buildingId);
    const total = unitsData ? unitsData.length : 0;
    const occupied = unitsData ? unitsData.filter(u => u.status === "occupied").length : 0;
    const vacant = total - occupied;
    statsHtml = `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-top:14px;">
        <div style="background:rgba(255,255,255,.1); border-radius:10px; padding:9px; text-align:center;"><p style="font-size:14px; font-weight:700; color:#fff; margin:0;">${toPersianDigits(total)}</p><p style="font-size:9.5px; color:rgba(255,255,255,.65); margin:2px 0 0;">کل واحد</p></div>
        <div style="background:rgba(255,255,255,.1); border-radius:10px; padding:9px; text-align:center;"><p style="font-size:14px; font-weight:700; color:#fff; margin:0;">${toPersianDigits(occupied)}</p><p style="font-size:9.5px; color:rgba(255,255,255,.65); margin:2px 0 0;">ساکن‌دار</p></div>
        <div style="background:rgba(255,255,255,.1); border-radius:10px; padding:9px; text-align:center;"><p style="font-size:14px; font-weight:700; color:#fff; margin:0;">${toPersianDigits(vacant)}</p><p style="font-size:9.5px; color:rgba(255,255,255,.65); margin:2px 0 0;">خالی</p></div>
      </div>`;
  }

  const roleLabel = isManager ? "مدیر ساختمان" : (activeRole.split(" — ")[0] || activeRole);
  const unitNumber = localStorage.getItem("activeUnitNumber");

  container.innerHTML = `
    <div style="background:#1b3a5c; border-radius:18px; padding:16px; margin-bottom:16px;">
      ${topRow}
      <div style="height:1px; background:rgba(255,255,255,.12); margin-bottom:14px;"></div>
      <div style="display:flex; align-items:flex-start; justify-content:space-between;">
        <span style="background:#e8c468; color:#1b3a5c; font-size:10.5px; font-weight:600; padding:4px 12px; border-radius:100px; white-space:nowrap;">${roleLabel}</span>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div id="buildingSwitchWrap" style="position:relative; display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
            <p style="font-size:15px; font-weight:700; color:#fff; margin:0;">${buildingData.name}</p>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="2"><path d="M6 9l6 6l6 -6"/></svg>
          </div>
          <p style="font-size:11px; color:rgba(255,255,255,.6); margin:0;">${buildingData.address || ""}</p>
          ${!isManager && unitNumber ? `<div id="unitSwitchWrap" style="position:relative; display:flex; align-items:center; gap:5px; background:rgba(255,255,255,.1); padding:4px 10px; border-radius:100px; cursor:pointer;"><span style="font-size:11.5px; color:#fff;">واحد ${unitNumber}</span><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="2"><path d="M6 9l6 6l6 -6"/></svg></div>` : ""}
        </div>
      </div>
      ${statsHtml}
    </div>
  `;

  if (currentUserId) attachHeaderSwitchers(currentUserId, buildingId, isManager);
}

async function attachHeaderSwitchers(currentUserId, currentBuildingId, isManager) {
  const { data } = await supabaseClient
    .from("user_building_roles")
    .select("role, unit_id, units(unit_number), buildings(id, name)")
    .eq("user_id", currentUserId).eq("status", "active");

  if (!data) return;

  const roleFilter = isManager ? "manager" : (localStorage.getItem("activeRole").indexOf("مالک") !== -1 ? "owner" : "tenant");
  const relevant = data.filter(r => r.role === roleFilter);

  const buildingWrap = document.getElementById("buildingSwitchWrap");
  const uniqueBuildings = {};
  relevant.forEach(r => { if (r.buildings) uniqueBuildings[r.buildings.id] = r.buildings.name; });

  if (buildingWrap && Object.keys(uniqueBuildings).length > 1) {
    const select = document.createElement("select");
    select.style.cssText = "position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;";
    Object.entries(uniqueBuildings).forEach(([id, name]) => {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = name;
      if (id === currentBuildingId) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = function () {
      localStorage.setItem("activeBuildingId", this.value);
      localStorage.removeItem("activeUnitNumber");
      window.location.reload();
    };
    buildingWrap.appendChild(select);
  }

  const unitWrap = document.getElementById("unitSwitchWrap");
  if (unitWrap) {
    const sameBuildingUnits = relevant.filter(r => r.buildings && r.buildings.id === currentBuildingId && r.units);
    if (sameBuildingUnits.length > 1) {
      const select = document.createElement("select");
      select.style.cssText = "position:absolute; inset:0; opacity:0; cursor:pointer; width:100%; height:100%;";
      sameBuildingUnits.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.units.unit_number; opt.textContent = "واحد " + r.units.unit_number;
        if (r.units.unit_number === localStorage.getItem("activeUnitNumber")) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = function () {
        localStorage.setItem("activeUnitNumber", this.value);
        window.location.reload();
      };
      unitWrap.appendChild(select);
    }
  }
}
document.addEventListener("DOMContentLoaded", renderAppHeader);

// ================= نمایش اطلاعات واقعی پروفایل در صفحه تنظیمات =================
async function loadProfileHeader() {
  const nameEl = document.getElementById("profileName");
  const phoneEl = document.getElementById("profilePhone");
  const avatarEl = document.getElementById("profileAvatar");
  if (!nameEl && !phoneEl) return;

  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("profiles").select("full_name, phone_number").eq("id", currentUserId).single();

  if (error || !data) return;

  if (nameEl) nameEl.textContent = data.full_name;
  if (phoneEl) {
    phoneEl.textContent = data.phone_number;
    phoneEl.style.direction = "ltr";
    phoneEl.style.textAlign = "right";
    phoneEl.style.unicodeBidi = "plaintext";
  }
  if (avatarEl && data.full_name) {
    const parts = data.full_name.trim().split(" ");
    const initials = parts.length > 1 ? parts[0][0] + "." + parts[1][0] : parts[0][0];
    avatarEl.textContent = initials;
  }
}
document.addEventListener("DOMContentLoaded", loadProfileHeader);

// ================= ویرایش اطلاعات پروفایل =================
async function openEditProfileModal() {
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) { alert("خطا: کاربر شناسایی نشد"); return; }

  const { data, error } = await supabaseClient
    .from("profiles").select("full_name, phone_number").eq("id", currentUserId).single();

  if (error || !data) { alert("خطا در دریافت اطلاعات پروفایل"); return; }

  document.getElementById("editProfileName").value = data.full_name || "";
  document.getElementById("editProfilePhone").value = data.phone_number || "";
  document.getElementById("editProfileModal").classList.add("open");
}

function closeEditProfileModal() {
  document.getElementById("editProfileModal").classList.remove("open");
}

async function submitProfileEdit() {
  const currentUserId = localStorage.getItem("currentUserId");
  const newName = document.getElementById("editProfileName").value.trim();
  const newPhone = document.getElementById("editProfilePhone").value.trim();

  if (!newName || !newPhone) { alert("لطفاً نام و شماره تماس را وارد کنید"); return; }

  const { error } = await supabaseClient
    .from("profiles")
    .update({ full_name: newName, phone_number: newPhone })
    .eq("id", currentUserId);

  if (error) { alert("خطا در به‌روزرسانی پروفایل: " + JSON.stringify(error)); return; }

  localStorage.setItem("currentUserName", newName);
  alert("اطلاعات پروفایل با موفقیت به‌روزرسانی شد");
  closeEditProfileModal();
  loadProfileHeader();
}

// ================= تنظیمات اعلان‌ها (فعال/غیرفعال پیامک) =================
async function loadNotificationSettings() {
  const toggleEl = document.getElementById("smsToggle");
  if (!toggleEl) return;
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) return;

  const { data, error } = await supabaseClient
    .from("profiles").select("sms_notifications_enabled").eq("id", currentUserId).single();

  if (error || !data) return;
  updateSmsToggleUI(data.sms_notifications_enabled);
}
document.addEventListener("DOMContentLoaded", loadNotificationSettings);

function updateSmsToggleUI(enabled) {
  const toggleEl = document.getElementById("smsToggle");
  if (!toggleEl) return;
  toggleEl.dataset.enabled = enabled ? "true" : "false";
  toggleEl.style.background = enabled ? "#1b3a5c" : "#e8e2d6";
  toggleEl.querySelector(".knob").style.transform = enabled ? "translateX(-20px)" : "translateX(0)";
}

async function toggleSmsNotifications() {
  const toggleEl = document.getElementById("smsToggle");
  const currentUserId = localStorage.getItem("currentUserId");
  if (!toggleEl || !currentUserId) return;

  const newValue = toggleEl.dataset.enabled !== "true";
  const { error } = await supabaseClient
    .from("profiles").update({ sms_notifications_enabled: newValue }).eq("id", currentUserId);

  if (error) { alert("خطا در ذخیره تنظیمات: " + JSON.stringify(error)); return; }
  updateSmsToggleUI(newValue);
}

// ================= اطلاعات ساختمان (ویرایش توسط مدیر) =================
async function openEditBuildingModal() {
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;
  const { data, error } = await supabaseClient
    .from("buildings").select("name, address, plaque_number, total_units, total_floors").eq("id", buildingId).single();
  if (error || !data) { alert("خطا در دریافت اطلاعات ساختمان"); return; }

  document.getElementById("editBuildingName").value = data.name || "";
  document.getElementById("editBuildingAddress").value = data.address || "";
  document.getElementById("editBuildingPlaque").value = data.plaque_number || "";
  document.getElementById("editBuildingUnits").value = data.total_units || "";
  document.getElementById("editBuildingFloors").value = data.total_floors || "";
  document.getElementById("editBuildingModal").classList.add("open");
}
function closeEditBuildingModal() { document.getElementById("editBuildingModal").classList.remove("open"); }

async function submitEditBuilding() {
  const buildingId = localStorage.getItem("activeBuildingId");
  const name = document.getElementById("editBuildingName").value.trim();
  const address = document.getElementById("editBuildingAddress").value.trim();
  const plaque = document.getElementById("editBuildingPlaque").value.trim();
  const totalUnits = document.getElementById("editBuildingUnits").value;
  const totalFloors = document.getElementById("editBuildingFloors").value;

  if (!name) { alert("نام ساختمان نمی‌تواند خالی باشد"); return; }

  const { error } = await supabaseClient
    .from("buildings")
    .update({ name: name, address: address, plaque_number: plaque, total_units: parseInt(totalUnits) || 0, total_floors: parseInt(totalFloors) || 0 })
    .eq("id", buildingId);

  if (error) { alert("خطا در به‌روزرسانی: " + JSON.stringify(error)); return; }
  alert("اطلاعات ساختمان به‌روزرسانی شد");
  closeEditBuildingModal();
  window.location.reload();
}
// ================= استعلام صاحب شبا (تستی — جایگزین بشه با API واقعی) =================
async function callShebaInquiry(sheba) {
  // TODO: اینجا رو با فراخوانی واقعی سرویس استعلام شبا عوض کن.
  await new Promise(r => setTimeout(r, 500));
  return { ownerName: null };
}

function shebaNamesMatch(nameFromBank, enteredName) {
  const normalize = s => (s || "").trim().replace(/\s+/g, " ").replace(/ي/g, "ی").replace(/ك/g, "ک");
  return normalize(nameFromBank) === normalize(enteredName);
}

async function verifyShebaOwnerOrWarn(sheba, enteredHolderName) {
  const result = await callShebaInquiry(sheba);
  if (!result.ownerName) return true;

  if (!shebaNamesMatch(result.ownerName, enteredHolderName)) {
    return confirm(
      "نام صاحب حساب بانکی («" + result.ownerName + "») با نامی که وارد کردی («" + enteredHolderName + "») یکی نیست.\n" +
      "آیا مطمئنی می‌خوای همین‌طور ذخیره بشه؟"
    );
  }
  return true;
}

// ================= درگاه پرداخت و شماره حساب ساختمان (نسخه رمزنگاری‌شده) =================
async function openBankInfoModal() {
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;
  const { data, error } = await supabaseClient.rpc("get_building_bank_info", { p_building_id: buildingId });
  if (error) { alert("خطا در دریافت اطلاعات"); return; }

  const row = (data && data[0]) || {};
  document.getElementById("bankAccountHolder").value = row.bank_account_holder || "";
  document.getElementById("bankSheba").value = row.bank_sheba || "";
  document.getElementById("bankInfoModal").classList.add("open");
}
function closeBankInfoModal() { document.getElementById("bankInfoModal").classList.remove("open"); }

async function submitBankInfo() {
  const buildingId = localStorage.getItem("activeBuildingId");
  const currentUserId = localStorage.getItem("currentUserId");
  const holder = document.getElementById("bankAccountHolder").value.trim();
  const sheba = document.getElementById("bankSheba").value.trim();

  if (!holder || !sheba) { alert("لطفاً نام صاحب حساب و شماره شبا را وارد کنید"); return; }
const shebaOk = await verifyShebaOwnerOrWarn(sheba, holder);
  if (!shebaOk) return;
  const { error } = await supabaseClient.rpc("manager_set_building_bank_info", {
    p_user_id: currentUserId, p_building_id: buildingId, p_holder: holder, p_sheba: sheba
  });

  if (error) { alert("خطا در ذخیره اطلاعات: " + (error.message || JSON.stringify(error))); return; }
  alert("اطلاعات حساب بانکی ذخیره شد");
  closeBankInfoModal();
}

// ================= دسترسی گروه گفتگو =================
let selectedChatPermission = "manager_only";
function selectChatPermission(perm, btnEl) {
  selectedChatPermission = perm;
  document.querySelectorAll(".chatPermBtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
}

async function openChatPermissionModal() {
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;
  const conversationId = await getOrCreateGroupConversation(buildingId);
  if (!conversationId) { alert("خطا در دریافت گروه گفتگو"); return; }
  window.currentConversationIdForPermission = conversationId;

  const { data } = await supabaseClient.from("conversations").select("message_permission").eq("id", conversationId).single();
  const current = (data && data.message_permission) || "manager_only";
  document.querySelectorAll(".chatPermBtn").forEach(b => {
    b.classList.toggle("active", b.dataset.perm === current);
  });
  selectedChatPermission = current;
  document.getElementById("chatPermissionModal").classList.add("open");
}
function closeChatPermissionModal() { document.getElementById("chatPermissionModal").classList.remove("open"); }

async function submitChatPermission() {
  const conversationId = window.currentConversationIdForPermission;
  if (!conversationId) return;
  const { error } = await supabaseClient
    .from("conversations").update({ message_permission: selectedChatPermission }).eq("id", conversationId);
  if (error) { alert("خطا در ذخیره تنظیمات: " + JSON.stringify(error)); return; }
  alert("دسترسی گروه گفتگو به‌روزرسانی شد");
  closeChatPermissionModal();
}

// ================= مدیریت واحدها و ساکنین (حق رأی) =================
async function loadUnitsManagement() {
  const listEl = document.getElementById("unitsManagementList");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const { data, error } = await supabaseClient
    .from("units")
    .select("id, unit_number, status, user_building_roles(id, role, has_voting_right, profiles(full_name))")
    .eq("building_id", buildingId)
    .order("unit_number");

  if (error || !data) { listEl.innerHTML = '<p style="color:red;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }

  listEl.innerHTML = "";
  data.forEach(unit => {
    const residents = (unit.user_building_roles || []).filter(r => r.role === "owner" || r.role === "tenant");
    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border:1px solid #e8e2d6; border-radius:14px; padding:12px; margin-bottom:8px;";

    if (residents.length === 0) {
      card.style.opacity = "0.7"; card.style.borderStyle = "dashed";
      card.innerHTML = `<p style="font-size:12.5px; font-weight:600; margin:0 0 6px; color:#1f2a33;">واحد ${unit.unit_number}</p><span style="font-size:12px; color:#9a9186;">خالی — بدون رأی</span>`;
    } else {
      let rowsHtml = "";
      residents.forEach((r, idx) => {
        const roleLabel = r.role === "owner" ? "مالک" : "مستأجر";
        const name = r.profiles ? r.profiles.full_name : "—";
        const border = idx < residents.length - 1 ? "border-bottom:1px solid #e8e2d6; margin-bottom:6px; padding-bottom:6px;" : "";
        rowsHtml += `<div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; ${border}">
          <span style="font-size:12px; color:#1f2a33;">${name} (${roleLabel})</span>
          ${r.has_voting_right
            ? `<span style="font-size:10px; background:#e6f6ef; color:#1f8a5f; padding:3px 9px; border-radius:100px;">حق رأی</span>`
            : (residents.length > 1 ? `<button onclick="transferVotingRight('${unit.id}')" style="font-size:10.5px; color:#1b3a5c; background:transparent; border:1px solid #1b3a5c; padding:3px 10px; border-radius:100px; font-family:inherit;">انتقال حق رأی</button>` : "")}
        </div>`;
      });
      card.innerHTML = `<p style="font-size:12.5px; font-weight:600; margin:0 0 8px; color:#1f2a33;">واحد ${unit.unit_number}</p>${rowsHtml}`;
    }
    listEl.appendChild(card);
  });
}
document.addEventListener("DOMContentLoaded", loadUnitsManagement);

async function transferVotingRight(unitId) {
  const { data, error } = await supabaseClient
    .from("user_building_roles").select("id, has_voting_right").eq("unit_id", unitId).in("role", ["owner", "tenant"]);
  if (error || !data) return;

  for (const row of data) {
    await supabaseClient.from("user_building_roles").update({ has_voting_right: !row.has_voting_right }).eq("id", row.id);
  }
  alert("حق رأی این واحد منتقل شد");
  loadUnitsManagement();
}

// ================= رأی‌گیری تغییر مدیر =================
async function getOrCreateOpenElection(buildingId) {
  const { data: existing } = await supabaseClient
    .from("manager_elections").select("id, eligible_voting_units_count").eq("building_id", buildingId).eq("status", "open").limit(1);
  if (existing && existing.length > 0) return existing[0];

  const { data: votersData } = await supabaseClient
    .from("user_building_roles").select("id").eq("building_id", buildingId).eq("has_voting_right", true).eq("status", "active");
  const eligibleCount = votersData ? votersData.length : 0;

  const { data: created, error } = await supabaseClient
    .from("manager_elections").insert([{ building_id: buildingId, status: "open", eligible_voting_units_count: eligibleCount }]).select();
  if (error) { console.error(error); return null; }
  return created[0];
}

async function loadElection() {
  const listEl = document.getElementById("electionCandidatesList");
  const progressEl = document.getElementById("electionProgress");
  if (!listEl) return;
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!buildingId) return;

  const election = await getOrCreateOpenElection(buildingId);
  if (!election) return;
  window.currentElectionId = election.id;
  window.currentElectionEligible = election.eligible_voting_units_count;

  const { data: candidates } = await supabaseClient
    .from("election_candidates").select("id, profiles(full_name)").eq("election_id", election.id);

  const { data: votes } = await supabaseClient
    .from("election_votes").select("candidate_id").eq("election_id", election.id);

  const voteCounts = {};
  (votes || []).forEach(v => { voteCounts[v.candidate_id] = (voteCounts[v.candidate_id] || 0) + 1; });

  if (progressEl) progressEl.textContent = `${toPersianDigits((votes || []).length)} از ${toPersianDigits(election.eligible_voting_units_count)} واحد رأی داده‌اند`;

  listEl.innerHTML = "";
  if (!candidates || candidates.length === 0) {
    listEl.innerHTML = '<p style="text-align:center; color:#9a9186; font-size:12px; padding:10px 0;">هنوز نامزدی معرفی نشده است</p>';
    return;
  }

  candidates.forEach(c => {
    const count = voteCounts[c.id] || 0;
    const percent = election.eligible_voting_units_count > 0 ? Math.round((count / election.eligible_voting_units_count) * 100) : 0;
    const name = c.profiles ? c.profiles.full_name : "نامزد";
    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border:1px solid #e8e2d6; border-radius:14px; padding:13px; margin-bottom:10px;";
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div><p style="font-size:13px; font-weight:600; margin:0; color:#1f2a33;">${name}</p><p style="font-size:10.5px; color:#9a9186; margin:1px 0 0;">${toPersianDigits(count)} رأی</p></div>
        <button onclick="castVote('${c.id}')" style="font-size:11.5px; background:#1b3a5c; color:#e8c468; border:none; padding:6px 14px; border-radius:8px; font-family:inherit;">رأی من</button>
      </div>
      <div style="height:6px; background:#ececec; border-radius:100px; overflow:hidden;"><div style="width:${percent}%; height:100%; background:#1b3a5c;"></div></div>
    `;
    listEl.appendChild(card);
  });
}
document.addEventListener("DOMContentLoaded", loadElection);

async function nominateCandidate() {
  const phoneInput = document.getElementById("nominatePhone");
  const phone = phoneInput.value.trim();
  const currentUserId = localStorage.getItem("currentUserId");
  if (!phone) { alert("لطفاً شماره موبایل نامزد را وارد کنید"); return; }
  if (!window.currentElectionId) { alert("خطا: رأی‌گیری یافت نشد"); return; }

  const { data: candidateProfile, error: profileError } = await supabaseClient
    .from("profiles").select("id, full_name").eq("phone_number", phone).limit(1);

  if (profileError || !candidateProfile || candidateProfile.length === 0) {
    alert("کاربری با این شماره پیدا نشد. باید قبلاً در سامانه ثبت‌نام کرده باشد");
    return;
  }

  const { error } = await supabaseClient
    .from("election_candidates").insert([{ election_id: window.currentElectionId, candidate_user_id: candidateProfile[0].id, nominated_by: currentUserId }]);

  if (error) { alert("خطا در معرفی نامزد: " + JSON.stringify(error)); return; }
  alert(candidateProfile[0].full_name + " به‌عنوان نامزد معرفی شد");
  phoneInput.value = "";
  loadElection();
}

async function castVote(candidateId) {
  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");
  if (!currentUserId || !window.currentElectionId) return;

  const { data: voterRole } = await supabaseClient
    .from("user_building_roles").select("unit_id").eq("user_id", currentUserId).eq("building_id", buildingId).eq("has_voting_right", true).eq("status", "active").limit(1);

  if (!voterRole || voterRole.length === 0 || !voterRole[0].unit_id) {
    alert("شما حق رأی در این ساختمان ندارید");
    return;
  }

  const { error } = await supabaseClient
    .from("election_votes").insert([{ election_id: window.currentElectionId, unit_id: voterRole[0].unit_id, voter_user_id: currentUserId, candidate_id: candidateId }]);

  if (error) {
    if (error.code === "23505") alert("شما قبلاً برای این واحد رأی داده‌اید");
    else alert("خطا در ثبت رأی: " + JSON.stringify(error));
    return;
  }

  alert("رأی شما ثبت شد");
  await checkElectionMajority(candidateId);
  loadElection();
}

async function checkElectionMajority(candidateId) {
  const { data: votes } = await supabaseClient
    .from("election_votes").select("id").eq("election_id", window.currentElectionId).eq("candidate_id", candidateId);
  const count = votes ? votes.length : 0;

  if (count > window.currentElectionEligible / 2) {
    const buildingId = localStorage.getItem("activeBuildingId");
    const { data: candidateData } = await supabaseClient
      .from("election_candidates").select("candidate_user_id, profiles(full_name)").eq("id", candidateId).single();
    if (!candidateData) return;

    await supabaseClient.from("user_building_roles").update({ status: "inactive" }).eq("building_id", buildingId).eq("role", "manager").eq("status", "active");
    await supabaseClient.from("user_building_roles").insert([{ user_id: candidateData.candidate_user_id, building_id: buildingId, role: "manager", has_voting_right: false, status: "active" }]);
    await supabaseClient.from("manager_elections").update({ status: "closed_won", closed_at: new Date().toISOString() }).eq("id", window.currentElectionId);

    alert((candidateData.profiles ? candidateData.profiles.full_name : "نامزد") + " با اکثریت آرا مدیر جدید ساختمان شد!");
    localStorage.setItem("activeRole", "مدیر ساختمان");
    window.location.href = "home.html";
  }
}

// ================= ثبت شماره کارت و شبا برای دریافت اجاره (نسخه رمزنگاری‌شده) =================
async function openRentCardModal() {
  const currentUserId = localStorage.getItem("currentUserId");
  if (!currentUserId) return;

  const { data, error } = await supabaseClient.rpc("get_owner_rent_info", { p_owner_user_id: currentUserId });
  const row = (data && data[0]) || {};

  document.getElementById("rentCardHolder").value = row.rent_card_holder || "";
  document.getElementById("rentCardNumber").value = row.rent_card_number || "";
  document.getElementById("rentSheba").value = row.rent_sheba || "";
  document.getElementById("rentCardModal").classList.add("open");
}
function closeRentCardModal() { document.getElementById("rentCardModal").classList.remove("open"); }

async function submitRentCard() {
  const currentUserId = localStorage.getItem("currentUserId");
  const holder = document.getElementById("rentCardHolder").value.trim();
  const cardNumber = document.getElementById("rentCardNumber").value.trim();
  const sheba = document.getElementById("rentSheba").value.trim();

  if (!holder || !cardNumber) { alert("لطفاً نام صاحب کارت و شماره کارت را وارد کنید"); return; }
if (sheba) {
    const shebaOk = await verifyShebaOwnerOrWarn(sheba, holder);
    if (!shebaOk) return;
}
  const { error } = await supabaseClient.rpc("owner_set_rent_info", {
    p_user_id: currentUserId, p_card_holder: holder, p_card_number: cardNumber, p_sheba: sheba
  });

  if (error) { alert("خطا در ذخیره: " + (error.message || JSON.stringify(error))); return; }
  alert("اطلاعات با موفقیت ذخیره شد");
  closeRentCardModal();
}

// =========================================================
// هدر یکپارچه (نسخه ۵ — خودکار از روی data-title/data-back)
// این کل بلوک رو جایگزین نسخه‌ی قبلیِ renderAppHeader /
// attachHeaderSwitchers توی انتهای assets/app.js کن
//
// از این به بعد توی هر صفحه فقط کافیه این یک خط رو بذاری،
// دیگه لازم نیست اسکریپتِ جداگانه برای صدا زدن renderAppHeader بنویسی:
//   <div id="appHeader" data-title="عنوان صفحه" data-back="صفحه-برگشت.html"></div>
// اگه data-back رو ننویسی، دکمه برگشت به‌صورت پیش‌فرض یک صفحه به عقب برمی‌گرده.
// =========================================================

// چون توی بعضی صفحات activeRole به‌صورت متن فارسی ذخیره شده (مثلاً "مدیر ساختمان")
// و توی بعضی جاها به‌صورت enum انگلیسی ("manager")، این تابع هر دو حالت رو یکسان می‌کنه
function normalizeRole(raw) {
  if (!raw) return "";
  if (raw === "manager" || raw === "owner" || raw === "tenant") return raw;
  if (raw.indexOf("مدیر") !== -1) return "manager";
  if (raw.indexOf("مالک") !== -1) return "owner";
  if (raw.indexOf("مستأجر") !== -1 || raw.indexOf("مستاجر") !== -1) return "tenant";
  return "";
}

async function renderAppHeader(titleArg, backHrefArg) {
  const headerEl = document.getElementById("appHeader");
  if (!headerEl) return;

  // اگه صفحه صریحاً عنوان/آدرس برگشت نداده بود، از روی data-title/data-back خودِ div می‌خونیم
  const title = titleArg || headerEl.dataset.title || "";
  const backHref = backHrefArg || headerEl.dataset.back || "javascript:history.back()";

  const buildingId = localStorage.getItem("activeBuildingId");
  const buildingName = localStorage.getItem("activeBuildingName") || "انتخاب ساختمان";
  const rawRole = (typeof getActiveRole === "function") ? getActiveRole() : (localStorage.getItem("activeRole") || "");
  const role = normalizeRole(rawRole);
  const unitNumber = localStorage.getItem("activeUnitNumber") || "";

  const roleLabels = { manager: "مدیر ساختمان", owner: "مالک", tenant: "مستأجر" };
  const badgeText = roleLabels[role] || "";

  headerEl.innerHTML = `
    <div class="app-header">
      <div class="ah-pagebar-inner">
  <a href="profile.html" class="ah-avatar-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"></circle><path d="M5 21v-1a7 7 0 0 1 14 0v1"></path></svg>
        </a>
        <h1 class="ah-pagetitle-gold">${title}</h1>
        <a href="${backHref}" class="ah-back-dark">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l14 0"></path><path d="M5 12l6 6"></path><path d="M5 12l6 -6"></path></svg>
        </a>
      </div>
      <div class="ah-divider"></div>
      <div class="ah-info-row">
        <div class="ah-info-stack">
          <div id="buildingSwitchWrap" class="ah-switch-wrap">
            <p class="ah-building-name">${buildingName}</p>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e8c468" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"></path></svg>
          </div>
          <p class="ah-building-address" id="ahAddress"></p>
          ${role !== "manager" && unitNumber ? `
          <div id="unitSwitchWrap" class="ah-switch-wrap">
            <span class="ah-unit-pill">
              واحد ${unitNumber}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6l6 -6"></path></svg>
            </span>
          </div>` : ""}
        </div>
        ${badgeText ? `<span class="ah-badge">${badgeText}</span>` : ""}
      </div>
      <div class="ah-stats" id="ahStatsRow" style="display:none;"></div>
    </div>
  `;

  if (!buildingId) return;

  // آدرس واقعی ساختمان
  const { data: buildingRow } = await supabaseClient
    .from("buildings").select("address").eq("id", buildingId).single();
  const addrEl = document.getElementById("ahAddress");
  if (addrEl) {
    if (buildingRow && buildingRow.address) addrEl.textContent = buildingRow.address;
    else addrEl.remove();
  }

  // آمار واحدها (فقط مدیر)
  if (role === "manager") {
    const { data: unitsData } = await supabaseClient
      .from("units").select("status").eq("building_id", buildingId);
    if (unitsData) {
      const total = unitsData.length;
      const vacant = unitsData.filter(u => u.status === "vacant").length;
      const occupied = total - vacant;
      const statsRow = document.getElementById("ahStatsRow");
      if (statsRow) {
        statsRow.style.display = "grid";
        statsRow.innerHTML = `
          <div class="ah-stat"><strong>${vacant.toLocaleString("fa-IR")}</strong><span>خالی</span></div>
          <div class="ah-stat"><strong>${occupied.toLocaleString("fa-IR")}</strong><span>ساکن‌دار</span></div>
          <div class="ah-stat"><strong>${total.toLocaleString("fa-IR")}</strong><span>کل واحد</span></div>
        `;
      }
    }
  }

  // فعال کردن تعویض مستقیم ساختمان/واحد از توی هدر
  const currentUserId = localStorage.getItem("currentUserId");
  if (currentUserId) attachHeaderSwitchers(currentUserId, buildingId, role);
}

async function attachHeaderSwitchers(currentUserId, currentBuildingId, role) {
  const { data } = await supabaseClient
    .from("user_building_roles")
    .select("role, unit_id, units(unit_number), buildings(id, name)")
    .eq("user_id", currentUserId).eq("status", "active");

  if (!data) return;

  const relevant = data.filter(r => r.role === role);

  // --- تعویض ساختمان ---
  const buildingWrap = document.getElementById("buildingSwitchWrap");
  const uniqueBuildings = {};
  relevant.forEach(r => { if (r.buildings) uniqueBuildings[r.buildings.id] = r.buildings.name; });

  if (buildingWrap && Object.keys(uniqueBuildings).length > 1) {
    const select = document.createElement("select");
    select.className = "ah-switch-select";
    Object.entries(uniqueBuildings).forEach(([id, name]) => {
      const opt = document.createElement("option");
      opt.value = id; opt.textContent = name;
      if (id === currentBuildingId) opt.selected = true;
      select.appendChild(opt);
    });
    select.onchange = function () {
      localStorage.setItem("activeBuildingId", this.value);
      localStorage.setItem("activeBuildingName", this.options[this.selectedIndex].textContent);
      localStorage.removeItem("activeUnitNumber");
      window.location.reload();
    };
    buildingWrap.appendChild(select);
  }

  // --- تعویض واحد (فقط مالک/مستأجر) ---
  const unitWrap = document.getElementById("unitSwitchWrap");
  if (unitWrap && role !== "manager") {
    const sameBuildingUnits = relevant.filter(r => r.buildings && r.buildings.id === currentBuildingId && r.units);
    if (sameBuildingUnits.length > 1) {
      const select = document.createElement("select");
      select.className = "ah-switch-select";
      sameBuildingUnits.forEach(r => {
        const opt = document.createElement("option");
        opt.value = r.units.unit_number; opt.textContent = "واحد " + r.units.unit_number;
        if (r.units.unit_number === localStorage.getItem("activeUnitNumber")) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = function () {
        localStorage.setItem("activeUnitNumber", this.value);
        window.location.reload();
      };
      unitWrap.appendChild(select);
    }
  }
}

// به‌محض بارگذاری هر صفحه‌ای که #appHeader داشته باشه، خودکار هدر رو می‌سازه —
// دیگه لازم نیست توی هیچ صفحه‌ای جداگانه renderAppHeader() صدا زده بشه
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("appHeader")) renderAppHeader();
});
