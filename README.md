# 阿黑的客字繪卷 工程交接 README

本專案是 2D 橫向跑酷式客語聽力排列遊戲。玩家聽一段客語音檔，將下方單字卡依照聽到的客語漢字順序排列；排對後阿黑過橋，排錯則斷橋、落水、扣分並重試。

目前版本為純靜態前端，可直接部署在 GitHub Pages。核心檔案如下：

```text
index.html          主畫面 DOM 結構
style.css           版面與 UI 樣式
app.js              遊戲流程、字卡邏輯、Canvas 動畫、音效
vue-app.js          Vue 3 最小 shell，目前主要互動仍在 app.js
questions_data.js   目前題庫資料，之後可改為 JSON fetch
data/image/         遊戲圖層與角色素材
data/music/         UI 音效與落水音效
```

## 遊戲玩法流程

1. 玩家進入遊戲後按「開始冒險」。
2. 每題載入一筆題目資料，播放客語音檔。
3. 系統從 `hakka_hanji` 抽出客語漢字，排除標點後，每一個字拆成一張獨立字卡。
4. 玩家可點選或拖曳字卡到回答區排序。
5. 按「搭建」後，比對玩家排序與正確客語漢字序列。
6. 答對：阿黑跑過完整橋，得分並進下一題。
7. 答錯：橋變成斷橋，阿黑跑到斷橋終點後落水，扣 2 分，字卡還原重試。
8. 單題最高 10 分，最低 0 分。分數扣到 0 時會觸發伯公協助通過。
9. 「求助伯公」可直接跳過該題，本題 0 分，顯示透明橋並讓阿黑通過。

主要流程函式：

```text
startGame()
loadQuestion(index)
renderBlocks()
submitAnswer()
askPoKongForHelp()
updateGamePhysics()
drawGameGraphics()
drawBridge()
drawDog()
```

## 題庫資料結構

目前題庫在 `questions_data.js`，格式如下：

```js
{
  question_id: "q_listening_001",
  level: "中",
  category: "情緒用語",
  audio_url: "https://example.com/audio.wav",
  hakka_hanji: "還暢哦，這擺考試𠊎考一百分。",
  correct_sequence: ["好開心", "這次", "考試", "我", "考", "一百分"],
  shuffled_blocks: ["考試", "我", "好開心", "一百分", "這次", "考"]
}
```

目前實際比對不是使用 `correct_sequence`，而是使用：

```js
getHakkaCharacters(q.hakka_hanji)
```

也就是把 `hakka_hanji` 去掉標點後拆成單字：

```text
𠊎試著這題數學還難哦。
=> 𠊎 / 試 / 著 / 這 / 題 / 數 / 學 / 還 / 難 / 哦
```

因此現階段「玩家字卡」是客語漢字單字卡，不是中文翻譯詞卡。

## 題庫篩選建議

目前尚未實作題庫篩選 UI。下一版若要串 JSON，建議在題目資料中加入可篩選欄位：

```js
{
  question_id: "s2_m3_001",
  mission_id: "S2_M3",
  level: "中",
  dialect: "sixian",
  category: "情緒用語",
  difficulty: 2,
  enabled: true,
  audio_url: "...",
  hakka_hanji: "...",
  chinese_hint: "...",
  source: "來上客入口網"
}
```

建議篩選條件：

```text
mission_id：指定本遊戲關卡
enabled：是否上架
level：初 / 中 / 中高 / 高
dialect：六腔
category：情境分類
difficulty：題目難度
max_cards：字卡數量上限
```

若題庫改成 JSON，可將 `questions_data.js` 改為：

```js
async function loadQuestions() {
  const res = await fetch("data/questions.json");
  questions = await res.json();
}
```

GitHub Pages 可讀同 repo 內的 JSON；若串外部 API，API 必須開 CORS。

## 六腔選擇設計

目前畫面只顯示固定文字「四縣腔」，尚未實作六腔切換。

建議六腔代碼：

```text
sixian       四縣腔
hailu        海陸腔
dapu         大埔腔
raoping      饒平腔
zhaoan       詔安腔
south_sixian 南四縣腔
```

建議資料格式有兩種：

### 方案 A：每腔一筆題目

```js
{
  question_id: "s2_m3_001_sixian",
  group_id: "s2_m3_001",
  dialect: "sixian",
  audio_url: "...",
  hakka_hanji: "..."
}
```

優點是篩選簡單；缺點是同題多腔會有資料重複。

### 方案 B：同題內含六腔資料

```js
{
  question_id: "s2_m3_001",
  category: "情緒用語",
  dialects: {
    sixian: {
      audio_url: "...",
      hakka_hanji: "..."
    },
    hailu: {
      audio_url: "...",
      hakka_hanji: "..."
    }
  },
  chinese_hint: "好開心，這次考試我考一百分。"
}
```

建議採用方案 B，因為同一題的中文提示、分類、難度可以共用。

前端切換邏輯建議：

```js
const selectedDialect = "sixian";
const dialectData = q.dialects[selectedDialect];
gameAudio.src = dialectData.audio_url;
const cards = getHakkaCharacters(dialectData.hakka_hanji);
```

