// ========================================
// BuildingManager Admin Panel — admin.js
// کاملاً مستقل از app.js اپ ساکنین
// ========================================

const ADMIN_SUPABASE_URL = "https://homnacotnynikzkbfosl.supabase.co";
const ADMIN_SUPABASE_KEY = "sb_publishable_PeVpQHHJ128RlIIXSBgrIA_i0XL-Av8";
const adminSupabase = supabase.createClient(ADMIN_SUPABASE_URL, ADMIN_SUPABASE_KEY);

// ----- ورود ادمین -----
async function adminLogin() {
  const username = document.getElementById("adminUsername").value.trim();
  const password = document.getElementById("adminPassword").value;

  if (!username || !password) { alert("لطفاً نام کاربری و رمز عبور را وارد کنید"); return; }

  const { data, error } = await adminSupabase.rpc("verify_admin_login", {
    p_username: username,
    p_password: password
  });

  if (error) { alert("خطا در ورود: " + JSON.stringify(error)); return; }

  if (!data || data.length === 0) {
    alert("نام کاربری یا رمز عبور اشتباه است");
    return;
  }

  const admin = data[0];
  localStorage.setItem("adminLoggedIn", "true");
  localStorage.setItem("adminId", admin.id);
  localStorage.setItem("adminName", admin.full_name);
  localStorage.setItem("adminRole", admin.role);
  window.location.href = "admin-dashboard.html";
}

// ----- بررسی ورود برای همه صفحات ادمین -----
function requireAdminLogin() {
  if (localStorage.getItem("adminLoggedIn") !== "true") {
    window.location.href = "admin-login.html";
  }
}

function adminLogout() {
  localStorage.removeItem("adminLoggedIn");
  localStorage.removeItem("adminId");
  localStorage.removeItem("adminName");
  localStorage.removeItem("adminRole");
  window.location.href = "admin-login.html";
}

// ----- بارگذاری آمار داشبورد -----
async function loadAdminDashboardStats() {
  requireAdminLogin();

  const nameEl = document.getElementById("adminNameDisplay");
  if (nameEl) nameEl.textContent = localStorage.getItem("adminName") || "ادمین";

  const [
    buildingsRes,
    profilesRes,
    managersRes,
    ownersRes,
    tenantsRes,
    newRequestsRes
  ] = await Promise.all([
    adminSupabase.from("buildings").select("*", { count: "exact", head: true }),
    adminSupabase.from("profiles").select("*", { count: "exact", head: true }),
    adminSupabase.from("user_building_roles").select("*", { count: "exact", head: true }).eq("role", "manager").eq("status", "active"),
    adminSupabase.from("user_building_roles").select("*", { count: "exact", head: true }).eq("role", "owner").eq("status", "active"),
    adminSupabase.from("user_building_roles").select("*", { count: "exact", head: true }).eq("role", "tenant").eq("status", "active"),
    adminSupabase.from("maintenance_requests").select("*", { count: "exact", head: true }).eq("status", "new"),
  ]);

  setStatValue("statBuildings", buildingsRes.count);
  setStatValue("statUsers", profilesRes.count);
  setStatValue("statManagers", managersRes.count);
  setStatValue("statOwners", ownersRes.count);
  setStatValue("statTenants", tenantsRes.count);
  setStatValue("statNewRequests", newRequestsRes.count);
}

function setStatValue(elId, value) {
  const el = document.getElementById(elId);
  if (el) el.textContent = toPersianDigitsAdmin(value || 0);
}

function toPersianDigitsAdmin(num) {
  const persianDigits = ['۰','۱','۲','۳','۴','۵','۶','۷','۸','۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
}

// فقط در صفحه داشبورد اجرا شود (نه در صفحه ورود)
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("statBuildings")) loadAdminDashboardStats();
});

// ================= فاز ۲: مدیریت ساختمان‌ها =================
let adminAllBuildings = [];
let adminBuildingFilter = "all";

