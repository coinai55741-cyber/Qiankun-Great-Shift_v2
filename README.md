# 阿黑的客字繪卷 工程交接 README

本專案是 2D 橫向跑酷式客語聽力排列遊戲。玩家聽一段客語音檔，將下方單字卡依照聽到的客語漢字順序排列；排對後阿黑過橋，排錯則斷橋、落水、扣分並重試。

目前版本為純靜態前端，沒有建置步驟（不需要 npm / bundler），可直接部署在 GitHub Pages 或任何靜態主機。核心檔案如下：

```text
index.html          主畫面 DOM 結構
style.css           版面與 UI 樣式
app.js              遊戲流程、字卡邏輯、Canvas 動畫、音效、結果頁、毛筆頁串接
vue-app.js          極小的啟動檔（只移除 v-cloak），遊戲互動全部在 app.js，並未使用 Vue
questions_data.js   舊版 fallback 題庫，JSON 載入失敗時使用
brush-prototype/    毛筆書寫關卡（以 iframe 嵌在遊戲裡，也有獨立倉庫版本，見下方「毛筆頁」）
data/quiz/          六腔 × 五級 JSON 題庫，主遊戲會動態載入
data/audio/         題目音檔（mp3）。題庫原本的 .wav 網址實際是 WebM，舊版 iPhone 播不出來，所以用 tools/convert_quiz_audio.py 轉成 mp3 放這裡
data/image/         遊戲圖層與角色素材（大張圖是 WebP，原始 PNG 在 tools/image-source/）
data/fonts/         字型（子集化後的 woff2，原始 OTF 在 tools/font-source/）
data/music/         背景音樂、UI 音效與毛筆音效
data/ui/            UI 小圖示（排行獎牌、返回鈕等）
tools/              素材轉檔、音效產生、截圖回歸驗證等工具（見「素材與工具」）
CREDITS.md          素材、字型、資料來源與授權清單
```

## 交接重點（先看這裡）

1. **排行榜目前是假資料。** `app.js` 的 `leaderboardTop`、`leaderboardStats`（名次、參賽人數、遊玩次數）是寫死的示範資料，結果頁和首頁排行榜都讀這份。正式上線前要接真正的成績服務；玩家分數與時間在結果頁已經算好，只差送出與讀回。
2. **沒有後端，也沒有玩家帳號。** 唯一存在瀏覽器裡的資料是音效開關（`localStorage` 的 `kuro-sound`）。
3. **題目語音來自外部網址。** 題庫 `audio_url` 大多指向 `https://dn9mvjhbyvvpc.cloudfront.net/files/…`（mp3 / m4a / mp4）；只有原本是 .wav 的那批已轉成本機 `data/audio/*.mp3`。換題庫來源時，重新下載題庫後要再跑一次 `tools/convert_quiz_audio.py`。
4. **改了素材、CSS 或 JS 要換版本號。** 頁面用 `?v=` 字串避免舊快取，見下方「快取版本號」。
5. **沒有自動化測試。** 只有畫面回歸工具（`tools/css_snapshot.mjs` + `tools/css_compare.py`），能抓到版面變化，抓不到計分等遊戲邏輯錯誤；改動後要人工完整玩一輪（答對、答錯、錯滿四次、求助伯公、毛筆頁、結果頁）。
6. **素材授權請看 `CREDITS.md`**：哪些已確認、哪些是負責人聲明、哪些還待補。

## 遊戲玩法流程

