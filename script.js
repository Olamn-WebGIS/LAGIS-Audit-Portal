const agentLoginBtn = document.getElementById('agentLoginBtn');
const adminLoginBtn = document.getElementById('adminLoginBtn');
const agentModal = document.getElementById('agentModal');
const adminModal = document.getElementById('adminModal');
const closeButtons = document.querySelectorAll('[data-close]');

const configPromise = fetch('/config.json')
  .then(async (response) => {
    if (response.ok) return response.json();
    const apiResponse = await fetch('/api/config');
    return apiResponse.ok ? apiResponse.json() : {};
  })
  .catch(async () => {
    try {
      const apiResponse = await fetch('/api/config');
      return apiResponse.ok ? apiResponse.json() : {};
    } catch {
      return {};
    }
  });

function getEnvValue(key) {
  return configPromise.then((config) => config[key] || '');
}

function openModal(modal) {
  if (!modal) return;
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

if (agentLoginBtn) {
  agentLoginBtn.addEventListener('click', () => openModal(agentModal));
}

if (adminLoginBtn) {
  adminLoginBtn.addEventListener('click', () => openModal(adminModal));
}

closeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const modal = button.closest('.login-modal');
    closeModal(modal);
  });
});

[agentModal, adminModal].forEach((modal) => {
  if (!modal) return;
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeModal(modal);
    }
  });
});

const agentNameDisplay = document.getElementById('agentNameDisplay');
const agentNameHeading = document.getElementById('agentNameHeading');
const logoutBtn = document.getElementById('logoutBtn');
const networkStatus = document.getElementById('networkStatus');

function setNetworkStatus() {
  if (!networkStatus) return;
  if (navigator.onLine) {
    networkStatus.textContent = 'Status: Online';
    networkStatus.classList.remove('offline');
  } else {
    networkStatus.textContent = 'Status: Offline';
    networkStatus.classList.add('offline');
  }
}

if (networkStatus) {
  window.addEventListener('online', setNetworkStatus);
  window.addEventListener('offline', setNetworkStatus);
  setNetworkStatus();
}

if (agentNameDisplay || agentNameHeading) {
  const storedName = localStorage.getItem('agentName') || 'Agent';
  if (agentNameDisplay) agentNameDisplay.textContent = storedName;
  if (agentNameHeading) agentNameHeading.textContent = storedName;
}

if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('agentName');
    window.location.href = 'index.html';
  });
}

const forms = document.querySelectorAll('.login-form');
forms.forEach((form) => {
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const modal = form.closest('.login-modal');
    closeModal(modal);
    if (form.id === 'agentForm') {
      const username = document.getElementById('agentUsername')?.value.trim() || 'Agent';
      localStorage.setItem('agentName', username);
      window.location.href = 'agent.html';
    } else if (form.id === 'adminForm') {
      const username = document.getElementById('adminUsername')?.value.trim() || 'Admin';
      localStorage.setItem('adminName', username);
      window.location.href = 'admin.html';
    }
  });
});

const addFacilityBtn = document.getElementById('addFacilityBtn');
const downloadBtn = document.getElementById('downloadBtn');
const syncCloudFab = document.getElementById('syncCloudFab');
const syncStatusText = document.getElementById('syncStatusText');
const downloadModal = document.getElementById('downloadModal');
const downloadCloseBtn = document.getElementById('downloadCloseBtn');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const exportJsonBtn = document.getElementById('exportJsonBtn');
const syncCloudBtn = document.getElementById('syncCloudBtn');
const downloadCloudBtn = document.getElementById('downloadCloudBtn');
const facilityModal = document.getElementById('facilityModal');
const facilityCloseBtn = document.getElementById('facilityCloseBtn');
const facilityForm = document.getElementById('facilityForm');
const getGpsBtn = document.getElementById('getGpsBtn');
const facilityGps = document.getElementById('facilityGps');
const facilityPhoto = document.getElementById('facilityPhoto');
const filterTypeSelect = document.getElementById('filterType');
const filterLgaSelect = document.getElementById('filterLga');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const savedFacilitiesTableBody = document.querySelector('#savedFacilitiesTable tbody');
const savedFacilitiesEmpty = document.getElementById('savedFacilitiesEmpty');
const recordCount = document.getElementById('recordCount');
const prevPageBtn = document.getElementById('prevPageBtn');
const nextPageBtn = document.getElementById('nextPageBtn');
const pageLabel = document.getElementById('pageLabel');
const paginationControls = document.getElementById('paginationControls');

