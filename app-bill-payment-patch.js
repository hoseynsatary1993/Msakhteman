// =========================================================
// پرداخت قبض (مشترک ساختمان / شخصی هر واحد) — assets/app-bill-payment-patch.js
// این فایل جدا نگه‌داشته شده؛ تو bill-payment.html بعد از app.js لودش کن:
//   <script src="assets/app-bill-payment-patch.js"></script>
//
// *** نکته مهم ***
// تابع callBillGatewayInquiry و callBillGatewayPayment پایین صفحه
// فعلاً با داده تستی کار می‌کنن (مثل کد OTP ثابت ۱۲۳۴۵ که قبلاً گذاشتیم)،
// چون هنوز درگاه پرداخت واقعی انتخاب/وصل نشده.
// وقتی درگاه (مثلاً زیبال/آیدی‌پی) رو وصل کردیم، فقط همین دو تابع
// باید با فراخوانی API واقعی جایگزین بشن؛ بقیه صفحه دست‌نخورده می‌مونه.
// =========================================================

let currentBillScope = "shared";
let lastInquiryResult = null; // { billId, payId, billType, amount, unitId }

function selectBillScope(scope) {
  currentBillScope = scope;
  document.getElementById("scopeSharedBtn").classList.toggle("active", scope === "shared");
  document.getElementById("scopePersonalBtn").classList.toggle("active", scope === "personal");
  document.getElementById("billUnitSelectWrap").style.display = (scope === "personal") ? "block" : "none";
  document.getElementById("inquiryResult").style.display = "none";
  lastInquiryResult = null;

  if (scope === "personal") loadMyUnitsForBillSelect();
  loadBillHistory();
}

// واحدهایی که کاربر فعلی توشون مالک یا مستأجر فعاله (برای حالت «قبض شخصی»)
async function loadMyUnitsForBillSelect() {
  const selectEl = document.getElementById("billUnitSelect");
  if (!selectEl) return;
  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");

  const { data, error } = await supabaseClient
    .from("user_building_roles")
    .select("unit_id, role, units(unit_number)")
    .eq("user_id", currentUserId)
    .eq("building_id", buildingId)
    .in("role", ["owner", "tenant"])
    .eq("status", "active");

  if (error || !data || data.length === 0) {
    selectEl.innerHTML = '<option value="">واحدی یافت نشد</option>';
    return;
  }
  selectEl.innerHTML = data.map(r =>
    `<option value="${r.unit_id}">واحد ${r.units ? r.units.unit_number : "—"}</option>`
  ).join("");
}

// ----- استعلام قبض -----
async function handleBillInquiry() {
  const billId = document.getElementById("billIdInput").value.trim();
  const payId = document.getElementById("payIdInput").value.trim();
  if (!billId || !payId) { alert("شناسه قبض و شناسه پرداخت را وارد کنید"); return; }

  const btn = document.getElementById("inquiryBtn");
  btn.disabled = true; btn.textContent = "در حال استعلام...";

  try {
    const result = await callBillGatewayInquiry(billId, payId);
    lastInquiryResult = {
      billId, payId,
      billType: result.billType,
      amount: result.amount,
      unitId: currentBillScope === "personal" ? document.getElementById("billUnitSelect").value : null
    };

    document.getElementById("resultBillType").textContent = result.billType;
    document.getElementById("resultBillAmount").textContent = toPersianDigits(result.amount.toLocaleString()) + " تومان";
    document.getElementById("inquiryResult").style.display = "block";
  } catch (e) {
    alert("خطا در استعلام قبض: " + (e.message || "شناسه قبض یا پرداخت نامعتبر است"));
  } finally {
    btn.disabled = false; btn.textContent = "استعلام قبض";
  }
}

