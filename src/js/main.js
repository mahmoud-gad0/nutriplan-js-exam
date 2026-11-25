const KEYS = {
    tm: 'VwECw2OiAzxVzIqnwmKJUG41FbeXJk1y',
    fx: '805842951e5953ad31497176'
};
const NAGER = 'https://date.nager.at/api/v3';
const TM = 'https://app.ticketmaster.com/discovery/v2/events.json';
const FX = `https://v6.exchangerate-api.com/v6/${KEYS.fx}`;
const SEG = {
    All: '',
    Music: 'KZFzniwnSyZfZ7v7nJ',
    Sports: 'KZFzniwnSyZfZ7v7nE',
    Arts: 'KZFzniwnSyZfZ7v7na'
};
const LBL = {
    holiday: 'Holiday',
    event: 'Event',
    longweekend: 'Long Weekend'
};
const V = {
    dashboard: ['Dashboard', 'Welcome back! Ready to plan your next adventure?'],
    holidays: ['Holidays', 'Public holidays to plan your trip around'],
    events: ['Events', 'Concerts, sports and shows in your city'],
    weather: ['Weather', '7-day forecast for your destination'],
    'long-weekends': ['Long Weekends', 'Mini-trips hiding next to public holidays'],
    currency: ['Currency', 'Convert currencies with live rates'],
    'sun-times': ['Sun Times', 'Sunrise and sunset for your destination'],
    'my-plans': ['My Plans', 'Everything you saved, in one place'],
};
const TARGET = {
    holidays: '#holidays-content',
    events: '#events-content',
    weather: '#weather-content',
    'long-weekends': '#lw-content',
    'sun-times': '#sun-times-content'
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
}[m]));
const get = async (u) => {
    const r = await fetch(u);
    if (!r.ok)
        throw new Error(r.status);
    return r.json();
};
const emoji = (c) => [...c.toUpperCase()].map((x) => String.fromCodePoint(127397 + x.charCodeAt())).join('');
const store = {
    get: (k, d) => {
        try {
            return JSON.parse(localStorage.getItem(k)) ?? d;
        } catch {
            return d;
        }
    },
    set: (k, v) => localStorage.setItem(k, JSON.stringify(v))
};
const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
});
const t12 = (iso) => {
    const [h, m] = iso.slice(11, 16).split(':');
    return `${h % 12 || 12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
};
const DN = new Intl.DisplayNames(['en'], {
    type: 'currency'
});
const YEAR = new Date().getFullYear();
const S = {
    countries: [],
    info: null,
    coords: null,
    view: 'dashboard',
    seg: 'All',
    done: {},
    items: [],
    fx: null,
    fxReady: false,
    sel: store.get('wl_sel', {
        code: 'EG',
        city: '',
        year: YEAR
    }),
    plans: store.get('wl_plans', []),
};
const cname = () => S.countries.find((c) => c.countryCode === S.sel.code)?.name || '';
const codeOf = (n) => S.countries.find((c) => c.name.toLowerCase() === n.trim().toLowerCase())?.countryCode;
const key = () => `${S.sel.code}|${S.sel.city}|${S.sel.year}`;
const busy = (on, t = 'Loading...') => {
    $('#loading-text').textContent = t;
    $('#loading-overlay').classList.toggle('hidden', !on);
};
const emptyHtml = (icon, title, msg) => `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-${icon}"></i></div><h3>${title}</h3><p>${msg}</p></div>`;

function toast(m, t = 'success') {
    const el = document.createElement('div');
    el.className = 'toast ' + t;
    el.innerHTML = `<i class="fa-solid fa-${t === 'success' ? 'circle-check' : t === 'error' ? 'circle-xmark' : 'circle-info'}"></i><span>${esc(m)}</span><button class="toast-close"><i class="fa-solid fa-xmark"></i></button>`;
    $('#toast-container').append(el);
    const x = () => el.remove();
    $('.toast-close', el).onclick = x;
    setTimeout(x, 3000);
}
const heart = (i, cls = 'holiday-action-btn') => {
    const s = isSaved(S.items[i].id);
    return `<button class="${cls}${s ? ' saved' : ''}" data-save="${i}"><i class="fa-${s ? 'solid' : 'regular'} fa-heart"></i></button>`;
};
const isSaved = (id) => S.plans.some((p) => p.id === id);
const reg = (p) => {
    p.id = [p.type, S.sel.code, p.date, p.title].join('|');
    S.items.push(p);
    return S.items.length - 1;
};

function counts() {
    const n = S.plans.length, c = (t) => S.plans.filter((p) => p.type === t).length;
    $('#plans-count').textContent = n;
    $('#plans-count').classList.toggle('hidden', !n);
    $('#stat-saved').textContent = n;
    $('#filter-all-count').textContent = n;
    $('#filter-holiday-count').textContent = c('holiday');
    $('#filter-event-count').textContent = c('event');
    $('#filter-lw-count').textContent = c('longweekend');
}

function toggleSave(i) {
    const p = S.items[i];
    if (isSaved(p.id)) {
        S.plans = S.plans.filter((x) => x.id !== p.id);
        toast('Removed from My Plans', 'info');
    } else {
        S.plans.push({
            ...p,
            country: cname(),
            savedAt: Date.now()
        });
        toast('Saved to My Plans');
    }
    store.set('wl_plans', S.plans);
    counts();
    const s = isSaved(p.id);
    $$(`[data-save="${i}"]`).forEach((b) => {
        b.classList.toggle('saved', s);
        $('i', b).className = `fa-${s ? 'solid' : 'regular'} fa-heart`;
        if (b.classList.contains('btn-event'))
            b.lastChild.textContent = s ? ' Saved' : ' Save';
    });
}
let pf = 'all';

function plans() {
    counts();
    const l = S.plans.filter((p) => pf === 'all' || p.type === pf);
    $('#plans-content').innerHTML = l.length ? l.map((p) => `<div class="plan-card"><span class="plan-card-type ${p.type}">${LBL[p.type]}</span><div class="plan-card-content"><h4>${esc(p.title)}</h4><div class="plan-card-details"><div><i class="fa-regular fa-calendar"></i>${fmtDate(p.date)}</div>${p.sub ? `<div><i class="fa-solid fa-circle-info"></i>${esc(p.sub)}</div>` : ''}<div><i class="fa-solid fa-flag"></i>${esc(p.country)}</div></div><div class="plan-card-actions"><button class="btn-plan-remove" data-rm="${esc(p.id)}"><i class="fa-solid fa-trash"></i> Remove</button></div></div></div>`).join('')
        : `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-heart-crack"></i></div><h3>No Saved Plans Yet</h3><p>Start exploring and save holidays, events, or long weekends you like!</p><button class="btn-primary" id="start-exploring-btn"><i class="fa-solid fa-compass"></i> Start Exploring</button></div>`;
}
const getInfo = async (code) => (await get(`https://restcountries.com/v3.1/alpha/${code}`))[0];
const offMin = (s) => {
    const m = /UTC([+-])(\d\d):(\d\d)/.exec(s || '');
    return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +m[3]) : 0;
};
const clock = () => {
    const el = $('#country-local-time');
    if (el && S.info)
        el.textContent = new Date(Date.now() + offMin(S.info.timezones?.[0]) * 6e4).toLocaleTimeString('en-US', {
            timeZone: 'UTC'
        });
    $('#current-datetime').textContent = new Date().toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

async function fillCities(info, keep) {
    const cap = info.capital?.[0];
    let l = [];
    try {
        l = (await (await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                country: info.name.common
            })
        })).json()).data || [];
    } catch {
    }
    l = [...new Set([cap, ...l].filter(Boolean))];
    $('#global-city').innerHTML = l.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#global-city').value = keep && l.includes(keep) ? keep : cap || l[0] || '';
}

