/* ═══════════════════════════════════════════════════════════════════
   groups-panel.js — لوحة إدارة نقاط المجموعات
   مزامنة لحظية مع Google Sheets فور تغيير أي رقم
   ورش + ألعاب + التزام (×3 أيام) + حفلة السمر
   ═══════════════════════════════════════════════════════════════════ */
'use strict';

/* ─── ثوابت ─── */
var GP_DAYS = ['1', '2', '3'];
var GP_CATS = [
    { key: 'workshop',   label: 'ورش العمل',  icon: '🛠️', max: 55  },
    { key: 'games',      label: 'الألعاب',    icon: '🎮', max: 30  },
    { key: 'commitment', label: 'الالتزام',   icon: '⭐', max: 20  }
];
var GP_DAY_MAX   = 105;
var GP_PARTY_MAX = 50;
var GP_GRAND_MAX = 365;

var GP_COLORS = {
    'مارجرجس'        : { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)'  },
    'القلب'          : { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)'  },
    'مريم العذراء'   : { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.4)'  },
    'الفكر'          : { color: '#06b6d4', bg: 'rgba(6,182,212,0.12)',  border: 'rgba(6,182,212,0.4)'  },
    'الشهيده مارينا' : { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
    'الشهيدة مارينا' : { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
    'الارادة'        : { color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.4)' },
    'البابا كيرلس'   : { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' },
    'الراحة'         : { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' },
    'الطريق'         : { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.4)' }
};
var GP_DEFAULT_COLOR = { color:'#8b5cf6', bg:'rgba(139,92,246,0.12)', border:'rgba(139,92,246,0.4)' };

/* ─── حالة النقاط في الذاكرة ─── */
var gpScores  = {};   // { groupName: { d1_workshop, d1_games, d1_commitment, d1_total, ..., party, grand } }
var gpTimers  = {};   // debounce timers { key: timerID }
var gpPending = {};   // { key: true } — مؤشر "جاري الحفظ"

/* ═══════════════════════════════════════════════
   1. الدخول الرئيسي — تُستدعى عند تحميل القسم
   ═══════════════════════════════════════════════ */
window.renderGroupsPanel = async function () {
    var wrap = document.getElementById('groupsPanelWrap');
    if (!wrap) return;

    var groups = (window.db && window.db.groups) ? window.db.groups : [];
    if (groups.length === 0) {
        wrap.innerHTML = '<div style="text-align:center;padding:40px;color:#64748b;">لا توجد مجموعات</div>';
        return;
    }

    wrap.innerHTML =
        '<div style="text-align:center;padding:30px;color:#94a3b8;">' +
        '<i class="bi bi-hourglass-split" style="font-size:1.5rem;display:block;margin-bottom:8px;"></i>' +
        'جاري تحميل النقاط من Google Sheets...</div>';

    await _gpLoadScores(groups);
    wrap.innerHTML = _gpBuildHTML(groups);
    _gpBindAll(groups);
};

/* ═══════════════════════════════════════════════
   2. تحميل النقاط من GAS
   ═══════════════════════════════════════════════ */
async function _gpLoadScores(groups) {
    try {
        if (!window.DataService) return;
        var res = await window.DataService.getGroupScores();
        if (res && res.status === 'success' && Array.isArray(res.data)) {
            res.data.forEach(function (item) {
                var k = String(item.group || '').trim();
                if (!k) return;
                /* GAS يُرجع: { day1: {workshop,games,commitment,total}, day2:..., day3:..., party, grandTotal } */
                var d1 = item.day1 || {};
                var d2 = item.day2 || {};
                var d3 = item.day3 || {};
                gpScores[k] = {
                    d1_workshop  : _n(d1.workshop),
                    d1_games     : _n(d1.games),
                    d1_commitment: _n(d1.commitment),
                    d1_total     : _n(d1.total),
                    d2_workshop  : _n(d2.workshop),
                    d2_games     : _n(d2.games),
                    d2_commitment: _n(d2.commitment),
                    d2_total     : _n(d2.total),
                    d3_workshop  : _n(d3.workshop),
                    d3_games     : _n(d3.games),
                    d3_commitment: _n(d3.commitment),
                    d3_total     : _n(d3.total),
                    party        : _n(item.party),
                    grand        : _n(item.grandTotal)
                };
            });
            console.log('✅ groups-panel: loaded scores for', Object.keys(gpScores).join(', '));
        }
    } catch (e) {
        console.warn('groups-panel: getGroupScores failed', e);
    }
    /* ضمان وجود سجل لكل مجموعة */
    groups.forEach(function (g) {
        if (!gpScores[g.name]) {
            gpScores[g.name] = {
                d1_workshop:0, d1_games:0, d1_commitment:0, d1_total:0,
                d2_workshop:0, d2_games:0, d2_commitment:0, d2_total:0,
                d3_workshop:0, d3_games:0, d3_commitment:0, d3_total:0,
                party:0, grand:0
            };
        }
    });
}

/* ═══════════════════════════════════════════════
   3. بناء HTML
   ═══════════════════════════════════════════════ */
function _gpBuildHTML(groups) {
    var inp_sty =
        'width:100%;background:rgba(0,0,0,0.4);border:1.5px solid rgba(255,255,255,0.12);' +
        'color:#f1f5f9;border-radius:10px;padding:7px 10px;font-size:0.95rem;' +
        'text-align:center;font-family:Cairo,sans-serif;outline:none;' +
        'transition:border-color 0.2s,box-shadow 0.2s;';
    var lbl_sty = 'font-size:0.72rem;color:#94a3b8;margin-bottom:4px;';
    var day_sty =
        'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);' +
        'border-radius:14px;padding:16px;margin-bottom:12px;';

    /* ── رأس الإحصائيات ── */
    var html =
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px;">';
    groups.forEach(function (g) {
        var sc  = gpScores[g.name] || {};
        var clr = GP_COLORS[g.name] || GP_DEFAULT_COLOR;
        var pct = Math.min(100, Math.round((_n(sc.grand)) / GP_GRAND_MAX * 100));
        html +=
            '<div style="flex:1;min-width:150px;background:'+clr.bg+';border:1.5px solid '+clr.border+';border-radius:14px;padding:14px;text-align:center;">' +
                '<div id="gp-score-'+_gpId(g.name)+'" style="font-size:1.6rem;font-weight:900;color:'+clr.color+';">' + _n(sc.grand) + '</div>' +
                '<div style="font-size:0.7rem;color:#94a3b8;">/ '+GP_GRAND_MAX+' نقطة</div>' +
                '<div style="font-weight:800;color:#f1f5f9;margin:4px 0 6px;">'+g.name+'</div>' +
                '<div style="background:rgba(255,255,255,0.08);border-radius:20px;height:6px;overflow:hidden;">' +
                    '<div id="gp-bar-'+_gpId(g.name)+'" style="height:100%;width:'+pct+'%;background:'+clr.color+';border-radius:20px;transition:width 0.4s;"></div>' +
                '</div>' +
            '</div>';
    });
    html += '</div>';

    /* ── بطاقة كل مجموعة ── */
    groups.forEach(function (g) {
        var sc  = gpScores[g.name] || {};
        var clr = GP_COLORS[g.name] || GP_DEFAULT_COLOR;
        html +=
            '<div style="background:rgba(15,23,42,0.7);border:1.5px solid '+clr.border+';border-radius:18px;padding:18px;margin-bottom:18px;">' +

            /* عنوان المجموعة */
            '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">' +
                '<div style="width:10px;height:10px;border-radius:50%;background:'+clr.color+';flex-shrink:0;"></div>' +
                '<div style="font-size:1.05rem;font-weight:900;color:'+clr.color+';">'+g.name+'</div>' +
                '<div style="margin-right:auto;font-size:0.78rem;color:#64748b;">' +
                    'المجموع الكلي: <span id="gp-grand-text-'+_gpId(g.name)+'" style="color:'+clr.color+';font-weight:900;">'+_n(sc.grand)+'</span> / '+GP_GRAND_MAX +
                '</div>' +
            '</div>';

        /* ── الأيام الثلاثة ── */
        GP_DAYS.forEach(function (day) {
            var pfx = 'd'+day+'_';
            html +=
                '<div style="'+day_sty+'">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">' +
                    '<span style="font-size:0.82rem;font-weight:700;color:#e2e8f0;">📅 اليوم '+day+'</span>' +
                    '<span style="margin-right:auto;font-size:0.75rem;color:#64748b;">' +
                        'مجموع اليوم: ' +
                        '<span id="gp-daytot-'+_gpId(g.name)+'-'+day+'" style="color:#fbbf24;font-weight:800;">'+_n(sc[pfx+'total'])+'</span>' +
                        ' / '+GP_DAY_MAX +
                    '</span>' +
                    /* مؤشر الحفظ لكل يوم */
                    '<span id="gp-status-'+_gpId(g.name)+'-'+day+'" style="font-size:0.7rem;color:#64748b;"></span>' +
                '</div>' +
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">';

            GP_CATS.forEach(function (cat) {
                var fid = 'gp-inp-'+_gpId(g.name)+'-'+day+'-'+cat.key;
                var val = _n(sc[pfx+cat.key]);
                html +=
                    '<div>' +
                        '<div style="'+lbl_sty+'">'+cat.icon+' '+cat.label+' <span style="color:#475569;">/'+cat.max+'</span></div>' +
                        '<input id="'+fid+'" type="number" min="0" max="'+cat.max+'" value="'+val+'" ' +
                            'data-group="'+g.name+'" data-day="'+day+'" data-cat="'+cat.key+'" data-max="'+cat.max+'" ' +
                            'style="'+inp_sty+'" autocomplete="off">' +
                    '</div>';
            });
            html += '</div></div>'; /* end grid + day card */
        });

        /* ── حفلة السمر ── */
        var partyInpId  = 'gp-inp-'+_gpId(g.name)+'-party';
        var partyStatId = 'gp-status-'+_gpId(g.name)+'-party';
        html +=
            '<div style="'+day_sty+'border-color:rgba(251,191,36,0.25);">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                    '<span style="font-size:0.82rem;font-weight:700;color:#fbbf24;">🎉 حفلة السمر</span>' +
                    '<span style="color:#64748b;font-size:0.72rem;">/ '+GP_PARTY_MAX+' نقطة</span>' +
                    '<span id="'+partyStatId+'" style="margin-right:auto;font-size:0.7rem;color:#64748b;"></span>' +
                '</div>' +
                '<div style="margin-top:10px;max-width:160px;">' +
                    '<input id="'+partyInpId+'" type="number" min="0" max="'+GP_PARTY_MAX+'" value="'+_n(sc.party)+'" ' +
                        'data-group="'+g.name+'" data-day="party" ' +
                        'style="'+inp_sty+'" autocomplete="off">' +
                '</div>' +
            '</div>';

        html += '</div>'; /* end group card */
    });

    return html;
}

/* ═══════════════════════════════════════════════
   4. ربط الأحداث — مزامنة لحظية بـ debounce
   ═══════════════════════════════════════════════ */
function _gpBindAll(groups) {
    groups.forEach(function (g) {

        /* ── أيام ── */
        GP_DAYS.forEach(function (day) {
            GP_CATS.forEach(function (cat) {
                var inp = document.getElementById('gp-inp-'+_gpId(g.name)+'-'+day+'-'+cat.key);
                if (!inp) return;

                /* focus: تمييز مرئي */
                inp.addEventListener('focus', function () {
                    this.style.borderColor = (GP_COLORS[g.name] || GP_DEFAULT_COLOR).color;
                    this.style.boxShadow   = '0 0 0 2px ' + (GP_COLORS[g.name] || GP_DEFAULT_COLOR).border;
                });
                inp.addEventListener('blur', function () {
                    this.style.borderColor = 'rgba(255,255,255,0.12)';
                    this.style.boxShadow   = '';
                });

                /* input: تحديث فوري للمجاميع + debounce للإرسال */
                inp.addEventListener('input', function () {
                    var v = Math.min(Math.max(Number(this.value)||0, 0), Number(this.dataset.max));
                    _gpRefreshTotals(g.name, day);
                    _gpDebounceSaveDay(g.name, day);
                });
            });
        });

        /* ── حفلة السمر ── */
        var partyInp = document.getElementById('gp-inp-'+_gpId(g.name)+'-party');
        if (partyInp) {
            partyInp.addEventListener('focus', function () {
                this.style.borderColor = '#fbbf24';
                this.style.boxShadow   = '0 0 0 2px rgba(251,191,36,0.4)';
            });
            partyInp.addEventListener('blur', function () {
                this.style.borderColor = 'rgba(255,255,255,0.12)';
                this.style.boxShadow   = '';
            });
            partyInp.addEventListener('input', function () {
                _gpRefreshGrand(g.name);
                _gpDebounceSaveParty(g.name);
            });
        }
    });
}

/* ═══════════════════════════════════════════════
   5. تحديث المجاميع في الواجهة (بدون شبكة)
   ═══════════════════════════════════════════════ */
function _gpRefreshTotals(groupName, day) {
    var pfx      = 'd'+day+'_';
    var dayTotal = 0;
    GP_CATS.forEach(function (cat) {
        var inp = document.getElementById('gp-inp-'+_gpId(groupName)+'-'+day+'-'+cat.key);
        if (inp) dayTotal += Math.min(Number(inp.value)||0, Number(inp.max||999));
    });
    var lbl = document.getElementById('gp-daytot-'+_gpId(groupName)+'-'+day);
    if (lbl) {
        lbl.textContent = dayTotal;
        lbl.style.color = dayTotal >= GP_DAY_MAX ? '#34d399' : '#fbbf24';
    }
    _gpRefreshGrand(groupName);
}

function _gpRefreshGrand(groupName) {
    var grand = 0;
    GP_DAYS.forEach(function (day) {
        GP_CATS.forEach(function (cat) {
            var inp = document.getElementById('gp-inp-'+_gpId(groupName)+'-'+day+'-'+cat.key);
            if (inp) grand += Math.min(Number(inp.value)||0, Number(inp.max||999));
        });
    });
    var partyInp = document.getElementById('gp-inp-'+_gpId(groupName)+'-party');
    if (partyInp) grand += Math.min(Number(partyInp.value)||0, GP_PARTY_MAX);
    grand = Math.min(grand, GP_GRAND_MAX);

    /* تحديث الرقم الكبير والشريط */
    var txt = document.getElementById('gp-grand-text-'+_gpId(groupName));
    if (txt) txt.textContent = grand;
    var sc  = document.getElementById('gp-score-'+_gpId(groupName));
    if (sc)  sc.textContent  = grand;
    var bar = document.getElementById('gp-bar-'+_gpId(groupName));
    if (bar) bar.style.width = Math.min(100, Math.round(grand/GP_GRAND_MAX*100)) + '%';

    return grand;
}

/* ═══════════════════════════════════════════════
   6. Debounce helpers (800ms)
   ═══════════════════════════════════════════════ */
function _gpDebounceSaveDay(groupName, day) {
    var key = groupName + '_d' + day;
    clearTimeout(gpTimers[key]);
    _gpSetStatus(groupName, day, '⏳', '#94a3b8');
    gpTimers[key] = setTimeout(function () {
        _gpSyncDay(groupName, day);
    }, 800);
}

function _gpDebounceSaveParty(groupName) {
    var key = groupName + '_party';
    clearTimeout(gpTimers[key]);
    _gpSetPartyStatus(groupName, '⏳', '#94a3b8');
    gpTimers[key] = setTimeout(function () {
        _gpSyncParty(groupName);
    }, 800);
}

/* ═══════════════════════════════════════════════
   7. الإرسال الفعلي لـ Google Sheets
   ═══════════════════════════════════════════════ */
async function _gpSyncDay(groupName, day) {
    if (!window.DataService) return;
    var key = groupName + '_d' + day;
    if (gpPending[key]) return; /* منع الإرسال المزدوج */
    gpPending[key] = true;

    _gpSetStatus(groupName, day, '☁️ جاري الحفظ...', '#94a3b8');

    var pfx      = 'd'+day+'_';
    var vals     = {};
    var dayTotal = 0;
    GP_CATS.forEach(function (cat) {
        var inp = document.getElementById('gp-inp-'+_gpId(groupName)+'-'+day+'-'+cat.key);
        var v   = inp ? Math.min(Math.max(Number(inp.value)||0,0), Number(inp.max||999)) : 0;
        vals[cat.key] = v;
        dayTotal += v;
    });
    var grand = _gpRefreshGrand(groupName);

    /* تحديث الذاكرة */
    if (!gpScores[groupName]) gpScores[groupName] = {};
    GP_CATS.forEach(function (cat) { gpScores[groupName][pfx+cat.key] = vals[cat.key]; });
    gpScores[groupName][pfx+'total'] = dayTotal;
    gpScores[groupName].grand        = grand;

    try {
        /* إرسال كل فئة في الـ payload بشكل متوازٍ */
        var promises = GP_CATS.map(function (cat) {
            return window.DataService.updateGroupDayScore(
                groupName, day, cat.key,
                vals[cat.key], dayTotal, grand
            );
        });
        var results  = await Promise.all(promises);
        var allOk    = results.every(function (r) { return r && (r.status === 'success' || r.status === 'offline'); });

        if (allOk) {
            _gpSetStatus(groupName, day, '✅ محفوظ', '#34d399');
            setTimeout(function () { _gpSetStatus(groupName, day, '', '#64748b'); }, 2500);
        } else {
            throw new Error('فشل جزئي');
        }
    } catch (e) {
        _gpSetStatus(groupName, day, '❌ فشل الحفظ', '#f87171');
        console.error('groups-panel: sync day failed', groupName, day, e);
        setTimeout(function () { _gpSetStatus(groupName, day, '', '#64748b'); }, 3500);
    } finally {
        gpPending[key] = false;
    }
}

async function _gpSyncParty(groupName) {
    if (!window.DataService) return;
    var key = groupName + '_party';
    if (gpPending[key]) return;
    gpPending[key] = true;

    _gpSetPartyStatus(groupName, '☁️ جاري الحفظ...', '#94a3b8');

    var inp   = document.getElementById('gp-inp-'+_gpId(groupName)+'-party');
    var pts   = inp ? Math.min(Math.max(Number(inp.value)||0,0), GP_PARTY_MAX) : 0;
    var grand = _gpRefreshGrand(groupName);

    if (!gpScores[groupName]) gpScores[groupName] = {};
    gpScores[groupName].party = pts;
    gpScores[groupName].grand = grand;

    try {
        var res = await window.DataService.updatePartyScore(groupName, pts, grand);
        if (res && (res.status === 'success' || res.status === 'offline')) {
            _gpSetPartyStatus(groupName, '✅ محفوظ', '#34d399');
            setTimeout(function () { _gpSetPartyStatus(groupName, '', '#64748b'); }, 2500);
        } else {
            throw new Error(res && res.message ? res.message : 'خطأ');
        }
    } catch (e) {
        _gpSetPartyStatus(groupName, '❌ فشل', '#f87171');
        console.error('groups-panel: sync party failed', groupName, e);
        setTimeout(function () { _gpSetPartyStatus(groupName, '', '#64748b'); }, 3500);
    } finally {
        gpPending[key] = false;
    }
}

/* ═══════════════════════════════════════════════
   8. أدوات مساعدة
   ═══════════════════════════════════════════════ */
function _gpSetStatus(groupName, day, msg, color) {
    var el = document.getElementById('gp-status-'+_gpId(groupName)+'-'+day);
    if (el) { el.textContent = msg; el.style.color = color; }
}

function _gpSetPartyStatus(groupName, msg, color) {
    var el = document.getElementById('gp-status-'+_gpId(groupName)+'-party');
    if (el) { el.textContent = msg; el.style.color = color; }
}

function _gpId(name) {
    return String(name).replace(/\s+/g,'_').replace(/[^a-z0-9_\u0600-\u06ff]/gi,'');
}

function _n(v) {
    var n = Number(v);
    return isNaN(n) ? 0 : n;
}