1. 玩家進入遊戲後按「開始冒險」。
2. 每題載入一筆題目資料，播放客語音檔。
3. 系統從 `hakka_hanji` 抽出客語漢字，排除標點後，每一個字拆成一張獨立字卡。
4. 玩家可點選或拖曳字卡到回答區排序。
5. 按「搭建」後，比對玩家排序與正確客語漢字序列。
6. 答對：阿黑跑過完整橋，得分並進下一題。
7. 答錯：橋變成斷橋，阿黑跑到斷橋終點後落水，扣 4 分，字卡還原重試。
8. 排字單題最高 16 分（16→12→8→4→0），5 題共 80 分；第 4 次答錯時伯公自動協助過橋，本題 0 分。毛筆最高 20 分，合計 100 分。
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
S2_m3_grass.webp
S2_m3_yamaloop.webp
S2_m3_village.webp
河面 / 斷口底色
S2_m3_floorloop.webp
S2_m3_floorR.webp / S2_m3_floorL.webp
S2_m3_bridgeA.webp / S2_m3_bridgeB.webp
水花粒子
阿黑
```

Canvas 規則是「先畫在下，後畫在上」，沒有 Photoshop 那種可視圖層面板。

目前素材：

```text
data/image/S2_m3_yamaloop.webp       遠山循環圖
data/image/S2_m3_village.webp        村莊循環圖
data/image/S2_m3_grass.webp          中景草地補空隙
data/image/S2_m3_floorloop.webp      平面地板循環圖
data/image/S2_m3_floorL.webp         右側斷崖圖
data/image/S2_m3_floorR.webp         左側斷崖圖
data/image/S2_m3_bridgeA.webp        完整橋
data/image/S2_m3_bridgeB.webp        斷橋，從完整橋左半裁切
data/image/kuro_high_frames_keyed/kuro_high_00～07.png    阿黑跑步 8 格逐格動畫（Canvas 逐格切換）
data/image/S2_m3_kuro_falling.webp   阿黑落下
data/image/S2_m3_kuro_wet_shaking.webp、S2_m3_kuro_wet_shake_frame01/02.webp   阿黑落水後甩水
data/image/S2_m3_bokon1.webp         伯公（協助過橋、故事頁）
data/image/kuro_five_stages_v2/      結果頁依成績顯示的五階段阿黑圖
```

注意：`floorL / floorR / floorloop` 原圖高度皆為 311px，因此在 Canvas 中應使用相同顯示高度，避免草皮線對不齊。

## 橋與落水邏輯

完整橋使用：

```text
S2_m3_bridgeA.webp
```

答錯後使用：

```text
S2_m3_bridgeB.webp
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
S2_m2_click.mp3       點擊、字卡操作
S2_m2_false.mp3       答錯
S2_m2_next.mp3        答對、下一題
S2_m3_splash.mp3      阿黑落水
S2_m3_pass.mp3        通過（tools/generate_sfx.py 產生）
S2_m3_help.mp3        伯公協助（tools/generate_sfx.py 產生）
S2_m3_finish.mp3      全部通關（tools/generate_sfx.py 產生）
S2_m3_ink.mp3         毛筆沾墨（tools/generate_sfx.py 產生）
S2_m3_write.mp3       毛筆寫字，可無縫循環（tools/generate_sfx.py 產生）
S2_m3_stamp.mp3       毛筆蓋章（tools/generate_sfx.py 產生）
S2_m3_bgmloop.mp3     背景音樂，16 小節可循環（tools/generate_bgm.py 產生）
S2_m3_story_voice.mp3 故事頁示範語音
```

音效管理在 `app.js`：

```js
const sfxPath = "data/music/";
function playSfx(name) { ... }
```

## 素材與工具

原始素材不放進執行路徑，執行時載入的是轉檔後的版本；要換素材請改原始檔再重新轉檔。

| 工具 | 用途 | 需要 |
| --- | --- | --- |
| `tools/subset_fonts.py` | 把 `tools/font-source/GenSekiGothic2TW-{R,B}.otf`（各約 15 MB）縮成只含用得到字的 woff2，輸出到 `data/fonts/`。題庫或文案出現新的罕用字、畫面上該字變成別的字型時重跑 | fonttools、brotli |
| `tools/convert_images.py` | 把 `data/image/` 下超過 40 KB 的 PNG 轉成 WebP（品質 90、保留透明），原始 PNG 收進 `tools/image-source/`。轉完要把程式裡的 `.png` 路徑改成 `.webp` | Pillow |
| `tools/convert_quiz_audio.py` | 題庫裡實際是 WebM 的 `.wav` 網址轉成本機 mp3（`data/audio/`），並改寫題庫網址；重新抓題庫後再跑一次 | ffmpeg |
| `tools/generate_bgm.py`、`tools/generate_sfx.py` | 用程式合成背景音樂與遊戲／毛筆音效，輸出到 `data/music/` | numpy、ffmpeg |
| `data/quiz/download_quiz.py` | 從題庫服務下載 30 個 JSON | requests |
| `data/quiz/build_offline_bundle.py` | 把 8 字以下題目打包成 `questions_offline.js`，讓 `index.html` 直接用 `file://` 開也能玩；題庫 JSON 變動後要重跑 | — |
| `tools/css_snapshot.mjs` + `tools/css_compare.py` | 畫面回歸驗證，見下一節 | playwright-core、Chrome、Pillow、numpy |