function badges() {
    const f = S.sel.code.toLowerCase();
    $$('.view-header-selection').forEach((el) => {
        const v = el.closest('.view').id.replace('-view', '');
        const x = ['holidays', 'long-weekends'].includes(v) ? `<span class="selection-year">${S.sel.year}</span>` : `<span class="selection-city">• ${esc(S.sel.city)}</span>`;
        el.innerHTML = S.sel.code ? `<div class="current-selection-badge"><img src="https://flagcdn.com/w40/${f}.png" class="selection-flag" alt=""><span>${esc(cname())}</span>${x}</div>` : '';
    });
    const box = $('#selected-destination');
    box.classList.toggle('hidden', !S.sel.code);
    if (S.sel.code) {
        $('#selected-country-flag').src = `https://flagcdn.com/w80/${f}.png`;
        $('#selected-country-name').textContent = cname();
        $('#selected-city-name').textContent = '• ' + S.sel.city;
    }
}

async function loadDash() {
    const box = $('#dashboard-country-info');
    if (!S.sel.code) {
        box.innerHTML = `<div class="country-info-placeholder"><div class="placeholder-icon"><i class="fa-solid fa-earth-americas"></i></div><p>Select a country and press Explore to see its information.</p></div>`;
        return;
    }
    box.innerHTML = `<div class="country-info-loading"><i class="fa-solid fa-spinner fa-spin"></i><span>Loading country info...</span></div>`;
    try {
        const i = S.info = await getInfo(S.sel.code);
        const tags = (a, cls = '') => (a.length ? a : ['—']).map((x) => `<span class="extra-tag ${cls}">${esc(x)}</span>`).join('');
        const d = (ic, l, v) => `<div class="dashboard-country-detail"><i class="fa-solid fa-${ic}"></i><span class="label">${l}</span><span class="value">${esc(v)}</span></div>`;
        const tz = i.timezones?.[0] || 'UTC';
        box.innerHTML = `<div class="dashboard-country-header"><img src="${i.flags.png}" alt="" class="dashboard-country-flag"><div class="dashboard-country-title"><h3>${esc(i.name.common)}</h3><p class="official-name">${esc(i.name.official)}</p><span class="region"><i class="fa-solid fa-location-dot"></i> ${esc(i.region)} • ${esc(i.subregion || i.region)}</span></div></div>
    <div class="dashboard-local-time"><div class="local-time-display"><i class="fa-solid fa-clock"></i><span class="local-time-value" id="country-local-time"></span><span class="local-time-zone">${esc(tz)}</span></div></div>
    <div class="dashboard-country-grid">${d('building-columns', 'Capital', i.capital?.[0] || '—')}${d('users', 'Population', i.population.toLocaleString('en-US'))}${d('ruler-combined', 'Area', Math.round(i.area).toLocaleString('en-US') + ' km²')}${d('globe', 'Continent', i.continents?.[0] || i.region)}${d('phone', 'Calling Code', (i.idd?.root || '') + (i.idd?.suffixes?.length === 1 ? i.idd.suffixes[0] : ''))}${d('car', 'Driving Side', i.car?.side ? i.car.side[0].toUpperCase() + i.car.side.slice(1) : '—')}${d('calendar-week', 'Week Starts', i.startOfWeek ? i.startOfWeek[0].toUpperCase() + i.startOfWeek.slice(1) : '—')}</div>
    <div class="dashboard-country-extras"><div class="dashboard-country-extra"><h4><i class="fa-solid fa-coins"></i> Currency</h4><div class="extra-tags">${tags(Object.entries(i.currencies || {}).map(([c, v]) => `${v.name} (${c} ${v.symbol || ''})`))}</div></div><div class="dashboard-country-extra"><h4><i class="fa-solid fa-language"></i> Languages</h4><div class="extra-tags">${tags(Object.values(i.languages || {}))}</div></div><div class="dashboard-country-extra"><h4><i class="fa-solid fa-map-location-dot"></i> Neighbors</h4><div class="extra-tags">${tags(i.borders || [], 'border-tag')}</div></div></div>
    <div class="dashboard-country-actions"><a href="${i.maps.googleMaps}" target="_blank" rel="noopener" class="btn-map-link"><i class="fa-solid fa-map"></i> View on Google Maps</a></div>`;
        clock();
    } catch {
        box.innerHTML = `<div class="country-info-placeholder"><div class="placeholder-icon error"><i class="fa-solid fa-triangle-exclamation"></i></div><p>Couldn't load this country. Please try again.</p></div>`;
    }
}