const savedFacilitiesKey = 'lagis_facilities';
const lastSyncKey = 'lagis_last_sync';
const itemsPerPage = 20;
let agentMap = null;
let facilityMarkers = {};
let allFacilities = [];
let currentPage = 1;

function getFormattedDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addFacilityMarker(map, facility) {
  if (!map || !facility.gps) return null;
  const [lat, lng] = facility.gps.split(',').map((value) => parseFloat(value.trim()));
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const marker = L.marker([lat, lng]).addTo(map);
  const formattedDate = new Date(facility.createdAt).toLocaleString();
  const photoHtml = facility.photo
    ? `<img src="${facility.photo}" width="120"><br>`
    : '';

  const popupContent = `
    <b>${facility.name}</b><br>
    Type: ${facility.type}<br>
    LGA: ${facility.lga}<br>
    ${photoHtml}
    Timestamp: ${formattedDate}
  `;
  marker.bindPopup(popupContent);
  facilityMarkers[facility.id] = marker;
  return marker;
}

function clearMarkers() {
  Object.values(facilityMarkers).forEach((marker) => {
    try {
      if (marker && marker.remove) {
        marker.remove();
      }
    } catch (error) {
      console.warn('Failed to remove marker', error);
    }
  });
  facilityMarkers = {};
}

function loadSavedFacilityMarkers(map) {
  facilityMarkers = {};
  const savedFacilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
  let list = Array.isArray(savedFacilities) ? savedFacilities : [];
  // If on agent page, show only facilities added by the logged-in agent
  if (document.body.classList.contains('agent-page')) {
    const agentName = localStorage.getItem('agentName') || '';
    list = list.filter((f) => (f.addedBy || '') === agentName);
  }
  allFacilities = list;
  allFacilities.forEach((facility) => addFacilityMarker(map, facility));
  populateFilterOptions(allFacilities);
  updateFacilitiesView();
}

const fixedTypes = [
  'Primary School',
  'Primary Health Centre',
  'Market',
  'Police Post',
  'Motor Park',
];

const fixedLgas = [
  'Agege',
  'Ajeromi-Ifelodun',
  'Alimosho',
  'Amuwo-Odofin',
  'Apapa',
  'Badagry',
  'Epe',
  'Eti-Osa',
  'Ibeju-Lekki',
  'Ifako-Ijaiye',
  'Ikeja',
  'Ikorodu',
  'Kosofe',
  'Lagos Island',
  'Lagos Mainland',
  'Mushin',
  'Ojo',
  'Oshodi-Isolo',
  'Shomolu',
  'Surulere',
];

function populateFilterOptions(facilities) {
  if (!filterTypeSelect || !filterLgaSelect) return;

  const selectedType = filterTypeSelect.value;
  const selectedLga = filterLgaSelect.value;

  filterTypeSelect.innerHTML = `<option value="">All Types</option>${fixedTypes
    .map((type) => `<option value="${type}">${type}</option>`)
    .join('')}`;
  filterLgaSelect.innerHTML = `<option value="">All LGAs</option>${fixedLgas
    .map((lga) => `<option value="${lga}">${lga}</option>`)
    .join('')}`;

  if (selectedType && fixedTypes.includes(selectedType)) {
    filterTypeSelect.value = selectedType;
  }
  if (selectedLga && fixedLgas.includes(selectedLga)) {
    filterLgaSelect.value = selectedLga;
  }
}

function getFilteredFacilities() {
  if (!Array.isArray(allFacilities)) return [];
  return allFacilities.filter((facility) => {
    const matchesType = !filterTypeSelect?.value || facility.type === filterTypeSelect.value;
    const matchesLga = !filterLgaSelect?.value || facility.lga === filterLgaSelect.value;
    return matchesType && matchesLga;
  });
}

function renderTable(data) {
  if (!savedFacilitiesTableBody || !savedFacilitiesEmpty) return;
  savedFacilitiesTableBody.innerHTML = '';

  if (!Array.isArray(data) || data.length === 0) {
    savedFacilitiesEmpty.style.display = 'block';
    return;
  }

  savedFacilitiesEmpty.style.display = 'none';
  const offset = (currentPage - 1) * itemsPerPage;

  data.forEach((facility, index) => {
    const row = document.createElement('tr');
    const isAgentView = document.body.classList.contains('agent-page');
    row.innerHTML = `
      <td>${offset + index + 1}</td>
      <td>${facility.name}</td>
      <td>${facility.type}</td>
      <td>${facility.lga}</td>
      <td>${facility.gps || ''}</td>
      <td>
        <button type="button" class="action-button view-on-map" data-id="${facility.id}">
          View
        </button>
        <button type="button" class="action-button delete" data-id="${facility.id}">Delete</button>
      </td>
    `;
    savedFacilitiesTableBody.appendChild(row);
  });
}

