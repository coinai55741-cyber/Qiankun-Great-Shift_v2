# 阿黑的客字繪卷 工程交接 README

本專案是 2D 橫向跑酷式客語聽力排列遊戲。玩家聽一段客語音檔，將下方單字卡依照聽到的客語漢字順序排列；排對後阿黑過橋，排錯則斷橋、落水、扣分並重試。

目前版本為純靜態前端，可直接部署在 GitHub Pages。核心檔案如下：

```text
index.html          主畫面 DOM 結構
style.css           版面與 UI 樣式
app.js              遊戲流程、字卡邏輯、Canvas 動畫、音效
vue-app.js          Vue 3 最小 shell，目前主要互動仍在 app.js
questions_data.js   舊版 fallback 題庫，JSON 載入失敗時使用
data/quiz/          六腔 × 五級 JSON 題庫，主遊戲會動態載入
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

目前正式題庫放在 `data/quiz/`，檔名規則如下：

```text
data/quiz/questions_dialect_{dialectId}_level_{levelNo}.json
```

目前共有 30 個 JSON 檔：

```text
6 腔 × 5 級 = 30 檔
```

`questions_data.js` 仍保留作為載入失敗時的 fallback 題庫。

JSON 題目格式如下：

```js
{
  question_id: "q_listening_d1_l1_c1_1",
  level: "I",
  dialect_id: 1,
  category: "身體認識",
  audio_url: "https://example.com/audio.wav",
  hakka_hanji: "𠊎个牙齒當痛哦！",
  correct_sequence: ["𠊎", "个", "牙", "齒", "當", "痛", "哦"],
  shuffled_blocks: ["𠊎", "哦", "當", "痛", "齒", "个", "牙"],
  chinese_sentence: "我的牙齒好痛！",
  hakka_char_count: 7
}
```

目前 `app.js` 對新 JSON 題庫會優先使用：

```js
q.correct_sequence
q.shuffled_blocks
q.chinese_sentence
q.hakka_char_count
```

舊 fallback 題庫沒有 `chinese_sentence` 時，才會退回使用：

```js
getHakkaCharacters(q.hakka_hanji)
```

也就是把 `hakka_hanji` 去掉標點後拆成單字。

```text
𠊎試著這題數學還難哦。
=> 𠊎 / 試 / 著 / 這 / 題 / 數 / 學 / 還 / 難 / 哦
```

目前「玩家字卡」是客語漢字單字卡，不是中文翻譯詞卡。

## 動態題庫篩選

目前已實作六腔動態載入與字數篩選。流程在 `app.js` 的 `startAdventureBtn` click handler：

```js
const dialectId = selectedDialectId;
const charLimit = 8;

fetch(`data/quiz/questions_dialect_${dialectId}_level_${l}.json`)
```

實際流程：

```text
1. 玩家在開始頁選擇六腔。
2. 按「開始冒險」後，依 selectedDialectId 載入該腔調 I～V 級共 5 個 JSON。
3. 合併 5 個 JSON 的題目。
4. 篩選 hakka_char_count <= 8。
5. 若篩選後為 0 題，改用該腔調全部題目。
6. shuffle 後取 10 題作為本局題目。
7. 更新右上角腔調 badge 和 level badge。
```

目前資料健檢結果：30 個 JSON 都可正常 parse，且每檔 `audio_url`、`hakka_hanji`、`correct_sequence`、`shuffled_blocks`、`chinese_sentence`、`hakka_char_count` 都存在。

注意：GitHub Pages 或本機 HTTP server 可以正常 `fetch(data/quiz/...)`。若直接用 `file:///.../index.html` 開檔，部分瀏覽器會擋本機 JSON fetch。

若未來改串外部 API，API 必須開 CORS。

## 六腔選擇

目前開始頁已實作六腔選擇 UI，按鈕位於 `index.html`：

```html
<button class="dialect-btn active" data-value="1">四縣腔</button>
<button class="dialect-btn" data-value="2">海陸腔</button>
<button class="dialect-btn" data-value="3">大埔腔</button>
<button class="dialect-btn" data-value="4">饒平腔</button>
<button class="dialect-btn" data-value="5">詔安腔</button>
<button class="dialect-btn" data-value="6">南四縣腔</button>
```

目前代碼：

```text
1 四縣腔
2 海陸腔
3 大埔腔
4 饒平腔
5 詔安腔
6 南四縣腔
```

`selectedDialectId` 預設為 `"1"`。玩家點擊腔調按鈕時會更新：

```js
selectedDialectId = btn.dataset.value;
```

開始遊戲後會載入對應 `data/quiz/questions_dialect_{dialectId}_level_{levelNo}.json`。

## 字卡長度限制

目前新 JSON 題庫已預先提供 `correct_sequence` 與 `shuffled_blocks`，每個元素是一張客語漢字字卡。舊 fallback 題庫則由 `hakka_hanji` 去標點後拆成「一字一卡」。每張卡最小高度約 52px，候選字卡區可換行。

目前遊戲開始時固定篩選：

```js
const charLimit = 8;
filtered = allQuestions.filter(q => q.hakka_char_count <= charLimit);
```

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

目前實作限制與建議：

```text
目前遊戲實際篩選：最多 8 字
桌機 / 平板橫式可承受：最多 12 字
手機橫式建議：8～10 字
最低題長：3 字以上
最佳題長：4～10 字
```

新 JSON 已有 `hakka_char_count`，不用前端即時計算。若後續新增題目，可用以下方式產生：

```js
const cardCount = getHakkaCharacters(hakka_hanji).length;
```

建議上架條件仍是：

```text
cardCount >= 3
cardCount <= 8
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

1. 將題庫載入邏輯從 `questionsData` 初始化判斷中拆出，讓 `data/quiz/` 成為完全獨立的正式資料源，`questions_data.js` 只作為可移除的開發備援。
2. 若之後需要更精準控題，可在開始頁加入「等級 / 分類」篩選，目前版本是同一腔調 I～V 級合併後篩 `hakka_char_count <= 8`，再隨機取 10 題。
3. 題庫上架前仍需檢查字卡數量，建議 4～8 字；若要支援 9～12 字，需同步確認回答區換行、橋磚寬度與手機橫式高度。
4. 阿黑跑步未來可改為「逐格動畫」：準備一張 sprite sheet，裡面排列 6 格阿黑跑步姿勢，再由 Canvas 逐格切換播放；目前 Canvas 仍使用單張角色圖 `S2_m3_kuro_run.png`。
5. 若需記錄玩家成績、帳號、老師後台編輯題目，靜態頁不夠，需要後端 API 或資料庫。
