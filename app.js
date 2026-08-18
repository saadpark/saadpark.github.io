/* Saad Park Web — vanilla HTML, CSS and JavaScript only. */
const API_BASE = localStorage.getItem('saadpark_web_api') || 'https://saadpark.pythonanywhere.com';
const state = { token: localStorage.getItem('saadpark_web_token'), user: null, view: 'dashboard', vehicles: [] };
const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const esc = (value) => String(value ?? '-').replace(/[&<>'"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[c]));
const fmt = (value) => value === null || value === undefined || value === '' ? '-' : esc(value);
const dateValue = () => new Date().toISOString().slice(0, 16);
const icons = {
  add: '<path d="M12 5v14M5 12h14"/>',
  arrow_forward: '<path d="M5 12h13M14 7l5 5-5 5"/>',
  description: '<path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/>',
  notifications: '<path d="M18 10a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.description}</svg>`;

function toast(message, type = '') { const node = document.createElement('div'); node.className = `toast ${type}`; node.textContent = message; $('#toast-region').append(node); setTimeout(() => node.remove(), 4200); }
async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Une erreur est survenue.');
  return body;
}
function json(path, method = 'GET', data) { return api(path, { method, body: data === undefined ? undefined : JSON.stringify(data) }); }
function statusClass(status) { const label = String(status?.label || status || ''); return /conforme|valide|service/i.test(label) ? 'success' : /expir|urgent|panne/i.test(label) ? 'danger' : 'warning'; }
function openModal(title, content) { $('#modal-title').textContent = title; $('#modal-content').innerHTML = content; $('#modal').classList.remove('hidden'); }
function closeModal() { $('#modal').classList.add('hidden'); $('#modal-content').innerHTML = ''; }

async function login(event) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  try { const result = await json('/api/web/login', 'POST', data); finishAuth(result); } catch (error) { toast(error.message, 'error'); }
}
async function register(event) {
  event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget));
  try { const result = await json('/api/web/register', 'POST', data); finishAuth(result); } catch (error) { toast(error.message, 'error'); }
}
function finishAuth(result) { state.token = result.token; state.user = result.user; localStorage.setItem('saadpark_web_token', result.token); $('#auth-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden'); setupShell(); render(); }
function logout() { localStorage.removeItem('saadpark_web_token'); state.token = null; state.user = null; $('#app-shell').classList.add('hidden'); $('#auth-screen').classList.remove('hidden'); }
function setupShell() { $('#profile-name').textContent = state.user?.full_name || 'Utilisateur'; $('#profile-role').textContent = state.user?.role || 'user'; }

const pageMeta = { dashboard:['VUE GÉNÉRALE','Tableau de bord'], vehicles:['PARC AUTOMOBILE','Véhicules'], deadlines:['SUIVI DES DOCUMENTS','Échéances'], fuel:['RAPPORTS','Consommation Gazoil'], notifications:['CENTRE D’ALERTES','Notifications'] };
async function render(view = state.view) {
  state.view = view; const [eyebrow, title] = pageMeta[view] || pageMeta.dashboard;
  $('#page-eyebrow').textContent = eyebrow; $('#page-title').textContent = title;
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view));
  $('#page-content').innerHTML = '<div class="panel empty">Chargement…</div>';
  try { if (view === 'vehicles') await renderVehicles(); else if (view === 'deadlines') await renderDeadlines(); else if (view === 'fuel') await renderFuel(); else if (view === 'notifications') await renderNotifications(); else await renderDashboard(); } catch (error) { $('#page-content').innerHTML = `<div class="panel empty">${esc(error.message)}</div>`; if (/Authentification/.test(error.message)) logout(); }
}
async function refreshNotifications() { try { const data = await json('/api/mobile/notifications'); const count = data.count || 0; for (const id of ['notification-badge','top-notification-badge']) { const badge = $(`#${id}`); badge.textContent = count; badge.classList.toggle('hidden', !count); } } catch (_) {} }