function getTotalPages(facilities) {
  return Math.max(1, Math.ceil((Array.isArray(facilities) ? facilities.length : 0) / itemsPerPage));
}

function updatePaginationControls(facilities) {
  if (!paginationControls || !prevPageBtn || !nextPageBtn || !pageLabel || !recordCount) return;

  const totalPages = getTotalPages(facilities);
  currentPage = Math.min(Math.max(currentPage, 1), totalPages);

  paginationControls.style.display = 'flex';
  pageLabel.textContent = `Page ${currentPage} of ${totalPages}`;
  recordCount.textContent = `${facilities.length} facilities`;
  prevPageBtn.disabled = currentPage <= 1;
  nextPageBtn.disabled = currentPage >= totalPages;
}

function filterFacilities() {
  currentPage = 1;
  const filteredData = getFilteredFacilities();
  renderSavedFacilitiesTable(filteredData);
}

function updateFacilitiesView() {
  filterFacilities();
}

function renderSavedFacilitiesTable(facilities) {
  if (!savedFacilitiesTableBody || !savedFacilitiesEmpty) return;
  if (!Array.isArray(facilities) || facilities.length === 0) {
    renderTable([]);
    updatePaginationControls(facilities);
    return;
  }

  currentPage = Math.min(Math.max(currentPage, 1), getTotalPages(facilities));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const pagedFacilities = facilities.slice(startIndex, startIndex + itemsPerPage);

  renderTable(pagedFacilities);
  updatePaginationControls(facilities);
}

function clearFilters() {
  if (filterTypeSelect) filterTypeSelect.value = '';
  if (filterLgaSelect) filterLgaSelect.value = '';
  updateFacilitiesView();
}

function openFacilityModal() {
  facilityModal?.classList.add('active');
  facilityModal?.setAttribute('aria-hidden', 'false');
}

function closeFacilityModal() {
  facilityModal?.classList.remove('active');
  facilityModal?.setAttribute('aria-hidden', 'true');
  facilityForm?.reset();
  if (facilityGps) facilityGps.value = '';
}

if (addFacilityBtn) {
  addFacilityBtn.addEventListener('click', openFacilityModal);
}

if (facilityCloseBtn) {
  facilityCloseBtn.addEventListener('click', closeFacilityModal);
}

facilityModal?.addEventListener('click', (event) => {
  if (event.target === facilityModal) {
    closeFacilityModal();
  }
});

downloadModal?.addEventListener('click', (event) => {
  if (event.target === downloadModal) {
    closeDownloadModal();
  }
});

if (downloadBtn) {
  downloadBtn.addEventListener('click', () => {
    const facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
    if (!Array.isArray(facilities) || facilities.length === 0) {
      alert('No data to export');
      return;
    }
    openDownloadModal();
  });
}

if (downloadCloseBtn) {
  downloadCloseBtn.addEventListener('click', closeDownloadModal);
}

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => exportFacilities('csv'));
}

if (exportJsonBtn) {
  exportJsonBtn.addEventListener('click', () => exportFacilities('json'));
}

if (syncCloudBtn) {
  syncCloudBtn.addEventListener('click', () => {
    syncToCloud();
  });
}

if (downloadCloudBtn) {
  downloadCloudBtn.addEventListener('click', () => {
    downloadFromCloud();
  });
}

if (syncCloudFab) {
  syncCloudFab.addEventListener('click', () => {
    syncToCloud();
  });
}

function setSyncStatus(timestamp) {
  if (!syncStatusText) return;
  syncStatusText.textContent = timestamp ? `Last Synced: ${timestamp}` : 'Last Synced: never';
}

function setSyncLoading(button, spinner, loading) {
  if (!button || !spinner) return;
  if (loading) {
    button.disabled = true;
    spinner.classList.remove('hidden');
    button.style.opacity = '0.8';
  } else {
    button.disabled = false;
    spinner.classList.add('hidden');
    button.style.opacity = '';
  }
}

function openDownloadModal() {
  downloadModal?.classList.add('active');
  downloadModal?.setAttribute('aria-hidden', 'false');
}

function closeDownloadModal() {
  downloadModal?.classList.remove('active');
  downloadModal?.setAttribute('aria-hidden', 'true');
}