async function coords() {
    const k = S.sel.code + '|' + S.sel.city;
    if (S.coords?.k === k)
        return S.coords;
    let c;
    try {
        const r = (await get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(S.sel.city)}&count=1&country_code=${S.sel.code}`)).results[0];
        c = {
            lat: r.latitude,
            lon: r.longitude,
            tz: r.timezone
        };
    } catch {
        if (S.info?.cca2 !== S.sel.code)
            S.info = await getInfo(S.sel.code);
        const ll = S.info.capitalInfo?.latlng || S.info.latlng;
        c = {
            lat: ll[0],
            lon: ll[1]
        };
    }
    return (S.coords = {
        ...c,
        k
    });
}

async function holidays() {
    const d = await get(`${NAGER}/PublicHolidays/${S.sel.year}/${S.sel.code}`);
    $('#stat-holidays').textContent = d.length;
    $('#holidays-content').innerHTML = d.map((h) => {
        const dt = new Date(h.date + 'T00:00:00');
        const i = reg({
            type: 'holiday',
            title: h.name,
            date: h.date,
            sub: h.localName
        });
        return `<div class="holiday-card"><div class="holiday-card-header"><div class="holiday-date-box"><span class="day">${dt.getDate()}</span><span class="month">${dt.toLocaleString('en', {
            month: 'short'
        })}</span></div>${heart(i)}</div><h3>${esc(h.name)}</h3><p class="holiday-name">${esc(h.localName)}</p><div class="holiday-card-footer"><span class="holiday-day-badge"><i class="fa-regular fa-calendar"></i> ${dt.toLocaleString('en', {
            weekday: 'long'
        })}</span><span class="holiday-type-badge">${h.types?.[0] || 'Public'}</span></div></div>`;
    }).join('') || emptyHtml('calendar-xmark', 'No holidays found', 'Nothing listed for this year.');
}

async function lw() {
    const d = await get(`${NAGER}/LongWeekend/${S.sel.year}/${S.sel.code}`);
    $('#lw-content').innerHTML = d.map((w, n) => {
        const days = [];
        for (let t = new Date(w.startDate + 'T00:00:00'), e = new Date(w.endDate + 'T00:00:00'); t <= e; t.setDate(t.getDate() + 1))
            days.push(new Date(t));
        const i = reg({
            type: 'longweekend',
            title: `Long Weekend #${n + 1}`,
            date: w.startDate,
            sub: `${w.startDate} → ${w.endDate} (${w.dayCount} days)`
        });
        return `<div class="lw-card"><div class="lw-card-header"><span class="lw-badge"><i class="fa-solid fa-calendar-days"></i> ${w.dayCount} Days</span>${heart(i)}</div><h3>Long Weekend #${n + 1}</h3><div class="lw-dates"><i class="fa-regular fa-calendar"></i> ${fmtDate(w.startDate)} - ${fmtDate(w.endDate)}</div>${w.needBridgeDay ? '<div class="lw-info-box warning"><i class="fa-solid fa-info-circle"></i> Requires taking a bridge day off</div>' : '<div class="lw-info-box success"><i class="fa-solid fa-check-circle"></i> No extra days off needed!</div>'}<div class="lw-days-visual">${days.map((x) => `<div class="lw-day${[0, 6].includes(x.getDay()) ? ' weekend' : ''}"><span class="name">${x.toLocaleString('en', {
            weekday: 'short'
        })}</span><span class="num">${x.getDate()}</span></div>`).join('')}</div></div>`;
    }).join('') || emptyHtml('umbrella-beach', 'No long weekends', 'No long weekends found for this year.');
}
const ph = (c) => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><rect width="400" height="200" fill="${{
    Music: '#6366f1',
    Sports: '#16a34a',
    Arts: '#a855f7'
}[c] || '#084887'}"/><text x="200" y="112" font-size="38" fill="white" text-anchor="middle" font-family="sans-serif">${c}</text></svg>`);

