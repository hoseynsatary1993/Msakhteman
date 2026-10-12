// =========================================================
// پچ v2 بخش آگهی — این کل بلوک جایگزین نسخه قبلی «app-listings-patch.js» می‌شود
// (یعنی اگه قبلی رو اضافه کرده بودی، اون بخش رو پاک کن و این رو جایگزینش کن)
// =========================================================

const LISTING_TYPE_LABELS = { rent: "رهن و اجاره", mortgage: "رهن کامل", sale: "فروش" };

// ================= صفحه عمومی لیست آگهی‌ها (بدون نیاز به ورود) =================
let currentListingFilter = "all";

async function loadPublicListings(filterType) {
  if (filterType) currentListingFilter = filterType;
  const feedEl = document.getElementById("listingsFeed");
  if (!feedEl) return;
  feedEl.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:20px 0;">در حال بارگذاری...</p>';

  let query = supabaseClient
    .from("listings")
    .select("id, listing_type, poster_type, deposit_amount, monthly_rent, sale_price, area, rooms, photos, property_title, city, created_at, buildings(name, city)")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (currentListingFilter !== "all") query = query.eq("listing_type", currentListingFilter);

  const { data, error } = await query;

  if (error) { feedEl.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:20px 0;">خطا در دریافت آگهی‌ها</p>'; return; }

  if (!data || data.length === 0) {
    feedEl.innerHTML = '<p style="text-align:center; color:var(--muted); font-size:12px; padding:30px 0;">آگهی‌ای یافت نشد</p>';
    return;
  }

  feedEl.innerHTML = "";
  data.forEach(l => feedEl.appendChild(renderListingCard(l)));
}

function setListingFilter(type, btnEl) {
  document.querySelectorAll(".listingFilterChip").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");
  loadPublicListings(type);
}

function listingPriceText(l) {
  if (l.listing_type === "sale") {
    return l.sale_price ? toPersianDigits(Number(l.sale_price).toLocaleString()) + " تومان" : "قیمت نامشخص";
  }
  if (l.listing_type === "mortgage") {
    return "رهن " + (l.deposit_amount ? toPersianDigits(Number(l.deposit_amount).toLocaleString()) : "—") + " تومان";
  }
  const deposit = l.deposit_amount ? toPersianDigits(Number(l.deposit_amount).toLocaleString()) : "۰";
  const rent = l.monthly_rent ? toPersianDigits(Number(l.monthly_rent).toLocaleString()) : "۰";
  return "رهن " + deposit + " / اجاره " + rent + " تومان";
}

function listingLocationText(l) {
  if (l.poster_type === "agent") {
    return (l.property_title ? l.property_title : "") + (l.city ? " — " + l.city : "");
  }
  return (l.buildings ? l.buildings.name : "") + (l.buildings && l.buildings.city ? " — " + l.buildings.city : "");
}

function renderListingCard(l) {
  const card = document.createElement("a");
  card.href = "listing-detail.html?id=" + l.id;
  card.style.cssText = "display:block; background:#fff; border:1px solid var(--line); border-radius:16px; overflow:hidden; margin-bottom:12px; text-decoration:none; color:inherit;";
  const photo = (l.photos && l.photos.length > 0) ? l.photos[0] : null;
  card.innerHTML = `
    ${photo ? `<img src="${photo}" style="width:100%; height:150px; object-fit:cover;">` : `<div style="width:100%; height:150px; background:var(--cream); display:flex; align-items:center; justify-content:center; color:var(--muted); font-size:12px;">بدون تصویر</div>`}
    <div style="padding:12px 14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <span style="font-size:11px; padding:3px 10px; border-radius:100px; background:var(--gold-soft); color:var(--navy); font-weight:600;">${LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}</span>
        ${l.poster_type === "agent" ? '<span style="font-size:10px; color:var(--muted);">مشاور املاک</span>' : ""}
      </div>
      <p style="font-size:14px; font-weight:700; margin:0 0 4px; color:var(--ink);">${listingPriceText(l)}</p>
      <p style="font-size:12px; color:var(--muted); margin:0;">${listingLocationText(l)} ${l.area ? "— " + toPersianDigits(l.area) + " متر" : ""} ${l.rooms ? "— " + toPersianDigits(l.rooms) + " خواب" : ""}</p>
    </div>
  `;
  return card;
}

// ================= صفحه جزئیات آگهی =================
async function loadListingDetail() {
  const container = document.getElementById("listingDetail");
  if (!container) return;
  const listingId = getQueryParam("id");
  if (!listingId) { container.innerHTML = "<p>آگهی یافت نشد</p>"; return; }

  const { data: l, error } = await supabaseClient
    .from("listings")
    .select("*, buildings(name, address, city), units(unit_number)")
    .eq("id", listingId)
    .single();

  if (error || !l) { container.innerHTML = "<p>آگهی یافت نشد یا حذف شده است</p>"; return; }

  const photosHtml = (l.photos && l.photos.length > 0)
    ? `<div style="display:flex; gap:8px; overflow-x:auto; margin-bottom:14px;">${l.photos.map(p => `<img src="${p}" style="width:140px; height:110px; object-fit:cover; border-radius:12px; flex-shrink:0;">`).join("")}</div>`
    : "";

  const locationLine = l.poster_type === "agent"
    ? (l.property_title || "") + (l.province || l.city ? " — " + [l.province, l.city].filter(Boolean).join("، ") : "")
    : (l.buildings ? l.buildings.name + " — " + (l.buildings.city || "") : "");

  const addressLine = l.poster_type === "agent" ? (l.address || "") : (l.buildings ? l.buildings.address || "" : "");

  container.innerHTML = `
    ${photosHtml}
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
      <span style="font-size:12px; padding:4px 12px; border-radius:100px; background:var(--gold-soft); color:var(--navy); font-weight:600;">${LISTING_TYPE_LABELS[l.listing_type] || l.listing_type}</span>
      ${l.poster_type === "agent" ? '<span style="font-size:11px; color:var(--muted);">ثبت‌شده توسط مشاور املاک</span>' : ""}
    </div>
    <h2 style="font-size:18px; margin:0 0 4px; color:var(--ink);">${listingPriceText(l)}</h2>
    <p style="color:var(--muted); font-size:12.5px; margin:0 0 4px;">${locationLine}</p>
    ${addressLine ? `<p style="color:var(--muted); font-size:11.5px; margin:0 0 14px;">${addressLine}</p>` : '<div style="margin-bottom:14px;"></div>'}
    <div style="display:flex; gap:14px; margin-bottom:14px;">
      ${l.area ? `<span style="color:var(--muted); font-size:12.5px;">متراژ: ${toPersianDigits(l.area)} متر</span>` : ""}
      ${l.rooms ? `<span style="color:var(--muted); font-size:12.5px;">اتاق: ${toPersianDigits(l.rooms)}</span>` : ""}
      ${l.floor ? `<span style="color:var(--muted); font-size:12.5px;">طبقه: ${toPersianDigits(l.floor)}</span>` : ""}
    </div>
    <p style="font-size:13.5px; line-height:1.9; color:var(--ink); margin-bottom:20px;">${l.description || "توضیحی ثبت نشده"}</p>
    ${l.contact_phone ? `<a href="tel:${l.contact_phone}" style="display:block; text-align:center; padding:14px; border-radius:12px; background:var(--navy); color:var(--gold); text-decoration:none; font-weight:600; font-size:13.5px;">تماس با آگهی‌دهنده</a>` : ""}
  `;
}

// ================= ثبت آگهی جدید =================
window.listingPhotos = [];
let selectedListingType = "rent";
let selectedPosterType = "resident";

function selectPosterType(type, btnEl) {
  selectedPosterType = type;
  document.querySelectorAll(".posterTypeBtn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  document.getElementById("residentFields").style.display = (type === "resident") ? "block" : "none";
  document.getElementById("agentFields").style.display = (type === "agent") ? "block" : "none";
}

async function loadMyPostableUnits() {
  const selectEl = document.getElementById("listingUnitSelect");
  if (!selectEl) return;
  const currentUserId = localStorage.getItem("currentUserId");

  const { data, error } = await supabaseClient
    .from("user_building_roles")
    .select("role, building_id, unit_id, buildings(name), units(unit_number)")
    .eq("user_id", currentUserId)
    .in("role", ["owner", "manager"])
    .eq("status", "active");

  if (error || !data || data.length === 0) {
    selectEl.innerHTML = '<option value="">هیچ واحد/ساختمانی یافت نشد</option>';
    return;
  }

  selectEl.innerHTML = data.map(r => {
    const label = (r.buildings ? r.buildings.name : "") + (r.units ? " — واحد " + r.units.unit_number : " (کل ساختمان)");
    return `<option value="${r.building_id}|${r.unit_id || ""}">${label}</option>`;
  }).join("");
}

function selectListingType(type, btnEl) {
  selectedListingType = type;
  document.querySelectorAll(".listingTypeBtn").forEach(b => b.classList.remove("active"));
  if (btnEl) btnEl.classList.add("active");

  document.getElementById("depositField").style.display = (type === "rent" || type === "mortgage") ? "block" : "none";
  document.getElementById("monthlyRentField").style.display = (type === "rent") ? "block" : "none";
  document.getElementById("salePriceField").style.display = (type === "sale") ? "block" : "none";
}

async function addListingPhoto(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const url = await uploadFile(file, "listings");
  if (!url) { alert("خطا در آپلود عکس"); return; }

  window.listingPhotos.push(url);
  const previewEl = document.getElementById("listingPhotoPreview");
  const img = document.createElement("img");
  img.src = url;
  img.style.cssText = "width:70px; height:70px; object-fit:cover; border-radius:10px;";
  previewEl.appendChild(img);
  inputEl.value = "";
}

async function submitListingForm() {
  const area = document.getElementById("listingArea").value;
  const rooms = document.getElementById("listingRooms").value;
  const floor = document.getElementById("listingFloor").value;
  const description = document.getElementById("listingDescription").value.trim();
  const contactPhone = document.getElementById("listingContactPhone").value.trim();

  if (!contactPhone) { alert("لطفاً شماره تماس را وارد کنید"); return; }

  const payload = {
    posted_by: localStorage.getItem("currentUserId"),
    poster_type: selectedPosterType,
    listing_type: selectedListingType,
    area: area ? parseFloat(area) : null,
    rooms: rooms ? parseInt(rooms) : null,
    floor: floor ? parseInt(floor) : null,
    description: description || null,
    contact_phone: contactPhone,
    photos: window.listingPhotos
  };

  if (selectedPosterType === "resident") {
    const combo = document.getElementById("listingUnitSelect").value;
    if (!combo) { alert("لطفاً واحد یا ساختمان را انتخاب کنید"); return; }
    const [buildingId, unitId] = combo.split("|");
    payload.building_id = buildingId;
    payload.unit_id = unitId || null;
  } else {
    const propertyTitle = document.getElementById("listingPropertyTitle").value.trim();
    const province = document.getElementById("listingProvince").value;
    const city = document.getElementById("listingCity").value;
    const address = document.getElementById("listingAddress").value.trim();

    if (!propertyTitle || !address) { alert("لطفاً عنوان ملک و آدرس را وارد کنید"); return; }

    payload.property_title = propertyTitle;
    payload.province = province;
    payload.city = city;
    payload.address = address;
  }

  if (selectedListingType === "rent") {
    payload.deposit_amount = getRawAmount(document.getElementById("listingDeposit").value) || 0;
    payload.monthly_rent = getRawAmount(document.getElementById("listingMonthlyRent").value) || 0;
  } else if (selectedListingType === "mortgage") {
    payload.deposit_amount = getRawAmount(document.getElementById("listingDeposit").value) || 0;
  } else if (selectedListingType === "sale") {
    payload.sale_price = getRawAmount(document.getElementById("listingSalePrice").value) || 0;
  }

  const { error } = await supabaseClient.from("listings").insert([payload]);

  if (error) { alert("خطا در ثبت آگهی: " + (error.message || JSON.stringify(error))); return; }
  alert("آگهی با موفقیت ثبت شد");
  window.location.href = "listings.html";
}