function formatCsv(facilities) {
  const headers = ['id', 'createdAt', 'type', 'name', 'lga', 'addedBy', 'address', 'gps'];
  const rows = facilities.map((facility) => {
    return headers
      .map((key) => {
        const value = facility[key] ?? '';
        const safeValue = String(value).replace(/"/g, '""');
        return `"${safeValue}"`;
      })
      .join(',');
  });
  return [headers.join(','), ...rows].join('\n');
}

function getExportData(facilities) {
  return facilities.map(({ photo, photoLocalData, photoPublicId, ...rest }) => rest);
}

function dataURLToBlob(dataURL) {
  const parts = dataURL.split(',');
  const meta = parts[0].match(/:(.*?);/);
  const mime = meta ? meta[1] : 'image/jpeg';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

async function uploadDataUrlToCloudinary(dataUrl) {
  const blob = dataURLToBlob(dataUrl);
  const file = new File([blob], `offline-${Date.now()}.jpg`, { type: blob.type });
  return uploadToCloudinary(file);
}

async function uploadOfflinePhoto(facility) {
  if (!facility || !facility.photoLocalData || facility.photoPublicId) {
    return null;
  }
  try {
    const uploaded = await uploadDataUrlToCloudinary(facility.photoLocalData);
    return uploaded;
  } catch (err) {
    console.warn('Offline photo upload failed:', err);
    return null;
  }
}

function getCloudUrl() {
  return getEnvValue('SHEETDB_URL');
}

function setSyncStatus(timestamp) {
  const syncStatusTextEl = document.getElementById('syncStatusText') || document.getElementById('syncStatusTextFac');
  if (!syncStatusTextEl) return;
  syncStatusTextEl.textContent = timestamp ? `Last Synced: ${timestamp}` : 'Last Synced: never';
}

function getLastSync() {
  return localStorage.getItem(lastSyncKey) || '';
}

function setLastSync(timestamp) {
  localStorage.setItem(lastSyncKey, timestamp);
  setSyncStatus(timestamp);
}

function initializeSyncStatus() {
  const timestamp = getLastSync();
  setSyncStatus(timestamp);
}

async function getCloudinaryConfig() {
  const cloudName = await getEnvValue('CLOUD_NAME');
  const uploadPreset = await getEnvValue('UPLOAD_PRESET');
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary configuration is not set.');
  }
  return { cloudName, uploadPreset };
}

async function uploadToCloudinary(file) {
  const { cloudName, uploadPreset } = await getCloudinaryConfig();
  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Image upload failed');
  }

  const data = await response.json();
  if (!data.secure_url || !data.public_id) {
    throw new Error('Image upload did not return required metadata');
  }

  return {
    url: data.secure_url,
    publicId: data.public_id,
  };
}

async function fetchCloudFacilities() {
  const url = await getCloudUrl();
  if (!url) {
    throw new Error('Cloud URL is not configured.');
  }

  const response = await fetch(url);
  if (!response.ok) throw new Error('Cloud fetch failed');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Unexpected cloud data');

  return data.map((item) => ({
    id: String(item.id || ''),
    createdAt: item.timestamp || item.createdAt || new Date().toISOString(),
    type: item.facilityType || item.type || '',
    name: item.facilityName || item.name || '',
    lga: item.lga || '',
    address: item.address || '',
    gps: item.gps || '',
    photo: item.photo || '',
    photoPublicId: item.photoPublicId || item.photo_public_id || '',
    addedBy: item.AddedBy || item.addedBy || '',
    synced: item.synced === true || item.synced === 'true',
  }));
}

async function getPendingFacilities() {
  const facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
  return (Array.isArray(facilities) ? facilities : []).filter((facility) => !facility.synced);
}

