# pg-rubik（魔術方塊）

3×3 魔術方塊 Playgrounds SAM：CSS 3D 轉看、轉層、打亂／計時；**最佳紀錄經 `functions.js` → `env.KV`**（與場殼／go／未來 Tauri 同一應用模型）。

## 玩法

- 空白處拖曳：整顆旋轉（orbit）
- 點色塊或 U/D/L/R/F/B 按鈕：轉層
- **打亂** 後開始計時；還原後寫入最佳時間／步數

## API

| 路徑 | 說明 |
| --- | --- |
| `GET/PUT /api/scores` | `{ bestTimeMs, bestMoves }` 於 KV 鍵 `scores:v1` |
| `GET/PUT /api/prefs` | `{ sound }` 於 `prefs:v1` |

UI **不**直寫 `localStorage`／IndexedDB。

## 驗證

- 場殼：`?open=sampot/pg-rubik`（repo 公開後）
- 純玩：`https://go.samkuo.me/s/pg-rubik`（go 須跑 functions＋Web KV）

## License

MIT