## 字卡長度限制

目前 `app.js` 會將 `hakka_hanji` 拆成「一字一卡」，排除標點符號。每張卡最小高度約 52px，候選字卡區可換行。

目前 Canvas 橋寬：

```js
const cliffWidth = 200;
```

橋面會依正確字數平均切分：

```js
const blockWidth = cliffWidth / totalChars;
```

若字卡太多，會發生以下問題：

```text
1. 回答區卡片換行過多，擠壓操作區
2. 橋面每格過窄，視覺上不容易看出橋磚
3. 手機橫式時高度不足
4. 題目太長時，玩家拖曳負擔過高
```

建議限制：

```text
桌機 / 平板橫式：最多 12 字
手機橫式：建議 8～10 字
最低題長：3 字以上
最佳題長：4～10 字
```

題庫篩選時可先計算：

```js
const cardCount = getHakkaCharacters(hakka_hanji).length;
```

建議上架條件：

```text
cardCount >= 3
cardCount <= 10 或 12
```

如果未來要支援更長句，建議改為分段題、兩段橋，或把部分字卡合併成詞卡。

## 動畫架構

動畫使用 HTML5 Canvas，內部固定尺寸：

```js
canvasWidth = 960
canvasHeight = 200
groundY = 140
riverY = 175
cliffWidth = 200
cliffTargetX = 230
```

主要動畫狀態：

```text
running        阿黑跑步，斷崖逐漸靠近
crossing       阿黑過橋
falling        阿黑落下
splashing      落水水花，不再畫狗
recovering     答錯後從上方回到起點
transition_out 答對後離場
transition_in  下一題進場
```

背景圖層繪製順序：

```text
天空底色
S2_m3_grass.png
S2_m3_yamaloop.png
S2_m3_village.png
河面 / 斷口底色
S2_m3_floorloop.png
S2_m3_floorR.png / S2_m3_floorL.png
S2_m3_bridgeA.png / S2_m3_bridgeB.png
水花粒子
阿黑
```

Canvas 規則是「先畫在下，後畫在上」，沒有 Photoshop 那種可視圖層面板。

目前素材：

```text
data/image/S2_m3_yamaloop.png       遠山循環圖
data/image/S2_m3_village.png        村莊循環圖
data/image/S2_m3_grass.png          中景草地補空隙
data/image/S2_m3_floorloop.png      平面地板循環圖
data/image/S2_m3_floorL.png         右側斷崖圖
data/image/S2_m3_floorR.png         左側斷崖圖
data/image/S2_m3_bridgeA.png        完整橋
data/image/S2_m3_bridgeB.png        斷橋，從完整橋左半裁切
data/image/S2_m3_kuro_run.png       阿黑目前遊戲使用圖
```

注意：`floorL / floorR / floorloop` 原圖高度皆為 311px，因此在 Canvas 中應使用相同顯示高度，避免草皮線對不齊。

## 橋與落水邏輯

完整橋使用：

```text
S2_m3_bridgeA.png
```

答錯後使用：

```text
S2_m3_bridgeB.png
```

斷橋 B 是從 A 左半切出，因此 B 與 A 使用相同左上定位，並以 A 的寬度比例縮放。

若玩家放滿字卡但順序錯，落水點設在斷橋圖右端：

```js
wrongBreakX = cliffX - 2 + brokenBridgeWidth;
```

若玩家字卡未放滿，落水點設在玩家已搭出的橋長：

```js
wrongBreakX = cliffX + userBridgeWidth;
```

## 音效架構

題目語音由題庫 `audio_url` 控制：

```js
gameAudio.src = q.audio_url;
```

UI 音效在 `data/music/`：

```text
S2_m2_click.mp3    點擊、字卡操作
S2_m2_false.mp3    答錯
S2_m2_next.mp3     答對、下一題
S2_m3_splash.mp3   阿黑落水
```

音效管理在 `app.js`：

```js
const sfxPath = "data/music/";
function playSfx(name) { ... }
```

## 目前部署

目前已推到：

```text
https://github.com/coinai55741-cyber/Qiankun-Great-Shift_v2
```

GitHub Pages 建議使用 Static HTML workflow，不需要 Jekyll。

預期 Pages 網址：

```text
https://coinai55741-cyber.github.io/Qiankun-Great-Shift_v2/
```

## Git 注意事項

`.gitignore` 已加入：

```gitignore
dummy/
data/dummy/
```

正式部署素材已改放：

```text
data/image/
data/music/
```

不要在程式中再引用 `data/dummy/`。

## 後續建議

1. 將 `questions_data.js` 改成 `data/questions.json`。
2. 加入六腔選擇 UI，並讓題庫依 dialect 載入音檔與漢字。
3. 題庫上架前檢查字卡數量，建議 4～10 字，最多 12 字。
4. 阿黑跑步建議改為 sprite sheet，目前已有 `S2_m3_kuro_run_sheet_6.png` 但尚未接進 Canvas 動畫。
5. 若需記錄玩家成績、帳號、老師後台編輯題目，靜態頁不夠，需要後端 API 或資料庫。