async function syncToCloud() {
  const url = await getCloudUrl();
  if (!url) {
    alert('Cloud URL is not configured.');
    return;
  }

  const syncButton = syncCloudBtn || syncCloudFab;
  const syncSpinner = document.getElementById('syncSpinnerAdmin') || document.querySelector('.sync-spinner');
  setSyncLoading(syncButton, syncSpinner, true);

  const facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
  if (!Array.isArray(facilities) || !facilities.length) {
    setSyncLoading(syncButton, syncSpinner, false);
    alert('No facilities to sync.');
    return;
  }

  try {
    const remoteFacilities = await fetchCloudFacilities();
    const remoteIds = new Set(remoteFacilities.map((facility) => String(facility.id)));

    const deletedRemoteFacilities = facilities.filter((facility) => {
      const facilityId = String(facility.id || '');
      return facilityId && facility.synced && !remoteIds.has(facilityId);
    });

    if (deletedRemoteFacilities.length) {
      facilities = facilities.filter((facility) => {
        const facilityId = String(facility.id || '');
        return !(facilityId && facility.synced && !remoteIds.has(facilityId));
      });
      localStorage.setItem(savedFacilitiesKey, JSON.stringify(facilities));
      allFacilities = facilities;
      if (document.body.classList.contains('agent-page') && agentMap) {
        clearMarkers();
        facilities.forEach((facility) => addFacilityMarker(agentMap, facility));
      }
    }

    const unsyncedFacilities = facilities.filter((facility) => {
      const facilityId = String(facility.id || '');
      return !remoteIds.has(facilityId) && !facility.synced;
    });

    if (!unsyncedFacilities.length) {
      setSyncLoading(syncButton, syncSpinner, false);
      alert('All facilities are already synced to cloud.');
      return;
    }

    for (const facility of unsyncedFacilities) {
      const facilityId = String(facility.id || '');
      if (!facilityId) {
        continue;
      }

      if (remoteIds.has(facilityId)) {
        const index = facilities.findIndex((item) => String(item.id) === facilityId);
        if (index !== -1) {
          facilities[index] = { ...facilities[index], synced: true };
        }
        continue;
      }

      let photoUrl = facility.photo || '';
      let photoPublicId = facility.photoPublicId || '';
      if (facility.photoLocalData && !photoPublicId) {
        const uploaded = await uploadOfflinePhoto(facility);
        if (uploaded) {
          photoUrl = uploaded.url;
          photoPublicId = uploaded.publicId;
        }
      }

      if (!photoUrl) {
        console.warn('Skipping facility sync because photo is not available yet:', facilityId);
        continue;
      }

      const payload = {
        id: facility.id,
        timestamp: facility.createdAt,
        facilityType: facility.type,
        facilityName: facility.name,
        lga: facility.lga,
        address: facility.address,
        gps: facility.gps,
        photo: photoUrl,
        photoPublicId,
        AddedBy: facility.addedBy || '',
        synced: true,
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [payload] }),
      });

      if (!response.ok) {
        throw new Error('Sync failed for facility ' + facility.id);
      }

      const index = facilities.findIndex((item) => String(item.id) === facilityId);
      if (index !== -1) {
        facilities[index] = {
          ...facilities[index],
          photo: photoUrl,
          photoPublicId,
          photoLocalData: facilities[index].photoLocalData && photoPublicId ? null : facilities[index].photoLocalData,
          synced: true,
        };
      }
    }

    localStorage.setItem(savedFacilitiesKey, JSON.stringify(facilities));
    const nowText = new Date().toLocaleString();
    setLastSync(nowText);
    setSyncLoading(syncButton, syncSpinner, false);
    alert('New facilities synced to cloud successfully.');
  } catch (err) {
    setSyncLoading(syncButton, syncSpinner, false);
    alert('Sync failed. Check internet');
    console.error(err);
  }
}