async function renderDashboard() {
  const data = await json('/api/mobile/dashboard'); const s = data.stats || {};
  $('#page-content').innerHTML = `<section class="stats">
    ${stat('Véhicules',s.vehicles,'accent')}${stat('Documents valides',s.valid_documents,'accent')}${stat('À échéance',s.soon_documents,'warning')}${stat('Expirés',s.expired_documents,'danger')}${stat('En maintenance',s.maintenance_vehicles,'warning')}
  </section><section class="split-grid"><div><div class="section-row"><h2>Véhicules récents</h2><button class="btn btn-secondary btn-small" data-go="vehicles">Voir tous</button></div><div class="vehicle-grid">${(data.recent_vehicles || []).map(vehicleCard).join('') || '<div class="panel empty">Aucun véhicule enregistré.</div>'}</div></div><div><div class="section-row"><h2>Prochaines échéances</h2><button class="btn btn-secondary btn-small" data-go="deadlines">Voir tout</button></div><div class="panel">${(data.latest_deadlines || []).map(documentLine).join('') || '<div class="empty">Aucune échéance proche.</div>'}</div></div></section>`;
  bindGo(); refreshNotifications();
}
function stat(label, value, color='') { return `<article class="stat-card ${color}"><span>${esc(label)}</span><strong>${Number(value || 0)}</strong></article>`; }
function vehicleCard(v) { return `<article class="panel vehicle-card" data-vehicle="${v.id}"><h3>${esc(v.matricule)}</h3><p>${fmt(v.brand)} ${v.model ? '· ' + esc(v.model) : ''}</p><div class="card-footer"><span class="badge ${statusClass(v.status)}">${esc(v.status?.label || v.status || 'En service')}</span><strong class="inline-icon">Voir ${icon('arrow_forward')}</strong></div></article>`; }
function documentLine(d) { return `<div class="list-row"><span class="list-icon">${icon('description')}</span><div><strong>${esc(d.type)} · ${esc(d.vehicle_matricule || d.matricule || '')}</strong><small>Expiration : ${fmt(d.expiry_date_fr || d.expiry_date)}</small></div></div>`; }
function bindGo() { $$('[data-go]').forEach(button => button.onclick = () => render(button.dataset.go)); $$('[data-vehicle]').forEach(card => card.onclick = () => showVehicle(Number(card.dataset.vehicle))); }