function mockEvents() {
    const y = S.sel.year, c = S.sel.city, base = [['Music', 'Live Concert', 2], ['Sports', 'Football Match', 3], ['Arts', 'Theatre Play', 4], ['Music', 'Symphony Orchestra', 5], ['Sports', 'Basketball Game', 6], ['Arts', 'Art Exhibition', 7]];
    return base.filter((b) => S.seg === 'All' || b[0] === S.seg).map(([cat, n, m]) => ({
        name: `${n} in ${c}`,
        date: `${y}-${String(m).padStart(2, '0')}-15`,
        time: '20:00',
        cat,
        venue: `${c} Arena`,
        img: ph(cat),
        url: ''
    }));
}

async function events() {
    if (!$('#event-filters'))
        $('#events-content').insertAdjacentHTML('beforebegin', '<div id="event-filters" class="events-filters">' + Object.keys(SEG).map((k) => `<button class="filter-chip${k === S.seg ? ' active' : ''}" data-seg="${k}">${k}</button>`).join('') + '</div>');
    let ev = [], mock = false;
    try {
        const d = await get(`${TM}?apikey=${KEYS.tm}&city=${encodeURIComponent(S.sel.city)}&countryCode=${S.sel.code}&size=20${SEG[S.seg] ? '&segmentId=' + SEG[S.seg] : ''}`);
        ev = (d._embedded?.events || []).map((e) => ({
            name: e.name,
            date: e.dates.start.localDate,
            time: e.dates.start.localTime?.slice(0, 5),
            cat: e.classifications?.[0]?.segment?.name || 'Other',
            venue: e._embedded?.venues?.[0]?.name || '',
            img: [...(e.images || [])].sort((a, b) => b.width - a.width)[0]?.url,
            url: e.url
        }));
    } catch {
    }
    if (!ev.length) {
        ev = mockEvents();
        mock = true;
    } else
        $('#stat-events').textContent = ev.length;
    $('#events-content').innerHTML = (mock ? '<div class="lw-info-box warning" style="grid-column:1/-1"><i class="fa-solid fa-info-circle"></i> No live events for this city, showing sample events.</div>' : '') + ev.map((e) => {
        const i = reg({
            type: 'event',
            title: e.name,
            date: e.date,
            sub: `${e.venue ? e.venue + ', ' : ''}${S.sel.city}`
        });
        return `<div class="event-card"><div class="event-card-image"><img src="${esc(e.img || ph(e.cat))}" alt="" onerror="this.onerror=null;this.src='${ph(e.cat)}'"><span class="event-card-category">${esc(e.cat)}</span>${heart(i, 'event-card-save')}</div><div class="event-card-body"><h3>${esc(e.name)}</h3><div class="event-card-info"><div><i class="fa-regular fa-calendar"></i>${fmtDate(e.date)}${e.time ? ' at ' + e.time : ''}</div><div><i class="fa-solid fa-location-dot"></i>${esc(e.venue)}${e.venue ? ', ' : ''}${esc(S.sel.city)}</div></div><div class="event-card-footer"><button class="btn-event${isSaved(S.items[i].id) ? ' saved' : ''}" data-save="${i}"><i class="fa-${isSaved(S.items[i].id) ? 'solid' : 'regular'} fa-heart"></i> ${isSaved(S.items[i].id) ? 'Saved' : 'Save'}</button>${e.url ? `<a href="${esc(e.url)}" target="_blank" rel="noopener" class="btn-buy-ticket"><i class="fa-solid fa-ticket"></i> Buy Tickets</a>` : ''}</div></div></div>`;
    }).join('');
}
const WX = (c) => c === 0 ? ['sun', 'Clear sky', 'sunny'] : c <= 2 ? ['cloud-sun', 'Partly cloudy', 'cloudy'] : c === 3 ? ['cloud', 'Overcast', 'cloudy'] : c <= 48 ? ['smog', 'Foggy', 'foggy'] : c <= 67 ? ['cloud-rain', 'Rain', 'rainy'] : c <= 77 ? ['snowflake', 'Snow', 'snowy'] : c <= 82 ? ['cloud-showers-heavy', 'Showers', 'rainy'] : c <= 86 ? ['snowflake', 'Snow showers', 'snowy'] : ['cloud-bolt', 'Thunderstorm', 'stormy'];