async function downloadFromCloud() {
  const url = await getCloudUrl();
  if (!url) {
    alert('Cloud URL is not configured.');
    return;
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      const message = await response.text().catch(() => 'No response body');
      throw new Error(`Download failed: ${response.status} ${response.statusText} - ${message}`);
    }

    let data = await response.json();
    if (!Array.isArray(data)) {
      if (data && Array.isArray(data.data)) {
        data = data.data;
      } else {
        throw new Error('Unexpected cloud data format');
      }
    }

    const remoteFacilities = data.map((item) => ({
      id: String(item.id || ''),
      createdAt: item.timestamp || item.createdAt || new Date().toISOString(),
      type: item.facilityType || item.type || '',
      name: item.facilityName || item.name || '',
      lga: item.lga || '',
      address: item.address || '',
      gps: item.gps || '',
      photo: item.photo || '',
      photoPublicId: item.photoPublicId || item.photo_public_id || '',
      addedBy: item.AddedBy || item.addedBy || '',
      synced: item.synced === true || item.synced === 'true',
    }));

    const localFacilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
    const localIds = new Set((Array.isArray(localFacilities) ? localFacilities : []).map((facility) => String(facility.id)));
    const mergedFacilities = [...(Array.isArray(localFacilities) ? localFacilities : [])];
    let addedCount = 0;

    remoteFacilities.forEach((remote) => {
      if (!remote.id) return;
      const existingIndex = mergedFacilities.findIndex((facility) => String(facility.id) === String(remote.id));
      if (existingIndex === -1) {
        mergedFacilities.push(remote);
        localIds.add(remote.id);
        addedCount += 1;
        return;
      }

      const existing = mergedFacilities[existingIndex];
      mergedFacilities[existingIndex] = {
        ...existing,
        ...remote,
        photo: remote.photo || existing.photo,
        photoPublicId: existing.photoPublicId || remote.photoPublicId || '',
        addedBy: existing.addedBy || remote.addedBy || '',
        synced: existing.synced || remote.synced,
      };
    });

    if (!addedCount) {
      alert('No new facilities were found in the cloud.');
      return;
    }

    localStorage.setItem(savedFacilitiesKey, JSON.stringify(mergedFacilities));
    allFacilities = mergedFacilities;
    console.log('Downloaded facilities', mergedFacilities);
    alert(`${addedCount} new facilities downloaded from cloud successfully.`);
    window.location.reload();
  } catch (err) {
    alert('Download from cloud failed. Please try again.');
    console.error(err);
  }
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function exportFacilities(format) {
  let facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
  if (!Array.isArray(facilities) || facilities.length === 0) {
    alert('No data to export');
    return;
  }
  // If agent is exporting, limit to their own records
  if (document.body.classList.contains('agent-page')) {
    const agentName = localStorage.getItem('agentName') || '';
    facilities = facilities.filter((f) => (f.addedBy || '') === agentName);
    if (!facilities.length) { alert('No data to export'); return; }
  }

  const exportData = getExportData(facilities);
  if (format === 'csv') {
    const csv = formatCsv(exportData);
    downloadFile('lagis_facilities.csv', csv, 'text/csv;charset=utf-8;');
  } else {
    const json = JSON.stringify(exportData, null, 2);
    const filename = `lagis_export_${getFormattedDate()}.json`;
    downloadFile(filename, json, 'application/json;charset=utf-8;');
  }
  closeDownloadModal();
}

function zoomToFacility(facilityId) {
  const marker = facilityMarkers[facilityId];
  if (!marker || !agentMap) return;
  const mapElement = document.getElementById('lagosMap');
  if (mapElement) {
    mapElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  agentMap.setView(marker.getLatLng(), 15, { animate: true });
  marker.openPopup();
}

async function deleteFacility(facilityId) {
  const facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
  const facilityRecord = facilities.find((f) => f.id === facilityId);
  if (!facilityRecord) return;
  // If agent, only allow deleting their own records
  if (document.body.classList.contains('agent-page')) {
    const agentName = localStorage.getItem('agentName') || '';
    if ((facilityRecord.addedBy || '') !== agentName) {
      alert('You can only delete facilities you added.');
      return;
    }
  }
  if (!confirm('Are you sure you want to delete this facility?')) return;

  if (facilityRecord.photoPublicId) {
    try {
      const deleteResponse = await fetch('/api/delete-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_id: facilityRecord.photoPublicId }),
      });
      const result = await deleteResponse.json();
      if (!deleteResponse.ok || !result.success) {
        console.error('Cloudinary delete failed:', result);
      }
    } catch (err) {
      console.error('Cloudinary delete error:', err);
    }
  }

  const url = await getCloudUrl();
  if (url) {
    try {
      const deleteResponse = await fetch(`${url}/id/${encodeURIComponent(facilityId)}`, {
        method: 'DELETE',
      });
      if (!deleteResponse.ok) {
        console.warn('SheetDB delete failed for', facilityId, deleteResponse.status);
      }
    } catch (err) {
      console.error('Remote delete error:', err);
    }
  }

  const updatedFacilities = facilities.filter((facility) => String(facility.id) !== String(facilityId));
  localStorage.setItem(savedFacilitiesKey, JSON.stringify(updatedFacilities));
  allFacilities = updatedFacilities;
  if (facilityMarkers[facilityId]) {
    try { agentMap.removeLayer(facilityMarkers[facilityId]); } catch (e) {}
    delete facilityMarkers[facilityId];
  }
  updateFacilitiesView();
}

if (savedFacilitiesTableBody) {
  savedFacilitiesTableBody.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-id]');
    if (!button) return;
    const facilityId = button.getAttribute('data-id');
    if (button.classList.contains('delete')) {
      deleteFacility(facilityId);
    } else if (button.classList.contains('view-on-map')) {
      zoomToFacility(facilityId);
    }
  });
}

if (prevPageBtn) {
  prevPageBtn.addEventListener('click', () => {
    if (currentPage <= 1) return;
    currentPage -= 1;
    renderSavedFacilitiesTable(getFilteredFacilities());
  });
}