const LIFECYCLE_LABELS = { active: "فعال", inactive: "غیرفعال", archived: "آرشیو" };
const LIFECYCLE_COLORS = {
  active: "background:#e6f6ef;color:#1f8a5f;",
  inactive: "background:#fbf3e0;color:#b8860b;",
  archived: "background:#ececec;color:#6b6b6b;"
};

async function loadAdminBuildings() {
  const listEl = document.getElementById("adminBuildingsList");
  if (!listEl) return;
  requireAdminLogin();

  const { data, error } = await adminSupabase
    .from("buildings")
    .select("id, name, address, city, province, total_units, lifecycle_status, created_at")
    .order("created_at", { ascending: false });

  if (error) { listEl.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت ساختمان‌ها</p>'; return; }
  adminAllBuildings = data || [];
  renderAdminBuildings();
}

function setAdminBuildingFilter(filter, btnEl) {
  adminBuildingFilter = filter;
  document.querySelectorAll(".filterChip").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  renderAdminBuildings();
}

function renderAdminBuildings() {
  const listEl = document.getElementById("adminBuildingsList");
  const searchEl = document.getElementById("adminBuildingSearch");
  const countEl = document.getElementById("adminBuildingCount");
  if (!listEl) return;

  const q = searchEl ? searchEl.value.trim().toLowerCase() : "";
  const filtered = adminAllBuildings.filter(b => {
    const status = b.lifecycle_status || "active";
    if (adminBuildingFilter !== "all" && status !== adminBuildingFilter) return false;
    if (!q) return true;
    return (b.name || "").toLowerCase().includes(q) ||
           (b.address || "").toLowerCase().includes(q) ||
           (b.id || "").toLowerCase().includes(q);
  });

  if (countEl) countEl.textContent = toPersianDigitsAdmin(filtered.length) + " ساختمان";

  if (filtered.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;padding:20px 0;">ساختمانی یافت نشد</p>';
    return;
  }

  listEl.innerHTML = "";
  filtered.forEach(b => {
    const status = b.lifecycle_status || "active";
    const a = document.createElement("a");
    a.href = "admin-building-detail.html?id=" + b.id;
    a.style.cssText = "display:flex; align-items:center; gap:10px; background:#fff; border-radius:14px; padding:13px; margin-bottom:8px; text-decoration:none;";
    a.innerHTML = `
      <div style="flex:1;">
        <p style="font-size:13.5px; font-weight:600; margin:0; color:#1f2a33;">${b.name}</p>
        <p style="font-size:11px; color:#9a9186; margin:2px 0 0;">${[b.province, b.city, b.address].filter(Boolean).join("، ")}</p>
        <p style="font-size:10.5px; color:#9a9186; margin:2px 0 0;">${toPersianDigitsAdmin(b.total_units || 0)} واحد</p>
      </div>
      <span style="font-size:10px; padding:3px 10px; border-radius:100px; ${LIFECYCLE_COLORS[status]}">${LIFECYCLE_LABELS[status]}</span>`;
    listEl.appendChild(a);
  });
}
document.addEventListener("DOMContentLoaded", loadAdminBuildings);

// ----- جزئیات ساختمان -----
function getAdminQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

async function loadAdminBuildingDetail() {
  const container = document.getElementById("adminBuildingDetail");
  if (!container) return;
  requireAdminLogin();

  const buildingId = getAdminQueryParam("id");
  if (!buildingId) { container.innerHTML = "<p>شناسه ساختمان نامعتبر است</p>"; return; }
  window.adminCurrentBuildingId = buildingId;

  const { data: b, error } = await adminSupabase
    .from("buildings").select("*").eq("id", buildingId).single();
  if (error || !b) { container.innerHTML = '<p style="color:#ff8a80;">ساختمان پیدا نشد</p>'; return; }
  window.adminCurrentBuilding = b;

  const status = b.lifecycle_status || "active";
  document.getElementById("detailName").textContent = b.name;
  document.getElementById("detailAddress").textContent = [b.province, b.city, b.address].filter(Boolean).join("، ");
  document.getElementById("detailId").textContent = b.id;
  const statusEl = document.getElementById("detailStatus");
  statusEl.textContent = LIFECYCLE_LABELS[status];
  statusEl.style.cssText = "font-size:11px; padding:4px 12px; border-radius:100px; " + LIFECYCLE_COLORS[status];

  renderAdminLifecycleButtons(status);

  const { data: roles } = await adminSupabase
    .from("user_building_roles")
    .select("role, has_voting_right, status, units(unit_number), profiles(full_name, phone_number)")
    .eq("building_id", buildingId)
    .eq("status", "active");

  const managers = (roles || []).filter(r => r.role === "manager");
  const owners = (roles || []).filter(r => r.role === "owner");
  const tenants = (roles || []).filter(r => r.role === "tenant");

  const { data: units } = await adminSupabase
    .from("units").select("id, unit_number, status").eq("building_id", buildingId).order("unit_number");

  const personRow = (r, showUnit) => `
    <div style="display:flex; justify-content:space-between; padding:7px 0; border-bottom:1px solid #f0ebe0; font-size:12px;">
      <span style="color:#1f2a33;">${r.profiles ? r.profiles.full_name : "—"}${showUnit && r.units ? " — واحد " + r.units.unit_number : ""}</span>
      <span style="color:#9a9186; direction:ltr;">${r.profiles ? r.profiles.phone_number : ""}</span>
    </div>`;

  document.getElementById("detailManagers").innerHTML = managers.length ? managers.map(r => personRow(r, false)).join("") : '<p class="empty">مدیری ثبت نشده</p>';
  document.getElementById("detailOwners").innerHTML = owners.length ? owners.map(r => personRow(r, true)).join("") : '<p class="empty">مالکی ثبت نشده</p>';
  document.getElementById("detailTenants").innerHTML = tenants.length ? tenants.map(r => personRow(r, true)).join("") : '<p class="empty">مستأجری ثبت نشده</p>';

  const occupied = (units || []).filter(u => u.status === "occupied").length;
  document.getElementById("detailUnitsSummary").textContent =
    toPersianDigitsAdmin((units || []).length) + " واحد — " + toPersianDigitsAdmin(occupied) + " ساکن‌دار — " + toPersianDigitsAdmin((units || []).length - occupied) + " خالی";
}
document.addEventListener("DOMContentLoaded", loadAdminBuildingDetail);

// ----- دکمه‌های چرخه‌ی حیات: فعال ⇄ غیرفعال → آرشیو → حذف دائمی -----
function renderAdminLifecycleButtons(status) {
  const box = document.getElementById("lifecycleActions");
  if (!box) return;
  const role = localStorage.getItem("adminRole");
  const canEdit = role === "super_admin" || role === "admin";
  const canDelete = role === "super_admin";

  if (!canEdit) { box.innerHTML = '<p class="empty">شما دسترسی تغییر وضعیت ندارید</p>'; return; }

  const btn = (label, onclick, style) => `<button onclick="${onclick}" style="flex:1; padding:11px; border-radius:10px; font-family:inherit; font-size:12px; cursor:pointer; ${style}">${label}</button>`;
  const neutral = "background:#fff; border:1px solid #e8e2d6; color:#1f2a33;";
  const primary = "background:#1b3a5c; border:none; color:#e8c468;";
  const danger = "background:#c0392b; border:none; color:#fff;";

  let html = "";
  if (status === "active") html = btn("غیرفعال‌سازی", "adminChangeBuildingStatus('inactive')", neutral) + btn("آرشیو", "adminChangeBuildingStatus('archived')", neutral);
  if (status === "inactive") html = btn("فعال‌سازی مجدد", "adminChangeBuildingStatus('active')", primary) + btn("آرشیو", "adminChangeBuildingStatus('archived')", neutral);
  if (status === "archived") {
    html = btn("بازگردانی (غیرفعال)", "adminChangeBuildingStatus('inactive')", neutral);
    if (canDelete) html += btn("حذف دائمی", "adminDeleteBuilding()", danger);
  }
  box.innerHTML = html;
}

async function adminChangeBuildingStatus(newStatus) {
  const labels = { active: "فعال", inactive: "غیرفعال", archived: "آرشیو" };
  if (!confirm("وضعیت ساختمان به «" + labels[newStatus] + "» تغییر کند؟")) return;

  const { error } = await adminSupabase.rpc("admin_set_building_status", {
    p_admin_id: localStorage.getItem("adminId"),
    p_building_id: window.adminCurrentBuildingId,
    p_status: newStatus
  });
  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  window.location.reload();
}

async function adminDeleteBuilding() {
  const b = window.adminCurrentBuilding;
  const typed = prompt("این عملیات غیرقابل بازگشت است و همه‌ی اطلاعات ساختمان (واحدها، شارژها، پرداخت‌ها) پاک می‌شود.\nبرای تایید، نام دقیق ساختمان را بنویسید:\n" + b.name);
  if (typed === null) return;
  if (typed.trim() !== b.name) { alert("نام واردشده مطابقت ندارد. حذف انجام نشد"); return; }

  const { error } = await adminSupabase.rpc("admin_delete_building", {
    p_admin_id: localStorage.getItem("adminId"),
    p_building_id: window.adminCurrentBuildingId
  });
  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  alert("ساختمان برای همیشه حذف شد");
  window.location.href = "admin-buildings.html";
}

// ----- ویرایش اطلاعات ساختمان -----
function openAdminEditBuilding() {
  const b = window.adminCurrentBuilding;
  if (!b) return;
  const role = localStorage.getItem("adminRole");
  if (role !== "super_admin" && role !== "admin") { alert("شما دسترسی ویرایش ندارید"); return; }
  document.getElementById("adminEditName").value = b.name || "";
  document.getElementById("adminEditAddress").value = b.address || "";
  document.getElementById("adminEditPlaque").value = b.plaque_number || "";
  document.getElementById("adminEditUnits").value = b.total_units || "";
  document.getElementById("adminEditFloors").value = b.total_floors || "";
  document.getElementById("adminEditModal").style.display = "flex";
}
function closeAdminEditBuilding() { document.getElementById("adminEditModal").style.display = "none"; }

async function submitAdminEditBuilding() {
  const name = document.getElementById("adminEditName").value.trim();
  if (!name) { alert("نام ساختمان نمی‌تواند خالی باشد"); return; }

  const { error } = await adminSupabase.rpc("admin_update_building", {
    p_admin_id: localStorage.getItem("adminId"),
    p_building_id: window.adminCurrentBuildingId,
    p_name: name,
    p_address: document.getElementById("adminEditAddress").value.trim(),
    p_plaque: document.getElementById("adminEditPlaque").value.trim(),
    p_units: parseInt(document.getElementById("adminEditUnits").value) || 0,
    p_floors: parseInt(document.getElementById("adminEditFloors").value) || 0
  });
  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  window.location.reload();
}

// ================= فاز ۳: مدیریت کاربران (مدیران/مالکان/مستأجران) =================
let adminUsersCurrentTab = "manager";
let adminUsersRawData = [];

function setAdminUsersTab(tab, btnEl) {
  adminUsersCurrentTab = tab;
  document.querySelectorAll(".userTabBtn").forEach(b => b.classList.remove("active"));
  btnEl.classList.add("active");
  loadAdminUsers();
}

async function loadAdminUsers() {
  const listEl = document.getElementById("adminUsersList");
  if (!listEl) return;
  requireAdminLogin();
  listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;">در حال بارگذاری...</p>';

  const { data, error } = await adminSupabase
    .from("user_building_roles")
    .select("id, role, status, user_id, profiles(id, full_name, phone_number, national_code, status), buildings(id, name), units(unit_number)")
    .eq("role", adminUsersCurrentTab);

  if (error) { listEl.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }
  adminUsersRawData = data || [];
  renderAdminUsers();
}

function renderAdminUsers() {
  const listEl = document.getElementById("adminUsersList");
  const searchEl = document.getElementById("adminUserSearch");
  if (!listEl) return;
  const q = searchEl ? searchEl.value.trim().toLowerCase() : "";

  // گروه‌بندی بر اساس کاربر
  const grouped = {};
  adminUsersRawData.forEach(r => {
    if (!r.profiles) return;
    const uid = r.profiles.id;
    if (!grouped[uid]) grouped[uid] = { profile: r.profiles, memberships: [] };
    grouped[uid].memberships.push({ building: r.buildings, unit: r.units, roleStatus: r.status });
  });

  const groups = Object.values(grouped).filter(g => {
    if (!q) return true;
    return (g.profile.full_name || "").toLowerCase().includes(q) || (g.profile.phone_number || "").includes(q);
  });

  if (groups.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;padding:20px 0;">کاربری یافت نشد</p>';
    return;
  }

  listEl.innerHTML = "";
  groups.forEach(g => {
    const p = g.profile;
    const isActive = (p.status || "active") === "active";
    const buildingsHtml = g.memberships.map(m => {
      const unitPart = m.unit ? " — واحد " + m.unit.unit_number : "";
      return `<span style="display:inline-block; background:#faf8f4; color:#6b6b6b; font-size:10px; padding:2px 8px; border-radius:100px; margin:2px 3px 0 0;">${m.building ? m.building.name : "؟"}${unitPart}</span>`;
    }).join("");

    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border-radius:14px; padding:13px; margin-bottom:8px;";
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
        <div>
          <p style="font-size:13px; font-weight:600; margin:0; color:#1f2a33;">${p.full_name}</p>
          <p style="font-size:11px; color:#9a9186; margin:1px 0 0; direction:ltr; text-align:right;">${p.phone_number}</p>
        </div>
        <span style="font-size:10px; padding:3px 10px; border-radius:100px; ${isActive ? "background:#e6f6ef;color:#1f8a5f;" : "background:#fbebe9;color:#c0392b;"}">${isActive ? "فعال" : "غیرفعال"}</span>
      </div>
      <div style="margin-bottom:8px;">${buildingsHtml}</div>
      <div style="display:flex; gap:6px;">
        <button onclick='openAdminEditUser(${JSON.stringify(p).replace(/'/g, "&apos;")})' style="flex:1; padding:7px; border:1px solid #e8e2d6; border-radius:8px; background:#fff; font-family:inherit; font-size:11px;">ویرایش</button>
        <button onclick="adminToggleUserStatus('${p.id}', ${isActive})" style="flex:1; padding:7px; border:none; border-radius:8px; font-family:inherit; font-size:11px; ${isActive ? "background:#fbebe9;color:#c0392b;" : "background:#1b3a5c;color:#e8c468;"}">${isActive ? "غیرفعال‌سازی" : "فعال‌سازی"}</button>
      </div>
    `;
    listEl.appendChild(card);
  });
}
document.addEventListener("DOMContentLoaded", () => { if (document.getElementById("adminUsersList")) loadAdminUsers(); });

// ----- ویرایش کاربر -----
function openAdminEditUser(profile) {
  window.adminEditingUserId = profile.id;
  document.getElementById("adminUserName").value = profile.full_name || "";
  document.getElementById("adminUserNationalCode").value = profile.national_code || "";
  document.getElementById("adminUserPhone").value = profile.phone_number || "";
  document.getElementById("adminUserModalTitle").textContent = "ویرایش کاربر";
  document.getElementById("adminUserModal").style.display = "flex";
}

function openAdminCreateUser() {
  window.adminEditingUserId = null;
  document.getElementById("adminUserName").value = "";
  document.getElementById("adminUserNationalCode").value = "";
  document.getElementById("adminUserPhone").value = "";
  document.getElementById("adminUserModalTitle").textContent = "ثبت کاربر جدید";
  document.getElementById("adminUserModal").style.display = "flex";
}

function closeAdminUserModal() { document.getElementById("adminUserModal").style.display = "none"; }

async function submitAdminUser() {
  const name = document.getElementById("adminUserName").value.trim();
  const nationalCode = document.getElementById("adminUserNationalCode").value.trim();
  const phone = document.getElementById("adminUserPhone").value.trim();
  if (!name || !nationalCode || !phone) { alert("لطفاً همه فیلدها را پر کنید"); return; }

  const adminId = localStorage.getItem("adminId");

  if (window.adminEditingUserId) {
    const { error } = await adminSupabase.rpc("admin_update_profile", {
      p_admin_id: adminId, p_profile_id: window.adminEditingUserId,
      p_full_name: name, p_national_code: nationalCode, p_phone_number: phone
    });
    if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  } else {
    const { error } = await adminSupabase.rpc("admin_create_profile", {
      p_admin_id: adminId, p_full_name: name, p_national_code: nationalCode, p_phone_number: phone
    });
    if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
    alert("توجه: کاربر ایجاد شد ولی هنوز به هیچ ساختمانی متصل نیست. باید از طریق کد دعوت به ساختمان بپیوندد.");
  }

  closeAdminUserModal();
  loadAdminUsers();
}

async function adminToggleUserStatus(profileId, currentlyActive) {
  const newStatus = currentlyActive ? "inactive" : "active";
  const label = currentlyActive ? "غیرفعال" : "فعال";
  if (!confirm("کاربر " + label + " شود؟")) return;

  const { error } = await adminSupabase.rpc("admin_set_profile_status", {
    p_admin_id: localStorage.getItem("adminId"), p_profile_id: profileId, p_status: newStatus
  });
  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  loadAdminUsers();
}

// ================= فاز ۴: Audit Log (لاگ فعالیت‌های ادمین‌ها) =================
let adminAuditOffset = 0;
const ADMIN_AUDIT_PAGE_SIZE = 30;

const AUDIT_ACTION_LABELS = {
  login: "ورود به پنل",
  building_status_change: "تغییر وضعیت ساختمان",
  building_update: "ویرایش ساختمان",
  building_delete: "حذف دائمی ساختمان",
  profile_create: "ایجاد کاربر",
  profile_update: "ویرایش کاربر",
  profile_status_change: "تغییر وضعیت کاربر"
};

const AUDIT_ACTION_COLORS = {
  login: "#6b7280",
  building_status_change: "#b8860b",
  building_update: "#1b3a5c",
  building_delete: "#c0392b",
  profile_create: "#1f8a5f",
  profile_update: "#1b3a5c",
  profile_status_change: "#b8860b"
};

function formatAuditTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
  } catch (e) {
    return iso;
  }
}

function auditDetailsText(action, details) {
  if (!details) return "";
  if (details.new_status) {
    const map = { active: "فعال", inactive: "غیرفعال", archived: "آرشیو" };
    return "وضعیت جدید: " + (map[details.new_status] || details.new_status);
  }
  return "";
}

async function loadAdminAuditLog(reset) {
  const listEl = document.getElementById("adminAuditList");
  if (!listEl) return;
  requireAdminLogin();

  if (reset) {
    adminAuditOffset = 0;
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;">در حال بارگذاری...</p>';
  }

  const { data, error } = await adminSupabase.rpc("admin_get_audit_log", {
    p_admin_id: localStorage.getItem("adminId"),
    p_limit: ADMIN_AUDIT_PAGE_SIZE,
    p_offset: adminAuditOffset
  });

  if (error) {
    listEl.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت لاگ</p>';
    return;
  }

  if (reset) listEl.innerHTML = "";

  const moreBtn = document.getElementById("adminAuditMoreBtn");

  if ((!data || data.length === 0) && adminAuditOffset === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;padding:20px 0;">هنوز فعالیتی ثبت نشده</p>';
    if (moreBtn) moreBtn.style.display = "none";
    return;
  }

  (data || []).forEach(row => {
    const label = AUDIT_ACTION_LABELS[row.action] || row.action;
    const color = AUDIT_ACTION_COLORS[row.action] || "#1b3a5c";
    const detailsText = auditDetailsText(row.action, row.details);
    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border-radius:14px; padding:12px 13px; margin-bottom:8px; border-right:3px solid " + color + ";";
    card.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:4px;">
        <span style="font-size:12.5px; font-weight:600; color:#1f2a33;">${label}</span>
        <span style="font-size:10px; color:#9a9186;">${formatAuditTime(row.created_at)}</span>
      </div>
      <p style="font-size:11.5px; color:#6b6b6b; margin:0;">
        توسط <b>${row.admin_name || "—"}</b>${row.target_label ? " — " + row.target_label : ""}
      </p>
      ${detailsText ? `<p style="font-size:11px; color:#9a9186; margin:4px 0 0;">${detailsText}</p>` : ""}
    `;
    listEl.appendChild(card);
  });

  adminAuditOffset += (data || []).length;

  if (moreBtn) {
    moreBtn.style.display = (data && data.length === ADMIN_AUDIT_PAGE_SIZE) ? "block" : "none";
  }
}