async function renderVehicles() {
  const data = await json('/api/mobile/vehicles'); state.vehicles = data.vehicles || [];
  $('#page-content').innerHTML = `<section class="toolbar"><form id="vehicle-search" class="search-form"><input name="q" placeholder="Rechercher par matricule, châssis…"><button class="btn btn-secondary">${icon('search')} Rechercher</button></form><button id="add-vehicle" class="btn btn-primary">${icon('add')} Ajouter véhicule</button></section><section class="panel"><div class="table-wrap"><table><thead><tr><th>Matricule</th><th>Marque</th><th>Modèle</th><th>N° Châssis</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="vehicle-table">${vehicleRows(state.vehicles)}</tbody></table></div></section>`;
  $('#vehicle-search').onsubmit = async event => { event.preventDefault(); const q = new FormData(event.currentTarget).get('q'); const filtered = await json(`/api/mobile/vehicles?q=${encodeURIComponent(q)}`); $('#vehicle-table').innerHTML = vehicleRows(filtered.vehicles || []); bindVehicleTable(); };
  $('#add-vehicle').onclick = () => vehicleForm(); bindVehicleTable();
}
function vehicleRows(vehicles) { return vehicles.length ? vehicles.map(v => `<tr><td><a class="table-link" href="#" data-open="${v.id}">${esc(v.matricule)}</a></td><td>${fmt(v.brand)}</td><td>${fmt(v.model)}</td><td>${fmt(v.chassis_number)}</td><td><span class="badge ${statusClass(v.status)}">${esc(v.status?.label || v.status || 'En service')}</span></td><td><div class="actions"><button class="btn btn-secondary btn-small" data-open="${v.id}">Voir</button><button class="btn btn-secondary btn-small" data-edit="${v.id}">Modifier</button><button class="btn btn-danger btn-small" data-delete="${v.id}">Supprimer</button></div></td></tr>`).join('') : '<tr><td colspan="6" class="empty">Aucun véhicule trouvé.</td></tr>'; }
function bindVehicleTable() { $$('[data-open]').forEach(b => b.onclick = event => { event.preventDefault(); showVehicle(Number(b.dataset.open)); }); $$('[data-edit]').forEach(b => b.onclick = () => vehicleForm(state.vehicles.find(v => v.id === Number(b.dataset.edit)))); $$('[data-delete]').forEach(b => b.onclick = () => deleteVehicle(Number(b.dataset.delete))); }
async function deleteVehicle(id) { if (!confirm('Supprimer ce véhicule et ses documents ?')) return; try { await json(`/api/mobile/vehicles/${id}`, 'DELETE'); toast('Véhicule supprimé.'); renderVehicles(); } catch (error) { toast(error.message,'error'); } }
function vehicleForm(vehicle = null) {
  const v = vehicle || {}; openModal(vehicle ? 'Modifier le véhicule' : 'Ajouter un véhicule', `<form id="vehicle-form" class="form-grid"><label>Matricule<input name="matricule" required value="${esc(v.matricule || '')}"></label><label>Marque<input name="brand" value="${esc(v.brand || '')}"></label><label>Modèle<input name="model" value="${esc(v.model || '')}"></label><label>N° Châssis<input name="chassis_number" value="${esc(v.chassis_number || '')}"></label><label>Première mise en circulation<input name="first_use_date" placeholder="JJ/MM/AAAA" value="${esc(v.first_use_date || '')}"></label><label>Propriétaire<input name="owner_name" value="${esc(v.owner_name || '')}"></label><label>Carburant<input name="fuel_type" value="${esc(v.fuel_type || '')}"></label><label>Puissance fiscale<input name="fiscal_power" value="${esc(v.fiscal_power || '')}"></label><label class="full">Genre<input name="genre" value="${esc(v.genre || '')}"></label><div class="modal-actions full"><button type="button" class="btn btn-secondary" data-close>Annuler</button><button class="btn btn-primary">Enregistrer</button></div></form>`);
  $('[data-close]').onclick = closeModal; $('#vehicle-form').onsubmit = async event => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget)); try { await json(vehicle ? `/api/mobile/vehicles/${vehicle.id}` : '/api/mobile/vehicles', vehicle ? 'PATCH' : 'POST', payload); toast('Véhicule enregistré.'); closeModal(); renderVehicles(); } catch (error) { toast(error.message,'error'); } };
}
async function showVehicle(id) {
  try { const data = await json(`/api/mobile/vehicles/${id}`); const v = data.vehicle; const fuel = await json(`/api/mobile/vehicles/${id}/fuel-consumption`); const docs = v.documents || []; openModal(v.matricule, `<div class="detail-stack"><div class="info-grid">${info('Marque',v.brand)}${info('Modèle',v.model)}${info('N° Châssis',v.chassis_number)}${info('Statut',v.status?.label || v.status)}${info('Propriétaire',v.owner_name)}${info('Mise en circulation',v.first_use_date)}</div><div class="panel"><h3>Maintenance</h3><p class="muted">${esc(v.active_maintenance ? 'Maintenance en cours.' : 'Aucune maintenance active.')}</p><button id="maintenance-action" class="btn ${v.active_maintenance ? 'btn-danger' : 'btn-primary'}">${v.active_maintenance ? 'Terminer maintenance' : 'Démarrer maintenance'}</button></div><div class="panel"><h3>Consommation Gazoil</h3>${fuel.latest_consumption ? `<div class="fuel-result"><strong>${Number(fuel.latest_consumption).toFixed(2)} L/100 km</strong><span>${Number(fuel.latest_consumption).toFixed(4)}</span></div>` : '<p class="muted">Deux lectures d’odomètre sont nécessaires.</p>'}<div>${(fuel.entries || []).slice(0,5).map(e => `<div class="document-row"><span>${esc(e.recorded_at_label)}</span><strong>${esc(e.odometer)} km · ${esc(e.volume)} L</strong></div>`).join('')}</div></div><div class="panel"><h3>Documents</h3>${docs.map(d => `<div class="document-row"><div><strong>${esc(d.type)}</strong><small>Expiration : ${fmt(d.expiry_date_fr || d.expiry_date)}</small></div><button class="btn btn-danger btn-small" data-document-delete="${d.id}">Supprimer</button></div>`).join('') || '<p class="muted">Aucun document.</p>'}<button id="add-document" class="btn btn-secondary btn-small">＋ Ajouter document</button></div></div>`); $('#maintenance-action').onclick = () => maintenance(id, v); $('#add-document').onclick = () => documentForm(id); $$('[data-document-delete]').forEach(b => b.onclick = () => deleteDocument(Number(b.dataset.documentDelete), id)); } catch (error) { toast(error.message,'error'); } }
