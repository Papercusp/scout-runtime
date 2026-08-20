---
authority: null
body_embedding_mode: "gemma"
body_tsv: "'-08':17A,25A,54A '-19':18A,26A,55A '..':72A '02.825':21A '12h':46A '14.461':58A '15':20A,28A '16':57A '1787149746344':34A '2026':16A,24A,53A '37.314':29A '401b5f6040e7':51A 'auto':100A 'auto-recov':99A 'bg':109A 'bg-host':108A 'candid':50A 'cannot':83A 'checkpoint':4A,38A 'dbos':111A 'dead':95A 'dead-executor':94A 'detail':35A 'detector':82A 'emit':32A 'engin':112A 'executor':96A 'fail':67A 'failingtest':31A 'fals':12A 'fire':92A 'firestal':11A 'frozen':75A 'green':3A,37A,43A 'green-checkpoint':36A 'green-checkpoint-watchdog':2A 'har':6A 'host':110A 'in-routin':78A 'kind':1A 'last':48A 'lastfiredat':15A 'lastgreenat':23A 'look':115A 'main':73A 'name':65A 'need':113A 'persist':106A 'reaper':97A 'recov':101A 'red':62A,71A 'render':60A 'routin':80A,91A 'run':49A,87A 'runtim':10A 'scout':9A 'scout-runtim':8A 'see':84A 'silent':39A 'slug':7A 'stall':40A,81A 't02':27A 't14':19A,56A 'test':68A 'true':14A 'unattribut':70A 'verdict':44A,63A 'verdictstal':13A 'watchdog':5A,41A 'wedg':103A 'z':22A,30A,59A"
escalation: "{\"kind\":\"green-checkpoint-watchdog\",\"harness_slug\":\"scout-runtime\",\"fireStale\":false,\"verdictStale\":true,\"lastFiredAt\":\"2026-08-19T14:15:02.825Z\",\"lastGreenAt\":\"2026-08-19T02:15:37.314Z\",\"failingTests\":[],\"emitted_at\":1787149746344,\"detail\":\"green-checkpoint silent stall (watchdog): no GREEN verdict in ~12h — The last run (candidate 401b5f6040e7) at 2026-08-19T14:16:14.461Z rendered a RED verdict but named no failing test — an unattributable red.. `main` is frozen and the in-routine stall detector cannot see this (it runs only when the routine fires). The dead-executor reaper should auto-recover a wedge; if this persists the bg-host / DBOS engine needs a look.\"}"
mtime_ms: 1787149746344
phase: "green-checkpoint-watchdog"
risk_tier: null
supervisor_notes: null
---