document.addEventListener("DOMContentLoaded", () => { if (document.getElementById("adminAuditList")) loadAdminAuditLog(true); });

// ================= فاز ۵: مدیریت نظارتی شماره شبا =================
let adminShebaRawData = [];

async function loadAdminShebaList() {
  const listEl = document.getElementById("adminShebaList");
  if (!listEl) return;
  requireAdminLogin();
  listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;">در حال بارگذاری...</p>';

  const { data, error } = await adminSupabase.rpc("admin_list_buildings_sheba", {
    p_admin_id: localStorage.getItem("adminId")
  });

  if (error) { listEl.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }
  adminShebaRawData = data || [];
  renderAdminShebaList();
}

function renderAdminShebaList() {
  const listEl = document.getElementById("adminShebaList");
  const searchEl = document.getElementById("adminShebaSearch");
  if (!listEl) return;
  const q = searchEl ? searchEl.value.trim().toLowerCase() : "";

  const rows = adminShebaRawData.filter(b => !q || (b.name || "").toLowerCase().includes(q));

  if (rows.length === 0) {
    listEl.innerHTML = '<p style="text-align:center;color:rgba(255,255,255,.5);font-size:12px;padding:20px 0;">ساختمانی یافت نشد</p>';
    return;
  }

  listEl.innerHTML = "";
  rows.forEach(b => {
    const card = document.createElement("div");
    card.style.cssText = "background:#fff; border-radius:14px; padding:13px; margin-bottom:8px;";
    card.innerHTML = `
      <p style="font-size:13px; font-weight:600; margin:0 0 2px; color:#1f2a33;">${b.name}</p>
      <p style="font-size:11px; color:#9a9186; margin:0 0 8px;">${b.bank_account_holder || "صاحب حساب ثبت نشده"}</p>
      <div style="display:flex; align-items:center; justify-content:space-between; background:#faf8f4; border-radius:10px; padding:9px 11px;">
        <span style="font-family:monospace; font-size:12.5px; direction:ltr; color:#1b3a5c;" id="shebaMasked_${b.id}">${b.has_sheba ? b.masked_sheba : "ثبت نشده"}</span>
        ${b.has_sheba ? `<button onclick="adminRevealSheba('${b.id}')" style="border:none; background:none; color:#b8860b; font-family:inherit; font-size:11px; cursor:pointer;">نمایش کامل</button>` : ""}
      </div>
    `;
    listEl.appendChild(card);
  });
}