function info(label,value) { return `<div class="info-item"><span>${esc(label)}</span><strong>${fmt(value)}</strong></div>`; }
async function maintenance(id, vehicle) { const issues = vehicle.active_maintenance ? [] : [prompt('Décrivez le problème (optionnel)') || '']; try { await json(`/api/mobile/vehicles/${id}/maintenance/${vehicle.active_maintenance ? 'finish':'start'}`, 'POST', { matricule: vehicle.matricule, issues }); toast(vehicle.active_maintenance ? 'Maintenance terminée.' : 'Maintenance démarrée.'); showVehicle(id); } catch (error) { toast(error.message,'error'); } }
function documentForm(vehicleId) { $('#modal-content').insertAdjacentHTML('beforeend', `<form id="document-form" class="form-grid" style="margin-top:18px"><label>Type<select name="type"><option>Carte Grise</option><option>Assurance</option><option>Visite Technique</option><option>Taxe</option></select></label><label>N° document<input name="document_number"></label><label>Date émission<input name="issue_date" placeholder="JJ/MM/AAAA"></label><label>Date expiration<input name="expiry_date" placeholder="JJ/MM/AAAA"></label><label class="full">Notes<textarea name="notes"></textarea></label><div class="modal-actions full"><button class="btn btn-primary">Ajouter document</button></div></form>`); $('#document-form').onsubmit = async event => { event.preventDefault(); try { await json(`/api/mobile/vehicles/${vehicleId}/documents`,'POST',Object.fromEntries(new FormData(event.currentTarget))); toast('Document ajouté.'); showVehicle(vehicleId); } catch(error) { toast(error.message,'error'); } }; }
async function deleteDocument(documentId, vehicleId) { if (!confirm('Supprimer ce document ?')) return; try { await json(`/api/mobile/documents/${documentId}`,'DELETE'); toast('Document supprimé.'); showVehicle(vehicleId); } catch(error) { toast(error.message,'error'); } }

