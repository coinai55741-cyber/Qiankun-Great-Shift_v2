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
    const QUESTION_SCORE = 16;        // 每題 16 分，五題共 80 分（毛筆另有 20 分，合計 100）
    const WRONG_PENALTY = 4;          // 答錯一次扣 4 分：16 → 12 → 8 → 4 → 0
    const MAX_WRONG_ATTEMPTS = 5;     // 第 5 次答錯時伯公自動協助過橋（此時該題分數早已扣完，本題 0 分）
    const BRUSH_MAX_SCORE = 20;       // 毛筆書寫最高 20 分
    let questionScore = QUESTION_SCORE;
    let questionAttempts = 0;
    let questionUsedHelp = false;
    let questionHelpType = '';
    let questionRecords = [];
    let lastUserSequence = [];
    let storyStepIndex = 0;
    
    let gameStartTime = null;
    let questionStartTime = null;
    let totalElapsedSeconds = 0;
    let resultLocked = false;
    let resultElapsedMs = 0;
    let isAnswerSubmitted = false;
    let draggedBlockId = null;
    let wrongBreakX = null;
    let questionBaseSpeed = 2.0;
    let shouldAutoTransition = false;
    let flashTimer = 0;
    let openingCountdownActive = false;
    let openingCountdownStartedAt = 0;
    const openingCountdownDuration = 3600;
    let selectedDialectId = "1"; // Default 四縣腔
    let writingScore = 0;
    let writingResult = null;
    let brushStageStarted = false;
    let brushCompleted = false;

    // Audio Element & Controls
    const gameAudio = document.getElementById('game-audio');
    const playAudioBtn = document.getElementById('play-audio-btn');
    const soundwave = document.getElementById('soundwave');

    const sfxPath = 'data/music/';
    const sfxVersion = '20261030-4';
    const sfx = {
        click: new Audio(`${sfxPath}S2_m2_click.mp3?v=${sfxVersion}`),
        wrong: new Audio(`${sfxPath}S2_m2_false.mp3?v=${sfxVersion}`),
        next: new Audio(`${sfxPath}S2_m2_next.mp3?v=${sfxVersion}`),
        splash: new Audio(`${sfxPath}S2_m3_splash.mp3?v=${sfxVersion}`),
        pass: new Audio(`${sfxPath}S2_m3_pass.mp3?v=${sfxVersion}`),      // 通過：阿黑平安過橋
        help: new Audio(`${sfxPath}S2_m3_help.mp3?v=${sfxVersion}`),      // 伯公協助：金橋閃光
        finish: new Audio(`${sfxPath}S2_m3_finish.mp3?v=${sfxVersion}`)   // 全部通關：進入結果頁
    };

    // 右上角喇叭按鈕（與 fukuchange 同款）只開關背景音樂；點擊、答對答錯等音效與題目語音不受影響。
    // 直接開硬碟上的 index.html（file://）時，頁面來源是「不透明」的：Chrome 的 location.origin 是 'file://'，
    // 但 postMessage 的 event.origin 卻是 'null'，兩者對不起來，所以要特別處理，否則毛筆頁的訊息會被擋掉。
    const isOpaqueOrigin = window.location.protocol === 'file:' || window.location.origin === 'null';
    const messageTargetOrigin = isOpaqueOrigin ? '*' : window.location.origin;
    const isSameOriginMessage = origin => origin === window.location.origin || (isOpaqueOrigin && origin === 'null');

    const BGM_VOLUME = 0.15;
    const BGM_DUCKED_VOLUME = 0.04;
    const soundToggleBtn = document.getElementById('sound-toggle');
    const soundToggleIcon = soundToggleBtn ? soundToggleBtn.querySelector('img') : null;
    let soundEnabled = true;
    try { soundEnabled = localStorage.getItem('kuro-sound') !== 'off'; } catch (e) { /* 無痕模式等情況就用預設開啟 */ }

    const bgm = new Audio(`${sfxPath}S2_m3_bgmloop.mp3?v=${sfxVersion}`);
    bgm.loop = true;
    bgm.volume = BGM_VOLUME;

    function ensureBgm() {
        if (soundEnabled && bgm.paused) bgm.play().catch(() => {});
    }

    // 題目語音播放時把背景音樂壓低，聽力才聽得清楚。
    function setBgmDucked(ducked) {
        bgm.volume = ducked ? BGM_DUCKED_VOLUME : BGM_VOLUME;
    }
    function duckBgmWhilePlaying(voice) {
        if (!voice) return;
        voice.addEventListener('play', () => setBgmDucked(true));
        voice.addEventListener('pause', () => setBgmDucked(false));
        voice.addEventListener('ended', () => setBgmDucked(false));
    }
    duckBgmWhilePlaying(gameAudio);

    function renderSoundToggle() {
        if (!soundToggleBtn) return;
        soundToggleBtn.setAttribute('aria-pressed', String(soundEnabled));
        soundToggleBtn.setAttribute('aria-label', soundEnabled
            ? '背景音樂，目前開啟，點擊關閉背景音樂'
            : '背景音樂，目前關閉，點擊開啟背景音樂');
        if (soundToggleIcon) soundToggleIcon.src = soundEnabled ? 'data/ui/sound-icon.svg' : 'data/ui/sound-off-icon.svg';
    }

    function setSoundEnabled(enabled) {
        soundEnabled = enabled;
        try { localStorage.setItem('kuro-sound', enabled ? 'on' : 'off'); } catch (e) { /* ignore */ }
        renderSoundToggle();
        if (enabled) ensureBgm();
        else bgm.pause();
    }

    function playSfx(name) {
        const audio = sfx[name];
        if (!audio) return;

        ensureBgm();
        audio.currentTime = 0;
        audio.volume = 0.75;
        audio.play().catch(() => {});
    }

    renderSoundToggle();
    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', () => {
            if (soundEnabled) { playSfx('click'); setSoundEnabled(false); }
            else { setSoundEnabled(true); playSfx('click'); }
        });
    }
    // 瀏覽器要求先有使用者操作才能播放：第一次點擊／按鍵就開始背景音樂。
    ['pointerdown', 'keydown'].forEach(type => {
        document.addEventListener(type, function startBgmOnce() {
            document.removeEventListener(type, startBgmOnce);
            ensureBgm();
        });
    });
    
    // UI Elements
    const appHeader = document.querySelector('.app-header');
    const storyCard = document.getElementById('story-card');
    const storyCanvas = document.getElementById('story-canvas');
    const storyBackgroundImage = new Image();
    let storyBackgroundFailed = false;
    storyBackgroundImage.src = 'data/image/S2_m3_story_bg.png?v=20261029-2';
    storyBackgroundImage.addEventListener('load', () => {
        if (storyCard && !storyCard.classList.contains('hidden')) drawStoryScene();
    });
    storyBackgroundImage.addEventListener('error', () => {
        storyBackgroundFailed = true;
        if (storyCard && !storyCard.classList.contains('hidden')) drawStoryScene();
    });
    const storySpeaker = document.getElementById('story-speaker');
    const storyLine = document.getElementById('story-line');
    const storyAvatarImg = document.getElementById('story-avatar-img');
    const storyCharacterLayer = document.querySelector('.story-character-layer');
    const storyStandingCharacters = document.querySelectorAll('[data-story-character]');
    const storyAudioVisualizer = document.getElementById('story-audio-visualizer');
    const storyBridgeAnimation = document.getElementById('story-bridge-animation');
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
    const resultRank = document.getElementById('result-rank');
    const resultBackBtn = document.getElementById('result-back-btn');
    const restartBtn = document.getElementById('restart-btn');
    const resultSummary = document.getElementById('result-summary');
    const rankingSection = document.getElementById('ranking-section');
    const brushStageOverlay = document.getElementById('brush-stage-overlay');
    const brushStageFrame = document.getElementById('brush-stage-frame');
    const brushStageClose = document.getElementById('brush-stage-close');
    const brushStageTitle = document.getElementById('brush-stage-title');
    const brushStageSubtitle = document.getElementById('brush-stage-subtitle');

    // Speed buttons
    const speedButtons = document.querySelectorAll('.speed-btn');

    // ---------------------------------------------------------
    // 2D HTML5 Canvas Runner Game Engine
    // ---------------------------------------------------------
    const canvas = document.getElementById('runner-canvas');
    const ctx = canvas.getContext('2d');
    
    const runnerStageScale = 1.5;
    const baseCanvasWidth = 960;
    const baseCanvasHeight = 200;
    const canvasWidth = Math.round(baseCanvasWidth * runnerStageScale);
    const canvasHeight = Math.round(baseCanvasHeight * runnerStageScale);
    const rs = (value) => value * runnerStageScale;
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
    const groundY = rs(140);
    const riverY = rs(175);
    
    let scrollX = 0;
    let skyScrollX = 0;
    let mountainScrollX = 0;
    let forestScrollX = 0;
    
    let speedMultiplier = 1.0;
    const baseSpeed = rs(2.0); 
    let activeSpeed = baseSpeed;
    
    const getDogStartX = () => canvasWidth / 3;
    const getDogEntryX = () => getDogStartX() - rs(300);
    const getCliffTargetX = () => getDogStartX() + rs(50);
    let dogX = getDogStartX();
    let dogY = groundY;
    let dogState = 'running'; // 'running', 'crossing', 'falling', 'splashing', 'recovering'
    let dogFrame = 0;
    
    // Cliff settings are authored against a 960x200 base stage, then scaled for sharper drawing.
    let cliffX = rs(1200); 
    const bridgeGapScale = 0.84;
    const fallbackCliffWidth = rs(154);
    const getBridgeHeight = () => rs(22);
    const getBridgeLandingOverlap = () => rs(18);
    const getCliffWidth = () => isImageReady(runnerAssets.bridge)
        ? (runnerAssets.bridge.naturalWidth * (getBridgeHeight() / runnerAssets.bridge.naturalHeight) - rs(4)) * bridgeGapScale
        : fallbackCliffWidth;
    const getBridgeDrawX = () => cliffX - getBridgeLandingOverlap();
    const getBridgeDrawWidth = () => getCliffWidth() + getBridgeLandingOverlap() * 2;
    let hasCliffAppeared = false;
    
    let animationFrameId = null;
    let isGamePaused = false;
    
    // Splash & sparkles particles
    let splashParticles = [];
    let sparkles = [];
    let speedLines = [];
    let bridgeAlpha = 0.0;

    // Bridge build sequence: 'wood' (correct), 'broken' (wrong), 'golden' (Bo-Gong help), null (no bridge)
    let bridgeKind = null;
    let bridgeChars = [];
    let bridgeBuildProgress = 1;
    let buildFrame = 0;
    let buildDuration = 18;
    let buildHold = 4;
    let pendingWrongCharCount = 0;
    let helpAfterRecovery = false;
    let isWetRecovery = false;
    let shakeFrames = 0;
    let splashFrames = 0;
    let nextCliffStartX = 0;
    let fastForward = false;
    const fastForwardSteps = 4;
    const skippableStates = ['building', 'crossing', 'falling', 'splashing', 'advancing', 'shaking'];
    const getCliffRushSpeed = () => rs(16) * speedMultiplier;
    const getDashSpeed = () => rs(9) * speedMultiplier;
    const getAdvanceSpeed = () => rs(16) * speedMultiplier;

    const runnerAssetPath = 'data/image/';
    const runnerAssetVersion = '20261019-fast-flow1';
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
        kuroRun: loadRunnerImage('S2_m3_kuro_run_transparent.gif'),
        kuroRunFrames: [
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_00.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_01.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_02.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_03.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_04.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_05.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_06.png'),
            loadRunnerImage('kuro_high_frames_keyed/kuro_high_07.png')
        ],
        kuroFalling: loadRunnerImage('S2_m3_kuro_falling.png'),
        kuroWet: loadRunnerImage('S2_m3_kuro_wet_shaking.png'),
        kuroWetShakeFrames: [
            loadRunnerImage('S2_m3_kuro_wet_shake_frame01.png'),
            loadRunnerImage('S2_m3_kuro_wet_shake_frame02.png')
        ],
        bokong: loadRunnerImage('S2_m3_bokon1.png')
    };



    const openingStory = [
        { speaker: '指導員', text: '阿黑啊，你現在到了小明家附近的田埂對吧？繪卷有感應到小明今天在發什麼牢騷嗎？' },
        { speaker: '阿黑', text: '汪……指導員，我第一次出任務，聽到村裡小朋友在講客語，可是繪卷突然發光，文字就全部變成字磚掉在地上了……我不知道怎麼排回去呀。' },
        { speaker: '指導員', text: '你是實習小神狗，需要多練習是正常的！' },
        { speaker: '指導員', text: '讓伯公把你的聽力技能加強，你仔細聽好囉～' },
        { speaker: '某聲音', text: '𠊎試著這題數學還難哦' },
        { speaker: '阿黑', text: '啊！聽到了！小明在抱怨數學啦！順序是：「𠊎」➔「試」➔「著」➔「這」➔「題」➔「數」➔「學」➔「還」➔「難」➔「哦」！' },
        { speaker: '字磚變化', text: '散落的字磚排回正確順序，伯公的仙光把斷橋接了起來。' },
        { speaker: '阿黑', text: '呼！過來了！伯公，小明抱怨數學的紀錄已經好好的印在繪卷上囉，其他的內容，我等一下帶回去給你讀！' },
        { speaker: '伯公', text: '好好好，這孩子總是怕數學。繼續吧，看看下一條路上還能幫伯公收集到什麼有趣的對話！' }
    ];
    const storyVoiceAudio = new Audio('https://dn9mvjhbyvvpc.cloudfront.net/files/71858_2bdea5329f2fdaec3dc9b152a18e8a14.wav');
    storyVoiceAudio.preload = 'auto';
    duckBgmWhilePlaying(storyVoiceAudio);
    storyVoiceAudio.addEventListener('ended', () => {
        if (storyAudioVisualizer) storyAudioVisualizer.classList.remove('is-playing');
    });

    const starResults = [
        { stars: 5, title: '傳音神犬', note: '最高星級，授予滿分且表現最出色的玩家。', comment: '你的耳朵比雷達還靈敏！繪卷紀錄得一字不漏，伯公讀完開心地哈哈大笑！' },
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
        const scaledWidth = sourceWidth * (height / image.naturalHeight);
        layer.height = Math.ceil(height);
        layer.width = Math.ceil(scaledWidth);

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
            width: scaledWidth,
            height: height
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
                x,
                y,
                width + seamOverlap,
                height
            );
        }

        return true;
    }

    function drawTiledImageRange(image, startX, endX, y, height, anchorX = startX, trimX = 0) {
        if (!useRunnerImageLayers) return false;

        const layer = getScaledRunnerLayer(image, height, trimX);
        if (!layer) return false;

        const width = layer.width;
        const seamOverlap = 1;
        let x = anchorX;

        while (x > startX) {
            x -= width;
        }

        for (; x < endX; x += width) {
            ctx.drawImage(
                layer.canvas,
                x,
                y,
                width + seamOverlap,
                height
            );
        }

        return true;
    }

    function drawStretchImage(image, x, y, width, height) {
        if (!isImageReady(image)) return false;
        ctx.drawImage(image, x, y, width, height);
        return true;
    }


    function drawCroppedImageByHeight(image, x, y, height, cropLeft = 0, cropRight = 0) {
        if (!isImageReady(image)) return 0;
        const sourceWidth = image.naturalWidth;
        const sourceHeight = image.naturalHeight;
        const sx = Math.max(0, Math.min(sourceWidth - 1, cropLeft));
        const sw = Math.max(1, sourceWidth - sx - Math.max(0, cropRight));
        const scale = height / sourceHeight;
        const width = sw * scale;
        ctx.drawImage(image, sx, 0, sw, sourceHeight, x, y, width, height);
        return width;
    }

    function drawImageByHeight(image, x, y, height) {
        if (!isImageReady(image)) return 0;
        const width = image.naturalWidth * (height / image.naturalHeight);
        ctx.drawImage(image, x, y, width, height);
        return width;
    }

    function getImageAlphaBounds(image) {
        if (!isImageReady(image)) return null;
        if (image._alphaBounds) return image._alphaBounds;

        const probe = document.createElement('canvas');
        probe.width = image.naturalWidth;
        probe.height = image.naturalHeight;
        const probeCtx = probe.getContext('2d', { willReadFrequently: true });
        probeCtx.drawImage(image, 0, 0);
        const pixels = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
        let left = probe.width;
        let right = -1;
        let top = probe.height;
        let bottom = -1;

        for (let py = 0; py < probe.height; py++) {
            for (let px = 0; px < probe.width; px++) {
                const alpha = pixels[(py * probe.width + px) * 4 + 3];
                if (alpha > 8) {
                    if (px < left) left = px;
                    if (px > right) right = px;
                    if (py < top) top = py;
                    if (py > bottom) bottom = py;
                }
            }
        }

        image._alphaBounds = right >= left
            ? { left, right, top, bottom, width: right - left + 1, height: bottom - top + 1 }
            : { left: 0, right: image.naturalWidth - 1, top: 0, bottom: image.naturalHeight - 1, width: image.naturalWidth, height: image.naturalHeight };
        return image._alphaBounds;
    }

    function getAlphaContentWidthByHeight(image, height) {
        if (!isImageReady(image)) return 0;
        const bounds = getImageAlphaBounds(image);
        return bounds.width * (height / image.naturalHeight);
    }

    function drawAlphaContentByHeight(image, x, y, height) {
        if (!isImageReady(image)) return 0;
        const bounds = getImageAlphaBounds(image);
        const width = bounds.width * (height / image.naturalHeight);
        ctx.drawImage(
            image,
            bounds.left,
            0,
            bounds.width,
            image.naturalHeight,
            x,
            y,
            width,
            height
        );
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

    // Questions bundled by data/quiz/build_offline_bundle.py (<= 8 characters only).
    function loadOfflineQuestions(dialectId) {
        const pick = () => (window.QUIZ_OFFLINE && window.QUIZ_OFFLINE[dialectId]) || [];
        if (window.QUIZ_OFFLINE) return Promise.resolve(pick());
        return new Promise(resolve => {
            const script = document.createElement('script');
            script.src = 'data/quiz/questions_offline.js?v=20261029-offline1';
            script.onload = () => resolve(pick());
            script.onerror = () => {
                console.warn('無法載入離線題庫', script.src);
                resolve([]);
            };
            document.head.appendChild(script);
        });
    }

    // Single-layer parallax: the whole page scroll range maps onto the spare height of the background layer.
    function setupParallax() {
        const bg = document.getElementById('parallax-bg');
        const layer = bg && bg.firstElementChild;
        if (!layer) return;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        let queued = false;

        function update() {
            queued = false;
            if (reduceMotion.matches || getComputedStyle(bg).display === 'none') return;
            const root = document.documentElement;
            const range = Math.max(root.scrollHeight, document.body.scrollHeight) - window.innerHeight;
            const scrolled = window.scrollY || root.scrollTop || document.body.scrollTop || 0;
            const progress = range > 1 ? Math.min(1, Math.max(0, scrolled / range)) : 0.5; // page doesn't scroll: keep centred
            const spare = layer.offsetHeight - window.innerHeight;
            layer.style.setProperty('--parallax-y', `${(0.5 - progress) * spare}px`);
        }
        function queue() {
            if (queued) return;
            queued = true;
            requestAnimationFrame(update);
        }

        document.addEventListener('scroll', queue, { passive: true, capture: true });
        window.addEventListener('resize', queue);
        reduceMotion.addEventListener('change', queue);
        // Pages are switched by toggling .hidden: start each page at its own scroll position.
        const watcher = new MutationObserver(queue);
        ['intro-card', 'results-card'].forEach(id => {
            const el = document.getElementById(id);
            if (el) watcher.observe(el, { attributes: true, attributeFilter: ['class'] });
        });
        queue();
    }

    // 1. Initial Load
    function init() {
        setupParallax();
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
                            // Opened from disk (file://) the browser blocks fetch(): use the bundled copy instead.
                            if (allQuestions.length === 0) {
                                return loadOfflineQuestions(dialectId);
                            }
                            return allQuestions;
                        })
                        .then(allQuestions => {
                            // Filter questions by length <= 8
                            let filtered = allQuestions.filter(q => q.hakka_char_count <= charLimit);
                            if (filtered.length === 0) {
                                console.warn(`腔調 ${dialectId} 沒有 ${charLimit} 字元以下的題目，改用全部題目`);
                                filtered = allQuestions;
                            }
                            
                            // Shuffle and slice to 5 questions max for a game session
                            questions = shuffleArray(filtered).slice(0, 5);
                            
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
        const isStoryAudioStep = step.speaker === '某聲音';
        const isBridgeStoryStep = step.speaker === '字磚變化';
        stopStoryVoice();
        stopStoryBridgeAnimation();
        if (storySpeaker) storySpeaker.textContent = step.speaker;
        if (storyLine) storyLine.textContent = step.text;
        const activeStoryCharacter = (isStoryAudioStep || isBridgeStoryStep)
            ? null
            : (step.speaker === '伯公'
            ? '伯公'
            : (step.speaker === '阿黑' ? '阿黑' : '指導員'));
        if (storyCharacterLayer) storyCharacterLayer.classList.toggle('is-empty', !activeStoryCharacter);
        if (storyAvatarImg) {
            storyAvatarImg.hidden = !activeStoryCharacter;
            if (activeStoryCharacter) {
                storyAvatarImg.src = activeStoryCharacter === '伯公'
                    ? 'data/image/S2_m3_bokon1.png'
                    : (activeStoryCharacter === '阿黑' ? 'data/image/S2_m3_kuro_sit.png' : 'data/image/S2_m3_p1.png');
                storyAvatarImg.alt = `${activeStoryCharacter}頭像`;
                storyAvatarImg.className = activeStoryCharacter === '伯公' ? 'avatar-bokong' : (activeStoryCharacter === '阿黑' ? 'avatar-kuro' : 'avatar-guide');
            }
        }
        storyStandingCharacters.forEach((character) => {
            character.classList.toggle('is-active', Boolean(activeStoryCharacter) && character.dataset.storyCharacter === activeStoryCharacter);
            character.classList.toggle('is-dimmed', character.dataset.storyCharacter !== activeStoryCharacter);
        });
        if (storyAudioVisualizer) {
            storyAudioVisualizer.classList.toggle('hidden', !isStoryAudioStep);
            storyAudioVisualizer.classList.toggle('is-playing', isStoryAudioStep);
        }
        if (isStoryAudioStep) {
            storyVoiceAudio.play().catch(() => {
                if (storyAudioVisualizer) storyAudioVisualizer.classList.remove('is-playing');
            });
        }
        if (isBridgeStoryStep && storyBridgeAnimation) {
            storyBridgeAnimation.classList.remove('hidden');
            void storyBridgeAnimation.offsetWidth;
            storyBridgeAnimation.classList.add('is-playing');
        }
        if (storyNextBtn) {
            storyNextBtn.innerHTML = storyStepIndex >= openingStory.length - 1
                ? '進入任務說明'
                : '繼續 <i class="fa-solid fa-arrow-right"></i>';
        }
    }

    function showIntroCard() {
        stopStoryVoice();
        stopStoryBridgeAnimation();
        if (storyCard) storyCard.classList.add('hidden');
        if (appHeader) appHeader.classList.add('hidden');
        if (introCard) introCard.classList.remove('hidden');
    }

    function stopStoryVoice() {
        storyVoiceAudio.pause();
        storyVoiceAudio.currentTime = 0;
        if (storyAudioVisualizer) {
            storyAudioVisualizer.classList.remove('is-playing');
            storyAudioVisualizer.classList.add('hidden');
        }
    }

    function stopStoryBridgeAnimation() {
        if (!storyBridgeAnimation) return;
        storyBridgeAnimation.classList.remove('is-playing');
        storyBridgeAnimation.classList.add('hidden');
    }

    function drawStoryScene() {
        if (!storyCanvas) return;
        const storyCtx = storyCanvas.getContext('2d');
        const width = storyCanvas.width;
        const height = storyCanvas.height;
        storyCtx.clearRect(0, 0, width, height);

        if (storyBackgroundImage.complete && storyBackgroundImage.naturalWidth > 0) {
            const scale = Math.max(
                width / storyBackgroundImage.naturalWidth,
                height / storyBackgroundImage.naturalHeight
            );
            const drawWidth = storyBackgroundImage.naturalWidth * scale;
            const drawHeight = storyBackgroundImage.naturalHeight * scale;
            storyCtx.drawImage(
                storyBackgroundImage,
                (width - drawWidth) / 2,
                (height - drawHeight) / 2,
                drawWidth,
                drawHeight
            );
            return;
        }

        // 背景圖還在載入時不畫備用場景，避免重新整理時閃一下舊的 canvas 畫面。
        if (!storyBackgroundFailed) return;

        const wall = storyCtx.createLinearGradient(0, 0, 0, height);
        wall.addColorStop(0, '#fff0c8');
        wall.addColorStop(0.58, '#f8dfb0');
        wall.addColorStop(1, '#efcf97');
        storyCtx.fillStyle = wall;
        storyCtx.fillRect(0, 0, width, height);

        // Soft paper texture dots.
        storyCtx.save();
        storyCtx.globalAlpha = 0.12;
        storyCtx.fillStyle = '#b8874c';
        for (let i = 0; i < 140; i++) {
            const x = (i * 137) % width;
            const y = (i * 251) % height;
            storyCtx.beginPath();
            storyCtx.arc(x, y, 1.2 + (i % 3), 0, Math.PI * 2);
            storyCtx.fill();
        }
        storyCtx.restore();

        // Floor and rug.
        storyCtx.fillStyle = '#efcf98';
        storyCtx.fillRect(0, height * 0.76, width, height * 0.24);
        storyCtx.strokeStyle = 'rgba(156, 105, 50, .18)';
        storyCtx.lineWidth = 3;
        for (let x = -40; x < width; x += 84) {
            storyCtx.beginPath();
            storyCtx.moveTo(x, height * 0.76);
            storyCtx.lineTo(x + 42, height);
            storyCtx.stroke();
        }
        storyCtx.fillStyle = 'rgba(255,255,255,.34)';
        storyCtx.fillRect(width * 0.39, height * 0.78, width * 0.25, height * 0.08);

        // Open door and outdoor path.
        const doorX = width * 0.36;
        const doorY = height * 0.08;
        const doorW = width * 0.28;
        const doorH = height * 0.67;
        storyCtx.fillStyle = '#9b6b3e';
        storyCtx.fillRect(doorX - 18, doorY - 18, doorW + 36, doorH + 36);
        const outside = storyCtx.createLinearGradient(0, doorY, 0, doorY + doorH);
        outside.addColorStop(0, '#aee6ff');
        outside.addColorStop(0.55, '#d9edb5');
        outside.addColorStop(1, '#f6dd9c');
        storyCtx.fillStyle = outside;
        storyCtx.fillRect(doorX, doorY, doorW, doorH);
        storyCtx.fillStyle = 'rgba(116, 172, 121, .65)';
        for (let i = 0; i < 7; i++) {
            storyCtx.beginPath();
            storyCtx.ellipse(doorX + doorW * (0.1 + i * 0.14), doorY + doorH * (0.55 + (i % 2) * .04), 120, 42, 0, 0, Math.PI * 2);
            storyCtx.fill();
        }
        storyCtx.fillStyle = 'rgba(115, 156, 190, .38)';
        storyCtx.beginPath();
        storyCtx.moveTo(doorX, doorY + doorH * .45);
        storyCtx.quadraticCurveTo(doorX + doorW * .25, doorY + doorH * .25, doorX + doorW * .5, doorY + doorH * .42);
        storyCtx.quadraticCurveTo(doorX + doorW * .75, doorY + doorH * .25, doorX + doorW, doorY + doorH * .45);
        storyCtx.lineTo(doorX + doorW, doorY + doorH * .58);
        storyCtx.lineTo(doorX, doorY + doorH * .58);
        storyCtx.fill();
        storyCtx.strokeStyle = 'rgba(151, 104, 52, .35)';
        storyCtx.lineWidth = 8;
        storyCtx.beginPath();
        storyCtx.moveTo(doorX + doorW * .5, doorY + doorH);
        storyCtx.quadraticCurveTo(doorX + doorW * .46, doorY + doorH * .83, doorX + doorW * .5, doorY + doorH * .65);
        storyCtx.stroke();

        // Left shelf, bags, and cabinet.
        storyCtx.fillStyle = '#9c683b';
        storyCtx.fillRect(width * .04, height * .18, width * .23, 18);
        storyCtx.fillRect(width * .08, height * .2, 12, 80);
        storyCtx.fillRect(width * .22, height * .2, 12, 80);
        storyCtx.fillStyle = 'rgba(255,255,255,.45)';
        storyCtx.fillRect(width * .06, height * .58, width * .2, height * .18);
        storyCtx.strokeStyle = '#9c683b';
        storyCtx.lineWidth = 5;
        storyCtx.strokeRect(width * .06, height * .58, width * .2, height * .18);
        storyCtx.fillStyle = '#6b8fa3';
        storyCtx.fillRect(width * .16, height * .27, 44, 190);
        storyCtx.fillStyle = '#fff8e8';
        storyCtx.beginPath();
        storyCtx.roundRect(width * .08, height * .3, 76, 140, 18);
        storyCtx.fill();

        // Right wall props.
        storyCtx.fillStyle = '#c26848';
        storyCtx.fillRect(width * .73, height * .18, 78, 170);
        storyCtx.fillStyle = '#34251d';
        storyCtx.font = '42px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
        storyCtx.fillText('平', width * .745, height * .24);
        storyCtx.fillText('安', width * .745, height * .31);
        storyCtx.fillText('喜', width * .745, height * .38);
        storyCtx.fillText('樂', width * .745, height * .45);
        storyCtx.fillStyle = '#9c683b';
        storyCtx.fillRect(width * .79, height * .25, width * .17, 18);
        storyCtx.fillStyle = 'rgba(255,255,255,.48)';
        storyCtx.fillRect(width * .78, height * .61, width * .18, height * .12);
        storyCtx.strokeStyle = '#9c683b';
        storyCtx.strokeRect(width * .78, height * .61, width * .18, height * .12);
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
        storyCtx.font = '700 22px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
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
        if (resultBackBtn) {
            resultBackBtn.addEventListener('click', () => {
                playSfx('click');
                if (brushStageOverlay) brushStageOverlay.classList.add('hidden');
                resultsCard.classList.add('hidden');
                introCard.classList.remove('hidden');
                if (appHeader) appHeader.classList.add('hidden');
            });
        }
        if (brushStageClose) {
            brushStageClose.addEventListener('click', () => {
                if (!brushCompleted) return;
                hideBrushOverlay();
                document.getElementById('open-scroll-share-btn')?.focus({ preventScroll: true });
            });
        }
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape' || !brushCompleted || brushStageOverlay?.classList.contains('hidden')) return;
            hideBrushOverlay();
            document.getElementById('open-scroll-share-btn')?.focus({ preventScroll: true });
        });
        window.addEventListener('message', handleBrushMessage);

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

        // Tap the runner scene to fast-forward bridge / dash / splash animations
        canvas.addEventListener('pointerdown', () => {
            if (skippableStates.includes(dogState)) {
                fastForward = true;
            }
        });

        // Mobile lobby leaderboard popup (top-right "★ 排行榜"); content mirrors the lobby leaderboard.
        const rankToggle = document.getElementById('lobby-rank-toggle');
        const rankModal = document.getElementById('lobby-rank-modal');
        const rankDialog = document.getElementById('lobby-rank-dialog');
        let rankReturnFocus = null;
        function closeLobbyRank() {
            if (!rankModal || rankModal.classList.contains('hidden')) return;
            rankModal.classList.add('hidden');
            if (rankReturnFocus) rankReturnFocus.focus({ preventScroll: true });
        }
        function openLobbyRank() {
            if (!rankModal) return;
            const board = document.querySelector('.lobby-leaderboard');
            const summary = document.getElementById('lobby-rank-modal-summary');
            const list = document.getElementById('lobby-rank-modal-list');
            if (board && summary && list) {
                summary.innerHTML = board.querySelector('.lobby-rank-summary').innerHTML;
                list.innerHTML = '';
                board.querySelectorAll('ol li').forEach((li) => {
                    const row = li.cloneNode(true);
                    row.querySelector('.lobby-rank-place').classList.replace('lobby-rank-place', 'lobby-rank-modal-place');
                    row.querySelector('.lobby-rank-name').classList.replace('lobby-rank-name', 'lobby-rank-modal-name');
                    list.appendChild(row);
                });
            }
            rankReturnFocus = document.activeElement;
            rankModal.classList.remove('hidden');
            if (rankDialog) rankDialog.focus({ preventScroll: true });
        }
        if (rankToggle) rankToggle.addEventListener('click', () => { playSfx('click'); openLobbyRank(); });
        // Wide-desktop side card: its "排行榜" button opens the same popup.
        const rankLink = document.querySelector('.lobby-rank-link');
        if (rankLink) rankLink.addEventListener('click', () => { playSfx('click'); openLobbyRank(); });
        ['lobby-rank-close', 'lobby-rank-close-bottom'].forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', () => { playSfx('click'); closeLobbyRank(); });
        });
        if (rankModal) rankModal.addEventListener('click', (e) => { if (e.target === rankModal) closeLobbyRank(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLobbyRank(); });

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
        writingScore = 0;
        writingResult = null;
        brushStageStarted = false;
        brushCompleted = false;
        document.body.classList.remove('brush-stage-active');
        questionRecords = [];
        currentQuestionIndex = 0;
        totalElapsedSeconds = 0;
        resultLocked = false;
        resultElapsedMs = 0;
        if (brushStageOverlay) brushStageOverlay.classList.add('hidden');
        if (brushStageClose) brushStageClose.classList.add('hidden');
        if (brushStageFrame) brushStageFrame.removeAttribute('src');
        gameStartTime = new Date();
        
        resultsCard.classList.add('hidden');
        gameCard.classList.remove('hidden');
        if (introCard) introCard.classList.add('hidden');
        if (storyCard) storyCard.classList.add('hidden');
        gameCard.classList.remove('fade-out');
        
        shouldAutoTransition = false;
        flashTimer = 0;
        openingCountdownActive = false;
        openingCountdownStartedAt = 0;
        resetRunnerViewForGameStart();
        
        loadQuestion(currentQuestionIndex);
    }

    // 4. Load Question at Index
    function lockQuestionControlsForOpening(lock) {
        if (playAudioBtn) playAudioBtn.disabled = lock;
        if (helpBgBtn) helpBgBtn.disabled = lock;
        if (submitBtn) submitBtn.disabled = true;
        if (clearBtn) clearBtn.disabled = lock || selectedBlocks.length === 0;
        if (gameCard) gameCard.classList.toggle('opening-countdown', lock);
    }

    function playQuestionAudioOnceReady() {
        if (gameAudio._playListener) {
            gameAudio.removeEventListener('canplay', gameAudio._playListener);
            gameAudio._playListener = null;
        }
        if (gameAudio.paused) {
            gameAudio.play().catch(e => {
                console.log("Autoplay blocked: user interaction required.", e);
            });
        }
    }

    function startOpeningCountdown() {
        openingCountdownActive = true;
        openingCountdownStartedAt = Date.now();
        dogX = getDogStartX();
        dogY = rs(-100);
        dogState = 'recovering';
        flashTimer = 70;
        lockQuestionControlsForOpening(true);

        setTimeout(() => {
            openingCountdownActive = false;
            dogX = getDogStartX();
            dogY = groundY;
            dogState = 'running';
            flashTimer = 0;
            lockQuestionControlsForOpening(false);
            playQuestionAudioOnceReady();
        }, openingCountdownDuration);
    }

    function loadQuestion(index) {
        if (index >= questions.length) {
            beginBrushStage();
            return;
        }

        const q = questions[index];
        isAnswerSubmitted = false;
        questionScore = QUESTION_SCORE;
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
        const shuffledHakka = shuffleArray(hakkaChars);

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
        
        // Auto play audio when ready. The first question waits for the opening countdown.
        gameAudio._playListener = function() {
            // While advancing, audio starts once Ah-Hei is back at the starting spot.
            if (openingCountdownActive || dogState === 'advancing') return;
            playQuestionAudioOnceReady();
        };
        gameAudio.addEventListener('canplay', gameAudio._playListener);

        if (index === 0) {
            startOpeningCountdown();
        }
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
        if (isAnswerSubmitted || selectedBlocks.length === 0 || dogState === 'advancing') return;
        
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
        const currentCorrectHakkaSequence = getCorrectSequence(q);
        const isCorrect = checkSequenceMatch(userSequenceText, currentCorrectHakkaSequence);

        // Disable standard game controls
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;

        if (isCorrect) {
            playSfx('pass');   // 答對：發光的便橋鋪出來
            correctCount++;
            totalScore += questionScore;
            recordQuestionOutcome('correct', questionScore);
            scoreDisplay.textContent = `得分: ${totalScore}`;
            
            shouldAutoTransition = true;
            startBridgeBuild('wood');
        } else {
            playSfx('wrong');
            // Deduct score for wrong attempt
            questionAttempts++;
            questionScore = Math.max(0, questionScore - WRONG_PENALTY);
            
            // The break point depends on where the cliff ends up, so it is computed once the cliff has arrived.
            pendingWrongCharCount = selectedBlocks.length;
            startBridgeBuild('broken');
        }
    }

    function getCorrectSequence(q) {
        return q.chinese_sentence ? (q.correct_sequence || getHakkaCharacters(q.hakka_hanji)) : getHakkaCharacters(q.hakka_hanji);
    }

    function computeWrongBreakX() {
        const q = questions[currentQuestionIndex];
        const totalChars = (q ? getCorrectSequence(q).length : 0) || 1;

        if (pendingWrongCharCount < totalChars) {
            // If they didn't place all blocks, they fall off the end of their blocks
            return cliffX + (pendingWrongCharCount / totalChars) * getCliffWidth();
        }
        // If they placed all blocks but wrong order, fall from the broken bridge edge.
        const bridgeSourceWidth = isImageReady(runnerAssets.bridge) ? runnerAssets.bridge.naturalWidth : 805;
        const brokenBridgeSourceWidth = isImageReady(runnerAssets.brokenBridge) ? runnerAssets.brokenBridge.naturalWidth : bridgeSourceWidth / 2;
        return getBridgeDrawX() + getBridgeDrawWidth() * (brokenBridgeSourceWidth / bridgeSourceWidth);
    }

    // Rush the cliff into place (if answered early), reveal the bridge, then dash across.
    function startBridgeBuild(kind) {
        const q = questions[currentQuestionIndex];
        bridgeKind = kind;
        if (kind === 'golden') playSfx('help');
        bridgeChars = kind === 'golden' && q ? [...getCorrectSequence(q)] : [];
        bridgeBuildProgress = 0;
        bridgeAlpha = 0.8;
        buildFrame = 0;
        buildDuration = kind === 'golden' ? Math.max(18, bridgeChars.length * 6) : 18;
        buildHold = kind === 'golden' ? 40 : 4;
        wrongBreakX = null;
        flashTimer = 0;
        dogState = 'building';
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
        if (isAnswerSubmitted || dogState === 'advancing') return;
        
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
        
        // Bo-Gong lays the correct answer as a golden bridge
        shouldAutoTransition = true;
        startBridgeBuild('golden');
        
        // Hide buttons
        submitBtn.classList.add('hidden');
        clearBtn.disabled = true;
    }

    // Correct / help: keep running forward while the old cliff scrolls away and the next question loads.
    function startAdvance() {
        const keptCliffX = cliffX;
        const keptKind = bridgeKind;
        const keptChars = bridgeChars;

        currentQuestionIndex++;
        loadQuestion(currentQuestionIndex);
        if (currentQuestionIndex >= questions.length) return;

        nextCliffStartX = cliffX;
        cliffX = keptCliffX;
        hasCliffAppeared = true;
        bridgeKind = keptKind;
        bridgeChars = keptChars;
        bridgeBuildProgress = 1;
        dogState = 'advancing';
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

    function getStarResult(score, maxScore = 100) {
        const percent = maxScore > 0 ? (score / maxScore) * 100 : 0;
        if (percent >= 100) return starResults[0];
        if (percent >= 80) return starResults[1];
        if (percent >= 60) return starResults[2];
        if (percent >= 40) return starResults[3];
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

    function formatScore(value) {
        return Number(value || 0).toFixed(2);
    }

    // Mock leaderboard for the results page.
    // Replace with the real ranking service later; scores are display strings.
    const leaderboardTop = [
        { rank: 1, name: '林O恩', score: '100.00', time: '00:00:05.00' },
        { rank: 2, name: '張O彤', score: '100.00', time: '00:00:09.00' },
        { rank: 3, name: '陳O宇', score: '100.00', time: '00:00:10.00' },
        { rank: 4, name: '李O澄', score: '100.00', time: '00:00:11.00' },
        { rank: 5, name: '黃O妍', score: '100.00', time: '00:00:12.00' },
        { rank: 6, name: '劉O安', score: '90', time: '00:00:08.00' },
        { rank: 7, name: '曾O晴', score: '90', time: '00:00:11.00' },
        { rank: 8, name: '羅O庭', score: '80', time: '00:00:07.00' },
        { rank: 9, name: '鍾O睿', score: '80', time: '00:00:10.00' },
        { rank: 10, name: '彭O萱', score: '70', time: '00:00:09.00' }
    ];
    const leaderboardStats = { myRank: 16, participants: 54, plays: 121 };

    function beginBrushStage() {
        if (brushStageStarted || !brushStageOverlay || !brushStageFrame) return;
        brushStageStarted = true;
        // Keep the runner scene alive (blurred by the overlay); only the question UI is hidden by CSS.
        dogState = 'brush_run';
        hasCliffAppeared = false;
        cliffX = canvasWidth * 20;
        bridgeKind = null;
        fastForward = false;
        dogX = getDogEntryX();
        dogY = groundY;
        shouldAutoTransition = false;
        document.body.classList.add('brush-stage-active');
        if (appHeader) appHeader.classList.add('hidden');
        if (bokongAssist) bokongAssist.classList.add('hidden');
        if (brushStageClose) brushStageClose.classList.add('hidden');
        if (brushStageTitle) brushStageTitle.textContent = '毛筆書寫';
        if (brushStageSubtitle) brushStageSubtitle.textContent = '完成五字書寫後才會結算總成績';
        brushStageFrame.src = `brush-prototype/index.html?embedded=1&dialect=${encodeURIComponent(selectedDialectId)}&session=${Date.now()}`;
        brushStageFrame.addEventListener('load', () => brushStageFrame.focus({ preventScroll: true }), { once: true });
        brushStageOverlay.classList.remove('hidden');
    }

    let brushFadeTimer = null;
    // Fade the brush overlay out (and in again when reopened) instead of cutting.
    function hideBrushOverlay() {
        if (!brushStageOverlay || brushStageOverlay.classList.contains('hidden')) return;
        brushStageOverlay.classList.add('is-leaving');
        clearTimeout(brushFadeTimer);
        brushFadeTimer = setTimeout(() => {
            brushStageOverlay.classList.add('hidden');
            brushStageOverlay.classList.remove('is-leaving');
        }, 520);
    }
    function showBrushOverlay() {
        clearTimeout(brushFadeTimer);
        brushStageOverlay.classList.remove('is-leaving', 'hidden');
    }

    function sendBrushSessionSummary(show = false) {
        if (!brushStageFrame?.contentWindow || !writingResult) return;
        brushStageFrame.contentWindow.postMessage({
            type: 'brush-session-summary',
            show,
            quizScore: Number((totalScore - writingScore).toFixed(2)),
            writingScore,
            totalScore: Number(totalScore.toFixed(2)),
            totalElapsedMs: resultElapsedMs,
            totalElapsedText: formatResultTime(resultElapsedMs)
        }, messageTargetOrigin);
    }

    function openBrushResult() {
        if (!brushCompleted || !brushStageOverlay) return;
        showBrushOverlay();
        brushStageFrame.focus({ preventScroll: true });
        sendBrushSessionSummary(true);
    }

    function handleBrushMessage(event) {
        if (!isSameOriginMessage(event.origin) || !brushStageFrame || event.source !== brushStageFrame.contentWindow) return;
        if (event.data?.type === 'brush-close-request') {
            if (!brushCompleted) return;
            hideBrushOverlay();
            document.getElementById('open-scroll-share-btn')?.focus({ preventScroll: true });
            return;
        }
        if (event.data?.type !== 'brush-complete') return;
        if (brushCompleted) return;
        brushCompleted = true;
        writingScore = Math.max(0, Math.min(BRUSH_MAX_SCORE, Number(Number(event.data.score || 0).toFixed(2))));
        writingResult = event.data;
        totalScore = Number((totalScore + writingScore).toFixed(2));
        hideBrushOverlay();
        if (brushStageClose) brushStageClose.classList.remove('hidden');
        if (brushStageTitle) brushStageTitle.textContent = '我的客字繪卷';
        if (brushStageSubtitle) brushStageSubtitle.textContent = '可下載或分享這次的毛筆作品';
        showResults();
        // Crossfade: the results card's own fadeIn runs while the brush panel fades out.
        sendBrushSessionSummary();
    }

    function formatResultTime(totalMs) {
        const safeMs = Math.max(0, Math.floor(totalMs || 0));
        const minutes = Math.floor(safeMs / 60000).toString().padStart(2, '0');
        const seconds = Math.floor((safeMs % 60000) / 1000).toString().padStart(2, '0');
        const centiseconds = Math.floor((safeMs % 1000) / 10).toString().padStart(2, '0');
        return `00:${minutes}:${seconds}.${centiseconds}`;
    }

    // 10. Show Results
    function showResults() {
        if (!resultLocked) {
            playSfx('finish');
            resultElapsedMs = gameStartTime ? Math.max(0, Date.now() - gameStartTime.getTime()) : 0;
            resultLocked = true;
        }
        dogState = 'idle';
        shouldAutoTransition = false;
        document.body.classList.remove('brush-stage-active');
        if (appHeader) appHeader.classList.add('hidden');
        gameCard.classList.add('hidden');
        resultsCard.classList.remove('hidden');
        if (bokongAssist) bokongAssist.classList.add('hidden');

        const elapsedMs = resultElapsedMs;
        totalElapsedSeconds = Math.round(elapsedMs / 1000);
        const elapsedText = formatResultTime(elapsedMs);
        const maxScore = 100;
        const completedText = `排字 ${questions.length} / ${questions.length} 題．毛筆已完成`;
        const star = getStarResult(totalScore, maxScore);

        resultScore.textContent = `${formatScore(totalScore)} / ${formatScore(maxScore)}`;
        resultAccuracy.textContent = completedText;
        resultTime.textContent = elapsedText;
        if (resultRank) resultRank.textContent = `第${leaderboardStats.myRank}名`;

        if (resultSummary) {
            const quizScore = Number((totalScore - writingScore).toFixed(2));
            resultSummary.innerHTML = `排字 ${formatScore(quizScore)} / ${QUESTION_SCORE * 5}．毛筆 ${formatScore(writingScore)} / ${BRUSH_MAX_SCORE}<br><strong>${star.title}</strong>`;
        }

        if (rankingSection) {
            rankingSection.innerHTML = `
                <h2 id="result-ranking-title" tabindex="-1">排行榜</h2>
                <div class="result-rank-head"><span>排名</span><span>學員</span><span>分數</span><span>計時</span></div>
                <ol class="result-rank-list">
                    ${leaderboardTop.map(row => {
                        const medal = ['rank-first', 'rank-second', 'rank-third'][row.rank - 1] || '';
                        const place = row.rank <= 3
                            ? `<span class="result-rank-place"><img src="data/ui/icon_rank${row.rank}.png" alt="第 ${row.rank} 名${['金', '銀', '銅'][row.rank - 1]}牌"><span class="sr-only">第 ${row.rank} 名</span></span>`
                            : `<span class="result-rank-place"><b>${row.rank}</b></span>`;
                        return `<li${medal ? ` class="${medal}"` : ''}>${place}<span>${row.name}</span><b>${row.score}</b><time>${row.time}</time></li>`;
                    }).join('')}
                    <li class="result-rank-ellipsis" aria-hidden="true"><span>·</span><span>·</span><span>·</span></li>
                    <li class="mine"><span class="result-rank-place"><b>${leaderboardStats.myRank}</b></span><span>你</span><b>${formatScore(totalScore)}</b><time>${elapsedText}</time></li>
                </ol>
                <p class="rank-foot">目前共 <b>${leaderboardStats.participants}</b> 人參加，共玩 <b>${leaderboardStats.plays}</b> 次</p>
                <aside class="result-ranking-note">
                    <b>注意事項</b>
                    <ol>
                        <li>同分且作答時間相同時，依活動參加先後進行排序。</li>
                        <li>本關總分 100 分；排字 5 題共 80 分，每題 16 分，錯一次扣 4 分；毛筆書寫最高 20 分。</li>
                    </ol>
                </aside>
                <button class="btn btn-primary result-scroll-share-btn" id="open-scroll-share-btn" type="button">查看／分享我的繪卷</button>`;
            document.getElementById('open-scroll-share-btn')?.addEventListener('click', openBrushResult);
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
            const isFailedByAttempts = record.wrongCount >= 5 && record.score <= 0;
            const isHelped = !isFailedByAttempts && record.helpUsed;
            const isPassed = !isFailedByAttempts && record.status === 'correct';
            let statusClass = 'status-pass';
            let statusText = '✓ 已通關';
            if (isFailedByAttempts || (!isPassed && record.status !== 'unanswered')) {
                statusClass = 'status-fail';
                statusText = '✘ 未通關';
            } else if (isHelped) {
                statusClass = 'status-help';
                statusText = '求助伯公';
            } else if (record.wrongCount > 0) {
                statusClass = 'status-wrong';
                statusText = `錯 ${record.wrongCount} 次`;
            }
            const item = document.createElement('article');
            item.className = `review-item sentence-review-item simple-review-item ${isFailedByAttempts ? 'failed' : isHelped ? 'helped' : isPassed ? 'passed' : 'failed'}`;
            item.innerHTML = `
                <div class="review-card-head">
                    <h4>第 ${idx + 1} 題</h4>
                    <div class="review-badges">
                        <span>得分：${record.score} 分</span>
                        <em class="${statusClass}">${statusText}</em>
                    </div>
                </div>
                <div class="review-sentence-body">
                    <p class="review-hakka-line">${record.hakka}</p>
                    <p class="review-translation-line">${record.translation}</p>
                </div>`;
            const playBtn = document.createElement('button');
            playBtn.className = 'review-play-btn review-audio-icon-btn';
            playBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i><span class="sr-only">播放音檔</span>';
            playBtn.type = 'button';
            playBtn.setAttribute('aria-label', `播放第 ${idx + 1} 題音檔`);
            let reviewAudio = null;
            playBtn.addEventListener('click', (event) => {
                event.preventDefault();
                if (!reviewAudio) {
                    reviewAudio = new Audio(record.audioUrl);
                    reviewAudio.addEventListener('ended', () => {
                        playBtn.classList.remove('is-playing');
                        playBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i><span class="sr-only">播放音檔</span>';
                        playBtn.setAttribute('aria-label', `播放第 ${idx + 1} 題音檔`);
                    });
                    reviewAudio.addEventListener('pause', () => {
                        if (!reviewAudio.ended) {
                            playBtn.classList.remove('is-playing');
                            playBtn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i><span class="sr-only">播放音檔</span>';
                            playBtn.setAttribute('aria-label', `播放第 ${idx + 1} 題音檔`);
                        }
                    });
                }
                if (reviewAudio.paused) {
                    reviewAudio.play().then(() => {
                        playBtn.classList.add('is-playing');
                        playBtn.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i><span class="sr-only">暫停音檔</span>';
                        playBtn.setAttribute('aria-label', `暫停第 ${idx + 1} 題音檔`);
                    }).catch(err => console.error('播放音檔失敗:', err));
                } else {
                    reviewAudio.pause();
                }
            });
            item.appendChild(playBtn);
            reviewList.appendChild(item);
        });
        document.querySelector('.result-summary-card')?.focus({ preventScroll: true });
    }

    // Audio Event Handlers
    function toggleAudio() {
        if (openingCountdownActive) return;
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
            const steps = fastForward ? fastForwardSteps : 1;
            for (let i = 0; i < steps; i++) {
                updateGamePhysics();
            }
            drawGameGraphics();
            animationFrameId = requestAnimationFrame(loop);
        }
        
        loop();
    }

    function getQuestionCliffStartX(index = currentQuestionIndex) {
        const roadStarts = [rs(1040), rs(1140), rs(1260), rs(1100), rs(1320)];
        return roadStarts[index % roadStarts.length];
    }

    function resetRunnerViewForGameStart() {
        scrollX = 0;
        skyScrollX = 0;
        mountainScrollX = 0;
        forestScrollX = 0;
        dogX = getDogStartX();
        dogY = groundY;
        dogState = 'running';
        hasCliffAppeared = false;
        cliffX = getQuestionCliffStartX(0);
        wrongBreakX = null;
        bridgeKind = null;
        bridgeAlpha = 0.0;
        splashParticles = [];
        sparkles = [];
        speedLines = [];
        flashTimer = 0;
        fastForward = false;
        isWetRecovery = false;
        helpAfterRecovery = false;
    }

    function resetCanvasForQuestion(q) {
        hasCliffAppeared = false;
        cliffX = getQuestionCliffStartX(currentQuestionIndex); // Variable road length per question.
        if (dogState !== 'transition_in') {
            dogState = 'running';
        }
        bridgeKind = null;
        bridgeAlpha = 0.0;
        splashParticles = [];
        sparkles = [];
        wrongBreakX = null;
        isWetRecovery = false;
        helpAfterRecovery = false;
        
        // Keep runner speed steady; each question can have a different road length.
        questionBaseSpeed = rs(2.2);
        activeSpeed = questionBaseSpeed * speedMultiplier;
    }

    function updateGamePhysics() {
        if (isGamePaused) return;
        
        dogFrame++;
        
        // Decrement flash timer
        if (flashTimer > 0) {
            flashTimer--;
        }
        
        // Update transparent bridge alpha pulsations
        if (bridgeKind === 'golden') {
            bridgeAlpha = 0.6 + Math.sin(dogFrame * 0.15) * 0.2;
        }
        
        // Handle physical movement based on dogState
        if (openingCountdownActive && dogState === 'running') {
            dogX += (getDogStartX() - dogX) * 0.1;
            dogY = groundY;
        }
        else if (dogState === 'running') {
            // Move cliff closer and scroll background layers ONLY before cliff appears
            if (!hasCliffAppeared) {
                const cliffTargetX = getCliffTargetX();
                const distanceToTarget = Math.max(0, cliffX - cliffTargetX);
                const approachSpeed = distanceToTarget < rs(95)
                    ? Math.max(rs(0.45), distanceToTarget * 0.18)
                    : activeSpeed;
                const step = Math.min(activeSpeed, approachSpeed, distanceToTarget);

                scrollX += step;
                skyScrollX += step * 0.05;
                mountainScrollX += step * 0.15;
                forestScrollX += step * 0.4;
                cliffX -= step;

                if (distanceToTarget <= rs(0.5) || step <= 0) {
                    cliffX = cliffTargetX;
                    hasCliffAppeared = true;
                }
            }
            
            // Ensure dog is in running position
            dogX += (getDogStartX() - dogX) * 0.1;
            dogY = groundY;
        } 
        else if (dogState === 'brush_run') {
            // Brush stage: the dog keeps trotting along an endless road behind the (blurred) writing panel.
            scrollRunnerLayers(rs(2.2) * speedMultiplier);
            dogX += (getDogStartX() - dogX) * 0.1;
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
            if (dogX >= canvasWidth + rs(100)) {
                currentQuestionIndex++;
                loadQuestion(currentQuestionIndex);
                
                // If it's not the end of the game, prepare transition_in
                if (currentQuestionIndex < questions.length) {
                    dogX = getDogEntryX();
                    dogState = 'transition_in';
                }
            }
        }
        else if (dogState === 'transition_in') {
            // Let Ah-Hei enter first. Do not move the cliff or runway until the player can see the dog.
            dogX += Math.max(rs(7), (getDogStartX() - dogX) * 0.16);
            dogY = groundY;
            
            // If dog reaches running position, change state to running
            if (dogX >= getDogStartX() - rs(5)) {
                dogX = getDogStartX();
                dogState = 'running';
            }
        } 
        else if (dogState === 'building') {
            // Answered before the cliff arrived: rush the cliff into place first.
            if (!hasCliffAppeared) {
                const cliffTargetX = getCliffTargetX();
                const step = Math.min(getCliffRushSpeed(), Math.max(0, cliffX - cliffTargetX));
                scrollRunnerLayers(step);
                cliffX -= step;
                if (cliffX - cliffTargetX <= rs(0.5)) {
                    cliffX = cliffTargetX;
                    hasCliffAppeared = true;
                }
            }
            dogX += (getDogStartX() - dogX) * 0.1;
            dogY = groundY;

            if (hasCliffAppeared) {
                buildFrame++;
                bridgeBuildProgress = Math.min(1, buildFrame / buildDuration);

                // Sparkles at the growing edge of the bridge
                if (bridgeBuildProgress < 1 && buildFrame % 2 === 0) {
                    sparkles.push({
                        x: getBridgeDrawX() + getBridgeDrawWidth() * bridgeBuildProgress,
                        y: groundY - rs(4) + Math.random() * rs(12),
                        size: rs(2) + Math.random() * rs(3),
                        alpha: 1.0,
                        color: bridgeKind === 'golden' ? '#ffd166' : '#fff3c4'
                    });
                }

                if (buildFrame >= buildDuration + buildHold) {
                    if (bridgeKind === 'broken') wrongBreakX = computeWrongBreakX();
                    dogState = 'crossing';
                }
            }
        }
        else if (dogState === 'advancing') {
            // Camera keeps moving forward: old cliff scrolls away, Ah-Hei eases back to his start spot.
            const step = getAdvanceSpeed();
            scrollRunnerLayers(step);
            cliffX -= step;
            dogX += (getDogStartX() - dogX) * 0.12;
            dogY = groundY;
            spawnSpeedLines();

            if (cliffX + getCliffWidth() + rs(300) < 0) {
                cliffX = nextCliffStartX;
                hasCliffAppeared = false;
                bridgeKind = null;
                dogX = getDogStartX();
                dogState = 'running';
                playQuestionAudioOnceReady();
            }
        }
        else if (dogState === 'crossing') {
            // Dash across the bridge
            dogX += getDashSpeed();
            spawnSpeedLines();

            // Check if dog reached the wrong break point
            if (wrongBreakX !== null && dogX >= wrongBreakX) {
                dogState = 'falling';
                wrongBreakX = null; // Clear to prevent double trigger
            }
            // Otherwise, check if dog reached the other side (only if not falling)
            else if (wrongBreakX === null && dogX >= cliffX + getCliffWidth() + getBridgeLandingOverlap() + rs(12)) {
                if (shouldAutoTransition) {
                    startAdvance();
                } else {
                    dogState = 'running';
                    hasCliffAppeared = false;
                    bridgeKind = null;
                }
            }
        }
        else if (dogState === 'falling') {
            // Dog falls off the cliff into the river
            dogX += activeSpeed * 0.5;
            dogY += rs(6.5); // gravity pull

            if (dogY >= riverY) {
                dogY = riverY;
                dogState = 'splashing';
                splashFrames = 0;
                playSfx('splash');
                createSplash(dogX, riverY);
            }
        }
        else if (dogState === 'splashing') {
            // Splash particles updating
            updateSplash();
            splashFrames++;
            if (splashFrames >= 42) {
                handleAfterSplash();
            }
        }
        else if (dogState === 'recovering') {
            // Dog falls down from the sky vertically to groundY
            dogX = getDogStartX();
            dogY += (groundY - dogY) * 0.15;

            if (Math.abs(dogY - groundY) < 1) {
                dogY = groundY;
                if (isWetRecovery) {
                    dogState = 'shaking';
                    shakeFrames = 0;
                } else {
                    dogState = 'running';
                }
            }
        }
        else if (dogState === 'shaking') {
            // Ah-Hei shakes the river water off before running again
            dogX = getDogStartX();
            dogY = groundY;
            shakeFrames++;
            if (shakeFrames >= 36) {
                isWetRecovery = false;
                if (helpAfterRecovery) {
                    helpAfterRecovery = false;
                    startBridgeBuild('golden');
                } else {
                    dogState = 'running';
                }
            }
        }

        updateSpeedLines();
        if (!skippableStates.includes(dogState)) {
            fastForward = false;
        }
    }

    function scrollRunnerLayers(step) {
        scrollX += step;
        skyScrollX += step * 0.05;
        mountainScrollX += step * 0.15;
        forestScrollX += step * 0.4;
    }

    function handleAfterSplash() {
        splashParticles = [];
        dogState = 'recovering';
        dogX = getDogStartX();
        dogY = rs(-100);
        flashTimer = 0;
        isWetRecovery = true;
        bridgeKind = null;

        if (questionAttempts >= MAX_WRONG_ATTEMPTS) {
            // Auto-pass: fifth wrong attempt, Bo-Gong builds the bridge after Ah-Hei shakes off.
            questionUsedHelp = true;
            questionHelpType = 'auto';
            recordQuestionOutcome('auto-help', 0);
            if (bokongAssist) bokongAssist.classList.remove('hidden');
            showInlineFeedback("伯公協助，本題 0 分。", 'var(--accent)');
            helpAfterRecovery = true;
            shouldAutoTransition = true;
            return;
        }

        // Normal incorrect retry
        showInlineFeedback("答錯了！字卡已還原請重新排列！", 'var(--danger)');
        isAnswerSubmitted = false;
        clearSelection();
        submitBtn.classList.remove('hidden');
        submitBtn.disabled = true;
        clearBtn.disabled = true;
        helpBgBtn.disabled = false;
    }

    function spawnSpeedLines() {
        if (dogFrame % 2 !== 0) return;
        speedLines.push({
            x: dogX - rs(30) - Math.random() * rs(20),
            y: dogY - rs(8) - Math.random() * rs(48),
            length: rs(30) + Math.random() * rs(50),
            alpha: 0.85
        });
    }

    function updateSpeedLines() {
        for (let i = speedLines.length - 1; i >= 0; i--) {
            const line = speedLines[i];
            line.x -= rs(7);
            line.alpha -= 0.06;
            if (line.alpha <= 0) speedLines.splice(i, 1);
        }
    }

    function drawSpeedLines() {
        if (speedLines.length === 0) return;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = rs(2.5);
        ctx.strokeStyle = '#ffffff';
        speedLines.forEach(line => {
            ctx.globalAlpha = line.alpha;
            ctx.beginPath();
            ctx.moveTo(line.x, line.y);
            ctx.lineTo(line.x - line.length, line.y);
            ctx.stroke();
        });
        ctx.restore();
    }

    function drawSkipHint() {
        if (!skippableStates.includes(dogState)) return;
        const label = fastForward ? '▸▸ 快轉中' : '點擊畫面快轉 ▸▸';
        ctx.save();
        ctx.font = `800 ${rs(6.5)}px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        // Bottom-center: the canvas is cropped left/right (object-fit: cover) on narrow screens.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const x = canvasWidth / 2;
        const y = canvasHeight - rs(16);
        const width = ctx.measureText(label).width;
        ctx.fillStyle = 'rgba(31, 26, 18, .5)';
        ctx.beginPath();
        ctx.roundRect(x - width / 2 - rs(5), y - rs(6), width + rs(10), rs(12), rs(6));
        ctx.fill();
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(label, x, y + rs(.5));
        ctx.restore();
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

        const grassDrawn = drawScrollingImage(runnerAssets.grass, rs(96), rs(52), forestScrollX, 0.8, 1);
        if (!grassDrawn) {
            ctx.fillStyle = '#78b85a';
            ctx.fillRect(0, groundY - rs(12), canvasWidth, rs(16));
        }

        const mountainsDrawn = drawScrollingImage(runnerAssets.mountains, rs(18), rs(92), mountainScrollX, 0.45);
        if (!mountainsDrawn) {
            ctx.fillStyle = '#8fbf73';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += rs(20)) {
                let relativeScroll = (mountainScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - rs(45) + Math.sin(relativeScroll * 0.004) * rs(25) + Math.cos(relativeScroll * 0.008) * rs(10);
                if (i === 0) ctx.moveTo(i, y);
                else ctx.lineTo(i, y);
            }
            ctx.lineTo(canvasWidth, groundY);
            ctx.lineTo(0, groundY);
            ctx.fill();
        }

        const villageDrawn = drawScrollingImage(runnerAssets.village, rs(48), rs(88), forestScrollX, 0.65);
        if (!villageDrawn) {
            ctx.fillStyle = '#71a858';
            ctx.beginPath();
            for (let i = 0; i <= canvasWidth; i += rs(15)) {
                let relativeScroll = (forestScrollX + i) % (canvasWidth * 1.5);
                let y = groundY - rs(15) + Math.sin(relativeScroll * 0.008) * rs(12);
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
        for (let i = 0; i <= canvasWidth; i += rs(25)) {
            let relativeScroll = (scrollX + i) % (canvasWidth * 1.5);
            let y = riverY + Math.sin(relativeScroll * 0.03 + dogFrame * 0.08) * rs(6);
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.lineTo(canvasWidth, canvasHeight);
        ctx.lineTo(0, canvasHeight);
        ctx.fill();
        
        // 5. Draw flat image ground.
        const groundTop = groundY - rs(8);
        const groundHeight = canvasHeight - groundTop + rs(8);
        const cliffInnerOverlap = 0;
        const groundJoinOverlap = 0;
        const floorLoopToFloorROverlap = 1;
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
        const currentCliffWidth = getCliffWidth();
        const rightCliffX = (cliffX + currentCliffWidth) - cliffInnerOverlap;
        const leftGroundEndX = leftCliffX + floorLoopToFloorROverlap;
        const rightGroundStartX = rightCliffX + rightCliffWidth - groundJoinOverlap;

        if (hasCliffAppeared || cliffX < canvasWidth) {
            // Left platform
            if (cliffX > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, groundTop, Math.max(0, leftGroundEndX), groundHeight);
                ctx.clip();
                if (!drawTiledImageRange(runnerAssets.floorLoop, 0, leftGroundEndX, groundTop, groundHeight, leftGroundEndX, 0)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(0, groundY, cliffX, riverY - groundY - rs(4));
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(0, groundY - rs(4), cliffX, rs(10));
                }
                ctx.restore();
            }
            
            // Right platform
            let rightStart = cliffX + currentCliffWidth;
            if (rightStart < canvasWidth) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(rightGroundStartX, groundTop, Math.max(0, canvasWidth - rightGroundStartX), groundHeight);
                ctx.clip();
                if (!drawTiledImageRange(runnerAssets.floorLoop, rightGroundStartX, canvasWidth, groundTop, groundHeight, rightGroundStartX, 0)) {
                    ctx.fillStyle = '#c97820';
                    ctx.fillRect(rightStart, groundY, canvasWidth - rightStart, riverY - groundY - rs(4));
                    ctx.fillStyle = '#76aa25';
                    ctx.fillRect(rightStart, groundY - rs(4), canvasWidth - rightStart, rs(10));
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
            if (!drawScrollingImage(runnerAssets.floorLoop, groundTop, groundHeight, scrollX, 1, 0)) {
                ctx.fillStyle = '#c97820';
                ctx.fillRect(0, groundY, canvasWidth, riverY - groundY - rs(4));
                ctx.fillStyle = '#76aa25';
                ctx.fillRect(0, groundY - rs(4), canvasWidth, rs(10));
            }
        }
        
        // 6. Draw Bridge
        drawBridge();
        
        // 7. Draw Sparkles & particles
        drawSparkles();
        drawSplashParticles();
        
        // 8. Draw Dog (阿黑)
        drawSpeedLines();
        drawDog(dogX, dogY, dogState, dogFrame);
        drawSkipHint();
        drawOpeningCountdown();
    }

    function drawOpeningCountdown() {
        if (!openingCountdownActive) return;
        const elapsed = Date.now() - openingCountdownStartedAt;
        const remaining = Math.max(0, openingCountdownDuration - elapsed);
        const label = remaining > 2600 ? '3' : remaining > 1700 ? '2' : remaining > 800 ? '1' : '開始';
        const pulse = 1 + Math.sin(dogFrame * 0.16) * 0.04;

        ctx.save();
        ctx.fillStyle = 'rgba(12, 37, 31, .28)';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        ctx.translate(canvasWidth / 2, rs(74));
        ctx.scale(pulse, pulse);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${label === '開始' ? rs(48) : rs(68)}px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        ctx.lineWidth = rs(8);
        ctx.strokeStyle = 'rgba(255, 255, 255, .95)';
        ctx.fillStyle = '#0f7d5c';
        ctx.strokeText(label, 0, 0);
        ctx.fillText(label, 0, 0);
        ctx.font = `800 ${rs(18)}px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;
        ctx.lineWidth = rs(4);
        ctx.fillStyle = '#fff8c5';
        ctx.strokeStyle = 'rgba(79, 59, 44, .78)';
        ctx.strokeText('阿黑準備出發', 0, rs(54));
        ctx.fillText('阿黑準備出發', 0, rs(54));
        ctx.restore();
    }

    function getKuroPoseSprite(state, frame) {
        if (state === 'falling' && isImageReady(runnerAssets.kuroFalling)) {
            return { image: runnerAssets.kuroFalling, widthFraction: 0.73, bottomFraction: 0.815 };
        }
        if (state === 'shaking') {
            const shakeFrames = runnerAssets.kuroWetShakeFrames.filter(isImageReady);
            if (shakeFrames.length > 0) {
                return { image: shakeFrames[Math.floor(frame / 5) % shakeFrames.length], widthFraction: 0.72, bottomFraction: 0.82 };
            }
        }
        if (state === 'recovering' && isWetRecovery && isImageReady(runnerAssets.kuroWet)) {
            return { image: runnerAssets.kuroWet, widthFraction: 0.75, bottomFraction: 0.837 };
        }
        return null;
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

        // Pose sprites (1024px canvases) are drawn so Ah-Hei matches the run-frame size.
        const poseSprite = getKuroPoseSprite(state, frame);
        if (poseSprite) {
            const drawSize = rs(96) * (0.49 / poseSprite.widthFraction);
            ctx.translate(x, y);
            if (state === 'falling') ctx.rotate(0.25);
            ctx.drawImage(poseSprite.image, -drawSize * 0.5, -drawSize * poseSprite.bottomFraction + rs(2), drawSize, drawSize);
            ctx.restore();
            return;
        }

        const kuroFrames = runnerAssets.kuroRunFrames || [];
        const readyKuroFrames = kuroFrames.filter(isImageReady);
        const isDashing = state === 'crossing' || state === 'advancing';
        const kuroImage = readyKuroFrames.length > 0
            ? readyKuroFrames[Math.floor(frame / (isDashing ? 3 : 6)) % readyKuroFrames.length]
            : runnerAssets.kuroRun;

        if (isImageReady(kuroImage) && state !== 'splashing') {
            const sourceWidth = kuroImage.naturalWidth || 512;
            const sourceHeight = kuroImage.naturalHeight || 512;
            const runnerHeight = rs(96);
            const runnerWidth = runnerHeight * (sourceWidth / sourceHeight);
            const runBob = (state === 'running' || state === 'crossing' || state === 'advancing' || state === 'building' || state === 'transition_out' || state === 'transition_in')
                ? Math.sin(frame * 0.22) * rs(2)
                : 0;

            ctx.translate(x, y + runBob);

            if (state === 'falling') {
                ctx.translate(0, rs(-10));
                ctx.rotate(frame * 0.1);
            }

            ctx.drawImage(kuroImage, -runnerWidth * 0.5, -runnerHeight + rs(29), runnerWidth, runnerHeight);
            ctx.restore();
            return;
        }
        
        ctx.translate(x, y);
        
        if (state === 'falling') {
            ctx.translate(0, rs(-10));
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
            ctx.font = 'bold 9px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif';
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
        if (!bridgeKind || dogState === 'recovering' || dogState === 'shaking') return;

        const bridgeDrawX = getBridgeDrawX();
        const bridgeDrawWidth = getBridgeDrawWidth();
        const bridgeHeight = getBridgeHeight();

        ctx.save();

        if (bridgeKind === 'golden') {
            drawGoldenAnswerBridge(bridgeDrawX, bridgeDrawWidth);
            ctx.restore();
            return;
        }

        // Reveal the wooden bridge left to right while it is being built
        if (bridgeBuildProgress < 1) {
            ctx.beginPath();
            ctx.rect(bridgeDrawX - rs(2), 0, bridgeDrawWidth * bridgeBuildProgress + rs(2), canvasHeight);
            ctx.clip();
        }

        if (bridgeKind === 'broken' && isImageReady(runnerAssets.brokenBridge) && isImageReady(runnerAssets.bridge)) {
            const bridgeScale = bridgeDrawWidth / runnerAssets.bridge.naturalWidth;
            const brokenBridgeWidth = runnerAssets.brokenBridge.naturalWidth * bridgeScale;
            ctx.drawImage(runnerAssets.brokenBridge, bridgeDrawX, groundY - rs(2), brokenBridgeWidth, bridgeHeight);
        } else if (bridgeKind === 'wood' && isImageReady(runnerAssets.bridge)) {
            ctx.drawImage(runnerAssets.bridge, bridgeDrawX, groundY - rs(2), bridgeDrawWidth, bridgeHeight);
        } else {
            // Fallback plank bridge if images are not ready
            const plankCount = 8;
            const plankWidth = (bridgeKind === 'broken' ? bridgeDrawWidth / 2 : bridgeDrawWidth) / plankCount;
            ctx.fillStyle = '#8B5A2B';
            ctx.strokeStyle = '#5c3a1a';
            ctx.lineWidth = rs(2);
            for (let i = 0; i < plankCount; i++) {
                ctx.beginPath();
                ctx.roundRect(bridgeDrawX + i * plankWidth + rs(1), groundY + rs(2), plankWidth - rs(2), rs(12), rs(3));
                ctx.fill();
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // Bo-Gong's bridge: golden planks showing the correct answer, laid one character at a time
    function drawGoldenAnswerBridge(bridgeDrawX, bridgeDrawWidth) {
        const chars = bridgeChars.length > 0 ? bridgeChars : [''];
        const plankWidth = bridgeDrawWidth / chars.length;
        const plankHeight = rs(24);
        const plankY = groundY - rs(6);
        const visibleCount = Math.ceil(bridgeBuildProgress * chars.length);
        const fontSize = Math.min(rs(17), plankWidth * 0.62);

        ctx.shadowColor = 'rgba(255, 200, 60, .9)';
        ctx.shadowBlur = rs(12);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${fontSize}px "GenSekiGothic2TW", "GenSekiGothic TW", "GenSekiGothic", "GenSeki Gothic", "Noto Sans TC", "Microsoft JhengHei", sans-serif`;

        for (let i = 0; i < visibleCount; i++) {
            const x = bridgeDrawX + i * plankWidth;
            ctx.globalAlpha = bridgeAlpha + 0.2;
            ctx.fillStyle = 'rgba(255, 236, 160, .92)';
            ctx.strokeStyle = 'rgba(214, 155, 53, 1)';
            ctx.lineWidth = rs(2);
            ctx.beginPath();
            ctx.roundRect(x + rs(1), plankY, plankWidth - rs(2), plankHeight, rs(5));
            ctx.fill();
            ctx.stroke();

            ctx.globalAlpha = 1;
            ctx.fillStyle = '#6b3d0a';
            ctx.fillText(chars[i], x + plankWidth / 2, plankY + plankHeight / 2 + rs(1));
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
                vx: (Math.random() - 0.5) * rs(6),
                vy: -Math.random() * rs(8) - rs(4),
                size: rs(2) + Math.random() * rs(5),
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
            p.vy += rs(0.45); // gravity
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

