// ----- پرداخت قبض (بعد از استعلام موفق) -----
async function handleBillPayment() {
  if (!lastInquiryResult) return;
  if (currentBillScope === "personal" && !lastInquiryResult.unitId) {
    alert("لطفاً واحد را انتخاب کنید"); return;
  }
  if (!confirm("پرداخت " + toPersianDigits(lastInquiryResult.amount.toLocaleString()) + " تومان بابت " + lastInquiryResult.billType + " انجام شود؟")) return;

  const payBtn = document.getElementById("payBtn");
  payBtn.disabled = true; payBtn.textContent = "در حال پرداخت...";

  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");

  try {
    // مرحله ۱: ثبت استعلام در دیتابیس (مبلغ و نوع قبض قفل می‌شه)
    const { data: billPaymentId, error: inquiryErr } = await supabaseClient.rpc("submit_bill_inquiry", {
      p_user_id: currentUserId,
      p_building_id: buildingId,
      p_unit_id: lastInquiryResult.unitId,
      p_scope: currentBillScope,
      p_bill_id: lastInquiryResult.billId,
      p_payment_id: lastInquiryResult.payId,
      p_bill_type: lastInquiryResult.billType,
      p_amount: lastInquiryResult.amount
    });
    if (inquiryErr) throw inquiryErr;

    // مرحله ۲: پرداخت واقعی از طریق درگاه (فعلاً تستی)
    const gatewayResult = await callBillGatewayPayment(lastInquiryResult.billId, lastInquiryResult.payId, lastInquiryResult.amount);

    // مرحله ۳: تایید نهایی در دیتابیس
    const { error: confirmErr } = await supabaseClient.rpc("confirm_bill_payment", {
      p_bill_payment_id: billPaymentId,
      p_user_id: currentUserId,
      p_gateway_ref: gatewayResult.ref
    });
    if (confirmErr) throw confirmErr;

    alert("قبض با موفقیت پرداخت شد");
    document.getElementById("billIdInput").value = "";
    document.getElementById("payIdInput").value = "";
    document.getElementById("inquiryResult").style.display = "none";
    lastInquiryResult = null;
    loadBillHistory();
  } catch (e) {
    alert("خطا در پرداخت: " + (e.message || "لطفاً دوباره تلاش کنید"));
  } finally {
    payBtn.disabled = false; payBtn.textContent = "پرداخت قبض";
  }
}

// ----- تاریخچه قبوض -----
async function loadBillHistory() {
  const listEl = document.getElementById("billHistoryList");
  if (!listEl) return;
  listEl.innerHTML = '<p class="empty">در حال بارگذاری...</p>';

  const currentUserId = localStorage.getItem("currentUserId");
  const buildingId = localStorage.getItem("activeBuildingId");
  const unitId = (currentBillScope === "personal") ? document.getElementById("billUnitSelect").value : null;

  if (currentBillScope === "personal" && !unitId) {
    listEl.innerHTML = '<p class="empty">ابتدا واحد را انتخاب کنید</p>';
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_bill_payments_history", {
    p_user_id: currentUserId,
    p_building_id: buildingId,
    p_unit_id: unitId
  });

  if (error || !data || data.length === 0) {
    listEl.innerHTML = '<p class="empty">هنوز قبضی ثبت نشده</p>';
    return;
  }

  const statusLabels = { paid: "پرداخت‌شده", pending: "در انتظار", inquired: "در انتظار", failed: "ناموفق" };

  listEl.innerHTML = data.map(b => `
    <div class="hist-item">
      <span>${b.bill_type || "قبض"} — ${toPersianDigits((b.amount || 0).toLocaleString())} تومان</span>
      <span class="hist-badge st-${b.status}">${statusLabels[b.status] || b.status}</span>
    </div>
  `).join("");
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("billHistoryList")) loadBillHistory();
});

// =========================================================
// *** بخش تستی — بعداً با درگاه واقعی جایگزین می‌شه ***
// =========================================================
async function callBillGatewayInquiry(billId, payId) {
  // TODO: اینجا رو با فراخوانی واقعی API درگاه (مثلاً زیبال) عوض کن.
  // فعلاً یک پاسخ تستی برمی‌گردونه تا بقیه صفحه قابل تست باشه.
  await new Promise(r => setTimeout(r, 600));
  return { billType: "قبض آب (تستی)", amount: 450000 };
}

async function callBillGatewayPayment(billId, payId, amount) {
  // TODO: اینجا رو با فراخوانی واقعی پرداخت درگاه عوض کن.
  await new Promise(r => setTimeout(r, 800));
  return { ref: "TEST-" + Date.now() };
}