# 素材、字型與資料來源

這份清單整理專案裡每一類素材的來源與授權。**「已確認」** 是從檔案內容、授權檔或程式碼可以直接查證的；**「負責人聲明」** 是專案負責人口頭告知、專案裡沒有授權文件可查的；**「待確認」** 是目前還沒有佐證、需要專案負責人補上的。

網頁執行時沒有載入任何第三方 JavaScript 函式庫或外部 CDN 腳本（`vue-app.js` 只是啟動檔，並未使用 Vue）。`tools/` 裡的工具所用的套件（fonttools、Pillow、numpy、playwright-core 等）只在開發時使用，不會隨網站發佈。

## 字型

| 字型 | 用在哪裡 | 授權 | 狀態 |
| --- | --- | --- | --- |
| GenSekiGothic2 TW（R、B） | 全站內文。`data/fonts/GenSekiGothic2TW-{R,B}.woff2` 是子集化版本，完整原檔在 `tools/font-source/` | SIL Open Font License 1.1（原檔字型資訊 nameID 13 的聲明；`http://scripts.sil.org/OFL`），可免費用於個人或商業用途（含印刷、網路、影片、圖片），可再散布與改造 | 已確認。注意：原檔的字型資訊裡沒有記錄著作權人，子集化後的 woff2 也沒有保留授權聲明；OFL 要求散布時附上授權全文，必要時可參考 `data/fonts/OFL-YujiMai.txt` 的條文格式另存一份 |
| Yuji Mai | 首頁標題（`data/fonts/YujiMai-title.woff2`，只含「阿黑的客字繪卷」七字）與毛筆紀念章名（`brush-prototype/fonts/YujiMai-stamp.woff2`，19 字） | SIL Open Font License 1.1，Copyright 2021 The Yuji Project Authors（https://github.com/Kinutafontfactory/Yuji） | 已確認；授權全文在 `data/fonts/OFL-YujiMai.txt` 與 `brush-prototype/fonts/OFL-YujiMai.txt` |

OFL 允許子集化與嵌入網頁，但要求隨附授權全文。更換標題或章名文字後要重新裁切字型，方法見 `brush-prototype/README.md`。

## 毛筆頁的筆畫資料

| 項目 | 來源與授權 | 狀態 |
| --- | --- | --- |
| `brush-prototype/strokes/strokes.json`、`strokes.js` | 由 `brush-prototype/tools/build_strokes.py` 從 hanzi-writer-data 2.0.1（https://github.com/chanind/hanzi-writer-data）取得筆畫輪廓與中心線；Arphic Public License，全文 `brush-prototype/strokes/ARPHICPL.txt` | 已確認 |
| 客語罕用字 𠊎、𫣆、吔 | 資料集沒有，由現有偏旁拼出（𠊎 = ⿰亻厓、𫣆 = ⿰亻恩、吔 = ⿰口也），結構依維基詞典 | 已確認（程式與說明在 `build_strokes.py`） |
| 筆順修正 | 與教育部《國字標準字體筆順學習網》的筆順逐字比對後，修正了數個字（細節見 `brush-prototype/README.md`）。該網站資料授權限非商業教學用途，**比對資料本身沒有放進專案** | 已確認；若政府案要正式採用教育部資料，需另行取得授權 |

Arphic Public License 要求修改後的衍生資料也註明並以同樣授權散布；本專案修正的筆順與拼字在 `strokes.json` 內，請隨專案一併附上 `ARPHICPL.txt`。

## 聲音

| 項目 | 來源 | 狀態 |
| --- | --- | --- |
| `data/music/S2_m3_bgmloop.mp3`（背景音樂） | 由 `tools/generate_bgm.py` 用程式合成（G 大調、116 BPM，撥弦、木魚、鼓、沙鈴），專案自製 | 已確認 |
| `data/music/S2_m3_pass.mp3`、`S2_m3_help.mp3`、`S2_m3_finish.mp3`、`S2_m3_ink.mp3`、`S2_m3_write.mp3`、`S2_m3_stamp.mp3` | 由 `tools/generate_sfx.py` 用程式合成，專案自製 | 已確認 |
| `data/music/S2_m2_click.mp3`、`S2_m2_false.mp3`、`S2_m2_next.mp3`、`S2_m3_splash.mp3` | 沒有產生程式，專案裡沒有來源紀錄 | 負責人聲明：已取得授權（授權文件未放入專案） |
| `data/music/S2_m3_story_voice.mp3`（故事頁示範語音） | 沒有產生程式，專案裡沒有來源紀錄 | 負責人聲明：已取得授權（授權文件未放入專案） |
| 題目語音（`data/audio/*.mp3`，以及題庫 `audio_url` 指向的 `https://dn9mvjhbyvvpc.cloudfront.net/files/…`） | 隨題庫取得；`data/audio/` 是其中原為 WebM 的檔案經 `tools/convert_quiz_audio.py` 轉出的 mp3 | 負責人聲明：已取得授權（授權文件未放入專案） |

## 題庫文字

`data/quiz/*.json`（六腔 × 五級 30 檔）與 `questions_data.js`、`data/quiz/questions_offline.js`：由 `data/quiz/download_quiz.py` 從題庫服務下載，內容含客語漢字、華語翻譯、分類與語音網址。**題庫的著作權人與授權範圍待確認。**

## 圖片

| 項目 | 位置 | 狀態 |
| --- | --- | --- |
| 角色（阿黑、伯公、指導員）、故事背景、跑酷圖層（遠山、村莊、草地、地板、橋）、結果頁五階段圖、首頁羊皮紙與標題卷軸 | `data/image/`；轉檔前的原始 PNG 在 `tools/image-source/` | 負責人聲明：以生成式 AI 製作，已避開既有著作權，可使用（生成工具與當時的服務條款未記錄在專案裡） |
| UI 小圖示（獎牌、返回鈕、勾選圖示、排行榜橫幅） | `data/ui/` | 負責人聲明：同上 |
| 毛筆頁繪卷底圖 | `brush-prototype/asset/scroll.webp`，由 `data/ui/classical-horizontal-scroll-blank.png` 裁切縮小 | 負責人聲明：同上 |
| 分享按鈕圖示（LINE、Threads、Facebook、Instagram） | `brush-prototype/asset/social-icons/*.svg` | **待確認**：檔案格式與 Simple Icons 資料集相同（該資料集以 CC0 釋出），但品牌圖樣的商標權仍屬各公司，使用時需遵守各平台的品牌規範；請確認實際來源 |
| 其他 SVG（音效開關、橋） | `data/ui/sound-icon.svg`、`sound-off-icon.svg`、`data/image/bridge.svg` | **待確認** |

## 仍待補的項目

- 題庫文字的著作權人與授權範圍。
- 社群分享圖示與其他 SVG 的實際來源。
- 「負責人聲明」的項目，如驗收需要書面證明，需另行補上授權文件或生成工具的服務條款紀錄。