## 快取版本號

頁面對自己的資源加了 `?v=` 字串，避免瀏覽器與 CDN 留著舊檔。改了對應檔案就要換字串，否則使用者可能拿到新 HTML 配舊檔：

```text
index.html     style.css?v=…、app.js?v=…、vue-app.js?v=…、questions_data.js?v=…
app.js         QUIZ_DATA_VERSION（題庫 JSON）、runnerAssetVersion（Canvas 圖層）、sfxVersion（音效）
brush-prototype/index.html   style.css?v=…、app.js?v=…
brush-prototype/style.css    字型網址的 ?v=…
```

`style.css` 裡用 `url()` 載入的圖（例如故事背景 `S2_m3_story_bg.webp`）沒有版本字串，換圖時請換檔名，或連同 `style.css?v=` 一起換。

## 畫面回歸驗證

改 CSS 或版面後，用截圖比對確認沒有意外變化（這套工具不會檢查遊戲邏輯）：

```text
python -m http.server 8791                 （專案根目錄，另開一個終端機）
node tools/css_snapshot.mjs before         走過故事、首頁、答題、毛筆、結果、分享，在 6 種視窗大小各拍一輪
（修改 style.css）
node tools/css_snapshot.mjs after
python tools/css_compare.py before after   列出有差異的截圖，並輸出洋紅色差異圖
```

注意：同時最多跑 2 個視窗大小，更多會讓點擊逾時；故事最後一頁與伯公雲的動畫在寬螢幕偶爾會因載入時機不同而差異，重跑一次確認；圖片轉成有損 WebP 後，逐像素比對會有細小雜訊，要看「差異很大的像素」才有意義。

## 毛筆頁

`brush-prototype/` 是毛筆書寫關卡：從題庫抽五字題，玩家一字一格書寫，系統依筆跡與筆順評分（最高 20 分），完成後產生 1080×1350 的作品圖卡供分享。

- 主遊戲在最後一題後以 iframe 載入 `brush-prototype/index.html?embedded=1&dialect=…`，寫完用 `postMessage`（`brush-complete`，附分數與筆跡）回傳給 `app.js`。
- 筆畫資料 `brush-prototype/strokes/strokes.json` 由 `brush-prototype/tools/build_strokes.py` 產生（題庫換字後要重跑），授權見 `CREDITS.md`。
- 詳細說明、評分方式與已知限制見 `brush-prototype/README.md`。
- 這個資料夾另有一份獨立部署的倉庫 `writing-brush`（https://github.com/coinai55741-cyber/writing-brush）。同步方式：複製 `index.html`、`app.js`、`style.css`，並把 `../data/` 改成 `data/`；獨立倉庫的 README、音效註解與題庫網址（沒有 `?v=`、音檔網址不補路徑）是它自己的版本，同步時不要覆蓋。

## 目前部署

網站全是相對路徑，沒有建置步驟，整個資料夾（`tools/` 不會被網頁載入，可以不放）放到任何靜態主機的子目錄或根目錄都能運作。換部署位置不需要改程式。目前已推到：

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
4. 阿黑跑步目前已是 8 格逐格動畫（`kuro_high_frames_keyed/`）。若想減少請求數，可改成一張 sprite sheet。
5. 若需記錄玩家成績、帳號、老師後台編輯題目，靜態頁不夠，需要後端 API 或資料庫；排行榜目前只是假資料（見「交接重點」）。
