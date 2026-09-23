/* ==========================================================================
   阿黑的客字繪卷 客語排列遊戲 Logic System
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // State variables
    let questions = [];
    let currentQuestionIndex = 0;
    let selectedBlocks = []; 
    let remainingBlocks = []; 
    
    let correctCount = 0;
    let totalScore = 0;
    let questionScore = 10; // Starts at 10 points per question
    let questionAttempts = 0;
    let questionUsedHelp = false;
    let questionHelpType = '';
    let questionRecords = [];
    let lastUserSequence = [];
    let storyStepIndex = 0;
    
    let gameStartTime = null;
    let questionStartTime = null;
    let totalElapsedSeconds = 0;
    let isAnswerSubmitted = false;
    let draggedBlockId = null;
    let wrongBreakX = null;
    let questionBaseSpeed = 2.0;
    let shouldAutoTransition = false;
    let isTransitioning = false;
    let flashTimer = 0;
    let selectedDialectId = "1"; // Default 四縣腔

    // Audio Element & Controls
    const gameAudio = document.getElementById('game-audio');
    const playAudioBtn = document.getElementById('play-audio-btn');
    const soundwave = document.getElementById('soundwave');

    const sfxPath = 'data/music/';
    const sfxVersion = '20260722-1';
    const sfx = {
        click: new Audio(`${sfxPath}S2_m2_click.mp3?v=${sfxVersion}`),
        wrong: new Audio(`${sfxPath}S2_m2_false.mp3?v=${sfxVersion}`),
        next: new Audio(`${sfxPath}S2_m2_next.mp3?v=${sfxVersion}`),
        splash: new Audio(`${sfxPath}S2_m3_splash.mp3?v=${sfxVersion}`)
    };

    function playSfx(name) {
        const audio = sfx[name];
        if (!audio) return;

        audio.currentTime = 0;
        audio.volume = 0.75;
        audio.play().catch(() => {});
    }
    
    // UI Elements
    const appHeader = document.querySelector('.app-header');
    const storyCard = document.getElementById('story-card');
    const storyCanvas = document.getElementById('story-canvas');
    const storySpeaker = document.getElementById('story-speaker');
    const storyLine = document.getElementById('story-line');
    const storyAvatarImg = document.getElementById('story-avatar-img');
    const storyNextBtn = document.getElementById('story-next-btn');
    const storySkipBtn = document.getElementById('story-skip-btn');
    const bokongAssist = document.getElementById('bokong-assist');
    const introCard = document.getElementById('intro-card');
    const startAdventureBtn = document.getElementById('start-adventure-btn');
    const gameCard = document.getElementById('game-card');
    const resultsCard = document.getElementById('results-card');
    const displayLevel = document.getElementById('display-level');
    const questionNumber = document.getElementById('question-number');
    const scoreDisplay = document.getElementById('score-display');
    const progressBar = document.getElementById('progress-bar');
    const questionCategory = document.getElementById('question-category');


    
    const hintBtn = document.getElementById('hint-btn');
    const hintText = document.getElementById('hint-text');
    const helpBgBtn = document.getElementById('help-bg-btn');
    
    const answerContainer = document.getElementById('answer-container');
    const candidatesContainer = document.getElementById('candidates-container');
    
    const clearBtn = document.getElementById('clear-btn');
    const submitBtn = document.getElementById('submit-btn');
    
    // Feedback Panel
    const feedbackPanel = document.getElementById('feedback-panel');
    const feedbackStatus = document.getElementById('feedback-status');
    const feedbackHakkaHanji = document.getElementById('feedback-hakka-hanji');
    const feedbackTranslation = document.getElementById('feedback-translation');
    const nextBtn = document.getElementById('next-btn');
    
    // Results Panel
    const resultScore = document.getElementById('result-score');
    const resultAccuracy = document.getElementById('result-accuracy');
    const resultTime = document.getElementById('result-time');
    const restartBtn = document.getElementById('restart-btn');
    const resultSummary = document.getElementById('result-summary');
    const rankingSection = document.getElementById('ranking-section');

    // Speed buttons
    const speedButtons = document.querySelectorAll('.speed-btn');

    // ---------------------------------------------------------
    // 2D HTML5 Canvas Runner Game Engine
    // ---------------------------------------------------------
    const canvas = document.getElementById('runner-canvas');
    const ctx = canvas.getContext('2d');
    
    const canvasWidth = 960;
    const canvasHeight = 200;
    let runnerCanvasScale = 1;

    function resizeRunnerCanvasForDisplay() {
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) return;

        const displayScale = Math.max(rect.width / canvasWidth, rect.height / canvasHeight);
        const pixelRatio = window.devicePixelRatio || 1;
        const nextScale = Math.min(4, Math.max(2, Math.ceil(displayScale * pixelRatio)));
        const nextWidth = Math.round(canvasWidth * nextScale);
        const nextHeight = Math.round(canvasHeight * nextScale);

        if (canvas.width !== nextWidth || canvas.height !== nextHeight || runnerCanvasScale !== nextScale) {
            canvas.width = nextWidth;
            canvas.height = nextHeight;
            runnerCanvasScale = nextScale;
        }

        ctx.setTransform(runnerCanvasScale, 0, 0, runnerCanvasScale, 0, 0);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
    }
    const groundY = 140;
    const riverY = 175;
    
    let scrollX = 0;
    let skyScrollX = 0;
    let mountainScrollX = 0;
    let forestScrollX = 0;
    
    let speedMultiplier = 1.0;
    const baseSpeed = 2.0; 
    let activeSpeed = 2.0;
    
    let dogX = 180;
    let dogY = groundY;
    let dogState = 'running'; // 'running', 'crossing', 'falling', 'splashing', 'recovering'
    let dogFrame = 0;
    
    // Cliff settings (Cliff width is 200px)
    let cliffX = 1200; 
    const cliffWidth = 200;
    const cliffTargetX = 230; 
    let hasCliffAppeared = false;
    
    let animationFrameId = null;
    let isGamePaused = false;
    
    // Splash & sparkles particles
    let splashParticles = [];
    let sparkles = [];
    let bridgeAlpha = 0.0;
    let isBridgeTransparent = false;
    let isBridgeBroken = false;

    const runnerAssetPath = 'data/image/';
    const runnerAssetVersion = '20260923-offline-transition1';
    const useRunnerImageLayers = true;
    const runnerAssets = {
        mountains: loadRunnerImage('S2_m3_yamaloop.png'),
        village: loadRunnerImage('S2_m3_village.png'),
        grass: loadRunnerImage('S2_m3_grass.png'),
        floorLoop: loadRunnerImage('S2_m3_floorloop.png'),
        floorLeft: loadRunnerImage('S2_m3_floorL.png'),
        floorRight: loadRunnerImage('S2_m3_floorR.png'),
        bridge: loadRunnerImage('S2_m3_bridgeA.png'),
        brokenBridge: loadRunnerImage('S2_m3_bridgeB.png'),
        kuroRun: loadRunnerImage('../dummy/Codex_角色_透明背景.gif'),
        kuroRunFrames: [
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_00.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_01.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_02.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_03.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_04.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_05.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_06.png'),
            loadRunnerImage('../dummy/kuro_high_frames_keyed/kuro_high_07.png')
        ],
        bokong: loadRunnerImage('S2_m3_bokon1.png')
    };



    const openingStory = [
        { speaker: '指導員', text: '阿黑啊，你現在到了小明家附近的田埂對吧？繪卷有感應到小明今天在發什麼牢騷嗎？' },
        { speaker: '阿黑', text: '汪……指導員，我第一次出任務，聽到村裡小朋友在講客語，可是繪卷突然發光，文字就全部變成字磚掉在地上了……我不知道怎麼排回去呀。' },
        { speaker: '指導員', text: '你是實習小神狗，需要多練習是正常的！' },
        { speaker: '指導員', text: '讓伯公把你的聽力技能加強，你仔細聽好囉～' },
        { speaker: '背景音效', text: '𠊎試著這題數學還難哦' },
        { speaker: '阿黑', text: '啊！聽到了！小明在抱怨數學啦！順序是：「𠊎」➔「試」➔「著」➔「這」➔「題」➔「數」➔「學」➔「還」➔「難」➔「哦」！' },
        { speaker: '場景變化', text: '散落的字磚排回正確順序，伯公的仙光把斷橋接了起來。' },
        { speaker: '阿黑', text: '呼！過來了！伯公，小明抱怨數學的紀錄已經好好的印在繪卷上囉，其他的內容，我等一下帶回去給你讀！' },
        { speaker: '伯公', text: '好好好，這孩子總是怕數學。繼續吧，看看下一條路上還能幫伯公收集到什麼有趣的對話！' }
    ];

    const starResults = [
        { stars: 5, title: '傳音神犬', note: '最高星級，僅授予排名第 1 且滿分 100 分的玩家。', comment: '你的耳朵比雷達還靈敏！繪卷紀錄得一字不漏，伯公讀完開心地哈哈大笑！' },
        { stars: 4, title: '伯公的得力金耳', note: '前 6%～20% 玩家。', comment: '表現得非常出色！伯公戴上老花眼鏡讀得津津有味呢！' },
        { stars: 3, title: '出擊的探聲犬', note: '前 21%～50% 玩家。', comment: '辛苦啦！這卷繪卷成功帶回了大家的聊天內容，伯公看得很開心喔！' },
        { stars: 2, title: '客話蒐集犬', note: '前 51%～80% 玩家。', comment: '哎呀，看來今天剛上任真的很緊張！伯公看著繪卷對你點點頭，阿黑的超級聽力可能還需要多磨練磨練。' },
        { stars: 1, title: '迷糊的小神犬', note: '後 20% 玩家。', comment: '這次的繪卷好多地方都空白了呢！下次出發前，一起先到自學專區聽聽音檔預習一下吧！' }
    ];

    function loadRunnerImage(fileName) {
        const image = new Image();
        image.src = `${runnerAssetPath}${fileName}?v=${runnerAssetVersion}`;
        return image;
    }

    function isImageReady(image) {
        return image && image.complete && image.naturalWidth > 0;
    }

    function getScaledRunnerLayer(image, height, trimX = 0) {
        if (!isImageReady(image)) return null;

        const sourceX = trimX;
        const sourceWidth = image.naturalWidth - trimX * 2;
        const cacheKey = `${Math.round(height)}:${trimX}`;

        if (image._runnerLayerCache && image._runnerLayerCache.key === cacheKey) {
            return image._runnerLayerCache;
        }

        const layer = document.createElement('canvas');
        layer.height = Math.ceil(height);
        layer.width = Math.ceil(sourceWidth * (height / image.naturalHeight));

        const layerCtx = layer.getContext('2d');
        layerCtx.imageSmoothingEnabled = true;
        layerCtx.imageSmoothingQuality = 'high';
        layerCtx.drawImage(
            image,
            sourceX,
            0,
            sourceWidth,
            image.naturalHeight,
            0,
            0,
            layer.width,
            layer.height
        );

        image._runnerLayerCache = {
            key: cacheKey,
            canvas: layer,
            width: layer.width,
            height: layer.height
        };

        return image._runnerLayerCache;
    }

    function drawScrollingImage(image, y, height, scroll, speedScale = 1, trimX = 0) {
        if (!useRunnerImageLayers) return false;

        const layer = getScaledRunnerLayer(image, height, trimX);
        if (!layer) return false;

        const width = layer.width;
        const seamOverlap = 1;
        const offset = -((scroll * speedScale) % width);

        for (let x = offset - width; x < canvasWidth + width; x += width) {
            ctx.drawImage(
                layer.canvas,
                Math.round(x),
                Math.round(y),
                Math.ceil(width) + seamOverlap,
                layer.height
            );
        }

        return true;
    }

    function drawStretchImage(image, x, y, width, height) {
        if (!isImageReady(image)) return false;
        ctx.drawImage(image, x, y, width, height);
        return true;
    }

    function drawImageByHeight(image, x, y, height) {
        if (!isImageReady(image)) return 0;
        const width = image.naturalWidth * (height / image.naturalHeight);
        ctx.drawImage(image, x, y, width, height);
        return width;
    }

    // Helper to extract Hakka character cards excluding punctuation
    function getHakkaCharacters(text) {
        const punctuation = /[\s，。！？、；：""''（）【】《》—～·(),.!?_=\-\+\*\/&%\$#@~`<>\{\}\[\]\\\|]/g;
        return Array.from(text.replace(punctuation, ''));
    }

    // Helper to shuffle array (Fisher-Yates algorithm)
    function shuffleArray(array) {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    // Helper to build Chinese sentence with punctuation matching Hakka phrasing
    function getChineseSentenceWithPunctuation(q) {
        if (q.chinese_sentence) {
            return q.chinese_sentence;
        }
        const chPunctuationMap = {
            "q_listening_001": "好開心，這次考試我考一百分。",
            "q_listening_002": "太棒了，你這次一定很用功。",
            "q_listening_003": "我覺得這題數學好難喔。",
            "q_listening_004": "這一題我會，我教你。",
            "q_listening_005": "我可以幫忙做什麼？",
            "q_listening_006": "你來幫忙摺衣服。",
            "q_listening_007": "我們學校有客家山歌比賽。",
            "q_listening_008": "今天好熱，我一直流汗。",
            "q_listening_009": "主任今天穿得好漂亮喔！",
            "q_listening_010": "謝謝你借我橡皮擦。"
        };
        
        if (chPunctuationMap[q.question_id]) {
            return chPunctuationMap[q.question_id];
        }
        
        // Fallback dynamic mapping for new custom questions
        const punctuationRegex = /[\s，。！？、；：""''（）【】《》—～·(),.!?_=\-\+\*\/&%\$#@~`<>\{\}\[\]\\\|]/g;
        let hakkaClean = "";
        let punctuationList = [];
        
        for (let i = 0; i < q.hakka_hanji.length; i++) {
            const char = q.hakka_hanji[i];
            if (char.match(punctuationRegex)) {
                punctuationList.push({
                    afterCharIndex: Array.from(hakkaClean).length,
                    punctuation: char
                });
            } else {
                hakkaClean += char;
            }
        }
        
        let result = "";
        let currentChineseLength = 0;
        const totalChineseLength = Array.from(q.correct_sequence.join('')).length;
        const hakkaLength = Array.from(hakkaClean).length;
        
        for (let wIdx = 0; wIdx < q.correct_sequence.length; wIdx++) {
            const word = q.correct_sequence[wIdx];
            result += word;
            currentChineseLength += Array.from(word).length;
            
            const correspondingHakkaIndex = Math.floor(currentChineseLength * (hakkaLength / totalChineseLength));
            
            for (let pIdx = 0; pIdx < punctuationList.length; pIdx++) {
                const p = punctuationList[pIdx];
                if (p.afterCharIndex === correspondingHakkaIndex && !p.added) {
                    result += p.punctuation;
                    p.added = true;
                }
            }
        }
        
        punctuationList.forEach(p => {
            if (!p.added) {
                result += p.punctuation;
            }
        });
        
        return result;
    }

    // 1. Initial Load
    function init() {
        if (typeof questionsData !== 'undefined') {
            questions = questionsData;
            setupEventListeners();
            setupCanvasEngine();
            setupStoryScene();
            
            // Wait for user to click Start Adventure button to start the game
            if (startAdventureBtn && introCard) {
                startAdventureBtn.addEventListener('click', () => {
                    playSfx('click');
                    
                    const dialectId = selectedDialectId;
                    const charLimit = 8; // Force max 8 characters as per instruction
                    
                    startAdventureBtn.disabled = true;
                    const originalBtnText = startAdventureBtn.innerHTML;
                    startAdventureBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 載入題庫中...';
                    
                    // Fetch all 5 levels for the selected dialect concurrently
                    const fetchPromises = [];
                    for (let l = 1; l <= 5; l++) {
                        fetchPromises.push(
                            fetch(`data/quiz/questions_dialect_${dialectId}_level_${l}.json`)
                                .then(res => res.json())
                                .catch(err => {
                                    console.warn(`無法載入腔調 ${dialectId} 級別 ${l}`, err);
                                    return [];
                                })
                        );
                    }
                    
                    Promise.all(fetchPromises)
                        .then(results => {
                            let allQuestions = [];
                            results.forEach(resList => {
                                allQuestions = allQuestions.concat(resList);
                            });
                            
                            // Filter questions by length <= 8
                            let filtered = allQuestions.filter(q => q.hakka_char_count <= charLimit);
                            if (filtered.length === 0) {
                                alert("在此腔調下，無符合 8 字元以下的題目！將載入該腔調之全數題目。");
                                filtered = allQuestions;
                            }
                            
                            // Shuffle and slice to 10 questions max for a game session
                            questions = shuffleArray(filtered).slice(0, 10);
                            
                            const dialectNames = {
                                "1": "四縣腔",
                                "2": "海陸腔",
                                "3": "大埔腔",
                                "4": "饒平腔",
                                "5": "詔安腔",
                                "6": "南四縣腔"
                            };
                            const displayDialect = document.querySelector('.badge-dialect');
                            if (displayDialect) {
                                displayDialect.textContent = dialectNames[dialectId];
                            }
                            
                            if (displayLevel) {
                                displayLevel.classList.remove('hidden');
                                if (questions.length > 0) {
                                    displayLevel.textContent = questions[0].level + '級';
                                }
                            }
                            
                            startAdventureBtn.disabled = false;
                            startAdventureBtn.innerHTML = originalBtnText;
                            introCard.classList.add('hidden');
                            startGame();
                        })
                        .catch(err => {
                            console.error("動態載入客語題庫失敗，將載入預設第一課", err);
                            questions = questionsData;
                            startAdventureBtn.disabled = false;
                            startAdventureBtn.innerHTML = originalBtnText;
                            introCard.classList.add('hidden');
                            startGame();
                        });
                });
            } else {
                startGame();
            }
        } else {
            console.error('無法載入題庫資料 questionsData');
            alert('遊戲內容加載失敗，請確認 questions_data.js 是否被正確載入。');
        }
    }

    function setupStoryScene() {
        if (!storyCard) return;
        if (appHeader) appHeader.classList.remove('hidden');
        renderStoryStep();
        drawStoryScene();
        if (storyNextBtn) {
            storyNextBtn.addEventListener('click', () => {
                playSfx('click');
                storyStepIndex++;
                if (storyStepIndex >= openingStory.length) showIntroCard();
                else renderStoryStep();
            });
        }
        if (storySkipBtn) {
            storySkipBtn.addEventListener('click', () => {
                playSfx('click');
                showIntroCard();
            });
        }
    }

    function renderStoryStep() {
        const step = openingStory[storyStepIndex] || openingStory[0];
        if (storySpeaker) storySpeaker.textContent = step.speaker;
        if (storyLine) storyLine.textContent = step.text;
        if (storyAvatarImg) {
            const isBokong = step.speaker === '伯公';
            const isGuide = step.speaker === '指導員' || step.speaker === '背景音效' || step.speaker === '場景變化';
            storyAvatarImg.src = isBokong ? 'data/image/S2_m3_bokon1.png' : 'data/dummy/Codex_角色_透明背景.gif';
            storyAvatarImg.alt = isBokong ? '伯公頭像' : (isGuide ? '指導員頭像' : '阿黑頭像');
            storyAvatarImg.className = isBokong ? 'avatar-bokong' : (isGuide ? 'avatar-guide' : 'avatar-kuro');
        }
        if (storyNextBtn) {
            storyNextBtn.innerHTML = storyStepIndex >= openingStory.length - 1
                ? '<i class="fa-solid fa-scroll"></i> 進入任務說明'
                : '繼續 <i class="fa-solid fa-arrow-right"></i>';
        }
    }

    function showIntroCard() {
        if (storyCard) storyCard.classList.add('hidden');
        if (appHeader) appHeader.classList.add('hidden');
        if (introCard) introCard.classList.remove('hidden');
    }

    function drawStoryScene() {
        if (!storyCanvas) return;
        const storyCtx = storyCanvas.getContext('2d');
        const width = storyCanvas.width;
        const height = storyCanvas.height;
        storyCtx.clearRect(0, 0, width, height);
        const sky = storyCtx.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, '#9ee5f1');
        sky.addColorStop(0.55, '#dff8df');
        sky.addColorStop(1, '#f5d487');
        storyCtx.fillStyle = sky;
        storyCtx.fillRect(0, 0, width, height);
        drawStoryHills(storyCtx, width, height);
        drawStoryField(storyCtx, width, height);
        drawStoryDog(storyCtx, 250, 292);
        drawStoryGuide(storyCtx, 122, 282);
        drawStoryScroll(storyCtx, 342, 292);
        if (isImageReady(runnerAssets.bokong)) {
            storyCtx.globalAlpha = 0.58;
            storyCtx.drawImage(runnerAssets.bokong, 612, 20, 270, 270);
            storyCtx.globalAlpha = 1;
        }
    }

    function drawStoryHills(storyCtx, width, height) {
        storyCtx.fillStyle = 'rgba(98, 178, 186, .42)';
        storyCtx.beginPath();
        storyCtx.moveTo(0, 176);
        for (let x = 0; x <= width; x += 80) storyCtx.quadraticCurveTo(x + 40, 120, x + 80, 176);
        storyCtx.lineTo(width, height);
        storyCtx.lineTo(0, height);
        storyCtx.fill();
        storyCtx.fillStyle = 'rgba(127, 185, 121, .6)';
        storyCtx.beginPath();
        storyCtx.moveTo(0, 238);
        for (let x = 0; x <= width; x += 100) storyCtx.quadraticCurveTo(x + 50, 194, x + 100, 238);
        storyCtx.lineTo(width, height);
        storyCtx.lineTo(0, height);
        storyCtx.fill();
    }

    function drawStoryField(storyCtx, width, height) {
        storyCtx.fillStyle = '#83ba49';
        storyCtx.fillRect(0, 292, width, height - 292);
        storyCtx.fillStyle = '#c7862a';
        storyCtx.fillRect(0, 330, width, 90);
        storyCtx.strokeStyle = 'rgba(98, 64, 22, .32)';
        storyCtx.lineWidth = 2;
        for (let x = -20; x < width; x += 58) {
            storyCtx.beginPath();
            storyCtx.moveTo(x, 338);
            storyCtx.quadraticCurveTo(x + 26, 370, x + 72, 416);
            storyCtx.stroke();
        }
    }

    function drawStoryGuide(storyCtx, x, y) {
        storyCtx.save();
        storyCtx.translate(x, y);
        storyCtx.fillStyle = '#f0c38f';
        storyCtx.beginPath();
        storyCtx.arc(0, -42, 22, 0, Math.PI * 2);
        storyCtx.fill();
        storyCtx.fillStyle = '#2e6f5b';
        storyCtx.fillRect(-26, -20, 52, 58);
        storyCtx.fillStyle = '#f7e4bd';
        storyCtx.fillRect(-18, -78, 36, 18);
        storyCtx.fillStyle = '#4c3528';
        storyCtx.fillRect(-8, -80, 16, 6);
        storyCtx.strokeStyle = '#4c3528';
        storyCtx.lineWidth = 4;
        storyCtx.beginPath();
        storyCtx.moveTo(18, -10);
        storyCtx.lineTo(52, 20);
        storyCtx.stroke();
        storyCtx.restore();
    }

    function drawStoryDog(storyCtx, x, y) {
        storyCtx.save();
        storyCtx.translate(x, y);
        storyCtx.fillStyle = '#182027';
        storyCtx.beginPath();
        storyCtx.ellipse(0, 0, 54, 28, 0, 0, Math.PI * 2);
        storyCtx.fill();
        storyCtx.beginPath();
        storyCtx.arc(48, -22, 26, 0, Math.PI * 2);
        storyCtx.fill();
        storyCtx.fillStyle = '#f6c04f';
        storyCtx.fillRect(16, -28, 32, 10);
        storyCtx.fillStyle = '#fff';
        storyCtx.beginPath();
        storyCtx.arc(54, -28, 5, 0, Math.PI * 2);
        storyCtx.fill();
        storyCtx.fillStyle = '#101010';
        storyCtx.beginPath();
        storyCtx.arc(56, -27, 2, 0, Math.PI * 2);
        storyCtx.fill();
        storyCtx.strokeStyle = '#182027';
        storyCtx.lineWidth = 10;
        storyCtx.beginPath();
        storyCtx.moveTo(-48, -12);
        storyCtx.quadraticCurveTo(-86, -48, -58, -76);
        storyCtx.stroke();
        storyCtx.restore();
    }

    function drawStoryScroll(storyCtx, x, y) {
        storyCtx.save();
        storyCtx.translate(x, y);
        storyCtx.fillStyle = '#fff5cf';
        storyCtx.strokeStyle = '#9a6934';
        storyCtx.lineWidth = 4;
        storyCtx.beginPath();
        storyCtx.roundRect(0, -36, 210, 72, 12);
        storyCtx.fill();
        storyCtx.stroke();
        storyCtx.fillStyle = '#4f3b2c';
        storyCtx.font = '700 22px "Noto Sans TC", sans-serif';
        storyCtx.fillText('𠊎 試 著 這 題', 24, -4);
        storyCtx.fillText('數 學 還 難 哦', 24, 25);
        storyCtx.restore();
    }

    // 2. Event Listeners Setup
    function setupEventListeners() {
        // Dialect Buttons Selection
        const dialectButtons = document.querySelectorAll('.dialect-btn');
        dialectButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                dialectButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedDialectId = btn.dataset.value;
                playSfx('click');
            });
        });
// Audio Controls
        playAudioBtn.addEventListener('click', () => {
            playSfx('click');
            toggleAudio();
        });
        gameAudio.addEventListener('play', onAudioPlay);
        gameAudio.addEventListener('pause', onAudioPause);
        gameAudio.addEventListener('ended', onAudioEnded);

        // Hint Toggle
        hintBtn.addEventListener('click', () => {
            playSfx('click');
            toggleHint();
        });
        
        // Help Po Kong Skip Button
        helpBgBtn.addEventListener('click', () => {
            playSfx('click');
            askPoKongForHelp();
        });

        // Action Buttons
        clearBtn.addEventListener('click', () => {
            playSfx('click');
            clearSelection();
        });
        submitBtn.addEventListener('click', submitAnswer);
        nextBtn.addEventListener('click', () => {
            playSfx('next');
            nextQuestion();
        });
        restartBtn.addEventListener('click', () => {
            playSfx('click');
            startGame();
        });

        // Speed Controls
        speedButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                playSfx('click');
                speedButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                speedMultiplier = parseFloat(btn.dataset.speed);
                
                // Keep audio speed at 1x
                gameAudio.playbackRate = 1.0;
                activeSpeed = questionBaseSpeed * speedMultiplier;
            });
        });

        // Container Drag and Drop Drop-zones
        answerContainer.addEventListener('dragover', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
        });
        
        answerContainer.addEventListener('drop', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
            
            const dataIdStr = e.dataTransfer.getData('text/plain');
            const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
            
            if (draggedId === null || isNaN(draggedId)) return;
            
            if (e.target === answerContainer || e.target.classList.contains('empty-state')) {
                const dragInRemainingIdx = remainingBlocks.findIndex(b => b.id === draggedId);
                if (dragInRemainingIdx > -1) {
                    const block = remainingBlocks[dragInRemainingIdx];
                    remainingBlocks.splice(dragInRemainingIdx, 1);
                    selectedBlocks.push(block);
                    renderBlocks();
                }
            }
        });
        
        candidatesContainer.addEventListener('dragover', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
        });
        
        candidatesContainer.addEventListener('drop', (e) => {
            if (isAnswerSubmitted) return;
            e.preventDefault();
            
            const dataIdStr = e.dataTransfer.getData('text/plain');
            const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
            
            if (draggedId === null || isNaN(draggedId)) return;
            
            if (e.target === candidatesContainer) {
                const dragInSelectedIdx = selectedBlocks.findIndex(b => b.id === draggedId);
                if (dragInSelectedIdx > -1) {
                    const block = selectedBlocks[dragInSelectedIdx];
                    selectedBlocks.splice(dragInSelectedIdx, 1);
                    remainingBlocks.push(block);
                    renderBlocks();
                }
            }
        });

        // Keyboard support (Space to play audio, Enter to submit/next)
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.target.matches('button, input, textarea')) {
                e.preventDefault();
                toggleAudio();
            }
            if (e.code === 'Enter' && !submitBtn.disabled && !isAnswerSubmitted) {
                e.preventDefault();
                submitAnswer();
            } else if (e.code === 'Enter' && isAnswerSubmitted && !feedbackPanel.classList.contains('hidden')) {
                e.preventDefault();
                nextQuestion();
            }
        });
    }

    // 3. Start/Restart Game
    function startGame() {
        if (appHeader) appHeader.classList.remove('hidden');
        correctCount = 0;
        totalScore = 0;
        questionRecords = [];
        currentQuestionIndex = 0;
        totalElapsedSeconds = 0;
        gameStartTime = new Date();
        
        resultsCard.classList.add('hidden');
        gameCard.classList.remove('hidden');
        if (introCard) introCard.classList.add('hidden');
        if (storyCard) storyCard.classList.add('hidden');
        gameCard.classList.remove('fade-out');
        
        shouldAutoTransition = false;
        isTransitioning = false;
        flashTimer = 0;
        
        loadQuestion(currentQuestionIndex);
    }

    // 4. Load Question at Index
    function loadQuestion(index) {
        if (index >= questions.length) {
            showResults();
            return;
        }

        const q = questions[index];
        isAnswerSubmitted = false;
        questionScore = 10; // Start with 10 points
        questionAttempts = 0;
        questionUsedHelp = false;
        questionHelpType = '';
        lastUserSequence = [];
        questionStartTime = new Date();
        shouldAutoTransition = false;
        flashTimer = 0;

        const inlineMsg = document.getElementById('inline-feedback-msg');
        if (inlineMsg) {
            inlineMsg.textContent = '';
            inlineMsg.classList.add('hidden');
        }

        if (bokongAssist) bokongAssist.classList.add('hidden');

        // Reset Canvas Position
        resetCanvasForQuestion(q);

        // Clear any previous play listener to avoid playing multiple files
        if (gameAudio._playListener) {
            gameAudio.removeEventListener('canplay', gameAudio._playListener);
        }

        // Stop any playing audio
        gameAudio.pause();
        gameAudio.src = q.audio_url;
        gameAudio.load();
        gameAudio.playbackRate = 1.0; // Keep audio at 1x speed

        // Update Text Info
        if (displayLevel) {
            displayLevel.textContent = q.level + '級';
            displayLevel.classList.remove('hidden');
        }
        if (questionCategory) {
            questionCategory.textContent = '';
        }
        questionNumber.textContent = `第 ${index + 1} / ${questions.length} 題`;
        scoreDisplay.textContent = `得分: ${totalScore}`;
        
        // Update Progress Bar
        const progressPercent = ((index + 1) / questions.length) * 100;
        progressBar.style.width = `${progressPercent}%`;

        // Reset Hint to Chinese translation sentence with punctuation
        hintText.textContent = getChineseSentenceWithPunctuation(q);
        hintText.classList.add('hidden');
        hintText.style.color = '';
        hintBtn.classList.remove('is-flipped', 'btn-secondary');
        hintBtn.classList.add('btn-primary');
        hintBtn.setAttribute('aria-pressed', 'false');
        hintBtn.innerHTML = `
            <span class="hint-card-face hint-card-front"><i class="fa-regular fa-lightbulb"></i> 顯示中文翻譯提示</span>
            <span class="hint-card-face hint-card-back">${hintText.textContent}</span>
        `;

        // Enable Po Kong Help skip button
        helpBgBtn.disabled = false;

        // Extract Hakka characters dynamically as block cards (or use pre-defined sequence from JSON)
        const hakkaChars = q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
        const shuffledHakka = q.chinese_sentence ? (q.shuffled_blocks || shuffleArray(hakkaChars)) : shuffleArray(hakkaChars);

        // Setup Blocks with Unique IDs (to handle identical strings properly)
        selectedBlocks = [];
        remainingBlocks = shuffledHakka.map((text, idx) => ({
            id: idx,
            text: text
        }));

        // Reset Panels
        feedbackPanel.classList.add('hidden');
        feedbackPanel.classList.remove('correct', 'incorrect');
        submitBtn.classList.remove('hidden');
        submitBtn.disabled = true;
        clearBtn.disabled = true;

        renderBlocks();
        
        // Auto play audio when ready
        gameAudio._playListener = function() {
            if (gameAudio.paused) {
                gameAudio.play().catch(e => {
                    console.log("Autoplay blocked: user interaction required.", e);
                });
            }
            gameAudio.removeEventListener('canplay', gameAudio._playListener);
            gameAudio._playListener = null;
        };
        gameAudio.addEventListener('canplay', gameAudio._playListener);
    }

    // 5. Render Blocks to UI
    function renderBlocks() {
        answerContainer.innerHTML = '';
        candidatesContainer.innerHTML = '';

        // Render Answer Container (Placed Blocks)
        if (selectedBlocks.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'empty-state';
            emptyEl.textContent = '從右側挑選字卡，依聽到的順序搭橋';
            answerContainer.appendChild(emptyEl);
        } else {
            selectedBlocks.forEach(block => {
                const btn = document.createElement('button');
                btn.className = 'word-block placed';
                btn.textContent = block.text;
                btn.dataset.id = block.id;
                
                if (!isAnswerSubmitted) {
                    btn.addEventListener('click', () => deselectBlock(block.id));
                    
                    // HTML5 Drag and Drop Setup
                    btn.setAttribute('draggable', 'true');
                    btn.addEventListener('dragstart', (e) => {
                        draggedBlockId = block.id;
                        btn.classList.add('dragging');
                        e.dataTransfer.setData('text/plain', String(block.id));
                    });
                    btn.addEventListener('dragend', () => {
                        btn.classList.remove('dragging');
                        draggedBlockId = null;
                        document.querySelectorAll('.word-block').forEach(el => el.classList.remove('drag-over', 'insert-before', 'insert-after'));
                    });
                    btn.addEventListener('dragover', (e) => {
                        e.preventDefault();
                        if (draggedBlockId !== null && draggedBlockId !== block.id) {
                            const rect = btn.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            if (x < rect.width / 2) {
                                btn.classList.add('insert-before');
                                btn.classList.remove('insert-after');
                            } else {
                                btn.classList.add('insert-after');
                                btn.classList.remove('insert-before');
                            }
                        }
                    });
                    btn.addEventListener('dragenter', (e) => {
                        e.preventDefault();
                        if (draggedBlockId !== null && draggedBlockId !== block.id) {
                            btn.classList.add('drag-over');
                        }
                    });
                    btn.addEventListener('dragleave', () => {
                        btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                    });
                    btn.addEventListener('drop', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const rect = btn.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const dropAfter = x >= rect.width / 2;
                        
                        btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                        const dataIdStr = e.dataTransfer.getData('text/plain');
                        const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
                        if (draggedId !== null && !isNaN(draggedId) && draggedId !== block.id) {
                            handleBlockDrop(draggedId, block.id, dropAfter);
                        }
                    });
                } else {
                    btn.style.cursor = 'default';
                }
                
                answerContainer.appendChild(btn);
            });
        }

        // Render Candidate Container
        remainingBlocks.forEach(block => {
            const btn = document.createElement('button');
            btn.className = 'word-block';
            btn.textContent = block.text;
            btn.dataset.id = block.id;

            if (!isAnswerSubmitted) {
                btn.addEventListener('click', () => selectBlock(block.id));
                
                // HTML5 Drag and Drop Setup
                btn.setAttribute('draggable', 'true');
                btn.addEventListener('dragstart', (e) => {
                    draggedBlockId = block.id;
                    btn.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', String(block.id));
                });
                btn.addEventListener('dragend', () => {
                    btn.classList.remove('dragging');
                    draggedBlockId = null;
                    document.querySelectorAll('.word-block').forEach(el => el.classList.remove('drag-over', 'insert-before', 'insert-after'));
                });
                btn.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    if (draggedBlockId !== null && draggedBlockId !== block.id) {
                        const rect = btn.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        if (x < rect.width / 2) {
                            btn.classList.add('insert-before');
                            btn.classList.remove('insert-after');
                        } else {
                            btn.classList.add('insert-after');
                            btn.classList.remove('insert-before');
                        }
                    }
                });
                btn.addEventListener('dragenter', (e) => {
                    e.preventDefault();
                    if (draggedBlockId !== null && draggedBlockId !== block.id) {
                        btn.classList.add('drag-over');
                    }
                });
                btn.addEventListener('dragleave', () => {
                    btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                });
                btn.addEventListener('drop', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    const rect = btn.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const dropAfter = x >= rect.width / 2;
                    
                    btn.classList.remove('drag-over', 'insert-before', 'insert-after');
                    const dataIdStr = e.dataTransfer.getData('text/plain');
                    const draggedId = dataIdStr ? parseInt(dataIdStr, 10) : draggedBlockId;
                    if (draggedId !== null && !isNaN(draggedId) && draggedId !== block.id) {
                        handleBlockDrop(draggedId, block.id, dropAfter);
                    }
                });
            } else {
                btn.style.cursor = 'default';
                btn.style.opacity = '0.5';
            }

            candidatesContainer.appendChild(btn);
        });

        // Update Action Buttons States
        if (!isAnswerSubmitted) {
            clearBtn.disabled = selectedBlocks.length === 0;
            submitBtn.disabled = selectedBlocks.length === 0;
        }
    }

    // 6. Block Movements
    function selectBlock(id) {
        const index = remainingBlocks.findIndex(b => b.id === id);
        if (index > -1) {
            playSfx('click');
            const block = remainingBlocks[index];
            remainingBlocks.splice(index, 1);
            selectedBlocks.push(block);
            renderBlocks();
        }
    }

    // Handle block dropping for reordering and swapping with visual insert support
    function handleBlockDrop(draggedId, targetId, dropAfter = false) {
        if (isAnswerSubmitted) return;
        
        // Find which array draggedId and targetId belong to
        const dragInSelectedIdx = selectedBlocks.findIndex(b => b.id === draggedId);
        const dragInRemainingIdx = remainingBlocks.findIndex(b => b.id === draggedId);
        
        const targetInSelectedIdx = selectedBlocks.findIndex(b => b.id === targetId);
        const targetInRemainingIdx = remainingBlocks.findIndex(b => b.id === targetId);
        
        // Case 1: Reordering within selectedBlocks
        if (dragInSelectedIdx > -1 && targetInSelectedIdx > -1) {
            const block = selectedBlocks[dragInSelectedIdx];
            selectedBlocks.splice(dragInSelectedIdx, 1);
            let newTargetIdx = selectedBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            selectedBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 2: Dragging from remaining to selected (insert at target index)
        else if (dragInRemainingIdx > -1 && targetInSelectedIdx > -1) {
            const block = remainingBlocks[dragInRemainingIdx];
            remainingBlocks.splice(dragInRemainingIdx, 1);
            let newTargetIdx = selectedBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            selectedBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 3: Dragging from selected to remaining (insert at target index)
        else if (dragInSelectedIdx > -1 && targetInRemainingIdx > -1) {
            const block = selectedBlocks[dragInSelectedIdx];
            selectedBlocks.splice(dragInSelectedIdx, 1);
            let newTargetIdx = remainingBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            remainingBlocks.splice(newTargetIdx, 0, block);
        }
        // Case 4: Reordering within remainingBlocks
        else if (dragInRemainingIdx > -1 && targetInRemainingIdx > -1) {
            const block = remainingBlocks[dragInRemainingIdx];
            remainingBlocks.splice(dragInRemainingIdx, 1);
            let newTargetIdx = remainingBlocks.findIndex(b => b.id === targetId);
            if (dropAfter) {
                newTargetIdx += 1;
            }
            remainingBlocks.splice(newTargetIdx, 0, block);
        }
        
        renderBlocks();
    }

    function deselectBlock(id) {
        const index = selectedBlocks.findIndex(b => b.id === id);
        if (index > -1) {
            playSfx('click');
            const block = selectedBlocks[index];
            selectedBlocks.splice(index, 1);
            remainingBlocks.push(block);
            renderBlocks();
        }
    }

    function clearSelection() {
        if (isAnswerSubmitted) return;
        remainingBlocks = [...remainingBlocks, ...selectedBlocks].sort((a, b) => a.id - b.id);
        selectedBlocks = [];
        renderBlocks();
    }

    // 7. Toggle Hint
    function toggleHint() {
        const isOpen = hintBtn.classList.toggle('is-flipped');
        hintBtn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
        hintText.classList.add('hidden');
        hintText.style.color = '';
        hintBtn.classList.toggle('btn-secondary', isOpen);
        hintBtn.classList.toggle('btn-primary', !isOpen);
    }

    // 8. Submit & Evaluate Answer
    function submitAnswer() {
        if (isAnswerSubmitted || selectedBlocks.length === 0) return;
        
        isAnswerSubmitted = true;
        gameAudio.pause();
        helpBgBtn.disabled = true;

        const q = questions[currentQuestionIndex];
        
        // Calculate time spent on this question
        const now = new Date();
        const timeSpent = Math.round((now - questionStartTime) / 1000);
        totalElapsedSeconds += timeSpent;

        // Build User Sequence
        const userSequenceText = selectedBlocks.map(b => b.text);
        lastUserSequence = [...userSequenceText];
        
        // Evaluate against Hakka characters
        const currentCorrectHakkaSequence = q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
        const isCorrect = checkSequenceMatch(userSequenceText, currentCorrectHakkaSequence);

        // Disable standard game controls
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;

        if (isCorrect) {
            playSfx('next');
            correctCount++;
            totalScore += questionScore;
            recordQuestionOutcome('correct', questionScore);
            scoreDisplay.textContent = `得分: ${totalScore}`;
            
            // Bridge cross animation
            isBridgeTransparent = false;
            isBridgeBroken = false;
            dogState = 'crossing';
            shouldAutoTransition = true;
        } else {
            playSfx('wrong');
            // Deduct score for wrong attempt
            questionAttempts++;
            questionScore = Math.max(0, questionScore - 2);
            
            // Calculate where the wrong bridge breaks
            const charCount = selectedBlocks.length;
            const correctHakkaSequence = currentCorrectHakkaSequence;
            const totalChars = correctHakkaSequence.length || 1;
            const userBridgeWidth = (charCount / totalChars) * cliffWidth;
            
            if (charCount < totalChars) {
                // If they didn't place all blocks, they fall off the end of their blocks
                wrongBreakX = cliffX + userBridgeWidth;
            } else {
                // If they placed all blocks but wrong order, fall from the broken bridge edge.
                const bridgeSourceWidth = isImageReady(runnerAssets.bridge) ? runnerAssets.bridge.naturalWidth : 805;
                const brokenBridgeSourceWidth = isImageReady(runnerAssets.brokenBridge) ? runnerAssets.brokenBridge.naturalWidth : bridgeSourceWidth / 2;
                const brokenBridgeWidth = (cliffWidth + 4) * (brokenBridgeSourceWidth / bridgeSourceWidth);
                wrongBreakX = cliffX - 2 + brokenBridgeWidth;
            }
            
            // Dog starts running towards the break point
            isBridgeBroken = true;
            dogState = 'crossing';
        }
    }

    let inlineFeedbackTimeout = null;

    function showInlineFeedback(text, color) {
        const inlineMsg = document.getElementById('inline-feedback-msg');
        if (!inlineMsg) return;

        inlineMsg.textContent = text;
        inlineMsg.style.color = color;
        inlineMsg.classList.remove('hidden');
        
        // Clear any existing timeout
        if (inlineFeedbackTimeout) {
            clearTimeout(inlineFeedbackTimeout);
        }
        
        // Hide after 2 seconds for normal wrong answers
        if (text.includes("答錯了")) {
            inlineFeedbackTimeout = setTimeout(() => {
                inlineMsg.classList.add('hidden');
            }, 2000);
        }
    }

    // Skip Mechanism (求助伯公)
    function askPoKongForHelp() {
        if (isAnswerSubmitted) return;
        
        isAnswerSubmitted = true;
        gameAudio.pause();
        helpBgBtn.disabled = true;
        
        // This question score is 0
        questionUsedHelp = true;
        questionHelpType = 'manual';
        questionScore = 0;
        lastUserSequence = selectedBlocks.map(b => b.text);
        recordQuestionOutcome('manual-help', 0);
        if (bokongAssist) bokongAssist.classList.remove('hidden');
        
        // Transparent bridge appears
        isBridgeTransparent = true;
        isBridgeBroken = false;
        bridgeAlpha = 0.8;
        dogState = 'crossing';
        shouldAutoTransition = true;
        
        // Hide buttons
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;
    }

    // Dynamic Fade Out Transition & Question Load
    function startFadeOutAndTransition() {
        if (isTransitioning) return;
        isTransitioning = true;
        
        const fadeDuration = 500 / speedMultiplier;
        
        // Set CSS variable
        gameCard.style.setProperty('--fade-duration', `${fadeDuration}ms`);
        gameCard.classList.add('fade-out');
        
        setTimeout(() => {
            currentQuestionIndex++;
            loadQuestion(currentQuestionIndex);
            
            if (currentQuestionIndex < questions.length) {
                dogX = -100;
                dogState = 'transition_in';
            }
            
            setTimeout(() => {
                gameCard.classList.remove('fade-out');
                isTransitioning = false;
            }, 50 / speedMultiplier);
        }, fadeDuration);
    }

    function recordQuestionOutcome(status, earnedScore) {
        const q = questions[currentQuestionIndex];
        if (!q || questionRecords[currentQuestionIndex]) return;
        const correctSequence = q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
        questionRecords[currentQuestionIndex] = {
            index: currentQuestionIndex + 1,
            hakka: q.hakka_hanji || correctSequence.join(''),
            translation: getChineseSentenceWithPunctuation(q),
            audioUrl: q.audio_url,
            userSequence: [...lastUserSequence],
            correctSequence: [...correctSequence],
            score: earnedScore,
            wrongCount: questionAttempts,
            helpUsed: questionUsedHelp,
            helpType: questionHelpType,
            status
        };
    }

    function getStarResult(score) {
        if (score >= 100) return starResults[0];
        if (score >= 80) return starResults[1];
        if (score >= 60) return starResults[2];
        if (score >= 40) return starResults[3];
        return starResults[4];
    }

    function formatSequence(sequence) {
        return sequence && sequence.length ? sequence.join(' → ') : '未放置字卡';
    }

    // Check if arrays are equal
    function checkSequenceMatch(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        for (let i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    }

    // 9. Next Question
    function nextQuestion() {
        // Start transition out (camera pans fast, dog runs off right)
        dogState = 'transition_out';
        feedbackPanel.classList.add('hidden');
    }

    // 10. Show Results
    function showResults() {
        if (appHeader) appHeader.classList.add('hidden');
        gameCard.classList.add('hidden');
        resultsCard.classList.remove('hidden');
        if (bokongAssist) bokongAssist.classList.add('hidden');

        const elapsed = Math.round((new Date() - gameStartTime) / 1000);
        const completedText = `${questions.length} / ${questions.length} 題`;
        const star = getStarResult(totalScore);
        const starMarks = '★'.repeat(star.stars) + '☆'.repeat(5 - star.stars);

        resultScore.textContent = `${totalScore} / 100 分`;
        resultAccuracy.textContent = completedText;
        resultTime.textContent = `${elapsed} 秒`;

        if (resultSummary) {
            resultSummary.innerHTML = `獲得稱號：<strong>${star.title}</strong><br>${star.comment}`;
        }

        if (rankingSection) {
            rankingSection.innerHTML = `
                <div class="star-result">
                    <div class="star-mark">${starMarks}</div>
                    <div>
                        <h3>${star.title}</h3>
                        <p>${star.note}</p>
                        <small>目前尚未接入正式排行榜百分比，星級先依分數示意；正式規則接入後會改以排名百分比判定。</small>
                    </div>
                </div>
                <div class="ranking-table" aria-label="示意排行榜">
                    <div class="ranking-row current"><span>1</span><strong>你</strong><em>${totalScore} 分</em><time>${elapsed} 秒</time></div>
                    <div class="ranking-row muted"><span>2</span><strong>示意玩家 A</strong><em>100 分</em><time>138 秒</time></div>
                    <div class="ranking-row muted"><span>3</span><strong>示意玩家 B</strong><em>98 分</em><time>152 秒</time></div>
                </div>`;
        }

        const reviewList = document.getElementById('review-list');
        reviewList.innerHTML = '';
        questions.forEach((q, idx) => {
            const correctSequence = q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
            const record = questionRecords[idx] || {
                index: idx + 1,
                hakka: q.hakka_hanji || correctSequence.join(''),
                translation: getChineseSentenceWithPunctuation(q),
                audioUrl: q.audio_url,
                userSequence: [],
                correctSequence,
                score: 0,
                wrongCount: 0,
                helpUsed: false,
                helpType: '',
                status: 'unanswered'
            };
            const item = document.createElement('details');
            item.className = 'review-item detailed-review';
            if (idx === 0) item.open = true;
            item.innerHTML = `
                <summary>
                    <span>第 ${idx + 1} 題</span>
                    <strong>${record.score} 分</strong>
                    <em>${record.helpUsed ? (record.helpType === 'auto' ? '伯公自動協助' : '求助伯公') : (record.status === 'correct' ? '答對' : '未完成')}</em>
                </summary>
                <div class="review-detail-grid">
                    <p><b>你的排序</b>${formatSequence(record.userSequence)}</p>
                    <p><b>正確排序</b>${formatSequence(record.correctSequence)}</p>
                    <p><b>完整客語</b>${record.hakka}</p>
                    <p><b>中文翻譯</b>${record.translation}</p>
                    <p><b>錯誤次數</b>${record.wrongCount} 次</p>
                    <p><b>求助狀態</b>${record.helpUsed ? (record.helpType === 'auto' ? '第 5 次錯誤後伯公協助' : '玩家主動求助伯公') : '未求助'}</p>
                </div>`;
            const playBtn = document.createElement('button');
            playBtn.className = 'review-play-btn';
            playBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i> 播放音檔';
            playBtn.type = 'button';
            playBtn.addEventListener('click', (event) => {
                event.preventDefault();
                const reviewAudio = new Audio(record.audioUrl);
                reviewAudio.play().catch(err => console.error('播放音檔失敗:', err));
            });
            item.appendChild(playBtn);
            reviewList.appendChild(item);
        });
    }

    // Audio Event Handlers
    function toggleAudio() {
        if (gameAudio.paused) {
            gameAudio.play().catch(e => {
                console.error("播放音檔失敗:", e);
            });
        } else {
            gameAudio.pause();
        }
    }

    function onAudioPlay() {
        playAudioBtn.classList.add('playing');
        playAudioBtn.querySelector('.play-icon').classList.add('hidden');
        playAudioBtn.querySelector('.pause-icon').classList.remove('hidden');
        soundwave.classList.remove('hidden');
    }

    function onAudioPause() {
        playAudioBtn.classList.remove('playing');
        playAudioBtn.querySelector('.play-icon').classList.remove('hidden');
        playAudioBtn.querySelector('.pause-icon').classList.add('hidden');
    }

    function onAudioEnded() {
        onAudioPause();
    }

    // ---------------------------------------------------------
    // 2D Canvas Engine Support Functions
    // ---------------------------------------------------------
    function setupCanvasEngine() {
        resizeRunnerCanvasForDisplay();

        // Start animation frame loop
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        
        function loop() {
            resizeRunnerCanvasForDisplay();
            updateGamePhysics();
            drawGameGraphics();
            animationFrameId = requestAnimationFrame(loop);
        }
        
        loop();
    }

    function resetCanvasForQuestion(q) {
        hasCliffAppeared = false;
        cliffX = 1160; // Place cliff completely off-screen to the right (continuous loop)
        if (dogState !== 'transition_in') {
            dogState = 'running';
        }
        isBridgeTransparent = false;
        isBridgeBroken = false;
        bridgeAlpha = 0.0;
        splashParticles = [];
        sparkles = [];
        wrongBreakX = null;
        
        // Dynamically compute speed based on audio duration (Section IV formula)
        // Set L = 930 px (1160 - 230). Time duration is D seconds.
        // We calculate base speed at 1x so the cliff arrives exactly when the audio finishes.
        gameAudio.addEventListener('loadedmetadata', function durationListener() {
            const D = gameAudio.duration || 3.0; // fallback if metadata not loaded
            questionBaseSpeed = Math.max(1.0, 930 / (D * 60));
            activeSpeed = questionBaseSpeed * speedMultiplier;
            gameAudio.removeEventListener('loadedmetadata', durationListener);
        });
        
        // If metadata is already loaded:
        if (gameAudio.duration) {
            const D = gameAudio.duration;
            questionBaseSpeed = Math.max(1.0, 930 / (D * 60));
            activeSpeed = questionBaseSpeed * speedMultiplier;
        }
    }

    function updateGamePhysics() {
        if (isGamePaused) return;
        
        dogFrame++;
        
        // Decrement flash timer
        if (flashTimer > 0) {
            flashTimer--;
        }
        
        // Update transparent bridge alpha pulsations
        if (isBridgeTransparent) {
            bridgeAlpha = 0.6 + Math.sin(dogFrame * 0.15) * 0.2;
        }
        
        // Handle physical movement based on dogState
        if (dogState === 'running') {
            // Move cliff closer and scroll background layers ONLY before cliff appears
            if (!hasCliffAppeared) {
                scrollX += activeSpeed;
                skyScrollX += activeSpeed * 0.05;
                mountainScrollX += activeSpeed * 0.15;
                forestScrollX += activeSpeed * 0.4;
                
                cliffX -= activeSpeed;
                if (cliffX <= cliffTargetX) {
                    cliffX = cliffTargetX;
                    hasCliffAppeared = true;
                }
            }
            
            // Ensure dog is in running position
            dogX += (180 - dogX) * 0.1;
            dogY = groundY;
        } 
        else if (dogState === 'transition_out') {
            // Scroll background and ground very fast (camera pan effect)
            const transitionSpeed = 10 * speedMultiplier;
            scrollX += transitionSpeed;
            skyScrollX += transitionSpeed * 0.05;
            mountainScrollX += transitionSpeed * 0.15;
            forestScrollX += transitionSpeed * 0.4;
            
            // Move dog forward off-screen
            dogX += transitionSpeed * 1.2;
            dogY = groundY;
            
            // If dog is fully off-screen, load the next question
            if (dogX >= canvasWidth + 100) {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
                
                // If it's not the end of the game, prepare transition_in
                if (currentQuestionIndex < questions.length) {
                    dogX = -100;
                    dogState = 'transition_in';
                }
            }
        }
        else if (dogState === 'transition_in') {
            // Let Ah-Hei enter first. Do not move the cliff or runway until the player can see the dog.
            dogX += Math.max(7, (180 - dogX) * 0.16);
            dogY = groundY;
            
            // If dog reaches running position, change state to running
            if (dogX >= 175) {
                dogX = 180;
                dogState = 'running';
            }
        } 
        else if (dogState === 'crossing') {
            // Dog runs across the bridge
            dogX += activeSpeed * 1.5;
            
            // Sparkle effects on the bridge
            if (dogFrame % 6 === 0) {
                sparkles.push({
                    x: dogX - 10,
                    y: groundY - 5 + Math.random() * 10,
                    size: 2 + Math.random() * 3,
                    alpha: 1.0,
                    color: isBridgeTransparent ? 'var(--accent)' : 'var(--primary-light)'
                });
            }
            
            // Check if dog reached the wrong break point
            if (wrongBreakX !== null && dogX >= wrongBreakX) {
                dogState = 'falling';
                wrongBreakX = null; // Clear to prevent double trigger
                
                // Trigger the falling and splash timeout to show feedback
                setTimeout(() => {
                    const q = questions[currentQuestionIndex];
                    if (questionScore <= 0) {
                        // Auto-pass: failed 5 times (or score reaches 0)
                        questionUsedHelp = true;
                        questionHelpType = 'auto';
                        recordQuestionOutcome('auto-help', 0);
                        if (bokongAssist) bokongAssist.classList.remove('hidden');
                        showInlineFeedback("伯公協助，本題 0 分。", 'var(--accent)');
                        
                        // 1. Fade out the card
                        const fadeOutDuration = 250 / speedMultiplier;
                        gameCard.style.setProperty('--fade-duration', `${fadeOutDuration}ms`);
                        gameCard.classList.add('fade-out');
                        
                        setTimeout(() => {
                            // 2. Put the dog back in the sky above starting point (to drop and flash)
                            dogX = 180;
                            dogY = -100;
                            dogState = 'recovering';
                            flashTimer = 25;
                            
                            // 3. Make transparent bridge appear
                            isBridgeTransparent = true;
                            isBridgeBroken = false;
                            bridgeAlpha = 0.8;
                            
                            // 4. Fade back in
                            gameCard.classList.remove('fade-out');
                            
                            // 5. Let the dog cross the bridge after a longer delay (2 seconds waiting time)
                            setTimeout(() => {
                                dogState = 'crossing';
                                shouldAutoTransition = true;
                            }, 2400 / speedMultiplier);
                        }, fadeOutDuration);
                    } else {
                        // Normal incorrect retry
                        showInlineFeedback("答錯了！字卡已還原請重新排列！", 'var(--danger)');
                        
                        dogState = 'recovering';
                        dogX = 180;
                        dogY = -100;
                        flashTimer = 25; // Flash 2 times (25 frames)
                        isAnswerSubmitted = false;
                        isBridgeBroken = false;
                        
                        clearSelection();
                        submitBtn.classList.remove('hidden');
                        submitBtn.disabled = true;
                        clearBtn.disabled = true;
                        helpBgBtn.disabled = false;
                    }
                }, 1200);
            }
            // Otherwise, check if dog reached the other side (only if not falling)
            else if (wrongBreakX === null && dogX >= cliffX + cliffWidth + 12) {
                // Successfully crossed! Transition to running on the other side or start fade out
                if (shouldAutoTransition) {
                    startFadeOutAndTransition();
                } else {
                    dogState = 'running';
                    
                    // Reset cliff position and scroll background out to load the next question
                    hasCliffAppeared = false;
                    
                    // Triggers next question automatically if skipped via help
                    if (isBridgeTransparent) {
                        isBridgeTransparent = false;
                    }
                    isBridgeBroken = false;
                }
            }
        } 
        else if (dogState === 'falling') {
            // Dog falls off the cliff into the river
            dogX += activeSpeed * 0.5;
            dogY += 6.5; // gravity pull
            
            if (dogY >= riverY) {
                dogY = riverY;
                dogState = 'splashing';
                playSfx('splash');
                createSplash(dogX, riverY);
            }
        } 
        else if (dogState === 'splashing') {
            // Splash particles updating
            updateSplash();
        } 
        else if (dogState === 'recovering') {
            // Dog falls down from the sky vertically to groundY
            dogX = 180;
            dogY += (groundY - dogY) * 0.15;
            
            if (Math.abs(dogY - groundY) < 1) {
                dogY = groundY;
                dogState = 'running';
            }
        }
    }

    function drawGameGraphics() {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        
        // 1. Draw Sky
        let grad = ctx.createLinearGradient(0, 0, 0, canvasHeight);
        grad.addColorStop(0, '#8bdff1'); 
        grad.addColorStop(0.68, '#dff8e4'); 
        grad.addColorStop(1, '#d8f4ff'); 
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        const grassDrawn = drawScrollingImage(runnerAssets.grass, 96, 52, forestScrollX, 0.8, 1);
        if (!grassDrawn) {
            ctx.fillStyle = '#78b85a';
            ctx.fillRect(0, groundY - 12, canvasWidth, 16);
        }

        const mountainsDrawn = drawScrollingImage(runnerAssets.mountains, 18, 92, mountainScrollX, 0.45);
        if (!mountainsDrawn) {
            ctx.fillStyle = '#8fbf73';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += 20) {
                let relativeScroll = (mountainScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - 45 + Math.sin(relativeScroll * 0.004) * 25 + Math.cos(relativeScroll * 0.008) * 10;
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.lineTo(canvasWidth, groundY);
            ctx.lineTo(0, groundY);
            ctx.fill();
        }

        const villageDrawn = drawScrollingImage(runnerAssets.village, 48, 88, forestScrollX, 0.65);
        if (!villageDrawn) {
            ctx.fillStyle = '#71a858';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += 15) {
                let relativeScroll = (forestScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - 15 + Math.sin(relativeScroll * 0.008) * 12;
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.lineTo(canvasWidth, groundY);
            ctx.lineTo(0, groundY);
            ctx.fill();
        }

        // 4. Draw River bed
        ctx.fillStyle = '#dee0a3';
        ctx.fillRect(0, groundY, canvasWidth, canvasHeight - groundY);
        
        // Draw wavy river water
        ctx.fillStyle = '#6daaf1';
        ctx.beginPath();
        for (let i = 0; i <= canvasWidth; i += 25) {
            let relativeScroll = (scrollX + i) % (canvasWidth * 1.5);
            let y = riverY + Math.sin(relativeScroll * 0.03 + dogFrame * 0.08) * 6;
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.lineTo(canvasWidth, canvasHeight);
        ctx.lineTo(0, canvasHeight);
        ctx.fill();
        
        // 5. Draw flat image ground.
        const groundTop = groundY - 8;
        const groundHeight = canvasHeight - groundTop + 8;
        const cliffInnerOverlap = 18;
        const groundJoinOverlap = 1;
        const cliffYOffset = 0;
        const leftCliffImage = runnerAssets.floorRight;
        const rightCliffImage = runnerAssets.floorLeft;
        const cliffHeight = groundHeight;
        const leftCliffWidth = isImageReady(leftCliffImage)
            ? leftCliffImage.naturalWidth * (cliffHeight / leftCliffImage.naturalHeight)
            : 0;
        const rightCliffWidth = isImageReady(rightCliffImage)
            ? rightCliffImage.naturalWidth * (cliffHeight / rightCliffImage.naturalHeight)
            : 0;
        const cliffDrawTop = groundTop + cliffYOffset;
        const leftCliffX = cliffX - leftCliffWidth + cliffInnerOverlap;
        const rightCliffX = (cliffX + cliffWidth) - cliffInnerOverlap;
        const leftGroundEndX = leftCliffX + groundJoinOverlap;
        const rightGroundStartX = rightCliffX + rightCliffWidth - groundJoinOverlap;

        if (hasCliffAppeared || cliffX < canvasWidth) {
            // Left platform
            if (cliffX > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, groundTop, Math.max(0, leftGroundEndX), groundHeight);
                ctx.clip();
                if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(0, groundY, cliffX, riverY - groundY - 4);
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(0, groundY - 4, cliffX, 10);
                }
                ctx.restore();
            }
            
            // Right platform
            let rightStart = cliffX + cliffWidth;
            if (rightStart < canvasWidth) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(rightGroundStartX, groundTop, Math.max(0, canvasWidth - rightGroundStartX), groundHeight);
                ctx.clip();
                if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(rightStart, groundY, canvasWidth - rightStart, riverY - groundY - 4);
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(rightStart, groundY - 4, canvasWidth - rightStart, 10);
                }
                ctx.restore();
            }
            
            if (leftCliffWidth > 0) {
                drawImageByHeight(leftCliffImage, leftCliffX, cliffDrawTop, cliffHeight);
            }
            if (rightCliffWidth > 0) {
                drawImageByHeight(rightCliffImage, rightCliffX, cliffDrawTop, cliffHeight);
            }
        } else {
            // Normal solid ground
            if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 6)) {
                ctx.fillStyle = '#c97820';
                ctx.fillRect(0, groundY, canvasWidth, riverY - groundY - 4);
                ctx.fillStyle = '#76aa25';
                ctx.fillRect(0, groundY - 4, canvasWidth, 10);
            }
        }
        
        // 6. Draw Bridge
        drawBridge();
        
        // 7. Draw Sparkles & particles
        drawSparkles();
        drawSplashParticles();
        
        // 8. Draw Dog (阿黑)
        drawDog(dogX, dogY, dogState, dogFrame);
    }

    // Animated Dog Drawing Function
    function drawDog(x, y, state, frame) {
        if (state === 'splashing') return;

        ctx.save();
        
        // Apply flashing effect if active
        if (flashTimer > 0) {
            if (Math.floor(flashTimer / 5) % 2 === 0) {
                ctx.globalAlpha = 0.2;
            }
        }

        const kuroFrames = runnerAssets.kuroRunFrames || [];
        const readyKuroFrames = kuroFrames.filter(isImageReady);
        const kuroImage = readyKuroFrames.length > 0
            ? readyKuroFrames[Math.floor(frame / 6) % readyKuroFrames.length]
            : runnerAssets.kuroRun;

        if (isImageReady(kuroImage) && state !== 'splashing') {
            const sourceWidth = kuroImage.naturalWidth || 512;
            const sourceHeight = kuroImage.naturalHeight || 512;
            const runnerHeight = 96;
            const runnerWidth = runnerHeight * (sourceWidth / sourceHeight);
            const runBob = (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in')
                ? Math.sin(frame * 0.22) * 2
                : 0;

            ctx.translate(x, y + runBob);

            if (state === 'falling') {
                ctx.translate(0, -10);
                ctx.rotate(frame * 0.1);
            }

            ctx.drawImage(kuroImage, -runnerWidth * 0.5, -runnerHeight + 29, runnerWidth, runnerHeight);
            ctx.restore();
            return;
        }
        
        ctx.translate(x, y);
        
        if (state === 'falling') {
            ctx.translate(0, -10);
            ctx.rotate(frame * 0.1);
        }
        
        const furColor = '#1a1a1a'; 
        const bellyColor = '#333333'; 
        const earColor = '#111111';
        const noseColor = '#6b4d35'; 
        const tongueColor = '#ff6b6b';
        
        let frontLegAngle = 0;
        let backLegAngle = 0;
        
        if (state === 'running' || state === 'transition_out' || state === 'transition_in') {
            frontLegAngle = Math.sin(frame * 0.18) * 0.65;
            backLegAngle = -Math.sin(frame * 0.18) * 0.65;
        } else if (state === 'crossing') {
            frontLegAngle = Math.sin(frame * 0.28) * 0.75;
            backLegAngle = -Math.sin(frame * 0.28) * 0.75;
        } else if (state === 'falling') {
            frontLegAngle = 0.9;
            backLegAngle = -0.9;
        } else if (state === 'recovering') {
            frontLegAngle = Math.sin(frame * 0.22) * 0.4;
            backLegAngle = -Math.sin(frame * 0.22) * 0.4;
        }
        
        if (state !== 'splashing') {
            // Draw Tail
            ctx.save();
            ctx.translate(-20, -16);
            let tailWag = Math.sin(frame * 0.25) * 0.25;
            if (state === 'crossing' || state === 'transition_out') tailWag = Math.sin(frame * 0.5) * 0.4;
            ctx.rotate(-0.6 + tailWag);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw Back Legs (drawn behind)
            drawLeg(-12, -2, backLegAngle, furColor);
            drawLeg(10, -2, frontLegAngle, furColor);
            
            // Draw Body
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(0, -12, 22, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Belly patch
            ctx.fillStyle = bellyColor;
            ctx.beginPath();
            ctx.ellipse(1, -9, 13, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Draw Front Legs (drawn in front)
            drawLeg(-10, -2, -backLegAngle, furColor);
            drawLeg(12, -2, -frontLegAngle, furColor);
            
            // Draw Neck
            ctx.fillStyle = furColor;
            ctx.save();
            ctx.translate(14, -20);
            ctx.rotate(0.3);
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Draw Head
            ctx.save();
            ctx.translate(22, -26);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Snout
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.ellipse(8, 2, 6, 4, 0.1, 0, Math.PI * 2);
            ctx.fill();
            
            // Nose tip
            ctx.fillStyle = noseColor;
            ctx.beginPath();
            ctx.arc(13, 1, 2, 0, Math.PI * 2);
            ctx.fill();
            
            // Eye
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(4, -3, 2.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(5, -3, 1.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Ear
            ctx.save();
            ctx.translate(-4, -6);
            let earFlap = Math.sin(frame * 0.12) * 0.15;
            if (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in') earFlap = Math.sin(frame * 0.3) * 0.25;
            ctx.rotate(0.6 + earFlap);
            ctx.fillStyle = earColor;
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 9, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            
            // Tongue
            if (state === 'running' || state === 'crossing' || state === 'transition_out' || state === 'transition_in') {
                ctx.fillStyle = tongueColor;
                ctx.beginPath();
                ctx.ellipse(8, 6, 3.2, 2.2, 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
        } else {
            // Splashing drowning state
            ctx.save();
            ctx.translate(0, 6);
            ctx.fillStyle = furColor;
            ctx.beginPath();
            ctx.arc(0, -10, 9, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 9px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('X', -3, -10);
            ctx.fillText('X', 3, -10);
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(0, -6, 12, Math.PI, 0);
            ctx.stroke();
            ctx.restore();
        }
        
        ctx.restore();
    }
    
    function drawLeg(offsetX, offsetY, angle, color) {
        ctx.save();
        ctx.translate(offsetX, offsetY);
        ctx.rotate(angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 5, 3.5, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(0, 11, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawBridge() {
        if (isAnswerSubmitted && dogState !== 'recovering') {
            ctx.save();
            
            if (isBridgeTransparent) {
                // Glow Transparent bridge (Ask Po Kong for help)
                ctx.lineWidth = 6;
                ctx.strokeStyle = `rgba(255, 183, 3, ${bridgeAlpha})`;
                ctx.shadowColor = 'var(--accent)';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.moveTo(cliffX, groundY + 4);
                ctx.lineTo(cliffX + cliffWidth, groundY + 4);
                ctx.stroke();
                
                // Draw glass transparent deck
                ctx.fillStyle = `rgba(255, 255, 255, ${bridgeAlpha * 0.15})`;
                ctx.fillRect(cliffX, groundY + 4, cliffWidth, 10);
            } else {
                // Solid wood plank bridge (No text)
                const charCount = selectedBlocks.length;
                if (charCount > 0) {
                    const q = questions[currentQuestionIndex];
                    if (!q) return;
                    const correctHakkaSequence = q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
                    const totalChars = correctHakkaSequence.length || 1;
                    const blockWidth = cliffWidth / totalChars;

                    if (isBridgeBroken && isImageReady(runnerAssets.brokenBridge) && isImageReady(runnerAssets.bridge)) {
                        const bridgeHeight = 22;
                        const bridgeWidth = cliffWidth + 4;
                        const bridgeScale = bridgeWidth / runnerAssets.bridge.naturalWidth;
                        const brokenBridgeWidth = runnerAssets.brokenBridge.naturalWidth * bridgeScale;
                        ctx.drawImage(runnerAssets.brokenBridge, cliffX - 2, groundY - 2, brokenBridgeWidth, bridgeHeight);
                    } else if (isImageReady(runnerAssets.bridge)) {
                        ctx.drawImage(runnerAssets.bridge, cliffX - 2, groundY - 2, cliffWidth + 4, 22);
                    } else {
                        selectedBlocks.forEach((block, idx) => {
                            let bx = cliffX + idx * blockWidth;
                            let by = groundY + 2;
                            
                            // Solid wooden plank styling
                            ctx.fillStyle = '#8B5A2B'; // Solid wood brown
                            ctx.strokeStyle = '#5c3a1a'; // Darker brown border
                            ctx.lineWidth = 2;
                            
                            ctx.beginPath();
                            ctx.roundRect(bx + 1, by, blockWidth - 2, 12, 3);
                            ctx.fill();
                            ctx.stroke();
                            
                            // Subtle wooden grain lines
                            ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.moveTo(bx + 3, by + 4);
                            ctx.lineTo(bx + blockWidth - 5, by + 4);
                            ctx.moveTo(bx + 5, by + 8);
                            ctx.lineTo(bx + blockWidth - 7, by + 8);
                            ctx.stroke();
                        });
                    }
                }
            }
            
            ctx.restore();
        }
    }

    // Sparkle Particle systems
    function drawSparkles() {
        ctx.save();
        for (let i = sparkles.length - 1; i >= 0; i--) {
            let p = sparkles[i];
            p.y -= 0.5;
            p.alpha -= 0.02;
            
            if (p.alpha <= 0) {
                sparkles.splice(i, 1);
                continue;
            }
            
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.fillRect(p.x, p.y, p.size, p.size);
        }
        ctx.restore();
    }

    // Splash Particles systems
    function createSplash(x, y) {
        splashParticles = [];
        for (let i = 0; i < 20; i++) {
            splashParticles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 6,
                vy: -Math.random() * 8 - 4,
                size: 2 + Math.random() * 5,
                color: '#8ecae6',
                alpha: 1.0
            });
        }
    }

    function updateSplash() {
        for (let i = splashParticles.length - 1; i >= 0; i--) {
            let p = splashParticles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.45; // gravity
            p.alpha -= 0.025;
            
            if (p.alpha <= 0) {
                splashParticles.splice(i, 1);
            }
        }
    }

    function drawSplashParticles() {
        ctx.save();
        for (let i = 0; i < splashParticles.length; i++) {
            let p = splashParticles[i];
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }

    // ---------------------------------------------------------
    // Execution Entry Point
    // ---------------------------------------------------------
    init();
});