async function renderDeadlines() { const data = await json('/api/mobile/deadlines'); $('#page-content').innerHTML = `<section class="panel"><h2>Documents à surveiller</h2>${(data.documents || []).map(d => `<div class="document-row"><div><strong>${esc(d.type)} · ${esc(d.vehicle_matricule || '')}</strong><small>Expire le ${fmt(d.expiry_date_fr || d.expiry_date)}</small></div><span class="badge ${statusClass(d.status)}">${esc(d.status?.label || d.status || '')}</span></div>`).join('') || '<div class="empty">Aucune échéance dans les 30 prochains jours.</div>'}</section>`; }
async function renderNotifications() { const data = await json('/api/mobile/notifications'); $('#page-content').innerHTML = `<section class="panel"><h2>Alertes</h2>${(data.notifications || []).map(n => `<div class="list-row"><span class="list-icon">${icon('notifications')}</span><div><strong>${esc(n.title)}</strong><small>${esc(n.message || n.body || '')}</small></div></div>`).join('') || '<div class="empty">Aucune notification.</div>'}</section>`; refreshNotifications(); }
async function renderFuel() {
  const [vehiclesData, fuelData] = await Promise.all([json('/api/mobile/vehicles'), json('/api/mobile/fuel-consumption')]); state.vehicles = vehiclesData.vehicles || []; const entries = fuelData.entries || [];
  $('#page-content').innerHTML = `<section class="split-grid"><div class="panel"><h2>Ajouter une consommation</h2><form id="fuel-form" class="form-grid"><label>Immatriculation<select name="matricule" required>${state.vehicles.map(v => `<option value="${esc(v.matricule)}">${esc(v.matricule)}</option>`).join('')}</select></label><label>Date et heure<input name="recorded_at" type="datetime-local" value="${dateValue()}" required></label><label>Odomètre (km)<input name="odometer" type="number" min="0" step="0.01" required></label><label>Volume (L)<input name="volume" type="number" min="0.01" step="0.01" required></label><div class="modal-actions full"><button class="btn btn-primary">＋ Ajouter</button></div></form><hr><label>Lire une image de tableau<input id="fuel-image" type="file" accept="image/*"></label><button id="extract-fuel" class="btn btn-secondary" style="margin-top:10px">⌁ Lire les 2 dernières lignes</button></div><div class="panel"><h2>Dernières opérations</h2>${entries.slice(0,12).map(e => `<div class="document-row"><div><strong>${esc(e.matricule)} · ${esc(e.odometer)} km</strong><small>${esc(e.recorded_at_label)}</small></div><strong>${esc(e.volume)} L</strong></div>`).join('') || '<div class="empty">Aucune consommation.</div>'}</div></section>`;
  $('#fuel-form').onsubmit = async event => { event.preventDefault(); try { await json('/api/mobile/fuel-consumption','POST',Object.fromEntries(new FormData(event.currentTarget))); toast('Consommation enregistrée.'); renderFuel(); } catch(error) { toast(error.message,'error'); } };
  $('#extract-fuel').onclick = async () => { const file = $('#fuel-image').files[0]; if (!file) return toast('Choisissez une image.','error'); const body = new FormData(); body.append('image',file); try { const extracted = await api('/api/mobile/fuel-consumption/extract',{method:'POST',body}); let created = 0; for (const entry of extracted.entries || []) { const saved = await json('/api/mobile/fuel-consumption','POST',entry); if (saved.created !== false) created++; } toast(`${created} nouvelle(s) opération(s) ajoutée(s).`); renderFuel(); } catch(error) { toast(error.message,'error'); } };
}

function init() {
  $('#login-form').onsubmit = login; $('#register-form').onsubmit = register; $('#auth-switch').onclick = () => { const registering = !$('#register-form').classList.contains('hidden'); $('#register-form').classList.toggle('hidden', registering); $('#login-form').classList.toggle('hidden', !registering); $('#auth-title').textContent = registering ? 'Bienvenue' : 'Créer un compte'; $('#auth-copy').textContent = registering ? 'Connectez-vous pour gérer votre parc automobile.' : 'Commencez à gérer votre parc automobile.'; $('#auth-switch').textContent = registering ? 'Créer un compte' : 'J’ai déjà un compte'; };
  $$('.nav-item[data-view]').forEach(button => button.onclick = () => render(button.dataset.view)); $('#logout-button').onclick = logout; $('#top-notifications').onclick = () => render('notifications'); $('.modal-close').onclick = closeModal; $('#modal').onclick = event => { if (event.target === $('#modal')) closeModal(); };
  if (!state.token) return; api('/api/mobile/me').then(data => { state.user = data.user; $('#auth-screen').classList.add('hidden'); $('#app-shell').classList.remove('hidden'); setupShell(); render(); }).catch(logout);
}
init();
