---
authority: null
body_embedding_mode: "gemma"
body_tsv: "'-08':18A,26A '-09':17A,25A '02.784':21A '1788877273936':34A '2026':16A,24A '21':20A,28A '30.446':29A '3h':48A 'activ':49A 'auto':86A 'auto-recov':85A 'bg':95A 'bg-host':94A 'cannot':69A 'checkpoint':4A,38A 'cron':50A 'dbos':97A 'dead':81A 'dead-executor':80A 'detail':35A 'detector':68A 'emit':32A 'engin':98A 'executor':82A 'failingtest':31A 'fals':14A 'fire':46A,78A 'firestal':11A 'frozen':61A 'green':3A,37A 'green-checkpoint':36A 'green-checkpoint-watchdog':2A 'har':6A 'host':96A 'hour':51A 'in-routin':64A 'kind':1A 'lastfiredat':15A 'lastgreenat':23A 'look':101A 'main':59A 'need':99A 'persist':92A 'reaper':83A 'recov':87A 'routin':43A,53A,66A,77A 'run':57A,73A 'runtim':10A 'scheduler/engine':54A 'scout':9A 'scout-runtim':8A 'see':70A 'silent':39A 'slug':7A 'stall':40A,67A 't11':19A,27A 'true':12A 'verdictstal':13A 'watchdog':5A,41A 'wedg':89A 'z':22A,30A"
escalation: "{\"kind\":\"green-checkpoint-watchdog\",\"harness_slug\":\"scout-runtime\",\"fireStale\":true,\"verdictStale\":false,\"lastFiredAt\":\"2026-09-08T11:21:02.784Z\",\"lastGreenAt\":\"2026-09-08T11:21:30.446Z\",\"failingTests\":[],\"emitted_at\":1788877273936,\"detail\":\"green-checkpoint silent stall (watchdog): the routine has not FIRED in ~3h (active, cron hourly) — the routine scheduler/engine is not running it. `main` is frozen and the in-routine stall detector cannot see this (it runs only when the routine fires). The dead-executor reaper should auto-recover a wedge; if this persists the bg-host / DBOS engine needs a look.\"}"
mtime_ms: 1788877273936
phase: "green-checkpoint-watchdog"
risk_tier: null
supervisor_notes: null
---