if (nextPageBtn) {
  nextPageBtn.addEventListener('click', () => {
    const filtered = getFilteredFacilities();
    const totalPages = getTotalPages(filtered);
    if (currentPage >= totalPages) return;
    currentPage += 1;
    renderSavedFacilitiesTable(filtered);
  });
}

if (filterTypeSelect) {
  filterTypeSelect.addEventListener('change', () => {
    filterFacilities();
  });
}

if (filterLgaSelect) {
  filterLgaSelect.addEventListener('change', () => {
    filterFacilities();
  });
}

if (clearFiltersBtn) {
  clearFiltersBtn.addEventListener('click', () => {
    currentPage = 1;
    clearFilters();
  });
}

if (getGpsBtn) {
  const gpsInfo = document.getElementById('gpsInfo');
  function resetGpsButton() {
    getGpsBtn.disabled = false;
    getGpsBtn.classList.remove('loading');
    getGpsBtn.textContent = 'Get GPS';
  }

  function setGpsButtonLoading() {
    getGpsBtn.disabled = true;
    getGpsBtn.classList.add('loading');
    getGpsBtn.innerHTML = '<span class="gps-spinner"></span>Locating...';
  }

  function setGpsInfo(text, isError = false) {
    if (!gpsInfo) return;
    gpsInfo.textContent = text;
    gpsInfo.classList.toggle('error', isError);
  }

  async function getQuickPosition(maxWaitMs = 10000) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false,
          timeout: maxWaitMs,
          maximumAge: 60000,
        }
      );
    });
  }

  async function getBestGpsPosition(desiredAccuracy = 20, maxWaitMs = 30000) {
    return new Promise((resolve, reject) => {
      let best = null;
      let isSettled = false;

      const finish = (result, success) => {
        if (isSettled) return;
        isSettled = true;
        navigator.geolocation.clearWatch(watchId);
        window.clearTimeout(timer);
        if (success) {
          resolve(result);
        } else {
          reject(result);
        }
      };

      const timer = window.setTimeout(() => {
        if (best) {
          finish(best, true);
        } else {
          finish({ code: 3, message: 'Location request timed out.' }, false);
        }
      }, maxWaitMs);

      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (!best || position.coords.accuracy < best.coords.accuracy) {
            best = position;
          }
          if (position.coords.accuracy <= desiredAccuracy) {
            finish(position, true);
          }
        },
        (error) => {
          finish(error, false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: maxWaitMs,
        }
      );
    });
  }

  getGpsBtn.addEventListener('click', async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setGpsInfo('', false);
    setGpsButtonLoading();

    if (navigator.permissions && navigator.permissions.query) {
      try {
        const status = await navigator.permissions.query({ name: 'geolocation' });
        if (status.state === 'denied') {
          const message = 'Location permission is denied. Allow location access for this site in Safari settings.';
          setGpsInfo(message, true);
          alert(message);
          resetGpsButton();
          return;
        }
      } catch (permError) {
        // Safari may not support permission query; continue to request location.
      }
    }

    try {
      let position;
      try {
        position = await getQuickPosition(10000);
      } catch (quickError) {
        try {
          position = await getBestGpsPosition(30, 30000);
        } catch (watchError) {
          position = await getFallbackPosition(10000);
        }
      }
      const { latitude, longitude, accuracy } = position.coords;
      if (facilityGps) {
        facilityGps.value = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      }
      setGpsInfo(`Accuracy: ${Math.round(accuracy)}m`, false);
    } catch (error) {
      let message = 'Unable to determine location.';
      if (error && error.code) {
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location access denied. Please enable location for this site.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location unavailable. Check your GPS or network connection.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Try again or check your signal.';
        }
      } else if (error && error.message) {
        message = error.message;
      }
      setGpsInfo(message, true);
      alert(message);
    } finally {
      resetGpsButton();
    }
  });
}

