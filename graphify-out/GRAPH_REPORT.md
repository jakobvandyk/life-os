# Graph Report - .  (2026-04-12)

## Corpus Check
- 51 files · ~41,031 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 220 nodes · 310 edges · 41 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]

## God Nodes (most connected - your core abstractions)
1. `set()` - 19 edges
2. `hLine()` - 18 edges
3. `createGrid()` - 14 edges
4. `dots()` - 14 edges
5. `vLine()` - 11 edges
6. `rect()` - 9 edges
7. `fetchData()` - 8 edges
8. `POST()` - 8 edges
9. `GET()` - 8 edges
10. `buildTasks()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `deleteEvent()` --calls--> `fetchData()`  [EXTRACTED]
  src/app/calendar/page.tsx → src/app/knowledge/page.tsx
- `POST()` --calls--> `getMonday()`  [EXTRACTED]
  src/app/api/import/cronometer/route.ts → src/app/api/chat/route.ts
- `POST()` --calls--> `parseOFX()`  [EXTRACTED]
  src/app/api/import/cronometer/route.ts → src/app/api/import/ofx/route.ts
- `GET()` --calls--> `toDateStr()`  [EXTRACTED]
  src/app/api/export/analysis/route.ts → src/app/api/sync/ical/route.ts
- `GET()` --calls--> `toTimeStr()`  [EXTRACTED]
  src/app/api/export/analysis/route.ts → src/app/api/sync/ical/route.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.36
Nodes (24): buildCalendar(), buildChat(), buildDashboard(), buildFinances(), buildGoals(), buildHabits(), buildJournal(), buildKnowledge() (+16 more)

### Community 1 - "Community 1"
Cohesion: 0.14
Nodes (8): buildPayload(), closeModal(), handleDelete(), handleModalSave(), handleSave(), loadFromEntry(), openEditModal(), resetForm()

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (11): addHabit(), addTask(), calculateStreak(), deleteHabit(), deleteTask(), fetchHabits(), fetchTasks(), getExpectedDates() (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.2
Nodes (9): addEvent(), addTag(), closeEditor(), deleteEvent(), deleteNote(), fetchData(), handleImport(), saveNote() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (1): handleExport()

### Community 5 - "Community 5"
Cohesion: 0.31
Nodes (4): getMonday(), parseCSV(), parseOFX(), POST()

### Community 6 - "Community 6"
Cohesion: 0.36
Nodes (5): GET(), getUserId(), sign(), toDateStr(), toTimeStr()

### Community 7 - "Community 7"
Cohesion: 0.29
Nodes (2): fetchSessions(), sendMessage()

### Community 8 - "Community 8"
Cohesion: 0.32
Nodes (3): addGoal(), fetchGoals(), updateKRProgress()

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (0): 

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (2): handleBackToPicker(), handleSaveSession()

### Community 12 - "Community 12"
Cohesion: 0.6
Nodes (5): buildFocusContext(), buildJournalContext(), buildReviewContext(), buildSpendingContext(), toDateStr()

### Community 13 - "Community 13"
Cohesion: 0.5
Nodes (2): fetchRecent(), saveEntry()

### Community 14 - "Community 14"
Cohesion: 0.4
Nodes (0): 

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (2): processSyncQueue(), replayOperation()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (0): 

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.5
Nodes (0): 

### Community 19 - "Community 19"
Cohesion: 0.67
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.67
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 1.0
Nodes (2): fmt(), MetricCards()

### Community 22 - "Community 22"
Cohesion: 1.0
Nodes (0): 

### Community 23 - "Community 23"
Cohesion: 1.0
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (0): 

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Community 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Community 31"
Cohesion: 1.0
Nodes (0): 

### Community 32 - "Community 32"
Cohesion: 1.0
Nodes (0): 

### Community 33 - "Community 33"
Cohesion: 1.0
Nodes (0): 

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **Thin community `Community 22`** (2 nodes): `proxy()`, `proxy.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 23`** (2 nodes): `getExerciseType()`, `constants.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 24`** (2 nodes): `getRpeDotColor()`, `ProgressView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 25`** (2 nodes): `handleLogin()`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 26`** (2 nodes): `SignOutButton()`, `SignOutButton.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (2 nodes): `PixelIcon()`, `PixelIcon.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (2 nodes): `ServiceWorkerRegistrar()`, `ServiceWorkerRegistrar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (2 nodes): `SyncStatus.tsx`, `SyncStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 30`** (2 nodes): `useOnlineStatus.ts`, `useOnlineStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 31`** (2 nodes): `supabase-service.ts`, `getServiceClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 32`** (2 nodes): `supabase-server.ts`, `createClient()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (1 nodes): `next-env.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (1 nodes): `sw.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (1 nodes): `modules.d.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (1 nodes): `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (1 nodes): `DailyView.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (1 nodes): `local-db.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (1 nodes): `supabase.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `toDateStr()` connect `Community 3` to `Community 4`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.14 - nodes in this community are weakly interconnected._