async function weather() {
    const c = await coords();
    const d = await get(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max,sunrise,sunset&timezone=auto&forecast_days=7`);
    const cu = d.current, dy = d.daily, w = WX(cu.weather_code), uv = Math.round(dy.uv_index_max[0]);
    const uvl = uv <= 2 ? ['low', 'Low'] : uv <= 5 ? ['moderate', 'Moderate'] : uv <= 7 ? ['high', 'High'] : uv <= 10 ? ['very-high', 'Very high'] : ['extreme', 'Extreme'];
    const hi = Math.max(0, d.hourly.time.indexOf(cu.time.slice(0, 13) + ':00'));
    const det = (cls, ic, l, v, extra = '') => `<div class="weather-detail-card"><div class="detail-icon ${cls}"><i class="fa-solid fa-${ic}"></i></div><div class="detail-info"><span class="detail-label">${l}</span><span class="detail-value">${v}</span></div>${extra}</div>`;
    $('#weather-content').innerHTML = `<div class="weather-hero-card weather-${w[2]}"><div class="weather-hero-bg"></div><div class="weather-hero-content"><div class="weather-location"><i class="fa-solid fa-location-dot"></i><span>${esc(S.sel.city)}</span><span class="weather-time">${new Date(cu.time).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    })}</span></div><div class="weather-hero-main"><div class="weather-hero-left"><div class="weather-hero-icon"><i class="fa-solid fa-${w[0]}"></i></div><div class="weather-hero-temp"><span class="temp-value">${Math.round(cu.temperature_2m)}</span><span class="temp-unit">°C</span></div></div><div class="weather-hero-right"><div class="weather-condition">${w[1]}</div><div class="weather-feels">Feels like ${Math.round(cu.apparent_temperature)}°C</div><div class="weather-high-low"><span class="high"><i class="fa-solid fa-arrow-up"></i> ${Math.round(dy.temperature_2m_max[0])}°</span><span class="low"><i class="fa-solid fa-arrow-down"></i> ${Math.round(dy.temperature_2m_min[0])}°</span></div></div></div></div></div>
  <div class="weather-details-grid">${det('humidity', 'droplet', 'Humidity', cu.relative_humidity_2m + '%', `<div class="detail-bar"><div class="detail-bar-fill" style="width:${cu.relative_humidity_2m}%"></div></div>`)}${det('wind', 'wind', 'Wind', Math.round(cu.wind_speed_10m) + ' km/h')}${det('uv', 'sun', 'UV Index', uv, `<span class="uv-level ${uvl[0]}">${uvl[1]}</span>`)}${det('precip', 'cloud-rain', 'Precipitation', (dy.precipitation_probability_max[0] ?? 0) + '%', `<span class="detail-extra">${cu.precipitation} mm now</span>`)}
  <div class="weather-detail-card sunrise-sunset"><div class="sun-times-visual"><div class="sun-time sunrise"><i class="fa-solid fa-sun"></i><span class="sun-label">Sunrise</span><span class="sun-value">${t12(dy.sunrise[0])}</span></div><div class="sun-time sunset"><i class="fa-solid fa-moon"></i><span class="sun-label">Sunset</span><span class="sun-value">${t12(dy.sunset[0])}</span></div></div></div></div>
  <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-clock"></i> Hourly Forecast</h3><div class="hourly-scroll">${d.hourly.time.slice(hi, hi + 12).map((t, n) => {
        const h = +t.slice(11, 13), j = hi + n, p = d.hourly.precipitation_probability[j];
        return `<div class="hourly-item${n ? '' : ' now'}"><span class="hourly-time">${n ? `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` : 'Now'}</span><div class="hourly-icon"><i class="fa-solid fa-${WX(d.hourly.weather_code[j])[0]}"></i></div><span class="hourly-temp">${Math.round(d.hourly.temperature_2m[j])}°</span>${p > 0 ? `<span class="hourly-precip"><i class="fa-solid fa-droplet"></i>${p}%</span>` : ''}</div>`;
    }).join('')}</div></div>
  <div class="weather-section"><h3 class="weather-section-title"><i class="fa-solid fa-calendar-week"></i> 7-Day Forecast</h3><div class="forecast-list">${dy.time.map((t, n) => {
        const dt = new Date(t + 'T00:00:00'), p = dy.precipitation_probability_max[n];
        return `<div class="forecast-day${n ? '' : ' today'}"><div class="forecast-day-name"><span class="day-label">${n ? dt.toLocaleString('en', {
            weekday: 'short'
        }) : 'Today'}</span><span class="day-date">${dt.getDate()} ${dt.toLocaleString('en', {
            month: 'short'
        })}</span></div><div class="forecast-icon"><i class="fa-solid fa-${WX(dy.weather_code[n])[0]}"></i></div><div class="forecast-temps"><span class="temp-max">${Math.round(dy.temperature_2m_max[n])}°</span><span class="temp-min">${Math.round(dy.temperature_2m_min[n])}°</span></div><div class="forecast-precip">${p > 0 ? `<i class="fa-solid fa-droplet"></i><span>${p}%</span>` : ''}</div></div>`;
    }).join('')}</div></div>`;
}

async function sun() {
    const c = await coords(), tz = c.tz;
    const day = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz
    }).format(new Date());
    const r = (await get(`https://api.sunrise-sunset.org/json?lat=${c.lat}&lng=${c.lon}&date=${day}&formatted=0`)).results;
    const f = (s) => new Date(s).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: tz
    });
    const h = Math.floor(r.day_length / 3600), m = Math.floor((r.day_length % 3600) / 60), pct = (r.day_length / 864).toFixed(1), dk = 86400 - r.day_length;
    const card = (cls, ic, l, t, sub) => `<div class="sun-time-card ${cls}"><div class="icon"><i class="fa-solid fa-${ic}"></i></div><div class="label">${l}</div><div class="time">${t}</div><div class="sub-label">${sub}</div></div>`;
    $('#sun-times-content').innerHTML = `<div class="sun-main-card"><div class="sun-main-header"><div class="sun-location"><h2><i class="fa-solid fa-location-dot"></i> ${esc(S.sel.city)}</h2><p>Sun times for your selected location</p></div><div class="sun-date-display"><div class="date">${new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: tz
    })}</div><div class="day">${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: tz
    })}</div></div></div><div class="sun-times-grid">${card('dawn', 'moon', 'Dawn', f(r.civil_twilight_begin), 'Civil Twilight')}${card('sunrise', 'sun', 'Sunrise', f(r.sunrise), 'Golden Hour Start')}${card('noon', 'sun', 'Solar Noon', f(r.solar_noon), 'Sun at Highest')}${card('sunset', 'sun', 'Sunset', f(r.sunset), 'Golden Hour End')}${card('dusk', 'moon', 'Dusk', f(r.civil_twilight_end), 'Civil Twilight')}${card('daylight', 'hourglass-half', 'Day Length', `${h}h ${m}m`, 'Total Daylight')}</div></div>
  <div class="day-length-card"><h3><i class="fa-solid fa-chart-pie"></i> Daylight Distribution</h3><div class="day-progress"><div class="day-progress-bar"><div class="day-progress-fill" style="width:${pct}%"></div></div></div><div class="day-length-stats"><div class="day-stat"><div class="value">${h}h ${m}m</div><div class="label">Daylight</div></div><div class="day-stat"><div class="value">${pct}%</div><div class="label">of 24 Hours</div></div><div class="day-stat"><div class="value">${Math.floor(dk / 3600)}h ${Math.floor((dk % 3600) / 60)}m</div><div class="label">Darkness</div></div></div></div>`;
}
const flagOf = (c) => ({
    EUR: 'eu',
    ANG: 'cw',
    XAF: 'cm',
    XOF: 'sn',
    XCD: 'ag',
    XPF: 'pf'
}[c] || c.slice(0, 2).toLowerCase());

