---
authority: null
body_embedding_mode: "gemma"
body_tsv: "'-08':18A,26A,89A '-09':17A,25A,88A '..':111A '02.079':21A '1788890635686':34A '2026':16A,24A,87A '3h':55A '41.003':92A '41.088':29A '4c1dab2f71cb':85A '52':28A,91A '59':20A 'auto':139A 'auto-recov':138A 'bg':148A 'bg-host':147A 'candid':84A 'cannot':122A 'checkpoint':4A,38A 'code':79A 'dbos':150A 'dead':134A 'dead-executor':133A 'detail':35A 'detector':121A 'die':59A 'emit':32A 'engin':151A 'everi':56A 'executor':135A 'exist':80A 'fail':69A,100A 'failingtest':31A 'fals':12A,14A 'fire':45A,131A 'firestal':11A 'frozen':114A 'green':3A,37A,51A,95A,104A 'green-checkpoint':36A 'green-checkpoint-watchdog':2A 'har':6A 'host':149A 'in-routin':117A 'kind':1A 'land':107A 'last':82A 'lastfiredat':15A 'lastgreenat':23A 'look':154A 'main':112A 'name':98A 'need':152A 'null':96A 'one':64A 'persist':145A 'reaper':136A 'record':48A,94A 'recov':140A 'red':53A,74A 'routin':43A,119A,130A 'run':57A,83A,126A 'runtim':10A 'scout':9A 'scout-runtim':8A 'see':123A 'silent':39A 'slug':7A 'stall':40A,120A 'suit':70A 't14':27A,90A 't17':19A 'test':101A 'verdict':50A,76A,105A 'verdictstal':13A 'watchdog':5A,41A 'wedg':142A 'window':110A 'write':63A 'yet':102A 'z':22A,30A,93A"
escalation: "{\"kind\":\"green-checkpoint-watchdog\",\"harness_slug\":\"scout-runtime\",\"fireStale\":false,\"verdictStale\":false,\"lastFiredAt\":\"2026-09-08T17:59:02.079Z\",\"lastGreenAt\":\"2026-09-08T14:52:41.088Z\",\"failingTests\":[],\"emitted_at\":1788890635686,\"detail\":\"green-checkpoint silent stall (watchdog): the routine is FIRING but has recorded NO verdict (green or red) in ~3h — every run is dying before it can write one. This is NOT a failing suite and NOT a red: no verdict about the code exists — The last run (candidate 4c1dab2f71cb) at 2026-09-08T14:52:41.003Z recorded green=null and named no failing test, yet no green verdict has landed in the window.. `main` is frozen and the in-routine stall detector cannot see this (it runs only when the routine fires). The dead-executor reaper should auto-recover a wedge; if this persists the bg-host / DBOS engine needs a look.\"}"
mtime_ms: 1788890635686
phase: "green-checkpoint-watchdog"
risk_tier: null
supervisor_notes: null
---


