# 魔術方塊（`pg-rubik`）— 遊戲規劃文檔

> **用途：** 本 repo 的遊戲權威規格——coding agent 改動前必讀：這個遊戲是什麼、規則、設計限制、優化方向。
> **整理方式：** 從本 repo 實作反向整理（2026-08-23）。**改玩法先改此檔再改碼**；本檔與程式碼衝突時，以「規則（§3）」描述的設計意圖為準回報差異。
> **上游契約：** [PG-GAME-AGENT-GUIDE.md](https://github.com/sampot/playgrounds/blob/main/docs/PG-GAME-AGENT-GUIDE.md)（唯一必讀；本檔不重複其全文）· 型錄條目 `playgrounds/catalog/entries/pg-rubik.yaml`

## 1. 一句話

CSS 3D 呈現的 3×3 魔術方塊：拖曳轉看、點面或按鈕轉層，打亂後計時計步，還原即記錄最佳——經典魔術方塊的瀏覽器重製，非任一商業作品復刻。

## 2. 定案速覽

| 項 | 值 |
| --- | --- |
| catalog id / kind / series | `pg-rubik` / `game` / `懷舊` |
| status | `listed` |
| 模式 | 單人自由玩＋打亂挑戰；無關卡 |
| 記法 | 標準面轉 **U D L R F B** ＋後綴 `'`／`2`；非法記法拋錯 |
| 成績 | 最佳時間與最佳步數**各自取最小**（KV `scores:v1`） |
| 素材 | CSS 3D cubie 程序繪製；WebAudio 單音 beep；無圖檔 |
| 交付形 | 純 HTML＋CSS＋ESM JS；無 build；**目前無測試** |

## 3. 完整規則（現行實作）

### 3.1 方塊模型（`cube.js`）

- Facelet 模型：6 面 ×9 貼紙，面序 U=0 D=1 F=2 B=3 L=4 R=5；配色 U 白 `#f5f5f5`、D 黃 `#f6d32d`、F 綠 `#3d9a5f`、B 藍 `#3b6fd6`、L 橙 `#e89a2b`、R 紅 `#d64545`。
- `applyMove(faces, "R'")` 等：先正規化（trim＋大寫），旋轉該面 `times` 次（`'`=3、`2`=2），再以三組 `cycle4` 四循環搬動鄰邊條（各面順時針定義）。回傳正規化記法字串。
- `isSolved`＝每面 9 貼紙全同面 index。`invertMove("R'")→"R"`、`"R"→"R'"`、`"R2"→"R2"`。
- 打亂 `scrambleMoves(22)`：22 步、避開連續同面、後綴 `'`/`2`/無均勻隨機。

### 3.2 對局流程與計時（`app.js`）

- `solvedLatched` 初始 true（還原態不計時）。**打亂**＝重置為已解狀態套用亂數、清 history、步數 0、`solvedLatched=false`。
- 打亂後第一個「有記錄」的轉動把步數歸零起算並啟動計時（`Date.now()`，200ms 刻度顯示）；計時連續不因暫停中斷。
- 還原偵測：每次轉動後若 `!solvedLatched && isSolved()` → 停錶、上鎖、beep、PUT `/api/scores {timeMs, moves}`；失敗則提示「這次無法保存最佳紀錄」。
- 已解狀態下再轉動會解除鎖定並重置計時（自由玩模式）。

### 3.3 成績合併與復原

- `functions.js` 端 PUT 合併規則：`bestTimeMs` 取更小、`bestMoves` 取更小（**獨立**最小值，可能來自不同次還原）；首次寫入直接採用。
- 復原一步：history 彈出最後記法取反轉套用，步數 −1（下限 0）；**時間不停不減**。復原成還原態同樣觸發結算。
- 重置：頁內確認面板（說明清步數計時、最佳紀錄保留）。

### 3.4 渲染細節（`render.js`）

- 26 顆 cubie（跳過中心），貼紙顏色固定在 cubie 局部面、僅位置＋旋轉矩陣變化；`paint()` 用於打亂/重置整盤重建。
- 轉層動畫：layer-pivot CSS transition，90°=360ms、180°=480ms，ease-in-out；動畫完 bake 旋轉矩陣。佇列上限 **8** 步防連點堆積。
- Orbit：空白處拖曳（靈敏度 0.4），rotX 鉗 ±80°，初始 rotX=−28° rotY=38°。點任一貼紙＝轉該貼紙當下的世界面。

## 4. 操作與畫面

| 輸入 | 動作 |
| --- | --- |
| 空白處拖曳 | 整顆旋轉視角 |
| 點色塊 / 12 顆面轉鈕（U…B 與 '） | 轉層（排隊動畫） |
| 打亂 / 復原一步 / 重置 | 對應流程（重置需頁內確認） |
| 音效開關 | beep 開/關，偏好存 KV |

- HUD：步數、時間（`m:ss`）、最佳（`0:47 · 63 步` 格式）、音效鈕。
- Mobile-first：44px 觸控目標、場景高 `min(52vh,360px)`；禁原生對話框。

## 5. 持久化（KV 權威）

functions.js 自訂 API（UI 不直碰 KV 鍵；離線時 stub 回 JSON）：

| API / KV key | 內容 | 讀寫時機 |
| --- | --- | --- |
| `GET/PUT/POST/DELETE /api/scores` → KV `scores:v1` | `{bestTimeMs, bestMoves}`（可為 null） | 載入顯示；還原成功 PUT；DELETE 清空 |
| `GET/PUT /api/prefs` → KV `prefs:v1` | `{sound: boolean}`（預設 true） | 載入與切換音效時 |

- UI **不使用 localStorage／IndexedDB**（README 明文約定）。KV 缺席時 `/api/*` 回 503 `kv_unavailable`，UI 退化為「—」照玩。
- 注意：`scores:v1`／`prefs:v1` 為半通用命名，宿主無 per-SAM 命名空間；目前無他遊戲撞鍵（已查核），但改名前須全域 grep。

## 6. 美術／音效／署名

- 無外部素材：cubie／貼紙全由 DOM＋CSS transform 繪製；深色主題固定（`color-scheme: dark`）。
- 音效：單一 WebAudio 振盪器 beep（520Hz、40ms、gain 0.04），無第三方取樣。
- 若未來加入素材：拷進 `assets/`、更新 `ATTRIBUTION.md`（CC0 也須署名）、同步 `sam-manifest.json` files。

## 7. 測試

**零測試**（repo 無任何 `*.test.js`、無 vitest 設定）——明說。最小必測建議（純函式即可覆蓋，不需 DOM）：

1. `applyMove` 恆等性：任意序列接自身反演回到原 facelet（如 `R R'`、`U2 U2`）。
2. 六基本轉的鄰邊條循環方向各一例（對照手算 facelet）。
3. `invertMove` 三種後綴往返；`scrambleMoves` 無連續同面且長度 22。
4. `isSolved` 對已解/單步擾動的判定。
5. functions.js 分數合併（min-time/min-moves 各自保留）——抽出純合併函式或以 mock env 呼叫 fetch 驗證。

## 8. 硬約束（不可違反）

1. 僅 HTML＋CSS＋ESM JS；**無 build**、不入庫 `node_modules`、不安套件；工具一律 `npx <pkg>` 臨時執行。
2. 禁瀏覽器原生 `alert`／`confirm`／`prompt`；重置確認一律頁內 panel。
3. Mobile-first：拖曳與點按皆可用、主操作不可 hover-only。
4. 成績／偏好的唯一權威是 functions.js 的 `/api/*`（背後 env.KV）；禁止裸 localStorage 當權威。
5. 不自行載入 `sdk.js`；宿主注入 `window.PG`。保持 vanilla＋CSS 3D，勿引入 three.js。
6. 改動可執行邏輯前先寫失敗測試（TDD）——本作補測試是第一債。
7. 檔案清單變動須同步 `sam-manifest.json`。
8. 轉動語意（`cube.js` 的面序、配色、cycle4 方向）是渲染與成績的共同地基；改它必須同步 `render.js` 的 `turnMotion` 映射與 §7 測試。

## 9. 優化建議（可玩性與樂趣）

依優先級；實作前先在此登記並補測試。原則：降低上手門檻、強化挑戰節奏，不改變「真實 3×3 轉層」的核心認同。

**高優先**

1. **補齊核心測試**（§7 清單）：facelet 引擎是一切成績可信度的根，現在改任何東西都在裸奔。
2. **新手引導層**：首次進入給三步提示（拖曳轉看→點面轉層→打亂開始計時），以及「這一面已完成的層」高亮微光，讓不會解方塊的人也有階段成就感。
3. **打亂難度分檔**：8 步（輕度）/22 步（標準）/40 步（深度），KV 記住選擇——現行單一 22 步對新手太難、對熟手太短。

**中優先**

4. **單一最佳成績語意可選**：現行時間與步數各自取最小（可能誤導為「同一次」）；加「綜合成績」模式（時間×步數或分開榜）並在 HUD 標示清楚。
5. **還原慶祝升級**：beep 換上行進琶音＋短震動＋彩帶粒子；結算面板顯示本局步數 vs 最佳步數差。
6. **公式提示／教學模式**：提供層先法（LBL）逐步提示按鈕（下一個該轉什麼），大幅拓寬受眾。

**低優先**

7. **音效細分**：轉層（短喀）、打亂（連續喀啦）、還原（琶音）三種合成音色，力度不改規則。
8. **局面分享**：把 facelet 編碼進 URL hash，讓人貼出「殘局挑戰」；解碼走既有 `paint()` 路徑。