function convert() {
    const a = +$('#currency-amount').value || 0, f = $('#currency-from').value, t = $('#currency-to').value, r = S.fx.conversion_rates, rate = r[t] / r[f];
    const n = (v, d = 2) => v.toLocaleString('en-US', {
        minimumFractionDigits: d,
        maximumFractionDigits: d
    });
    $('#currency-result').innerHTML = `<div class="conversion-display"><div class="conversion-from"><span class="amount">${n(a)}</span><span class="currency-code">${f}</span></div><div class="conversion-equals"><i class="fa-solid fa-equals"></i></div><div class="conversion-to"><span class="amount">${n(a * rate)}</span><span class="currency-code">${t}</span></div></div><div class="exchange-rate-info"><p>1 ${f} = ${n(rate, 4)} ${t}</p><small>Last updated: ${S.fx.time_last_update_utc.slice(0, 16)}</small></div>`;
}

async function loadRates() {
    const cached = store.get('wl_fx', null);
    if (cached && Date.now() < cached.next) {
        return cached.data;
    }
    try {
        const data = await get(`${FX}/latest/USD`);
        store.set('wl_fx', {
            data,
            next: data.time_next_update_unix * 1000
        });
        return data;
    } catch (error) {
        if (cached) {
            return cached.data;
        }
        throw error;
    }
}