if (facilityForm) {
  facilityForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const type = document.getElementById('facilityType')?.value.trim();
    const name = document.getElementById('facilityName')?.value.trim();
    const lga = document.getElementById('facilityLga')?.value.trim();
    const address = document.getElementById('facilityAddress')?.value.trim();
    const gps = facilityGps?.value.trim();
    const photoFile = facilityPhoto?.files?.[0];

    const facilityNameError = document.getElementById('facilityNameError');
    const facilityLgaError = document.getElementById('facilityLgaError');
    const facilityPhotoError = document.getElementById('facilityPhotoError');
    const gpsInfo = document.getElementById('gpsInfo');

    function clearErrors() {
      facilityNameError.textContent = '';
      facilityLgaError.textContent = '';
      facilityPhotoError.textContent = '';
      if (gpsInfo) {
        gpsInfo.classList.remove('error');
      }
    }

    clearErrors();

    let hasError = false;
    if (!name) {
      facilityNameError.textContent = 'Facility Name is required.';
      hasError = true;
    }
    if (!lga) {
      facilityLgaError.textContent = 'LGA is required.';
      hasError = true;
    }
    if (!gps) {
      if (gpsInfo) {
        gpsInfo.textContent = 'GPS is required.';
        gpsInfo.classList.add('error');
      }
      hasError = true;
    }
    if (!photoFile) {
      facilityPhotoError.textContent = 'Photo is required.';
      hasError = true;
    }
    if (hasError) return;

    function createUuid() {
      return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, (c) =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4))).toString(16)
      );
    }

    const saveFacility = async (photoUrl, photoPublicId, photoLocalData) => {
      const facilities = JSON.parse(localStorage.getItem(savedFacilitiesKey) || '[]');
      const facilityData = {
        id: createUuid(),
        type,
        name,
        lga,
        address,
        gps,
        photo: photoUrl || photoLocalData || null,
        photoLocalData: photoLocalData || null,
        photoPublicId: photoPublicId || null,
        createdAt: new Date().toISOString(),
        addedBy: localStorage.getItem('agentName') || '',
        synced: false,
      };

      facilities.push(facilityData);
      localStorage.setItem(savedFacilitiesKey, JSON.stringify(facilities));
      allFacilities = facilities;
      if (agentMap) {
        addFacilityMarker(agentMap, facilityData);
      }
      populateFilterOptions(allFacilities);
      updateFacilitiesView();
      alert('Facility saved locally. It will sync when online.');
      closeFacilityModal();
    };

    const saveOffline = async () => {
      if (photoFile) {
        const localData = await readFileAsDataUrl(photoFile);
        await saveFacility(null, null, localData);
      } else {
        await saveFacility(null, null, null);
      }
    };

    if (photoFile && navigator.onLine) {
      try {
        const uploaded = await uploadToCloudinary(photoFile);
        await saveFacility(uploaded.url, uploaded.publicId, null);
      } catch (error) {
        console.warn('Photo upload failed, saving offline:', error);
        await saveOffline();
      }
    } else {
      await saveOffline();
    }
  });
}

if (document.body.classList.contains('agent-page')) {
  window.addEventListener('load', async () => {
    const mapContainer = document.getElementById('lagosMap');
    if (!mapContainer) return;
    mapContainer.style.minHeight = '420px';

    agentMap = L.map('lagosMap', {
      scrollWheelZoom: true,
      touchZoom: true,
      pinchZoom: true,
      tap: true,
      zoomControl: true,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      maxZoom: 19,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      maxNativeZoom: 19,
    }).addTo(agentMap);

    const fallbackBounds = [[6.25, 2.70], [6.80, 3.75]];

    const boundaryLayer = L.rectangle(fallbackBounds, {
      color: '#006400',
      weight: 3,
      fillOpacity: 0,
    }).addTo(agentMap);

    const worldMask = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[-180, -90], [-180, 90], [180, 90], [180, -90], [-180, -90]],
          [[2.70, 6.25], [3.75, 6.25], [3.75, 6.80], [2.70, 6.80], [2.70, 6.25]],
        ],
      },
    };

    L.geoJSON(worldMask, {
      style: { color: '#000', weight: 0, fillColor: '#000', fillOpacity: 0.5 },
    }).addTo(agentMap);

    const bounds = boundaryLayer.getBounds();
    agentMap.fitBounds(bounds.pad(0.12), { maxZoom: 15 });
    agentMap.setMaxBounds(bounds.pad(0.3));

    const labelControl = L.control({ position: 'topright' });
    labelControl.onAdd = function () {
      const div = L.DomUtil.create('div', 'lagis-map-label');
      div.innerHTML = '<div style="background: rgba(255,255,255,0.95); border: 1px solid #cfe2cf; color: #174b22; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 700; box-shadow: 0 2px 8px rgba(0,0,0,0.12);">LAGIS Asset Map - Lagos State</div>';
      return div;
    };
    labelControl.addTo(agentMap);

    loadSavedFacilityMarkers(agentMap);
    initializeSyncStatus();

    window.addEventListener('online', async () => {
      const pending = await getPendingFacilities();
      if (pending.length) {
        syncToCloud();
      }
    });
  });
}