async function adminRevealSheba(buildingId) {
  if (!confirm("نمایش شماره کامل شبا ثبت خواهد شد. ادامه می‌دهید؟")) return;

  const { data, error } = await adminSupabase.rpc("admin_get_building_sheba_full", {
    p_admin_id: localStorage.getItem("adminId"), p_building_id: buildingId
  });

  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }

  const el = document.getElementById("shebaMasked_" + buildingId);
  if (el) el.textContent = data || "—";
}

document.addEventListener("DOMContentLoaded", () => { if (document.getElementById("adminShebaList")) loadAdminShebaList(); });

// ================= فاز ۶: مدیریت نسخه و بروزرسانی =================
async function loadAdminVersionInfo() {
  const container = document.getElementById("adminVersionInfo");
  if (!container) return;
  requireAdminLogin();

  const { data, error } = await adminSupabase.from("app_config").select("*").single();
  if (error || !data) { container.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت اطلاعات</p>'; return; }

  document.getElementById("vCurrentVersion").value = data.current_version || "";
  document.getElementById("vMinVersion").value = data.min_supported_version || "";
  document.getElementById("vMessage").value = data.update_message || "";
  document.getElementById("vForceUpdate").checked = !!data.force_update;

  loadAdminMigrationHistory();
}

async function loadAdminMigrationHistory() {
  const listEl = document.getElementById("adminMigrationList");
  if (!listEl) return;

  const { data, error } = await adminSupabase.rpc("admin_get_migration_history", {
    p_admin_id: localStorage.getItem("adminId")
  });

  if (error || !data) { listEl.innerHTML = '<p style="color:#ff8a80;font-size:12px;">خطا در دریافت تاریخچه</p>'; return; }

  listEl.innerHTML = "";
  data.forEach(m => {
    const row = document.createElement("div");
    row.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:9px 0; border-bottom:1px solid #f0ece2;";
    row.innerHTML = `
      <div>
        <span style="font-size:12px; font-weight:600; color:#1b3a5c;">${m.version}</span>
        <p style="font-size:11px; color:#6b6b6b; margin:2px 0 0;">${m.description || ""}</p>
      </div>
      <span style="font-size:10px; color:#9a9186; white-space:nowrap; margin-right:8px;">${formatAuditTime(m.applied_at)}</span>
    `;
    listEl.appendChild(row);
  });
}

async function submitAdminVersion() {
  const currentVersion = document.getElementById("vCurrentVersion").value.trim();
  const minVersion = document.getElementById("vMinVersion").value.trim();
  const message = document.getElementById("vMessage").value.trim();
  const forceUpdate = document.getElementById("vForceUpdate").checked;

  if (!currentVersion || !minVersion) { alert("لطفاً نسخه فعلی و حداقل نسخه مجاز را وارد کنید"); return; }
  if (!confirm("تنظیمات نسخه به‌روزرسانی شود؟")) return;

  const { error } = await adminSupabase.rpc("admin_set_app_version", {
    p_admin_id: localStorage.getItem("adminId"),
    p_current_version: currentVersion,
    p_min_supported_version: minVersion,
    p_update_message: message || null,
    p_force_update: forceUpdate
  });

  if (error) { alert("خطا: " + (error.message || JSON.stringify(error))); return; }
  alert("تنظیمات نسخه ذخیره شد");
  loadAdminVersionInfo();
}

document.addEventListener("DOMContentLoaded", () => { if (document.getElementById("adminVersionInfo")) loadAdminVersionInfo(); });