async function currency() {
    if (!S.fxReady) {
        S.fx = await loadRates();
        const o = Object.keys(S.fx.conversion_rates).map((c) => `<option value="${c}">${c} - ${DN.of(c)}</option>`).join('');
        $('#currency-from').innerHTML = o;
        $('#currency-to').innerHTML = o;
        $('#currency-from').value = 'USD';
        $('#currency-to').value = 'EGP';
        S.fxReady = true;
    }
    const own = Object.keys(S.info?.currencies || {})[0];
    if (own && S.fx.conversion_rates[own] && S.done.fxFor !== S.sel.code) {
        $('#currency-to').value = own;
        S.done.fxFor = S.sel.code;
    }
    convert();
}
const RENDER = {
    holidays,
    events,
    weather,
    'long-weekends': lw,
    'sun-times': sun
};

async function render(v) {
    if (v === 'my-plans')
        return plans();
    if (v === 'currency') {
        try {
            busy(true, 'Fetching live rates...');
            await currency();
        } catch {
            toast('Could not load exchange rates', 'error');
        } finally {
            busy(false);
        }
        return;
    }
    const R = RENDER[v];
    if (!R)
        return;
    if (!S.sel.code) {
        $(TARGET[v]).innerHTML = emptyHtml('earth-americas', 'No destination selected', 'Pick a country on the Dashboard first.');
        return;
    }
    const k = key() + S.seg;
    if (S.done[v] === k)
        return;
    S.done[v] = k;
    try {
        busy(true, `Loading ${V[v][0].toLowerCase()}...`);
        await R();
    } catch {
        S.done[v] = null;
        $(TARGET[v]).innerHTML = emptyHtml('triangle-exclamation', 'Something went wrong', 'We could not load this data. Try again in a moment.');
        toast('Failed to load data', 'error');
    } finally {
        busy(false);
    }
}
const closeMenu = () => {
    $('#sidebar').classList.remove('open');
    $('#sidebar-overlay').classList.remove('active');
    $('#sidebar-overlay').classList.add('hidden');
};

function go(v, push = true) {
    if (!V[v])
        v = 'dashboard';
    S.view = v;
    $$('.view').forEach((e) => e.classList.toggle('active', e.id === v + '-view'));
    $$('.nav-item').forEach((a) => a.classList.toggle('active', a.dataset.view === v));
    $('#page-title').textContent = V[v][0];
    $('#page-subtitle').textContent = V[v][1];
    if (push && location.hash !== '#/' + v)
        location.hash = '/' + v;
    closeMenu();
    render(v);
}

async function explore() {
    const code = codeOf($('#global-country').value);
    if (!code)
        return Swal.fire({
            icon: 'info',
            title: 'Pick a country first'
        });
    S.sel = {
        code,
        city: $('#global-city').value,
        year: +$('#global-year').value
    };
    store.set('wl_sel', S.sel);
    S.done = {};
    S.items = [];
    S.coords = null;
    $('#event-filters')?.remove();
    badges();
    await loadDash();
    toast(`Exploring ${cname()}`, 'info');
}

async function init() {
    setInterval(clock, 1000);
    counts();
    const ys = $('#global-year');
    ys.innerHTML = [YEAR - 1, YEAR, YEAR + 1, YEAR + 2].map((y) => `<option value="${y}">${y}</option>`).join('');
    ys.value = S.sel.year;
    try {
        S.countries = (await get(`${NAGER}/AvailableCountries`)).sort((a, b) => a.name.localeCompare(b.name));
        $('#stat-countries').textContent = S.countries.length;
        $('#country-list').innerHTML = S.countries.map((c) => `<option value="${esc(c.name)}">${emoji(c.countryCode)}</option>`).join('');
    } catch {
        Swal.fire({
            icon: 'error',
            title: 'Could not load countries',
            text: 'Check your connection and reload.'
        });
    }
    $('#global-country').value = cname();
    if (S.sel.code) {
        try {
            const i = await getInfo(S.sel.code);
            await fillCities(i, S.sel.city);
            S.sel.city = $('#global-city').value;
        } catch {
        }
    }
    badges();
    await loadDash();
    go(location.hash.slice(2) || 'dashboard', false);
}

document.addEventListener('click', async (e) => {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-save]')))
        toggleSave(+b.dataset.save);
    else if ((b = t.closest('[data-rm]'))) {
        S.plans = S.plans.filter((p) => p.id !== b.dataset.rm);
        store.set('wl_plans', S.plans);
        plans();
        toast('Plan removed', 'info');
    } else if ((b = t.closest('[data-seg]'))) {
        S.seg = b.dataset.seg;
        $$('[data-seg]').forEach((x) => x.classList.toggle('active', x === b));
        render('events');
    } else if ((b = t.closest('.plan-filter'))) {
        pf = b.dataset.filter;
        $$('.plan-filter').forEach((x) => x.classList.toggle('active', x === b));
        plans();
    } else if (t.closest('#start-exploring-btn'))
        go('dashboard');
    else if (t.closest('#clear-all-plans-btn')) {
        if (!S.plans.length)
            return;
        const r = await Swal.fire({
            icon: 'warning',
            title: 'Clear all plans?',
            text: 'This cannot be undone.',
            showCancelButton: true,
            confirmButtonText: 'Yes, clear'
        });
        if (r.isConfirmed) {
            S.plans = [];
            store.set('wl_plans', S.plans);
            plans();
            toast('All plans cleared', 'info');
        }
    } else if (t.closest('#swap-currencies-btn')) {
        const f = $('#currency-from'), o = $('#currency-to');
        [f.value, o.value] = [o.value, f.value];
        convert();
    } else if (t.closest('#convert-btn'))
        convert();
    else if (t.closest('#global-search-btn'))
        explore();
    else if (t.closest('#clear-selection-btn')) {
        S.sel = {
            code: '',
            city: '',
            year: S.sel.year
        };
        store.set('wl_sel', S.sel);
        S.done = {};
        S.info = null;
        $('#global-country').value = '';
        $('#global-city').innerHTML = '';
        badges();
        loadDash();
    } else if (t.closest('#mobile-menu-btn')) {
        $('#sidebar').classList.add('open');
        $('#sidebar-overlay').classList.remove('hidden');
        $('#sidebar-overlay').classList.add('active');
    } else if (t.closest('#sidebar-overlay'))
        closeMenu();
    else if ((b = t.closest('.nav-item'))) {
        e.preventDefault();
        go(b.dataset.view);
    }
});
$('#global-country').addEventListener('input', async (e) => {
    const c = codeOf(e.target.value);
    if (c) {
        try {
            await fillCities(await getInfo(c));
        } catch {
            toast('Could not load cities', 'error');
        }
    }
});
$('#global-country').addEventListener('focus', (e) => e.target.select());
['input', 'change'].forEach((ev) => $('#currency-amount').addEventListener(ev, () => S.fxReady && convert()));
['#currency-from', '#currency-to'].forEach((s) => $(s).addEventListener('change', () => S.fxReady && convert()));
addEventListener('hashchange', () => {
    const v = location.hash.slice(2) || 'dashboard';
    if (v !== S.view)
        go(v, false);
});
init();